---
title: "Caching"
summary: "Cache-aside, invalidation ordering, stampedes, TTLs and where caches sit."
---

## The idea

You keep a water bottle on your desk instead of walking to the kitchen each time you are thirsty. The kitchen has all the water, but the bottle is closer, so it is faster.

A **cache** is a small, fast store that keeps copies of data that is slow to get. The slow place might be a database or a server on another continent. In "Latency, throughput & the numbers that matter" you saw that memory is thousands of times faster than going over a network, and that is exactly the gap a cache uses. The price: the copy can go out of date, so you must decide when to throw it away. In "Clients & servers" terms, every cache hit is a request the server never had to handle.

```check
{"prompt": "What is the main trade-off of using a cache?", "options": ["It is slower but always accurate", "It is faster, but the copy can be stale", "It stores more data than the database"], "answer": 1, "explanation": "A cache holds a copy for speed. If the original changes, the copy may be out of date until it expires or is removed. That is why invalidation is the hard part."}
```

## Where caches live

Browser → CDN → reverse proxy → app in-memory (`IMemoryCache`) → distributed cache (Redis) → database buffer pool. Each layer needs its own invalidation story.

## Patterns

| Pattern | Read | Write |
|---|---|---|
| **Cache-aside** | app checks cache, on miss loads from DB and sets the cache | app writes DB, then **deletes** the key |
| Read-through | cache loads on miss by itself | — |
| Write-through | — | write goes to cache and DB synchronously |
| Write-behind | — | cache writes to DB asynchronously (risk of data loss) |

## Invalidation ordering under concurrency

**Update the DB, then delete the key.** If you *write* the new value to the cache instead, two concurrent writers can interleave so the older value lands last and stays until the TTL expires. A small race remains (a slow reader repopulating the old value). A short TTL or a delayed second delete closes it.

## Stampede (thundering herd)

When a hot key expires, N requests miss at once and hit the DB together. Mitigations:

- **Single-flight / request coalescing:** one request recomputes, the rest wait.
- **Stale-while-revalidate:** serve the stale value while one request refreshes it in the background.
- **Jittered TTLs**, so keys don't expire at the same moment.

## Other failure modes

- **Penetration:** repeated lookups for keys that don't exist. Cache the negative result or use a Bloom filter.
- **Hot key:** a single key overloads one Redis node. Replicate it locally (L1 cache) or shard the key.

## Rules of thumb

Put a TTL on everything. Cache **immutable or derived** data aggressively. Measure the hit ratio. Never cache per-user data at a shared layer without the user in the key.

## Stampede vs penetration

| Symptom | Name | Fix |
|---|---|---|
| One existing hot key expires, many requests hit the DB together | Stampede | Per-key lock or request coalescing, TTL jitter |
| Requests for ids that never exist always miss | Penetration | Briefly cache the not-found result, or a Bloom filter |

Check first whether the missing keys *exist*. Random non-existent ids point to penetration, not stampede.

```check
{"prompt": "A hot product page's cache entry expires and 5,000 requests hit the database in the same second. What helps most?", "options": ["Let one request rebuild the value while the others wait or get the stale copy", "Make the cache bigger", "Remove the TTL from every key"], "answer": 0, "explanation": "The problem is many callers rebuilding the same value at once. Coalescing (or serving stale while one refreshes) turns 5,000 database hits into one. A bigger cache does not change when the key expires."}
```

Write path: update the DB, then **delete** the key. Deleting first lets a concurrent reader refill the old value.
