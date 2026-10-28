---
title: "Hashing & hash maps"
summary: "How hash tables really behave, the Equals/GetHashCode contract, and prefix-sum tricks."
---

## Mechanics

A hash table maps `hash(key) → bucket`. Collisions are resolved by **chaining** (a list per bucket) or **open addressing** (probing). When the load factor passes a threshold (~0.75) the table resizes and rehashes, so inserts are amortized O(1).

## The equality contract (.NET / Java)

> If `a.Equals(b)`, then `a.GetHashCode() == b.GetHashCode()`.

Override one without the other and lookups silently miss. Prefer `record` types or `HashCode.Combine(...)`. **Never mutate a key** after inserting it: its bucket no longer matches.

In JS, `Map` keys compare by reference (SameValueZero), so `map.get({id: 1})` never hits. Use a string key such as `` `${a}:${b}` ``.

## Interview patterns

- **Two-sum / complements:** store what you have seen and look up `target − x`.
- **Prefix sums + hash:** subarray sum = k ⇔ `prefix[j] − prefix[i] = k`. Seed with `{0: 1}`. Works with negatives, unlike a sliding window.
- **Sliding window + last-seen index:** longest substring without repeats, in O(n).
- **Frequency maps:** anagrams, top-k (combine with a heap or bucket sort).

## Worst case

If every key collides, lookup is O(n). Runtimes defend against hash flooding with randomized string hashing (.NET) and treeified buckets (Java 8+).
