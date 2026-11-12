---
title: "Caching"
summary: "Keep copies of slow data close by: cache-aside, expiry, eviction, stampedes and where caches sit."
---

## The idea

You keep a water bottle on your desk instead of walking to the kitchen each time you are thirsty. The kitchen has all the water, but the bottle is closer, so it is faster. It is also small: when it is full of old water you pour it out and refill.

A **cache** is a small, fast store that keeps copies of data that is slow to get. The slow place (the **source of truth**) might be a database or a server on another continent. The fast place is usually memory. In "Latency, throughput & the numbers that matter" you saw that memory is thousands of times faster than a network trip, and that gap is what a cache uses. Every **hit** (answer found in the cache) is also a request the database never had to handle.

The price: the copy can go out of date, so you must decide when to throw it away.

```check
{"prompt": "What is the main trade-off of using a cache?", "options": ["It is slower but always accurate", "It is faster, but the copy can be stale", "It stores more data than the database"], "answer": 1, "explanation": "A cache holds a copy for speed. If the original changes, the copy may be out of date until it expires or is removed. That is why invalidation is the hard part."}
```

## See it work

The most common recipe is **cache-aside**: the app checks the cache first, and only on a **miss** (not found) asks the database, then saves the answer in the cache. Here the cache holds at most 2 entries.

```steps
{"title": "Cache-aside with a 2-entry cache", "frames": [
  {"visual": "request   cache        database\n----------------------------------\nget A     [ . . ]      A B C\n", "caption": "Empty cache. The app is asked for item A."},
  {"visual": "request   cache        database\n----------------------------------\nget A     [ . . ]      A B C\nMISS      look up A  ->  A\n", "caption": "**Miss.** A is not cached, so the app goes to the slow database."},
  {"visual": "request   cache        database\n----------------------------------\nget A     [ A . ]      A B C\nstored A in the cache\n", "caption": "The app saves A in the cache before replying."},
  {"visual": "request   cache        database\n----------------------------------\nget A     [ A . ]      A B C\nHIT       answered from cache, DB untouched\n", "caption": "**Hit.** The second request for A never reaches the database."},
  {"visual": "request   cache        database\n----------------------------------\nget B     [ A B ]      A B C\nMISS      loaded B, cache is now full\n", "caption": "B misses, is loaded and stored. The cache is full."},
  {"visual": "request   cache        database\n----------------------------------\nget C     [ B C ]      A B C\nMISS      loaded C, A evicted (oldest use)\n", "caption": "No room for C, so the cache **evicts** A, the entry used longest ago. This policy is called LRU (least recently used)."}
]}
```

## How it works

**Expiry (TTL).** TTL means *time to live*: each entry is deleted after, say, 60 seconds. It guarantees a stale copy cannot live forever. Put a TTL on everything.

**Eviction.** A cache has limited room. When full, it drops something. LRU is the usual choice.

**Writes: invalidate, don't update.** When data changes, update the database, then **delete** the cache key. The next read refills it. If you write the new value into the cache instead, two concurrent writers can interleave so the older value lands last and stays until the TTL. A small race remains (a slow reader repopulating the old value); a short TTL closes it.

```reveal
{"prompt": "Before you look: a writer deletes the cache key first and updates the database second. A reader arrives between those two steps. What does the cache hold afterwards?", "answer": "The reader misses, reads the **old** value from the database, and puts it in the cache. Then the write finishes, so the cache holds stale data until the TTL. That is why the order is: **update the DB, then delete the key.**"}
```

Here is cache-aside in C# with .NET's in-process `IMemoryCache`:

```csharp
public async Task<Product?> GetAsync(int id)
{
    if (cache.TryGetValue(id, out Product? p)) return p;   // hit
    p = await db.Products.FindAsync(id);                   // miss
    if (p is not null)
        cache.Set(id, p, TimeSpan.FromSeconds(60));        // TTL
    return p;
}
```

## Where you'll meet it

Caches stack in layers: browser, then a **CDN** (servers near users that cache files), a reverse proxy, an in-memory cache inside your app (`IMemoryCache`), a shared cache such as Redis (needed when many app servers must see the same entries, the "stateless servers" idea from the load-balancing lesson), and finally the database's own buffer pool. Each layer needs its own expiry story. Azure Cache for Redis is the managed Redis on Azure, and HTTP `Cache-Control` headers control browser caching. In interviews, "add a cache in front of the database" is the standard answer to a read-heavy system.

## Failure modes

When a hot key expires, thousands of requests can miss at once and hit the database together. This is a **stampede** (thundering herd).

```steps
{"title": "A stampede when a hot key expires", "frames": [
  {"visual": "cache: [ hot ]   requests: > > > > >   DB: idle\n", "caption": "The hot key is cached. All requests are hits and the database is quiet."},
  {"visual": "cache: [     ]   requests: > > > > >   DB: idle\n", "caption": "The TTL ends. The entry disappears."},
  {"visual": "cache: [     ]   requests: x x x x x   DB: 5 hits!\n", "caption": "Five requests miss at the same moment and all ask the database for the same value."},
  {"visual": "cache: [     ]   requests: x w w w w   DB: 1 query\n", "caption": "Fix: **single-flight**. One request (x) recomputes; the others (w) wait for it."},
  {"visual": "cache: [ hot ]   requests: > > > > >   DB: idle\n", "caption": "The value is back in the cache. Jittered TTLs (a little random spread) also stop many keys expiring together."}
]}
```

Another failure is **penetration**: requests for keys that never exist always miss, so each reaches the database. Cache the not-found result briefly, or use a Bloom filter (a compact structure that says "definitely not present"). Check whether the missing keys *exist*: random non-existent ids mean penetration, not a stampede.

## Common mistakes

- No TTL, so stale data lives forever.
- Caching per-user data in a shared layer without the user id in the key, which leaks one user's data to another.
- Writing the value into the cache on update instead of deleting the key.
- Never measuring the **hit ratio** (hits divided by all lookups). A cache that rarely hits is just extra latency.

```check
{"prompt": "A hot product page's cache entry expires and 5,000 requests hit the database in the same second. What helps most?", "options": ["Let one request rebuild the value while the others wait or get the stale copy", "Make the cache bigger", "Remove the TTL from every key"], "answer": 0, "explanation": "The problem is many callers rebuilding the same value at once. Coalescing (or serving stale while one refreshes) turns 5,000 database hits into one. A bigger cache does not change when the key expires."}
```

## Recap

- A **cache** is a fast copy of slow data; a hit skips the source, a miss loads and stores it.
- **Cache-aside**: check the cache, on miss read the DB and fill the cache.
- **TTL** limits staleness; **eviction** (LRU) handles a full cache.
- On writes, update the DB, then **delete** the key.
- Guard against **stampedes** (single-flight, jittered TTLs) and **penetration** (cache not-found).
