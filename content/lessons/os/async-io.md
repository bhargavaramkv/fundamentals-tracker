---
title: "Async I/O, thread pools and the event loop"
summary: "How a server handles thousands of waiting requests without thousands of waiting threads."
---

## The idea

A waiter takes your order, walks to the kitchen and stands there staring at the chef until the food is ready. While he waits, nobody else gets served. That is **blocking** I/O: the thread asks for something slow (a file, a database, a web call) and does nothing until the answer arrives.

A better waiter writes the order down, goes to serve the next table, and returns when the kitchen rings a bell. That is **non-blocking** (asynchronous) I/O: the thread starts the slow job, moves on, and picks up the result later.

Here **I/O** means input/output, any work where your code waits for something outside the CPU. Waiting for I/O is most of what a web service does, so how you wait matters a great deal.

## See it work

```csharp
// Blocking: the thread is stuck for the whole download
string a = new HttpClient().GetStringAsync(url).Result;

// Non-blocking: the thread is released while waiting
string b = await new HttpClient().GetStringAsync(url);
```

Both get the same text. The first parks a thread, consuming its stack and a slot in the pool, for the whole download. The second returns the thread to do other work and resumes the method when the data has arrived.

```check
{"prompt": "A web server handles 1,000 requests at once, each waiting 200 ms for a database. With blocking calls, what does it need?", "options": ["Close to 1,000 threads, each stuck waiting", "Just 1 thread, since waiting costs nothing", "Exactly one thread per CPU core", "No threads, the database does the waiting"], "answer": 0, "explanation": "Each blocked request holds its own thread until the reply comes. Threads that do nothing are not free: each reserves stack memory, and the pool may not even have 1,000. Async code removes that one-thread-per-waiting-request cost."}
```

## How it works

**The thread pool.** Creating a thread is expensive, so .NET keeps a **thread pool**: a set of ready-made worker threads. Work is queued, a free worker takes it, and when done goes back to the pool. If all workers are busy or blocked, new work waits in the queue. The pool adds threads only gradually, so a pool full of blocked threads makes the whole app slow. This is called **thread pool starvation**, and blocking calls like `.Result` and `.Wait()` are the usual cause.

**async/await in C#.** Marking a method `async` and using `await` lets the compiler split the method into pieces. At an `await` on unfinished work, the method returns control to its caller and hands the thread back. No thread is blocked while the OS does the I/O. When the operation completes, the rest of the method is queued to run on a pool thread. A `Task` is the object that represents "this will finish later".

**The event loop (Node.js and browsers).** JavaScript runs your code on a single thread. To stay responsive it uses an **event loop**: a loop that takes one finished piece of work from a queue and runs it. Slow I/O is handed to the OS or helper threads, and when it completes, its **callback** (the function to call with the result) is added to the queue.

```steps
{"title": "The event loop drains its queue", "frames": [
{"visual": "Call stack : main()\nQueue      : (empty)\nWaiting I/O: read file, timer 0ms", "caption": "`main()` runs. It starts a file read and a timer. Neither blocks."},
{"visual": "Call stack : main()\nQueue      : timer-callback\nWaiting I/O: read file", "caption": "A 0 ms timer is done almost at once. Its callback joins the **queue**. It cannot run yet: `main` still holds the stack."},
{"visual": "Call stack : (empty)\nQueue      : timer-callback\nWaiting I/O: read file", "caption": "`main()` finishes. The stack is empty. Now the loop may look at the queue."},
{"visual": "Call stack : timer-callback\nQueue      : (empty)\nWaiting I/O: read file", "caption": "The loop moves one callback onto the stack. It runs to completion, and nothing can interrupt it."},
{"visual": "Call stack : (empty)\nQueue      : file-callback\nWaiting I/O: (none)", "caption": "The file read finished meanwhile, so its callback waits in the queue."},
{"visual": "Call stack : file-callback\nQueue      : (empty)\nWaiting I/O: (none)", "caption": "The loop runs it. One thread has handled both events without ever waiting."}
]}
```

The catch: while a callback runs, nothing else can. A long calculation in Node freezes every request. The rule is **never block the loop**. Do heavy CPU work in a worker thread or another process.

```reveal
{"prompt": "What order does this JavaScript print?\n`console.log('A'); setTimeout(() => console.log('B'), 0); console.log('C');`", "answer": "**A, C, B.** The timer callback is queued, and it can only run after the current code has finished and the stack is empty. Even with a delay of 0, it never jumps ahead of the running code."}
```

## Where you'll meet it

- **ASP.NET Core** endpoints that `await` database and HTTP calls, so a few threads serve thousands of requests.
- **Node.js servers**, where the single-threaded event loop is the whole design.
- **Browsers**: every click handler and `fetch` callback goes through the same kind of loop.
- **Task.Run** to push *CPU-bound* work onto the pool. Async is for waiting, not for computing: wrapping a calculation in `async` does not make it faster.
- **Interviews:** "What happens to the thread when you `await`?"

```check
{"prompt": "In C#, a method awaits an HTTP call that takes 2 seconds. What is true about the calling thread during that time?", "options": ["It is released and can run other work", "It sleeps and keeps its place in line", "It spins in a loop checking for the reply", "It is destroyed and a new one is started"], "answer": 0, "explanation": "await returns the thread to the pool, and nothing is blocked while the OS waits for the network. The method resumes later, perhaps on a different thread. A blocked or spinning thread is what you get with .Result or a polling loop."}
```

## Common mistakes

- **Sync over async**: calling `.Result` or `.Wait()` on a task. It blocks a pool thread, and in UI or older ASP.NET apps it can deadlock completely.
- **`async void`** except for event handlers. Exceptions cannot be caught by the caller.
- **Using async for CPU work** and expecting a speedup.
- **Blocking the Node event loop** with a huge loop or `fs.readFileSync` in a request handler.
- **Not awaiting a task**, so errors vanish and the method moves on before the work is done.

## Recap

- **Blocking** I/O parks a thread; **non-blocking** I/O starts the work and moves on.
- The **thread pool** reuses threads; blocking them causes **starvation**.
- C# `async`/`await` frees the thread at each `await` and resumes later.
- Node's **event loop** runs one callback at a time from a queue, to completion, so never block it.
- Use async for waiting; use extra threads or cores for computing.
