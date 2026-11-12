---
title: "Race conditions"
summary: "Why two threads adding to the same counter can lose updates, and how atomic operations fix it."
---

## The idea

Two flatmates share a notebook that tracks how many eggs are in the fridge. It says 6. Both open the fridge at the same moment, each takes one egg, and each thinks "6 minus 1 is 5" and writes 5. Two eggs left the fridge but the notebook says 5, not 4. One update vanished.

That is a **race condition**: the result depends on the exact timing of two threads, and some timings give the wrong answer. The shared notebook is **shared mutable state**: data that more than one thread can change. If data is not shared, or not changed, there is nothing to race over.

## See it work

```csharp
int count = 0;
var a = new Thread(() => { for (int i = 0; i < 1_000_000; i++) count++; });
var b = new Thread(() => { for (int i = 0; i < 1_000_000; i++) count++; });
a.Start(); b.Start();
a.Join(); b.Join();
Console.WriteLine(count);   // expected 2,000,000
```

Run it a few times. You will see numbers like 1,338,201 and 1,520,744, different each run. Millions of increments were lost.

```reveal
{"prompt": "`count++` is a single line. How can it lose an update?", "answer": "It is **three** steps for the CPU: read `count` into a register, add 1, write it back. A thread can be paused between any two of them. If both threads read the same old value, both write back old + 1, and one increment is gone."}
```

## How it works

Here is the exact interleaving. The shared `count` starts at 5 and each thread runs `count++` once.

```steps
{"title": "Two threads run count++ at once", "frames": [
{"visual": "Shared count = 5\n\nThread A              Thread B\n--------------------  --------------------\n(waiting)             (waiting)", "caption": "`count` is 5. We expect 7 after two increments."},
{"visual": "Shared count = 5\n\nThread A              Thread B\n--------------------  --------------------\n1. read  -> 5\n                      (waiting)", "caption": "A **reads** count and holds 5 in a register."},
{"visual": "Shared count = 5\n\nThread A              Thread B\n--------------------  --------------------\n1. read  -> 5         1. read  -> 5\n", "caption": "The OS switches to B before A writes. B also reads 5."},
{"visual": "Shared count = 5\n\nThread A              Thread B\n--------------------  --------------------\n1. read  -> 5         1. read  -> 5\n2. add   -> 6         2. add   -> 6", "caption": "Both calculate 5 + 1 = 6 in their private registers."},
{"visual": "Shared count = 6\n\nThread A              Thread B\n--------------------  --------------------\n1. read  -> 5         1. read  -> 5\n2. add   -> 6         2. add   -> 6\n3. write 6", "caption": "A writes 6."},
{"visual": "Shared count = 6\n\nThread A              Thread B\n--------------------  --------------------\n1. read  -> 5         1. read  -> 5\n2. add   -> 6         2. add   -> 6\n3. write 6            3. write 6", "caption": "B writes 6 too. Two increments, but `count` went up by one. A's update is **lost**."}
]}
```

The fix is to make the read-add-write one **atomic** operation: indivisible, so no other thread can see it half done. There are two ways.

**1. A hardware atomic.** .NET exposes the CPU's atomic instructions in the `Interlocked` class. This is fast and needs no waiting.

```csharp
Interlocked.Increment(ref count);   // read-add-write as one step
```

**2. A lock.** Only one thread at a time may run a protected block, called a **critical section**. The next lesson covers locks in depth.

```csharp
lock (gate) { count++; }
```

Races are not only about counters. A common shape is **check-then-act**: a thread checks a condition, then acts on it, but the condition changed in between.

```csharp
if (!cache.ContainsKey(id))   // thread B can add id right here
    cache.Add(id, value);     // A's Add now throws
```

Even though each call is fine alone, the pair is not atomic. A single atomic call, or a lock around both lines, is the cure.

```check
{"prompt": "Two threads each call Interlocked.Increment(ref count) one million times on the same int. What is the final value?", "options": ["Exactly 2,000,000", "Somewhere below 2,000,000", "Exactly 1,000,000", "It is unpredictable, like count++"], "answer": 0, "explanation": "Interlocked.Increment performs read, add and write as one indivisible step, so no update can be lost. Plain count++ is the unpredictable one. Interlocked is also cheaper than a lock for this job."}
```

Races are hard to debug because they depend on timing. The bad interleaving may be rare, so a test passes a thousand times and the bug shows up only in production under load. Adding a log line or a breakpoint changes the timing and can make the bug vanish. That is why the cure is to design the sharing out or protect it correctly, not to hunt for the failure by running the program again.

## Where you'll meet it

- **Counters and totals** shared across web requests: hit counts, rate limiters, stock levels.
- **Static or singleton objects** holding mutable fields, in a server that handles requests on many threads.
- **Plain `Dictionary<,>` or `List<>`** used from several threads. They are not thread-safe: you can lose entries, get exceptions or corrupt their internals.
- **Database rows.** "Read balance, add money, write balance" races between two requests in the same way. The fix there is a transaction or a conditional update.
- **Interviews:** "Why is `count++` not thread-safe?" is a classic.

## Common mistakes

- **Testing once and trusting it.** Races may need millions of runs or a busy production machine to appear.
- **Protecting writes but not reads.** A reader can see a half-updated object if only the writer locks.
- **Assuming a short operation is atomic.** Only a few things are guaranteed so, such as reading or writing a 32-bit `int` on its own. Anything with two steps is not.
- **Sprinkling `volatile` and hoping.** It controls visibility of one variable between threads, not atomic read-modify-write.

```check
{"prompt": "Which of these lines is safe to run from many threads at once on a shared variable, with no extra protection?", "options": ["None of them is safe on its own", "total = total + 1;", "if (total < 100) total++;", "list.Add(total);"], "answer": 0, "explanation": "Each option reads and then writes, or checks and then acts, so another thread can slip in between. Adding one to a variable looks tiny but is still read, add, write. Only an Interlocked call or a lock makes such steps atomic."}
```

## Recap

- A **race condition** is a bug whose outcome depends on thread timing.
- It needs **shared mutable state**. Remove the sharing or the mutation and the race disappears.
- `count++` is three steps (read, add, write), so threads can interleave and lose updates.
- **Atomic** operations (`Interlocked`) or a **lock** around a critical section make a multi-step action indivisible.
- Check-then-act sequences are races too.
