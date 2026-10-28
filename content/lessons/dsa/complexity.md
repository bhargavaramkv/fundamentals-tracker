---
title: "Complexity & amortized analysis"
summary: "Big-O you can defend in an interview, including amortized and recurrence reasoning."
---

## What interviewers actually probe

- **Worst vs average vs amortized.** A hash lookup is O(1) *average* and O(n) worst. `List<T>.Add` is O(1) *amortized*: an occasional O(n) resize, paid for by the cheap appends around it.
- **Space counts too.** Recursion depth is stack space, so a recursive DFS on a 10⁶-node linked structure can overflow.

## Amortized: the doubling argument

Resizes happen at sizes 1, 2, 4, …, n. Copy work = 1 + 2 + 4 + … + n < 2n, which is O(1) per append. If you grow by a **constant amount** instead (+10), the total becomes O(n²).

## Recurrences you should know cold

| Recurrence | Result | Example |
|---|---|---|
| T(n) = T(n/2) + O(1) | O(log n) | binary search |
| T(n) = 2T(n/2) + O(n) | O(n log n) | merge sort |
| T(n) = 2T(n/2) + O(n log n) | O(n log² n) | naive divide & conquer with sort per level |
| T(n) = T(n−1) + O(n) | O(n²) | quicksort worst case |

## Surprising linear-time results

- **Bottom-up heapify** is O(n): most nodes are near the leaves and barely move.
- **Quickselect** (k-th smallest) is O(n) average.

## Practical checklist

1. State n (and m for graphs).
2. Count the work per element, times how often it is touched.
3. Mention hidden costs: string concatenation in loops, LINQ `.Count()` on `IEnumerable`, `Array.includes` inside a loop.
