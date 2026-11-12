---
title: "Concurrency patterns"
summary: "Safer designs than sprinkling locks: queues between threads, immutable data, thread-safe collections and actors."
---

## The idea

Locks work, but code with locks everywhere is hard to read and easy to get wrong. Experienced engineers prefer designs where threads rarely touch the same data in the first place. This lesson covers four such designs.

Think of a restaurant. Waiters do not walk into the kitchen and cook. They put an order slip on a rail, and cooks take slips from it. The rail is the only thing both groups touch, and it is built to be touched safely. That is the first and most useful pattern.

## See it work

The **producer–consumer** pattern: some threads produce work items, others consume them, and a **queue** sits between. The queue decouples them, so producers need not wait for consumers to finish each item. In modern .NET the tool is `Channel<T>`.

```csharp
var ch = Channel.CreateBounded<int>(10);       // holds at most 10

var producer = Task.Run(async () => {
    for (int i = 0; i < 100; i++)
        await ch.Writer.WriteAsync(i);         // waits if the queue is full
    ch.Writer.Complete();                      // no more items
});

await foreach (int item in ch.Reader.ReadAllAsync())
    Console.WriteLine(item);                   // consumer
await producer;
```

The channel handles all the locking. Neither side shares anything except the queue.

## How it works

**Why bounded?** If producers are faster than consumers, an unbounded queue grows until memory runs out. A **bounded** queue has a maximum size. When it is full, the producer must wait. This slowing-down of the source is called **backpressure**, and it protects the system under load.

```steps
{"title": "A bounded queue with capacity 3", "frames": [
{"visual": "Producer --> [ 1 ][ 2 ][   ] --> Consumer\n                  size 2 of 3", "caption": "The producer added 1 and 2. The consumer is busy with something else."},
{"visual": "Producer --> [ 1 ][ 2 ][ 3 ] --> Consumer\n                  size 3 of 3 FULL", "caption": "Item 3 fills the queue."},
{"visual": "Producer --> [ 1 ][ 2 ][ 3 ] --> Consumer\n  (waits on 4)    size 3 of 3 FULL", "caption": "The producer tries to add 4. The queue is full, so the producer **waits**. Memory use stays flat."},
{"visual": "Producer --> [ 2 ][ 3 ][   ] --> Consumer\n  (waits on 4)    size 2 of 3     took 1", "caption": "The consumer takes item 1, which frees a slot."},
{"visual": "Producer --> [ 2 ][ 3 ][ 4 ] --> Consumer\n  (resumed)       size 3 of 3", "caption": "The producer wakes and adds 4. The work continues, at the consumer's pace."}
]}
```

**Immutability.** An **immutable** object never changes after it is created. If nothing can be changed, there can be no race, and no lock is needed to read it. To "change" it, you build a new object. C# makes this easy with `record` types, `readonly` fields and `System.Collections.Immutable`. A common trick is to share an immutable snapshot and swap the reference to a new one when something changes.

**Thread-safe collections.** `System.Collections.Concurrent` offers `ConcurrentQueue<T>`, `ConcurrentDictionary<K,V>` and `BlockingCollection<T>`. Each single call is atomic. But a *sequence* of calls is not. Checking `ContainsKey` and then `Add` is still a check-then-act race; use the single combined call `GetOrAdd` or `TryAdd`. Note that the factory function passed to `GetOrAdd` may run more than once when threads collide, so it should be cheap and free of side effects.

**The actor model.** An **actor** is an object that owns its private state and has a **mailbox** of messages. It handles one message at a time, so its state needs no locks. Actors talk only by sending messages, never by sharing memory. Erlang is built on it. In .NET, Akka.NET and Orleans provide it. A `Channel<T>` with a single consumer loop is a small hand-made actor.

```check
{"prompt": "Producers add jobs far faster than consumers finish them. What is the main danger of an unbounded queue?", "options": ["Memory keeps growing until the process fails", "The consumers will skip some of the jobs", "The queue reorders jobs at random", "The producers deadlock with the consumers"], "answer": 0, "explanation": "Nothing stops the producers, so the backlog grows without limit and can exhaust memory. A bounded queue applies backpressure by making producers wait. Jobs are not skipped or reordered, and no lock cycle is involved."}
```

```check
{"prompt": "You write: if (!dict.ContainsKey(k)) dict.TryAdd(k, v) on a ConcurrentDictionary from many threads. Why is the pair still risky?", "options": ["Another thread can add k between the two calls", "ConcurrentDictionary cannot be used with TryAdd", "ContainsKey locks the entire dictionary forever", "It is only unsafe when there are over 100 keys"], "answer": 0, "explanation": "Each call is atomic, but the gap between them is open. The check may be out of date by the time TryAdd runs. Using TryAdd or GetOrAdd alone removes the gap, because the check and the insert happen as one operation."}
```

## Where you'll meet it

- **Background job queues**: web requests enqueue emails or reports, workers process them. Also message brokers like RabbitMQ or Azure Service Bus.
- **Logging libraries**: they buffer messages in a queue and write them on a separate thread.
- **UI frameworks**: one UI thread owns the screen, and other threads send it messages instead of touching controls.
- **Redux-style state**: replacing immutable state rather than mutating it.
- **Interviews:** "Design a thread-safe bounded buffer" or "How would you avoid locks here?"

```reveal
{"prompt": "Ten threads read a big configuration object, and once an hour one thread replaces the settings. How could you do this with no lock for the readers?", "answer": "Make the config **immutable** and keep it in one reference. The updater builds a complete new config and assigns it to the reference (a single reference write is atomic). Readers just read the reference and use whichever version they got. Nobody ever sees a half-updated config."}
```

## Common mistakes

- **Unbounded queues** in production. Always decide what happens when the queue is full: wait, drop or fail.
- **Believing a thread-safe collection makes your logic thread-safe.** Only each single call is protected.
- **Shared mutable objects inside an immutable wrapper.** A `record` holding a `List<T>` is only shallowly immutable.
- **Forgetting to signal completion.** Consumers waiting forever because no one called `Complete()`.
- **One slow consumer for many producers** with no way to scale out consumers.

## Recap

- Prefer designs that share less over designs that lock more.
- **Producer–consumer** with a queue decouples threads; **bounded** queues give backpressure.
- **Immutable** data needs no locks; swap a reference to publish changes.
- **Concurrent collections** make single calls atomic, not multi-step logic.
- **Actors** keep state private and communicate by messages, handling one at a time.
