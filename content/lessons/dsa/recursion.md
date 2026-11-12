---
title: "Recursion"
summary: "Solving a problem by having a function call itself on a smaller version of the same problem."
---

## The idea

Imagine you are in a long queue and want to know your position. You cannot see the front. So you tap the person ahead and ask, "What is your position?" They tap the person ahead of them and ask the same thing. This continues until the person at the front says, "I'm number 1." Then each person adds one to the answer they heard and passes it back.

That is **recursion**: a function solves a problem by calling **itself** on a smaller piece of the same problem, then uses that answer to build its own.

Every recursion needs two parts:

- A **base case**: the smallest problem, answered directly (the person at the front).
- A **recursive case**: shrink the problem and call yourself (ask the person ahead).

Without a base case, the calls never stop.

## See it work

The **factorial** of n, written n!, is n × (n-1) × ... × 1. So 4! = 4 × 3 × 2 × 1 = 24. Notice 4! = 4 × 3!: the big problem contains a smaller copy of itself.

```csharp
int Factorial(int n) {
    if (n <= 1) return 1;          // base case
    return n * Factorial(n - 1);   // recursive case
}
```

```check
{"prompt": "What does Factorial(4) return with the code above?", "options": ["10", "24", "12", "16"], "answer": 1, "explanation": "Factorial(4) = 4 * Factorial(3) = 4 * 3 * Factorial(2) = 4 * 3 * 2 * Factorial(1) = 4 * 3 * 2 * 1 = 24."}
```

## The call stack

Each time a function is called, the computer creates a **frame**: a small block of memory holding that call's variables and where to return to. Frames pile up on the **call stack**, the last-in-first-out idea from *Stacks & queues*. The newest call is on top and must finish first. Watch `Factorial(3)`:

```steps
{"title": "Call stack for Factorial(3)", "frames": [
  {"visual": "+--------------------------------+\n|                                |\n|                                |\n| Factorial(3)  n=3  running     |  <- top\n+--------------------------------+", "caption": "Factorial(3) starts. It needs Factorial(2) before it can multiply."},
  {"visual": "+--------------------------------+\n|                                |\n| Factorial(2)  n=2  running     |  <- top\n| Factorial(3)  n=3  waiting     |\n+--------------------------------+", "caption": "A new frame lands on top. Factorial(3) waits underneath."},
  {"visual": "+--------------------------------+\n| Factorial(1)  n=1  running     |  <- top\n| Factorial(2)  n=2  waiting     |\n| Factorial(3)  n=3  waiting     |\n+--------------------------------+", "caption": "Three frames deep. n is 1, the base case, so no more calls."},
  {"visual": "+--------------------------------+\n| Factorial(1)  n=1  returns 1   |  <- top\n| Factorial(2)  n=2  waiting     |\n| Factorial(3)  n=3  waiting     |\n+--------------------------------+", "caption": "The base case returns 1 straight away."},
  {"visual": "+--------------------------------+\n|                                |\n| Factorial(2)  n=2  returns 2   |  <- top\n| Factorial(3)  n=3  waiting     |\n+--------------------------------+", "caption": "Its frame is popped. Factorial(2) computes 2 * 1 = 2 and returns."},
  {"visual": "+--------------------------------+\n|                                |\n|                                |\n| Factorial(3)  n=3  returns 6   |  <- top\n+--------------------------------+", "caption": "Factorial(3) computes 3 * 2 = 6. The stack grew down to the base case, then the answers flowed back up."}
]}
```

A very deep recursion needs very many frames, and the stack has limited size. Too deep gives a **stack overflow**, which crashes a .NET program (it cannot be caught).

```reveal
{"prompt": "Spot the bug: int Factorial(int n) { return n * Factorial(n - 1); }  What happens when you call Factorial(3)?", "answer": "There is **no base case**. It calls Factorial(2), Factorial(1), Factorial(0), Factorial(-1) and never stops, until the call stack is full and the process dies with a stack overflow."}
```

```check
{"prompt": "What happens if a recursive function has no base case?", "options": ["It returns 0", "It calls itself until the call stack overflows", "It runs once and stops", "It loops without using memory"], "answer": 1, "explanation": "Every call creates a new frame on the call stack. With no base case the calls never stop, the stack fills up, and the program crashes with a stack overflow."}
```

## Writing your own

Reverse a string by taking the first character off and reversing the rest:

```csharp
string Reverse(string s) {
    if (s.Length <= 1) return s;
    return Reverse(s.Substring(1)) + s[0];
}
```

`Reverse("abc")` = `Reverse("bc") + 'a'` = `(Reverse("c") + 'b') + 'a'` = `"cba"`.

Ask three questions about any recursive function:

1. What is the base case, and does it return directly?
2. Does each call move **closer** to the base case?
3. If I trust the smaller call to be correct, is my answer correct?

```reveal
{"prompt": "Before you look: what does int Sum(int n) => n == 0 ? 0 : n + Sum(n - 1); return for Sum(4)?", "answer": "**10**. Sum(4) = 4 + Sum(3) = 4 + 3 + Sum(2) = 4 + 3 + 2 + Sum(1) = 4 + 3 + 2 + 1 + Sum(0) = 10. The base case is `n == 0`."}
```

## Where you'll meet it

- **Trees and folders.** A folder holds files and other folders, so listing everything is naturally recursive (see *Trees, from scratch*).
- **Divide and conquer**, such as merge sort (see *Sorting & binary search*).
- **Graph search** such as depth-first search.
- **Dynamic programming** starts as slow recursion and then speeds it up.
- Interviews: permutations, subsets, "climb n stairs", maze paths.

## Common mistakes

- **Missing or wrong base case**, often an off-by-one: `n == 0` when `n` could start negative.
- **Not shrinking.** Calling `F(n)` inside `F(n)` loops forever.
- **Repeated work.** Naive `Fib(n-1) + Fib(n-2)` recomputes the same values and takes exponential time. Remembering results (memoization) fixes it.
- **Too deep.** Summing 1,000,000 items recursively can overflow the stack. A loop is safer.

```check
{"prompt": "Why is the naive Fib(n) = Fib(n-1) + Fib(n-2) so slow for large n?", "options": ["It uses too many variables", "It solves the same smaller problems again and again", "Addition is slow", "It has no base case"], "answer": 1, "explanation": "Fib(5) calls Fib(4) and Fib(3), and Fib(4) calls Fib(3) again. The number of repeated calls roughly doubles with each step, so the time grows exponentially. Storing answers once computed avoids this."}
```

## Recap

- Recursion: a function solves a problem by calling itself on a smaller version.
- You need a **base case** and a **recursive case** that moves toward it.
- Each call adds a frame to the **call stack**; too many frames overflow it.
- Trust the smaller call, then build your answer from it.
- Watch for repeated work, which memoization can remove.
