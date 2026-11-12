---
title: "Processes and threads"
summary: "What a running program really is, and how one CPU juggles many of them at once."
---

## The idea

A program on disk is just a file, like a recipe in a cookbook. Nothing happens until someone cooks it.

A **process** is a program that is running. Think of a kitchen: it has its own pantry (memory), its own list of open tools (files and network connections), and at least one cook. Two kitchens cannot reach into each other's pantry. That wall is deliberate: if one kitchen burns down, the others keep cooking.

A **thread** is one cook in that kitchen. Each cook follows their own recipe step and keeps their own notebook of where they are. All cooks in the same kitchen share the pantry. That makes teamwork easy and also makes collisions possible, which later lessons cover.

One more word: a **CPU core** is the part of the processor that executes instructions, one thread at a time. A laptop might have 8 cores but run hundreds of threads. The **operating system** (OS) is the manager that decides which thread gets a core right now.

## See it work

This C# program prints which process and thread each line runs on.

```csharp
void Show() => Console.WriteLine(
    $"process {Environment.ProcessId}, thread {Environment.CurrentManagedThreadId}");

Show();                          // main thread
var t = new Thread(Show);
t.Start();                       // a second thread
t.Join();                        // wait for it to finish
```

The process number is the same on both lines because it is one kitchen. The thread numbers differ because there are two cooks.

```check
{"prompt": "Your C# program starts a second Thread. Which of these do the two threads share?", "options": ["The heap objects of the program", "The call stack of the program", "The saved position in the code", "The CPU registers they use"], "answer": 0, "explanation": "Threads in one process share its memory, including objects on the heap. Each thread has its own stack, its own saved position in the code and its own registers, because each one is working on a different step."}
```

## How it works

Every thread owns three private things: a **stack** (the notes for the functions it is currently inside, with their local variables), a **program counter** (which instruction comes next) and its **registers** (the CPU's tiny scratch slots). Everything else in the process is shared.

Because there are more threads than cores, the OS gives each runnable thread a short turn. When a turn ends, the OS performs a **context switch**: it saves the running thread's registers and program counter, then loads the saved ones of another thread. The first thread can later resume exactly where it stopped, unaware it was paused.

```steps
{"title": "A context switch, one move at a time", "frames": [
{"visual": "Core 0     Thread A      Thread B\n---------  ------------  ------------\nruns A     RUNNING       READY\n           pc = 12       pc = 40\n           x  = 7        x  = 2", "caption": "Thread A runs on the core. Thread B waits its turn. The pc (program counter) is the next instruction to run."},
{"visual": "Core 0     Thread A      Thread B\n---------  ------------  ------------\nOS acts    PAUSED        READY\n           pc = 12       pc = 40\n           x  = 7        x  = 2\n           (saved)", "caption": "A timer fires and A's turn is over. The OS **saves** A's state in a record it keeps in memory."},
{"visual": "Core 0     Thread A      Thread B\n---------  ------------  ------------\nOS acts    PAUSED        LOADING\n           pc = 12       pc = 40\n           x  = 7        x  = 2\n           (saved)       (restored)", "caption": "The OS **loads** B's saved state into the core's registers."},
{"visual": "Core 0     Thread A      Thread B\n---------  ------------  ------------\nruns B     READY         RUNNING\n           pc = 12       pc = 41\n           x  = 7        x  = 3", "caption": "B runs and moves on. A still holds its saved pc = 12 and x = 7, untouched."},
{"visual": "Core 0     Thread A      Thread B\n---------  ------------  ------------\nruns A     RUNNING       READY\n           pc = 12       pc = 44\n           x  = 7        x  = 3", "caption": "At the next switch, A resumes at line 12 with x = 7, as if nothing happened."}
]}
```

A switch is quick but not free. The OS spends time saving and loading, and the core's fast caches fill with the new thread's data instead of the old one's. Switching between *processes* usually costs more than between threads of one process, because the OS must also swap which memory the core sees.

Creating a thread is also not free: each one reserves space for its stack (often around a megabyte), so you cannot create a million of them.

```check
{"prompt": "What does the OS save when it pauses a thread so that it can be resumed later?", "options": ["Its registers and program counter", "A full copy of all the process's heap memory", "A copy of every open file's contents", "The source code of the running function"], "answer": 0, "explanation": "Only the small private state is saved: registers, program counter and a pointer to the stack. The heap is shared and stays where it is, so copying it would be slow and pointless."}
```

## Where you'll meet it

- **Web servers.** IIS, Kestrel and nginx serve many requests at once using threads, processes or both.
- **Browsers.** Chrome gives each site its own process, so one crashed tab does not take down the rest.
- **Task Manager.** The Processes tab lists kitchens. The Details tab can show thread counts.
- **Debugging.** The Threads window in Visual Studio shows each thread's own stack. Reading it is how you find a hung program.
- **Containers.** A Docker container is, at heart, a process (or a few) with a restricted view of the machine.

```reveal
{"prompt": "A thread in your C# service throws an exception that nothing catches. What do you think happens to the other threads?", "answer": "In .NET an unhandled exception on any thread ends the **whole process**, so every thread dies with it. Threads share one process, so they share one fate. Separate processes would have survived, which is why browsers and some servers prefer them."}
```

## Common mistakes

- **Mixing up "program" and "process".** A program is a file. Run it twice and you get two processes.
- **Assuming threads make code faster.** Extra threads help only if there is spare core capacity or waiting to hide. On a busy 4-core machine, 40 busy threads just take turns.
- **Forgetting that threads share memory.** Writing to a shared object from two threads without care causes bugs that appear once in a thousand runs.
- **Thinking a context switch is free.** Thousands of threads constantly swapping can waste more time switching than working.

## Recap

- A **process** is a running program with its own memory. A **thread** is one line of execution inside it.
- Threads share the heap and open files, but each has its own stack, program counter and registers.
- The OS gives threads short turns on each core using a **context switch**: save one thread's state, load another's.
- Switching and creating threads costs something, so more threads is not always better.
- Separate processes isolate failures; threads in one process share fate.
