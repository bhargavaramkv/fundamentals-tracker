---
title: "Hashing & hash maps"
summary: "How hash tables really behave, the Equals/GetHashCode contract, and prefix-sum tricks."
---

## The idea

Think of a coat check. You hand over your coat and get a numbered ticket. Later, you show the ticket and the attendant goes straight to that hook. They never search the whole room.

A **hash table** works like that. You give it a **key** (such as a name) and a **value** (such as a phone number). A **hash function** turns the key into a number, and that number says which slot in an array to use. You met arrays in *Arrays & strings*: jumping to a slot by number is O(1), which is why lookups are so quick compared with scanning a list, as described in *Big-O, from scratch*.

Sometimes two keys get the same number. That is a **collision**, like two coats sharing a hook. The table needs a plan for it, and the rest of this lesson covers how real tables cope.

```check
{"prompt": "What does a hash function do in a hash table?", "options": ["Sorts the keys alphabetically", "Turns a key into a number that picks a slot", "Encrypts the values", "Counts how many keys exist"], "answer": 1, "explanation": "The hash function maps a key to an integer, which is reduced to an array index. That lets the table jump straight to the likely slot instead of searching."}
```

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

```check
{"prompt": "You scan an array and want to know whether target - x was already seen. Which structure makes each check about O(1)?", "options": ["A sorted list with linear search", "A hash set or dictionary", "A linked list", "A queue"], "answer": 1, "explanation": "A hash set answers 'have I seen this value?' in O(1) on average. A list or queue would need an O(n) scan each time, making the whole two-sum approach O(n²)."}
```

## Worst case

If every key collides, lookup is O(n). Runtimes defend against hash flooding with randomized string hashing (.NET) and treeified buckets (Java 8+).
