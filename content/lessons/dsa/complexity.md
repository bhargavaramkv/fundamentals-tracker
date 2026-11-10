---
title: "Complexity & amortized analysis"
summary: "Big-O you can defend in an interview, including amortized and recurrence reasoning."
---

## The idea

You met Big-O in *Big-O, from scratch*: a label for how work grows as the input grows. This lesson goes one level deeper. Real code is rarely "always the same speed". A hash lookup is usually instant but occasionally slow. An append is usually cheap but sometimes copies everything.

Think of a bus ride. Most stops take seconds, but now and then the bus stops for a long break. If you ask "how long does a stop take?", the honest answer depends on whether you mean the worst stop, a typical stop, or the average over the whole trip. Complexity analysis gives each of those a name: **worst case**, **average case** and **amortized**. You will also learn to add up the cost of recursive code, which you first saw in *Recursion* and *Sorting & binary search*.

```check
{"prompt": "A bus makes 99 stops of 10 seconds and one stop of 5 minutes. Which idea describes the cost per stop averaged over the whole trip, even with the occasional long one?", "options": ["Amortized cost", "Worst case", "Best case", "Space complexity"], "answer": 0, "explanation": "Amortized cost spreads rare expensive operations over many cheap ones. Worst case would only describe the 5 minute stop, and best case only the quickest."}
```

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

```check
{"prompt": "A binary search halves the range each step and does O(1) other work. Which recurrence and result match it?", "options": ["T(n) = 2T(n/2) + O(n), O(n log n)", "T(n) = T(n/2) + O(1), O(log n)", "T(n) = T(n-1) + O(n), O(n²)", "T(n) = 2T(n/2) + O(1), O(n)"], "answer": 1, "explanation": "One subproblem of half the size plus constant work per level gives about log n levels of O(1) work, so O(log n)."}
```

## Surprising linear-time results

- **Bottom-up heapify** is O(n): most nodes are near the leaves and barely move.
- **Quickselect** (k-th smallest) is O(n) average.

## Practical checklist

1. State n (and m for graphs).
2. Count the work per element, times how often it is touched.
3. Mention hidden costs: string concatenation in loops, LINQ `.Count()` on `IEnumerable`, `Array.includes` inside a loop.
