---
title: "Dynamic programming"
summary: "Recognize DP, define state clearly, and know the classic complexities."
---

## Recognize it

DP applies when there is **optimal substructure** (the answer is built from sub-answers) and **overlapping subproblems** (the same sub-answers repeat). If the subproblems don't overlap, it's divide & conquer.

## A recipe that works under pressure

1. **State:** what does `dp[i]` (or `dp[i][j]`) mean, in one sentence?
2. **Transition:** how does a state depend on smaller ones?
3. **Base cases.**
4. **Order:** top-down memoization or a bottom-up table.
5. **Space:** often only the previous row or column is needed.

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
