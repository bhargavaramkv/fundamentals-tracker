---
title: "Big-O, from scratch"
summary: "A simple way to describe how much slower a program gets when you give it more data."
---

## The idea

Imagine you have to find one friend's name in a phone book. If the book has 10 names, you check them one by one and finish fast. If it has 10 million names, the same method takes forever.

The question that matters is not "how many seconds?" Seconds depend on your computer. The question is: **when the input gets bigger, how much more work do I do?**

**Big-O** is the name for that answer. It is a short label, like *O(n)*, that says how the amount of work grows as the input grows. The input size is called **n**. A bigger n means more items, more characters, more users.

Big-O ignores small details. It cares about the shape of the growth.

## See it work

Here are two ways to look at a list of `n` numbers.

```csharp
int First(int[] a) {
    return a[0];            // one step, any size
}

int Sum(int[] a) {
    int total = 0;
    foreach (int x in a)    // once per item
        total += x;
    return total;
}
```

Count the steps:

```
n         First    Sum
10        1        10
1,000     1        1,000
1,000,000 1        1,000,000
```

`First` always does one step. We write **O(1)**, said "order one" or "constant". `Sum` does one step per item. We write **O(n)**, said "order n" or "linear". Double the list and `Sum` takes twice as long.

```check
{"prompt": "A function loops once over a list of n names and prints each. If the list grows from 100 to 200 names, roughly what happens to the work?", "options": ["It doubles", "It stays the same", "It becomes four times bigger"], "answer": 0, "explanation": "One step per name means the work grows in step with n. Twice the names means about twice the work. That is O(n), or linear."}
```

## How it works

Three rules turn code into a Big-O label.

1. **Count steps as a function of n.** Ask how many times the busiest line runs.
2. **Drop constants.** A loop that does 3 things per item is still O(n), not O(3n). The shape is the same.
3. **Keep only the biggest part.** If you do n steps and then n × n steps, the total is O(n²). The small part gets swamped.

Nested loops multiply:

```csharp
for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++)
        Console.WriteLine(i + j);   // runs n * n times
```

That is **O(n²)**, said "n squared" or "quadratic". With n = 1,000 it runs a million times.

Here are the common labels, from fastest to slowest growth:

| Label | Name | Example |
|---|---|---|
| O(1) | constant | read `a[5]` |
| O(log n) | logarithmic | halving the search each step |
| O(n) | linear | one pass over a list |
| O(n log n) | linearithmic | good sorting |
| O(n²) | quadratic | a loop inside a loop |

**Logarithm** (log n) means "how many times can I halve n before I reach 1?" For n = 1,000,000 that is only about 20. It grows very slowly, which is why O(log n) is excellent.

```check
{"prompt": "What is the Big-O of this code? for (i in 0..n) { for (j in 0..n) { work(); } }", "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"], "answer": 2, "explanation": "The inner loop runs n times for each of the n outer passes, so work() runs n × n times. Nested loops over the same input multiply, giving O(n²)."}
```

## Where you'll meet it

- **Choosing a data structure.** Looking up a name in a list is O(n). In a dictionary it is about O(1). Big-O tells you which to pick.
- **Interviews.** You are almost always asked "what is the time complexity?" after you write a solution.
- **Real slowdowns.** A page that is fast with 100 rows and crawls with 100,000 usually hides an O(n²) loop.
- **Space too.** Big-O also describes memory. Copying a list of n items uses O(n) extra space.

Big-O usually talks about the **worst case**: the slowest the code can be for an input of that size. Searching for a name by checking one at a time is O(n) because the name might be last.

## Common mistakes

- **Thinking O(1) means fast.** It means the cost does not grow with n. It could still be a slow step, just a steady one.
- **Keeping constants.** Saying O(2n) or O(n + 5) is noise. Write O(n).
- **Counting lines instead of loops.** Ten lines in a row cost O(1) each. What matters is how many times they repeat.
- **Forgetting hidden loops.** A call such as `list.Contains(x)` loops inside. Calling it inside your own loop makes O(n²).

```check
{"prompt": "Your code does n steps, then another n × n steps. Which label describes the total?", "options": ["O(n)", "O(n²)", "O(2n)", "O(n³)"], "answer": 1, "explanation": "Keep only the biggest part. n² grows much faster than n, so for large n the n² part is nearly all the work. Total: O(n²)."}
```

## Recap

- **Big-O** describes how work (or memory) grows as the input size **n** grows.
- Drop constants and small parts: keep only the fastest-growing term.
- O(1) and O(log n) scale beautifully, O(n) is fair, O(n²) hurts on big inputs.
- Nested loops multiply, loops one after another add.
- Watch for loops hidden inside library calls.
