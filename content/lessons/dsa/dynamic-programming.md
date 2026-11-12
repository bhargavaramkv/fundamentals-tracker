---
title: "Dynamic programming"
summary: "Recursion plus a notebook: recognize when answers repeat, define the state clearly, and fill a table."
---

## The idea

Imagine climbing stairs, taking one or two steps at a time, and asking how many different ways reach step 10. To land on step 10 you came from step 9 or step 8. So ways(10) = ways(9) + ways(8). The same smaller questions keep coming back.

Plain *Recursion* answers ways(8) again and again, wasting time. **Dynamic programming** (DP) fixes that: solve each small question once, write the answer down, and reuse it. It is recursion plus a notebook. The notebook is often an array (see *Arrays & strings*), and it typically turns exponential time into polynomial time (see *Big-O, from scratch*).

```check
{"prompt": "What is the core trick of dynamic programming?", "options": ["Sort the input first", "Store the answer to each subproblem so it is computed only once", "Always pick the locally best choice", "Use more loops instead of functions"], "answer": 1, "explanation": "DP works when the same subproblems repeat. Saving each result (memoization or a table) means every subproblem is solved a single time instead of exponentially often."}
```

## See it work: stairs with a notebook

```csharp
long Ways(int n, Dictionary<int, long> memo) {
    if (n <= 1) return 1;                       // base cases
    if (memo.TryGetValue(n, out long v)) return v;   // seen it
    return memo[n] = Ways(n - 1, memo) + Ways(n - 2, memo);
}
```

Saving results in a dictionary like this is called **memoization**. The first time `Ways(n)` runs it does the work; every later call just reads the notebook.

```reveal
{"prompt": "Without the memo, Ways(50) makes about 40 billion calls. With the memo, how many times does the body actually compute a value?", "answer": "**About 50 times**, once for each n from 2 to 50. Every other call returns instantly from the dictionary. The time drops from exponential to **O(n)**."}
```

## The recipe

1. **State:** what does `dp[i]` (or `dp[i][j]`) mean, in one sentence?
2. **Transition:** how does a state depend on smaller ones?
3. **Base cases:** the answers you know without thinking.
4. **Order:** top-down with memoization (above), or bottom-up by filling a table from the smallest state up.
5. **Space:** often only the previous row or a couple of values are needed.

For the stairs: `dp[i]` is the number of distinct ways to reach step i, and `dp[i] = dp[i-1] + dp[i-2]`.

```check
{"prompt": "For climbing stairs with steps of 1 or 2, what is a good definition of dp[i]?", "options": ["The number of stairs in the building", "The number of distinct ways to reach step i", "The largest step size", "Whether step i exists"], "answer": 1, "explanation": "A clear one-sentence state makes the transition obvious: dp[i] = dp[i-1] + dp[i-2], because you arrive from one step or two steps below."}
```

## Filling a table: coin change

You have coins of value 1, 3 and 4. What is the fewest coins that make 6? Let `dp[a]` be the fewest coins for amount `a`. To make `a`, the last coin is some `c`, so `dp[a] = 1 + min(dp[a - c])` over the coins that fit. Fill the table left to right:

```steps
{"title":"Fewest coins for each amount","frames":[{"visual":"coins 1, 3, 4   target 6\n\namount:  0  1  2  3  4  5  6\ndp:      0  .  .  .  .  .  .\n\ndp[0] = 0 (zero coins make 0)","caption":"Base case: making 0 takes 0 coins. Everything else is unknown (.)."},{"visual":"coins 1, 3, 4   target 6\n\namount:  0  1  2  3  4  5  6\ndp:      0  1  2  .  .  .  .\n\ndp[1] = dp[0]+1 = 1;  dp[2] = dp[1]+1 = 2","caption":"1 and 2 can only use the 1 coin: 1 coin, then 2 coins."},{"visual":"coins 1, 3, 4   target 6\n\namount:  0  1  2  3  4  5  6\ndp:      0  1  2  1  .  .  .\n\ndp[3] = min(dp[2]+1, dp[0]+1) = 1","caption":"For 3: use a 1 on top of dp[2] (3 coins total) or a 3 on top of dp[0] (1 coin). The 3 coin wins."},{"visual":"coins 1, 3, 4   target 6\n\namount:  0  1  2  3  4  5  6\ndp:      0  1  2  1  1  .  .\n\ndp[4] = min(dp[3]+1, dp[1]+1, dp[0]+1) = 1","caption":"For 4: the 4 coin on top of dp[0] gives 1 coin."},{"visual":"coins 1, 3, 4   target 6\n\namount:  0  1  2  3  4  5  6\ndp:      0  1  2  1  1  2  .\n\ndp[5] = min(dp[4]+1, dp[2]+1, dp[1]+1) = 2","caption":"For 5: best is 4 + 1, two coins."},{"visual":"coins 1, 3, 4   target 6\n\namount:  0  1  2  3  4  5  6\ndp:      0  1  2  1  1  2  2\n\ndp[6] = min(dp[5]+1, dp[3]+1, dp[2]+1) = 2","caption":"For 6: a 3 on top of dp[3] gives 2 coins (3 + 3). Each cell reused earlier cells, none was recomputed."}]}
```

```csharp
int MinCoins(int[] coins, int amount) {
    var dp = new int[amount + 1];
    Array.Fill(dp, int.MaxValue);
    dp[0] = 0;
    for (int a = 1; a <= amount; a++)
        foreach (int c in coins)
            if (c <= a && dp[a - c] != int.MaxValue)
                dp[a] = Math.Min(dp[a], dp[a - c] + 1);
    return dp[amount] == int.MaxValue ? -1 : dp[amount];
}
```

The cost is amount × number of coins.

```reveal
{"prompt": "With coins 1, 3, 4 and amount 6, a greedy shopper always takes the biggest coin that fits. How many coins does greedy use, and what does DP find?", "answer": "Greedy takes 4, then 1, then 1: **3 coins**. DP finds 3 + 3: **2 coins**. Greedy only works for special coin systems like 1, 5, 10, 25; DP works for any."}
```

## Where you'll meet it

DP applies when there is **optimal substructure** (the answer is built from sub-answers) and **overlapping subproblems** (the same sub-answers repeat). If subproblems don't overlap, it is plain divide and conquer.

| Problem | State | Time |
|---|---|---|
| Coin change (fewest coins) | `dp[amount]` | O(amount × coins) |
| 0/1 knapsack | `dp[item][capacity]` | O(items × capacity) |
| Edit distance | `dp[i][j]` over two prefixes | O(m × n) |
| Longest common subsequence | `dp[i][j]` | O(m × n) |
| Longest increasing subsequence | `dp[i]`, or a tails array | O(n²), or O(n log n) |

In real work you meet it in diff tools (edit distance and common subsequence), spell-checkers, route and scheduling optimisers, and in a large share of interview questions.

## Common mistakes

- **Vague state.** If you can't say what `dp[i]` means in one sentence, the transition will be wrong.
- **Recursion without memoization.** Still exponential.
- **Forgetting base cases**, or filling the table in an order where a needed cell is empty.
- **Reaching for greedy** when a counter-example like coins 1, 3, 4 exists.

## Recap

- DP = recursion + a notebook: solve each subproblem once and reuse it.
- It fits when the same sub-answers repeat and the answer is built from them.
- Recipe: state, transition, base cases, order, then trim the space.
- Memoization is top-down; a table filled in order is bottom-up.
- Greedy is not a substitute; check with small counter-examples.
