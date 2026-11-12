---
title: "Locks, semaphores and deadlock"
summary: "How to let threads take turns safely, and how taking turns can freeze a program forever."
---

## The idea

A race happens when two threads touch the same data at once. The obvious cure is to make them take turns. A **lock** (also called a **mutex**, short for mutual exclusion) works like the key to a single toilet. Only the holder may go in. Anyone else waits outside until the key comes back. The code between taking and returning the key is the **critical section**.

Locks fix races but bring a new danger. If you hold one key and wait for another, while someone holding that other key waits for yours, nobody ever moves. This is a **deadlock**.

## See it work

```csharp
class Account {
    private readonly object _gate = new();
    private decimal _balance;

    public void Deposit(decimal amount) {
        lock (_gate) {            // take the key; wait if taken
            _balance += amount;   // only one thread at a time here
        }                         // key returned, even on exception
    }
}
```

The `lock` statement wraps the `Monitor` class. It waits for the key, runs the block, and always returns the key at the end, even if an exception is thrown. The key is an ordinary object you choose. Use a private one like `_gate`, never `this`, a string or a public object, because outside code could lock the same thing and cause surprise stalls.

## How it works

**Mutex versus semaphore.** A lock admits one thread. A **semaphore** admits up to N: it is a counter of free "permits". Each thread takes a permit to enter and returns it on leaving. At zero, newcomers wait. Use a semaphore to limit something, such as at most 3 simultaneous database calls. In .NET, `SemaphoreSlim` does this and, unlike `lock`, has `WaitAsync()` so you can wait with `await`. (You cannot `await` inside a `lock` block.)

**Deadlock.** Two threads need the same two locks but take them in opposite order.

```steps
{"title": "A deadlock forms", "frames": [
{"visual": "Lock X: free       Lock Y: free\n\nThread A              Thread B\n--------------------  --------------------\nneeds X then Y        needs Y then X", "caption": "Two locks. A wants X first, then Y. B wants Y first, then X."},
{"visual": "Lock X: A           Lock Y: B\n\nThread A              Thread B\n--------------------  --------------------\nlock X  -> got it     lock Y  -> got it", "caption": "Each thread takes its first lock. So far, fine."},
{"visual": "Lock X: A           Lock Y: B\n\nThread A              Thread B\n--------------------  --------------------\nlock X  -> got it     lock Y  -> got it\nlock Y  -> WAITING    lock X  -> WAITING", "caption": "A needs Y, which B holds. B needs X, which A holds. Neither will let go."},
{"visual": "Lock X: A           Lock Y: B\n\nThread A              Thread B\n--------------------  --------------------\nwaits for B           waits for A\n\n    A --wants Y--> B --wants X--> A", "caption": "A circle of waiting. **Deadlock.** No thread will ever continue, and the program just hangs with no error."}
]}
```

Deadlock needs **all four** of these conditions at once (named after Coffman):

1. **Mutual exclusion**: a resource can be held by only one thread.
2. **Hold and wait**: a thread holds one resource while waiting for another.
3. **No preemption**: the resource cannot be forcibly taken away.
4. **Circular wait**: a loop of threads each waiting for the next one's resource.

Break any one and deadlock cannot happen. The easiest to break is the fourth, with **lock ordering**: agree on one global order for locks (for example, always the lower account id first) and have every thread follow it.

```csharp
void Transfer(Account from, Account to, decimal amt) {
    var (first, second) = from.Id < to.Id ? (from, to) : (to, from);
    lock (first.Gate) lock (second.Gate) {   // same order for everyone
        from.Balance -= amt; to.Balance += amt;
    }
}
```

Another cure is a **timeout**: `Monitor.TryEnter(gate, 1000)` gives up after a second instead of waiting forever, so you can back off and retry.

```check
{"prompt": "Thread A locks X then Y. Thread B locks X then Y as well, in the same order. Can these two threads deadlock on X and Y?", "options": ["No, circular wait cannot form", "Yes, if both start at the same moment", "Yes, since each holds a lock while waiting", "Only if there are more than two threads"], "answer": 0, "explanation": "Holding one lock while waiting for another is exactly what lock ordering allows. Without a cycle it is harmless: whoever gets X first also gets Y, finishes and releases both. Circular wait is the condition that never occurs."}
```

```check
{"prompt": "You want at most 5 threads calling a slow external service at the same time. Which tool fits?", "options": ["A semaphore with 5 permits", "A lock around the whole call", "A volatile counter set to 5", "A thread priority of 5"], "answer": 0, "explanation": "A lock lets exactly one thread in, which is too strict. A semaphore counts permits and lets N through. A plain volatile counter cannot make threads wait, and priority has nothing to do with limiting concurrency."}
```

## Where you'll meet it

- **`lock` in C#** around shared collections, caches and counters.
- **Database deadlocks.** SQL Server picks a victim and rolls it back when two transactions lock rows in opposite order. The same four conditions apply.
- **Hung applications.** A frozen UI or a service that stops answering with CPU near zero is often a deadlock. Take a memory dump or attach a debugger and read each thread's stack to find the cycle.
- **Throttling.** `SemaphoreSlim` to cap parallel calls to an API.
- **Interviews:** "Name the four conditions for deadlock and how to prevent it."

```reveal
{"prompt": "A method locks `_a`, then calls another method that locks `_a` again on the same thread. Does it deadlock with itself?", "answer": "In C# **no**: `lock` (Monitor) is **reentrant**, so the thread that already holds it can enter again. It must release it as many times as it took it. Not every language works this way. In some, a non-reentrant mutex would hang right there."}
```

## Common mistakes

- **Locking too much.** A big lock around everything makes threads wait in a line and wastes the benefit of threads. Keep critical sections short.
- **Calling unknown code while holding a lock.** A callback or event handler may take another lock and create a cycle.
- **Locking on `this`, a `string` or a `Type`.** Other code can hold the same key without you knowing.
- **Waiting on a task inside a lock** (`task.Wait()` or `.Result`). The task may need that lock itself.
- **Forgetting to release in non-`lock` code.** Using `Monitor.Enter` without `finally` leaks the key. The `lock` statement does it for you.

## Recap

- A **lock** (mutex) lets one thread at a time into a **critical section**; a **semaphore** lets N in.
- Use a private lock object and keep the section short.
- **Deadlock** needs mutual exclusion, hold and wait, no preemption and circular wait, all together.
- Prevent it most simply with a **global lock order**; also use timeouts and avoid holding locks while calling other code.
- A hung program with low CPU often means a deadlock.
