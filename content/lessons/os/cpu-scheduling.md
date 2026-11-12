---
title: "CPU scheduling"
summary: "How the OS decides which thread runs next, and why waiting threads cost almost nothing."
---

## The idea

Imagine one hairdresser and a waiting room full of customers. The hairdresser cannot cut everyone's hair at the same moment, so a rule decides who is next, and how long each person gets before someone else has a turn.

Your computer has the same problem. There are far more threads than **CPU cores**, so the **scheduler**, the part of the operating system that picks which thread runs, hands out short turns. Each turn is a **time slice** (also called a quantum), typically a few milliseconds. When the slice ends, a hardware timer interrupts the core, and the scheduler may pick a different thread. Taking the core away from a thread like this is called **preemption**. The thread does not need to agree.

Because the switching is so fast, it looks as if everything runs at once.

## See it work

A thread is always in one of three states:

- **Running**: it has a core right now.
- **Ready** (also called runnable): it could run, but is waiting for a core.
- **Blocked** (also called waiting): it cannot run yet because it is waiting for something, such as a disk read, a network reply, a timer or a lock.

```csharp
Console.WriteLine(Environment.ProcessorCount); // cores the OS shows us

Thread.Sleep(1000);   // BLOCKED for 1 s: uses no CPU
while (true) { }      // always READY or RUNNING: eats a core
```

`Thread.Sleep` hands the core back at once. The OS marks the thread blocked and does not consider it again until the timer fires. The infinite loop never blocks, so it is always asking for CPU.

```check
{"prompt": "A server has 4 cores and 200 threads, and 196 of them are blocked waiting for network replies. How many threads compete for the cores right now?", "options": ["Only the 4 that are ready or running", "All 200, since they all exist", "196, since blocked ones are waiting", "None, because blocked threads stop the OS"], "answer": 0, "explanation": "Blocked threads are not in the ready queue. They cost memory for their stack but no CPU time. Only ready and running threads compete for cores, which is why a server can hold many waiting connections cheaply."}
```

## How it works

The scheduler keeps a **ready queue** of threads that could run. When a core is free (a slice ended, or its thread blocked), it picks one. Real schedulers use **priorities** and tweak them as threads behave.

```steps
{"title": "One core, three threads", "frames": [
{"visual": "Core 0 runs : A\nReady queue : B, C\nBlocked     : (none)", "caption": "A runs. B and C are ready and wait in line."},
{"visual": "Core 0 runs : B\nReady queue : C, A\nBlocked     : (none)", "caption": "A's time slice ran out, so it was preempted and went to the back of the queue. B runs now."},
{"visual": "Core 0 runs : C\nReady queue : A\nBlocked     : B (disk read)", "caption": "B asked for a disk read, so it **blocks** early. It gave up its slice. C runs."},
{"visual": "Core 0 runs : A\nReady queue : C\nBlocked     : B (disk read)", "caption": "C's slice ended. A runs again. B is not in the queue, so it costs nothing while it waits."},
{"visual": "Core 0 runs : A\nReady queue : C, B\nBlocked     : (none)", "caption": "The disk finished. The OS moves B from blocked to **ready**. It waits for a turn like everyone else."}
]}
```

Two kinds of work behave very differently.

- **CPU-bound** threads spend their time calculating: compressing video, hashing, sorting a huge array. They use whole slices and are always ready. Speed depends on cores and clock speed.
- **I/O-bound** threads spend most of their life waiting: for a database, a file, an HTTP call. They run for a moment, then block. Speed depends on the thing being waited for.

That difference decides how many threads make sense. For CPU-bound work, about one thread per core keeps every core busy, and more only adds switching. For I/O-bound work, many more threads (or better, async code, a later lesson) are fine, since most of them are blocked.

Schedulers also tend to favour threads that block often, because they are usually interactive (a user is waiting) and they use little CPU. A thread that has used its full slice many times is treated as a CPU hog and may lose priority. Priorities can cause **starvation**, where a low-priority thread rarely gets a turn, so schedulers also add fairness tricks.

```check
{"prompt": "Your service resizes images (heavy calculation) on a 4-core machine. Which thread count is the most sensible starting point?", "options": ["About 4 worker threads", "About 400 worker threads", "Exactly 1 worker thread", "One new thread per image, no limit"], "answer": 0, "explanation": "Resizing is CPU-bound: every thread is always ready. Beyond one per core, extra threads only wait in the ready queue and add context-switch cost. A single thread would leave three cores idle."}
```

## Where you'll meet it

- **Thread pools.** .NET sizes its pool partly by core count (`Environment.ProcessorCount`) for exactly this reason.
- **Cloud CPU limits.** A container limited to 0.5 CPU is throttled: its threads become ready but are denied a core.
- **High CPU vs slow response.** If CPU is near 100%, the cause is CPU-bound work. If CPU is low but requests are slow, threads are probably blocked on something.
- **Interview question:** "Why does adding more threads sometimes make a program slower?"

```reveal
{"prompt": "Your API shows 5% CPU usage but each request takes 3 seconds. Is the CPU the bottleneck? What would you look at first?", "answer": "**No.** Low CPU with slow responses means threads are mostly **blocked**, waiting on a database, another service or a lock. Look at what the requests wait for: query times, outbound calls and contention. Adding cores would change nothing."}
```

## Common mistakes

- **Believing sleeping threads waste CPU.** A blocked thread uses none. The cost is its stack memory.
- **Spinning to wait.** `while (!done) { }` keeps a core at 100% to do nothing. Block on a signal or use `await`.
- **Setting thread priority to fix slowness.** It only reorders the queue. It rarely adds throughput and can starve other work.
- **Assuming a time slice is exact.** It varies by OS and load, and a thread can be preempted at any instruction. Never write code that depends on timing.

## Recap

- The **scheduler** gives ready threads short **time slices** on each core; a timer lets it **preempt** them.
- Threads are **running**, **ready** or **blocked**; blocked threads cost no CPU.
- **CPU-bound** work wants about one thread per core; **I/O-bound** work spends its time waiting and can be spread over many more.
- Low CPU with slow responses points to waiting, not computing.
- Never rely on when the OS switches threads.
