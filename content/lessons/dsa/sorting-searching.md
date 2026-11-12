---
title: "Sorting & binary search"
summary: "Putting items in order, and why sorted data lets you find things by halving the search."
---

## The idea

Think about a dictionary. You do not read it from page one to find "mango". You open it near the middle, see you landed on "L", and know "mango" is later. You jump to the middle of the later half, and so on. Within a few jumps you are there.

That only works because the words are **sorted**: arranged in order. **Sorting** puts items in order. **Searching** finds an item. Sorting first can make searching dramatically faster.

Repeatedly cutting the search area in half is called **binary search**. It is the O(log n) idea from *Big-O, from scratch*.

## See it work

Find 23 in this sorted array. Keep two markers, `low` (L) and `high` (H), around the part still possible, and look at the middle (M).

```steps
{"title":"Binary search for 23","frames":[{"visual":"index: 0   1   2   3   4   5   6\nvalue: 4   8   15  16  23  42  50\n       L           M           H","caption":"Whole array in play. The middle is index 3, value 16."},{"visual":"index: 0   1   2   3   4   5   6\nvalue: --  --  --  --  23  42  50\n                       L   M   H","caption":"16 is smaller than 23, so 23 must be to the right. Everything left of the middle is thrown away. New middle: 42."},{"visual":"index: 0   1   2   3   4   5   6\nvalue: --  --  --  --  23  --  --\n                       LMH","caption":"42 is bigger than 23, so H moves left of the middle. One item remains and it is the middle."},{"visual":"index: 0   1   2   3   4   5   6\nvalue: --  --  --  --  23  --  --\n                       ^ found","caption":"The middle is 23: found at index 4. Three looks instead of up to seven. For a million items, at most about 20."}]}
```

```csharp
int BinarySearch(int[] a, int target) {
    int low = 0, high = a.Length - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;   // not found
}
```

```check
{"prompt": "About how many looks does binary search need on a sorted array of 1,000,000 items, at most?", "options": ["About 20", "About 1,000", "About 500,000", "About 1,000,000"], "answer": 0, "explanation": "Each look halves the remaining range. You can halve a million about 20 times before one item is left, so the cost is O(log n)."}
```

## Why it needs sorted data

If the array is jumbled, "the target is bigger than the middle" says nothing about which side holds it. Each loop turns "is it here?" into "which half?", so the work is O(log n). A **linear search**, which checks every item, is O(n).

```reveal
{"prompt": "Spot the bug: in the loop above, the author writes low = mid; instead of low = mid + 1;. Search for 2 in { 1, 2 }. What happens?", "answer": "low = 0, high = 1, mid = 0. `a[0]` is 1, smaller than 2, so `low = mid` leaves low at 0. Nothing changed, so the loop **runs forever**. Moving past `mid` (we already looked at it) guarantees the range shrinks."}
```

## Sorting itself

The simplest method is **selection sort**: find the smallest item, put it first, then repeat on the rest.

```csharp
for (int i = 0; i < a.Length - 1; i++) {
    int m = i;
    for (int j = i + 1; j < a.Length; j++)
        if (a[j] < a[m]) m = j;
    (a[i], a[m]) = (a[m], a[i]);   // swap
}
```

For `[3, 1, 2]`: the smallest is 1, swap with 3 to get `[1, 3, 2]`. Of the rest the smallest is 2, swap to get `[1, 2, 3]`. A loop inside a loop makes it **O(n²)**: fine for 100 items, painful for a million.

Better sorts are **O(n log n)**. **Merge sort** splits the array in half, sorts each half by recursion (see *Recursion*), then **merges** two sorted halves by repeatedly taking the smaller front item:

```
[1, 4] + [2, 3]  ->  take 1, take 2, take 3, take 4  ->  [1, 2, 3, 4]
```

Halving gives about log n levels, each doing about n work to merge: n log n in total. **Quicksort** picks a pivot, moves smaller items left and bigger right, then recurses; it is O(n log n) on average. In real C# you write `Array.Sort(a)`.

```check
{"prompt": "You must find many values in the same big list. What is a sensible plan?", "options": ["Linear search each time", "Sort once, then binary search each time", "Binary search without sorting", "Selection sort before each search"], "answer": 1, "explanation": "Sorting costs O(n log n) once, and then every search costs only O(log n). Binary search on unsorted data gives wrong answers, and re-sorting each time wastes the savings."}
```

## Where you'll meet it

- **Database indexes** are sorted structures, so lookups avoid scanning every row.
- **"Sort by price"** buttons and autocomplete rely on sorting.
- **`git bisect`** is binary search over commits to find which one broke something.
- Interviews: search in a rotated array, merge intervals, "kth largest", first bad version.

## Common mistakes

- **Binary searching unsorted data.** The result is meaningless.
- **`mid = (low + high) / 2`.** On huge arrays the sum can overflow an int. Use `low + (high - low) / 2`.
- **Forgetting stability.** A *stable* sort keeps equal items in their original order. `Array.Sort` is not stable; LINQ `OrderBy` is.

## Recap

- **Sorting** arranges items in order; good general sorts take O(n log n), simple ones O(n²).
- **Binary search** halves the range each step: O(log n), but only on sorted data.
- Sort once, then search many times.
- Use `low + (high - low) / 2` and move past `mid`.
- Merge sort and quicksort are built on recursion.
