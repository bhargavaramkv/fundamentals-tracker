---
title: "Hashing & hash maps"
summary: "How hash tables work, why collisions happen, the Equals/GetHashCode contract, and the interview patterns built on them."
---

## The idea

Think of a coat check. You hand over your coat and get a numbered ticket. Later you show the ticket and the attendant goes straight to that hook. They never search the whole room.

A **hash table** works like that. You give it a **key** (such as a name) and a **value** (such as a phone number). A **hash function** turns the key into a number, and that number says which slot of an array, called a **bucket**, to use. Jumping to a slot by number is O(1) (see *Arrays & strings*), which is why lookups beat scanning a list (see *Big-O, from scratch*). In C# this is `Dictionary<TKey, TValue>` and `HashSet<T>`.

Sometimes two keys get the same bucket. That is a **collision**, like two coats sharing a hook. The table needs a plan, and the next step shows it.

```check
{"prompt": "What does a hash function do in a hash table?", "options": ["Sorts the keys alphabetically", "Turns a key into a number that picks a slot", "Encrypts the values", "Counts how many keys exist"], "answer": 1, "explanation": "The hash function maps a key to an integer, which is reduced to an array index. That lets the table jump straight to the likely slot instead of searching."}
```

## See it work: a collision

To keep numbers small, use a toy table with 4 buckets and the toy hash `key % 4` (the remainder after dividing by 4). Each bucket holds a short chain of entries, like a mini linked list (see *Linked lists*). This plan is called **chaining**.

```steps
{"title":"Inserting into a 4-bucket table (toy hash: key % 4)","frames":[{"visual":"insert 5:  5 % 4 = 1\n\nbucket 0:\nbucket 1: [5]\nbucket 2:\nbucket 3:\n\nchain length in bucket 1: 1","caption":"5 divided by 4 leaves remainder 1, so 5 goes to bucket 1."},{"visual":"insert 2:  2 % 4 = 2\n\nbucket 0:\nbucket 1: [5]\nbucket 2: [2]\nbucket 3:\n\nchain length in bucket 2: 1","caption":"2 % 4 = 2. A different bucket, no clash."},{"visual":"insert 9:  9 % 4 = 1  COLLISION\n\nbucket 0:\nbucket 1: [5] -> [9]\nbucket 2: [2]\nbucket 3:\n\nchain length in bucket 1: 2","caption":"9 % 4 = 1 too. Bucket 1 is taken, so 9 is chained after 5. Both keys live there."},{"visual":"find 9:    9 % 4 = 1, so look in bucket 1\n\nbucket 0:\nbucket 1: [5] -> [9]\nbucket 2: [2]\nbucket 3:\n\ncompare: 5? no.  9? yes -> found","caption":"Lookup hashes to bucket 1, then compares keys along the short chain: 5 is not 9, the next is. Two comparisons, not a scan of the whole table."}]}
```

## How it works

Every operation is: hash the key, jump to the bucket, then compare keys in that small chain. With few entries per bucket that is O(1) on average.

When the table gets too full, chains grow long. So it **resizes**: it makes a bigger bucket array and re-places every entry (**rehashing**). Resizing is rare and its cost is spread across many inserts, so inserting is O(1) amortized (see *Complexity & amortized analysis*). Java's `HashMap` resizes at 75% full; .NET's `Dictionary` grows when its entry storage is full.

If every key landed in one bucket, lookup would degrade to O(n). Good hash functions spread keys out, and .NET randomizes string hashes so attackers cannot craft such keys.

## The equality contract

> If `a.Equals(b)`, then `a.GetHashCode() == b.GetHashCode()`.

The table uses the hash to find the bucket and `Equals` to confirm the match. If two "equal" keys hash differently, they go to different buckets and lookups silently miss.

```csharp
class P { public int X, Y; }       // no Equals / GetHashCode
var set = new HashSet<P> { new P { X = 1, Y = 2 } };
Console.WriteLine(set.Contains(new P { X = 1, Y = 2 }));
```

```reveal
{"prompt": "What does the code above print, and how would you make it print True?", "answer": "**False.** A class uses reference equality by default, so the second `P` is a different object. Make it a `record` (or override `Equals` and `GetHashCode`, e.g. with `HashCode.Combine(X, Y)`) and it prints True."}
```

Also **never change a key** after inserting it: its hash changes, but the entry stays in its old bucket and becomes unfindable.

```check
{"prompt": "You override Equals on a key class but not GetHashCode. What is the likely result?", "options": ["Compile error", "Lookups with equal-but-different objects miss", "Dictionary becomes sorted", "Everything works as before"], "answer": 1, "explanation": "Two equal objects now usually get different default hash codes, so they land in different buckets and the table never compares them. Always override both together."}
```

## Where you'll meet it

- **Caches and lookups**: user by id, config by name, memoization tables.
- **Sets**: removing duplicates, "have I seen this before?".
- **Interview patterns**:
  - **Two-sum:** store each number seen, and for each `x` look up `target − x`.
  - **Frequency maps:** count letters for anagrams, or counts for top-k.
  - **Prefix sums + hash:** a subarray sum equals k when `prefix[j] − prefix[i] = k`. Seed the map with `{0: 1}`. It works with negative numbers, unlike a sliding window.
  - **Last-seen index:** longest substring without repeats, in O(n).

```reveal
{"prompt": "Count subarrays of {1, 2, 3} that sum to 3, using a prefix-sum map seeded with {0: 1}. How many, and which?", "answer": "**2**: {1, 2} and {3}. Prefix sums are 1, 3, 6. At prefix 3 we look for 3 − 3 = 0 (seeded, once) and at prefix 6 for 6 − 3 = 3 (seen once), giving 1 + 1 = 2."}
```

```check
{"prompt": "You scan an array and want to know whether target - x was already seen. Which structure makes each check about O(1)?", "options": ["A sorted list with linear search", "A hash set or dictionary", "A linked list", "A queue"], "answer": 1, "explanation": "A hash set answers 'have I seen this value?' in O(1) on average. A list or queue would need an O(n) scan each time, making the whole two-sum approach O(n²)."}
```

## Common mistakes

- **Overriding one of Equals/GetHashCode.** Override both, or use a `record`.
- **Mutating a key** after inserting it.
- **Assuming order.** A dictionary is not sorted and gives no promise about enumeration order.
- **Calling `list.Contains` in a loop** when a `HashSet` would make it O(1).

## Recap

- A **hash function** turns a key into a bucket number; lookups jump straight there.
- **Collisions** (two keys, one bucket) are handled by chaining; the table resizes as it fills.
- Insert and lookup are O(1) on average, O(n) in the worst case.
- Equal keys must have equal hash codes; never mutate a key.
- Hash maps power two-sum, frequency counts and prefix-sum tricks.
