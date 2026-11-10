---
title: "Dynamic programming"
summary: "Recognize DP, define state clearly, and know the classic complexities."
---

## The idea

Imagine you are climbing stairs and want to know how many different ways there are to reach step 10, taking one or two steps at a time. To get to step 10 you must come from step 9 or step 8. So ways(10) = ways(9) + ways(8). The same smaller questions keep coming back.

Plain *Recursion* would answer ways(8) again and again, wasting time. **Dynamic programming** (DP) fixes that: solve each small question once, write the answer down, and reuse it. It is recursion plus a notebook. The notebook is often an array (see *Arrays & strings*), and the savings are the kind of Big-O improvement described in *Big-O, from scratch*, often turning exponential time into polynomial time.

```check
{"prompt": "What is the core trick of dynamic programming?", "options": ["Sort the input first", "Store the answer to each subproblem so it is computed only once", "Always pick the locally best choice", "Use more loops instead of functions"], "answer": 1, "explanation": "DP works when the same subproblems repeat. Saving each result (memoization or a table) means every subproblem is solved a single time instead of exponentially often."}
```

## Recognize it

DP applies when there is **optimal substructure** (the answer is built from sub-answers) and **overlapping subproblems** (the same sub-answers repeat). If the subproblems don't overlap, it's divide & conquer.

## A recipe that works under pressure

1. **State:** what does `dp[i]` (or `dp[i][j]`) mean, in one sentence?
2. **Transition:** how does a state depend on smaller ones?
3. **Base cases.**
4. **Order:** top-down memoization or a bottom-up table.
5. **Space:** often only the previous row or column is needed.

```check
{"prompt": "For climbing stairs with steps of 1 or 2, what is a good definition of dp[i]?", "options": ["The number of stairs in the building", "The number of distinct ways to reach step i", "The largest step size", "Whether step i exists"], "answer": 1, "explanation": "A clear one-sentence state makes the transition obvious: dp[i] = dp[i-1] + dp[i-2], because you arrive from one step or two steps below."}
```

## Classics and their costs

| Problem | State | Time |
|---|---|---|
| Coin change (min coins) | dp[amount] | O(n·A) (pseudo-polynomial) |
| 0/1 knapsack | dp[item][capacity] | O(n·W) |
| Edit distance | dp[i][j] over prefixes | O(m·n) |
| LIS | tails[] + binary search | **O(n log n)** |
| Longest common subsequence | dp[i][j] | O(m·n) |

## LIS in O(n log n)

`tails[k]` holds the smallest possible tail of an increasing subsequence of length k+1. For each x, binary-search the first tail ≥ x and replace it (or append x). The length of `tails` is the answer. `tails` itself is *not* the subsequence.

## Pitfalls

- Greedy works for canonical coin systems (1, 5, 10, 25) but not in general (1, 3, 4 → amount 6).
- Recursion without memoization is exponential.
