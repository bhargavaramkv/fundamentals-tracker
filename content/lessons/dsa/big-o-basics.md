---
title: "Big-O, from scratch"
summary: "A simple way to describe how much slower a program gets when you give it more data."
---

## The idea

Imagine finding one friend's name in a phone book. With 10 names you check them one by one and finish fast. With 10 million names, the same method takes forever.

The useful question is not "how many seconds?", because seconds depend on your computer. The useful question is: **when the input gets bigger, how much more work do I do?**

**Big-O** is the short label for that answer, written like *O(n)*. The size of the input is called **n**: more items, more characters, more users. Big-O ignores small details and describes only the shape of the growth.

## See it work

Two ways to look at a list of `n` numbers:

```csharp
int First(int[] a) => a[0];      // one step, any size

int Sum(int[] a) {
    int total = 0;
    foreach (int x in a)         // once per item
        total += x;
    return total;
}
```

`First` always does one step. We call that **O(1)**, said "order one" or "constant". `Sum` does one step per item, so doubling the list doubles the work. That is **O(n)**, "order n" or "linear".

Now watch a loop inside a loop as n doubles:

```steps
{"title": "One loop vs nested loops as n grows", "frames": [
  {"visual": "n = 2   one loop: 2 steps   nested loops: 4 steps\n\none loop:     # #\n\nnested loops: # #\n              # #", "caption": "With 2 items the difference is tiny."},
  {"visual": "n = 4   one loop: 4 steps   nested loops: 16 steps\n\none loop:     # # # #\n\nnested loops: # # # #\n              # # # #\n              # # # #\n              # # # #", "caption": "Double n. The single loop doubles to 4 steps, the nested loops grow four times to 16."},
  {"visual": "n = 8   one loop: 8 steps   nested loops: 64 steps\n\none loop:     # # # # # # # #\n\nnested loops: # # # # # # # #\n              # # # # # # # #\n              # # # # # # # #\n              # # # # # # # #\n              # # # # # # # #\n              # # # # # # # #\n              # # # # # # # #\n              # # # # # # # #", "caption": "Double again: 8 steps against 64. Nested loops run away from you."}
]}
```

```check
{"prompt": "A function loops once over a list of n names and prints each. If the list grows from 100 to 200 names, roughly what happens to the work?", "options": ["It doubles", "It stays the same", "It becomes four times bigger"], "answer": 0, "explanation": "One step per name means the work grows in step with n. Twice the names means about twice the work. That is O(n), or linear."}
```

## How it works

Three rules turn code into a Big-O label.

1. **Count steps as a function of n.** Ask how many times the busiest line runs.
2. **Drop constants.** A loop that does 3 things per item is still O(n), not O(3n). The shape is the same.
3. **Keep only the biggest part.** If you do n steps and then n × n steps, the total is O(n²). The small part gets swamped.

Loops inside loops **multiply**. Loops one after another **add**:

```csharp
for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++)
        Console.WriteLine(i + j);   // n * n times: O(n²)
```

That is **O(n²)**, "quadratic". With n = 1,000 it runs a million times.

```check
{"prompt": "What is the Big-O of this code? for (i in 0..n) { for (j in 0..n) { work(); } }", "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"], "answer": 2, "explanation": "The inner loop runs n times for each of the n outer passes, so work() runs n × n times. Nested loops over the same input multiply, giving O(n²)."}
```

```reveal
{"prompt": "A method has one loop that prints n items, and right after it a second separate loop that prints n items again (not nested). What is its Big-O?", "answer": "**O(n)**. Two loops one after another add: n + n = 2n, and we drop the constant 2. Only *nested* loops multiply."}
```

## The common labels

From slowest-growing (best) to fastest-growing (worst):

| Label | Name | Example |
|---|---|---|
| O(1) | constant | read `a[5]` |
| O(log n) | logarithmic | halving the search each step |
| O(n) | linear | one pass over a list |
| O(n log n) | linearithmic | good sorting |
| O(n²) | quadratic | a loop inside a loop |

A **logarithm** (log n) answers "how many times can I halve n before I reach 1?" For n = 1,000,000 that is only about 20, so O(log n) is excellent.

```reveal
{"prompt": "For a million items, would you rather run an O(n log n) algorithm or an O(n²) one? Roughly how different are they?", "answer": "Take **O(n log n)**. It is about 1,000,000 × 20 = 20 million steps. O(n²) is 1,000,000 × 1,000,000 = a trillion steps, around 50,000 times more work."}
```

## Where you'll meet it

- **Choosing a data structure.** Looking up a name in a list is O(n). In a dictionary it is about O(1).
- **Interviews.** After you write a solution you are almost always asked for its time complexity.
- **Real slowdowns.** A page that is fast with 100 rows and crawls with 100,000 usually hides an O(n²) loop.
- **Memory too.** Copying a list of n items uses O(n) extra space.

Big-O usually describes the **worst case**: the slowest the code can be for that size. Checking names one at a time is O(n) because the name might be last.

## Common mistakes

- **Thinking O(1) means fast.** It means the cost does not grow with n. It could be a slow step, just a steady one.
- **Keeping constants.** O(2n) or O(n + 5) is noise. Write O(n).
- **Counting lines instead of repeats.** Ten lines in a row cost O(1) each. What matters is how many times they repeat.
- **Forgetting hidden loops.** `list.Contains(x)` loops inside. Calling it inside your own loop makes O(n²).

```check
{"prompt": "Your code does n steps, then another n × n steps. Which label describes the total?", "options": ["O(n)", "O(n²)", "O(2n)", "O(n³)"], "answer": 1, "explanation": "Keep only the biggest part. n² grows much faster than n, so for large n the n² part is nearly all the work. Total: O(n²)."}
```

## Recap

- **Big-O** describes how work (or memory) grows as the input size **n** grows.
- Drop constants and small parts: keep only the fastest-growing term.
- O(1) and O(log n) scale beautifully, O(n) is fair, O(n²) hurts on big inputs.
- Nested loops multiply, loops in a row add.
- Watch for loops hidden inside library calls.
