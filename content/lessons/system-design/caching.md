---
title: "Caching"
summary: "Cache-aside, invalidation ordering, stampedes, TTLs and where caches sit."
---

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
