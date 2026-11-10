---
title: "Sorting & binary search"
summary: "Putting items in order, and why sorted data lets you find things by halving the search."
---

## The idea

Think about a dictionary. You do not read it from page one to find "mango". You open it near the middle, see you landed on "L", and know "mango" is later. You jump to the middle of the later half, and so on. Within a few jumps you are there.

That only works because the words are **sorted**: arranged in order. **Sorting** puts items in order. **Searching** finds an item. Sorting first can make searching dramatically faster.

The trick of repeatedly cutting the search area in half is called **binary search**. It is a perfect use of the O(log n) idea from *Big-O, from scratch*.

## See it work

Find 23 in this sorted array:

```
index: 0  1  2  3   4   5   6
value: 4  8  15 16  23  42  50
```

Keep two markers, `low` and `high`, around the part still possible.

```
low=0 high=6 -> mid=3 -> 16 < 23, so look right: low=4
low=4 high=6 -> mid=5 -> 42 > 23, so look left: high=4
low=4 high=4 -> mid=4 -> 23 found at index 4
```

Three looks instead of up to seven. For a million items you need at most about 20 looks.

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

## How it works

**Binary search needs sorted data.** If the array is jumbled, "the target is bigger than the middle" tells you nothing about which side it is on.

Each loop turns the question "is it here?" into "which half?", so the work is O(log n). Compare with a **linear search**, which checks every item: O(n).

Now sorting itself. The simplest method is **selection sort**: find the smallest item, put it first, then repeat on the rest.

```csharp
for (int i = 0; i < a.Length - 1; i++) {
    int m = i;
    for (int j = i + 1; j < a.Length; j++)
        if (a[j] < a[m]) m = j;
    (a[i], a[m]) = (a[m], a[i]);   // swap
}
```

Trace `[3, 1, 2]`: the smallest is 1, swap with 3 to get `[1, 3, 2]`. Of the rest, the smallest is 2, swap to get `[1, 2, 3]`. Two loops inside each other make it **O(n²)**. That is fine for 100 items and painful for a million.

Better sorts are **O(n log n)**. **Merge sort** splits the array in half, sorts each half by recursion (see *Recursion*), then **merges** two sorted halves by repeatedly taking the smaller front item:

```
[1, 4] + [2, 3]  ->  take 1, take 2, take 3, take 4  ->  [1, 2, 3, 4]
```

Splitting gives about log n levels, and each level does about n work to merge, so n log n in total. **Quicksort** picks a pivot, moves smaller items left and bigger right, then recurses. It is O(n log n) on average.

In real C# code you would write `Array.Sort(a)`, which is O(n log n).

```check
{"prompt": "You must find many values in the same big list. What is a sensible plan?", "options": ["Linear search each time", "Sort once, then binary search each time", "Binary search without sorting", "Selection sort before each search"], "answer": 1, "explanation": "Sorting costs O(n log n) once, and then every search costs only O(log n). Binary search on unsorted data gives wrong answers, and re-sorting each time wastes the savings."}
```

## Where you'll meet it

- **Database indexes** are sorted structures so lookups avoid scanning every row.
- **Autocomplete and "sort by price"** buttons rely on sorting.
- **Version bisecting** (`git bisect`) is binary search over commits to find which one broke something.
- Interviews: search in a rotated array, merge intervals, "kth largest", first bad version.

## Common mistakes

- **Binary searching unsorted data.** The result is meaningless.
- **Computing mid as `(low + high) / 2`.** With huge arrays the sum can overflow an int. Use `low + (high - low) / 2`.
- **Infinite loops.** Setting `low = mid` instead of `mid + 1` can get stuck.
- **Forgetting stability.** A *stable* sort keeps equal items in their original order. `Array.Sort` is not stable; LINQ `OrderBy` is.

## Recap

- **Sorting** arranges items in order; the good general sorts take O(n log n), simple ones O(n²).
- **Binary search** halves the range each step: O(log n), but only on sorted data.
- Sort once, then search many times.
- Use `low + (high - low) / 2` and move past `mid` to avoid bugs.
- Merge sort and quicksort are built on recursion.
