---
title: "Complexity & amortized analysis"
summary: "Big-O you can defend in an interview: worst, average and amortized cost, and how to add up recursive code."
---

## The idea

You met Big-O in *Big-O, from scratch*: a label for how work grows as the input grows. This lesson goes one level deeper, because real code is rarely "always the same speed". A hash lookup is usually instant but occasionally slow. An append is usually cheap but sometimes copies everything.

Think of a bus ride. Most stops take seconds, but now and then the bus has a long break. "How long does a stop take?" has three honest answers:

- **Worst case**: the longest single stop.
- **Average case**: the typical stop, if you assume a typical mix of inputs.
- **Amortized**: the total time divided by the number of stops, over *any* sequence of stops. The rare long break is paid for by the many short ones.

```check
{"prompt": "A bus makes 99 stops of 10 seconds and one stop of 5 minutes. Which idea describes the cost per stop averaged over the whole trip, even with the occasional long one?", "options": ["Amortized cost", "Worst case", "Best case", "Space complexity"], "answer": 0, "explanation": "Amortized cost spreads rare expensive operations over many cheap ones. Worst case would only describe the 5 minute stop, and best case only the quickest."}
```

## See it work: a growing list

`List<T>` stores items in an array. When the array is full, `Add` makes a new array twice as big and copies every item across. That copy is the "long break". Here is a toy version that starts at capacity 1 (the real one starts at 4 but doubles the same way):

```steps
{"title":"Appending a..e to a doubling list","frames":[{"visual":"add a   room left, capacity 1\nslots:  [a]\ncopies this add: 0   total copies: 0","caption":"The array has one slot. No copying needed."},{"visual":"add b   full! capacity 1 -> 2\nslots:  [a][b]\ncopies this add: 1   total copies: 1","caption":"The array is full, so a bigger one is made and 1 item is copied across."},{"visual":"add c   full! capacity 2 -> 4\nslots:  [a][b][c][ ]\ncopies this add: 2   total copies: 3","caption":"The array is full, so a bigger one is made and 2 items are copied across."},{"visual":"add d   room left, capacity 4\nslots:  [a][b][c][d]\ncopies this add: 0   total copies: 3","caption":"There was a free slot, so this add is cheap: no copying."},{"visual":"add e   full! capacity 4 -> 8\nslots:  [a][b][c][d][e][ ][ ][ ]\ncopies this add: 4   total copies: 7","caption":"The array is full, so a bigger one is made and 4 items are copied across."}]}
```

After 5 adds there were 7 copies in total, less than 2 per add. Keep going and that stays true, which is why `Add` is **O(1) amortized**.

```reveal
{"prompt": "Suppose the list grew by a fixed 10 slots each time it filled up, instead of doubling. Is Add still O(1) amortized?", "answer": "No. Copies would cost 10, 20, 30, ... so the total for n adds is about n²/20, which is **O(n²)**, roughly O(n) per add. Growing by a *multiple* (doubling) is what makes it work."}
```

## Why doubling works

Resizes happen when the size is 1, 2, 4, ..., up to n. The copy work is 1 + 2 + 4 + ... + n, which is less than 2n. Spread over n adds, that is under 2 extra steps per add: O(1).

Amortized is a **guarantee** about any sequence of operations. **Average case** is different: it relies on assumptions about the input, such as keys spreading evenly in a hash table. A hash lookup is O(1) average and O(n) worst.

```reveal
{"prompt": "True or false: 'amortized O(1)' and 'average-case O(1)' mean the same thing.", "answer": "**False.** Amortized needs no assumptions about the data: over any sequence of n operations the total is O(n). Average case depends on a probability model, for example well-spread hash codes."}
```

## Adding up recursive code

A recursive function's time is written as a **recurrence**: T(n) is the time for input size n, expressed with smaller T's. Merge sort splits in half, sorts both halves, then merges in n steps:

T(n) = 2·T(n/2) + n

There are about log n levels of splitting, and every level does about n work in total, so T(n) = O(n log n). The ones to know:

| Recurrence | Result | Example |
|---|---|---|
| T(n) = T(n/2) + O(1) | O(log n) | binary search |
| T(n) = 2T(n/2) + O(n) | O(n log n) | merge sort |
| T(n) = T(n−1) + O(n) | O(n²) | quicksort worst case |
| T(n) = T(n−1) + O(1) | O(n) | simple recursion down a list |

```check
{"prompt": "A binary search halves the range each step and does O(1) other work. Which recurrence and result match it?", "options": ["T(n) = 2T(n/2) + O(n), O(n log n)", "T(n) = T(n/2) + O(1), O(log n)", "T(n) = T(n-1) + O(n), O(n²)", "T(n) = 2T(n/2) + O(1), O(n)"], "answer": 1, "explanation": "One subproblem of half the size plus constant work per level gives about log n levels of O(1) work, so O(log n)."}
```

## Where you'll meet it

- **Interviews**: after your solution, "what is the complexity, and is it worst or average?" Mention space too: recursion depth is stack space.
- **Surprising linear results**: building a heap bottom-up is O(n), and quickselect (k-th smallest) is O(n) on average.
- **Hidden costs in .NET**: `list.Contains` is O(n); string `+=` in a loop is O(n²); LINQ `Count()` on a plain `IEnumerable` walks the whole sequence.

A practical checklist: state n (and m for graphs), count the work per element, multiply by how often each is touched, then hunt for hidden loops.

## Common mistakes

- **Quoting the average when asked for worst case.** Say which one you mean.
- **Calling every occasional slow operation O(n).** Cheap steps pay for rare expensive ones.
- **Forgetting space.** Recursion of depth n uses O(n) stack, even if it allocates nothing else.

## Recap

- **Worst case**, **average case** and **amortized** answer different questions; name which one you mean.
- Doubling a growing array costs under 2 copies per add, so `List<T>.Add` is O(1) amortized.
- A **recurrence** adds up recursive code: levels times work per level.
- Splitting in half with O(n) work per level gives O(n log n).
- Check for hidden loops and for stack space.
