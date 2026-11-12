---
title: "Memory: stack, heap and virtual memory"
summary: "Where your variables actually live, why every process thinks it owns the machine, and what the garbage collector does."
---

## The idea

Your program needs somewhere to keep its data while it runs. That place is **memory** (RAM), a huge row of numbered boxes. Each box has an **address**, its number.

Picture a workshop. The **stack** is your desk: small, tidy, and you only keep what you are using right now. When you start a task you put down a sheet for it; when the task ends you throw the sheet away. The **heap** is the warehouse next door: huge and flexible, where things you need to keep for a while are stored. Someone has to decide when a box in the warehouse is no longer needed, and that someone is the garbage collector.

## See it work

```csharp
int Total(List<int> items) {
    int sum = 0;                  // local number: on the stack
    foreach (var x in items) sum += x;
    return sum;
}

var list = new List<int> { 1, 2, 3 };   // object on the heap
int result = Total(list);
```

The variables `sum`, `result` and `list` are on the stack (the compiler may even keep them in CPU registers). The `List<int>` object itself, with its items, lives on the heap. The variable `list` on the stack only holds the *address* of that object. This kind of variable is called a **reference**.

## How it works

**The stack.** Each time a function is called, the thread pushes a **stack frame**: space for that call's parameters and local variables. When the function returns, the frame is popped and its space is instantly reusable. This is very fast and needs no cleanup. Each thread has its own stack, with a limited size. Recursion with no end keeps pushing frames until the stack overflows, which in .NET ends the process.

**The heap.** Objects created with `new` for classes, arrays and strings go on the heap. They can outlive the function that made them and can be shared between threads, as long as someone holds a reference. A value stored inside a heap object, such as an `int` field of a class, lives inside that object on the heap.

```steps
{"title": "Stack and heap during a call", "frames": [
{"visual": "STACK (one thread)      HEAP (shared)\n----------------------  ------------------\nMain                    \n  list  = 0x40  ------->  List {1, 2, 3}", "caption": "`Main` creates a list. The object is on the heap. The stack holds only its address, 0x40."},
{"visual": "STACK (one thread)      HEAP (shared)\n----------------------  ------------------\nTotal                   \n  items = 0x40  ------->  List {1, 2, 3}\n  sum   = 0             \nMain                    \n  list  = 0x40  ------->  (same object)", "caption": "Calling `Total` pushes a frame. `items` copies the address, so both variables point to one object. Nothing was copied."},
{"visual": "STACK (one thread)      HEAP (shared)\n----------------------  ------------------\nMain                    \n  list   = 0x40 ------->  List {1, 2, 3}\n  result = 6            ", "caption": "`Total` returned 6. Its frame is popped and its space is free again."},
{"visual": "STACK (one thread)      HEAP (shared)\n----------------------  ------------------\nMain                    \n  list   = null           List {1, 2, 3}\n  result = 6            ", "caption": "Once `list` no longer points at it, nothing can reach the object. It is garbage, waiting for the collector."},
{"visual": "STACK (one thread)      HEAP (shared)\n----------------------  ------------------\nMain                    \n  list   = null           (space reclaimed)\n  result = 6            ", "caption": "The garbage collector (GC) finds that no reference reaches the list and frees its space."}
]}
```

**Virtual memory.** Your process does not see the real RAM. The OS and CPU give every process its own private numbering of addresses, called its **virtual address space**. Memory is handled in chunks called **pages** (commonly 4 KB). A table maps each virtual page to a real spot in RAM. This gives three gifts: processes cannot touch each other's data, each program can pretend it has a big continuous block, and rarely used pages can be moved out to disk. Touching a page that is not in RAM triggers a **page fault**, and the OS loads it back, which is thousands of times slower than a normal access. A machine that keeps doing this is "thrashing".

```check
{"prompt": "Two different processes both read the address 0x1000 in their own code. What do they get?", "options": ["Data from different places in RAM", "The same data, because the address is shared", "An error, since addresses must be unique", "Whatever the process started first wrote"], "answer": 0, "explanation": "Addresses in a program are virtual. Each process has its own mapping, so 0x1000 in one process usually points to a different spot in RAM than 0x1000 in another. That is what keeps processes apart."}
```

**Garbage collection in .NET.** The GC starts from **roots** (stack variables, static fields, CPU registers) and follows references to mark every live object. Everything unmarked is garbage and its space is reused. Because most objects die young, .NET sorts the heap into **generations**: gen 0 for new objects, gen 1 and gen 2 for survivors. Collecting gen 0 is cheap and frequent; a full collection is rarer and slower. Very large objects (about 85,000 bytes and up) go in a separate large object heap. While the GC works, it may briefly pause your threads.

## Where you'll meet it

- **StackOverflowException** from runaway recursion, or from huge `stackalloc` buffers.
- **Memory leaks in managed code.** The GC frees only *unreachable* objects. A static list that you keep adding to, or an event handler never unsubscribed, keeps everything alive.
- **Latency spikes** under load, caused by frequent gen 2 collections. Reducing allocations in hot paths is a standard fix.
- **Out of memory** and slow machines when a process uses more than the RAM available.
- **Struct vs class** choices, which affect how much lives on the heap.

```reveal
{"prompt": "A static `List<byte[]> cache` has items added to it on every request and never removed. The GC runs all the time. Will it clean the cache up eventually?", "answer": "**No.** The static field is a root, so everything it points to is reachable and therefore not garbage. The GC cannot guess that you no longer need the items. This is the classic managed memory leak: remove entries yourself, or bound the cache's size."}
```

## Common mistakes

- **"Value types always live on the stack."** A struct that is a field of a class lives inside that heap object. The real rule: a local variable's own storage is on the stack, an object's fields are inside the object.
- **"The GC means I cannot leak."** It only frees what nobody references.
- **Calling `GC.Collect()` by hand.** It usually hurts. The GC knows more than your guess does.
- **Forgetting non-memory resources.** The GC does not close files or database connections on time. Use `using` / `Dispose`.

```check
{"prompt": "What makes a heap object eligible for garbage collection in .NET?", "options": ["No chain of references from any root reaches it", "It has not been used for a certain number of seconds", "The method that created it has returned", "Its variable was assigned the value null once"], "answer": 0, "explanation": "Reachability is the test. A method returning does not matter if the object was stored in a field, and setting one variable to null does not matter if another reference still points at it. Time since last use is never checked."}
```

## Recap

- The **stack** holds a thread's call frames and locals: fast, automatic, small. The **heap** holds objects that can outlive a call.
- A reference on the stack is just an address pointing into the heap.
- **Virtual memory** gives each process a private address space, mapped in pages to RAM, and lets the OS swap pages to disk.
- The .NET **GC** frees objects that no root can reach, using generations to stay cheap.
- Leaks in managed code are objects you still reference by accident.
