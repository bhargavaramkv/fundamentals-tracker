---
title: "Stacks & queues"
summary: "Two simple ways to hold items, last-in-first-out and first-in-first-out, and why they are everywhere."
---

## The idea

Two everyday pictures cover this whole lesson.

A **stack of plates**: you put a clean plate on top, and you take a plate from the top. The last plate added is the first taken. This is **LIFO**, short for last in, first out.

A **queue at a shop**: new people join the back, and the person at the front is served first. The first to arrive is the first to leave. This is **FIFO**, short for first in, first out.

Both are collections with strict rules about where you add and where you remove. The rules sound limiting, but they match many real problems perfectly. You can build either on an array or a linked list (see *Arrays & strings* and *Linked lists*).

## See it work

A stack has two main actions. **Push** adds to the top. **Pop** removes from the top. **Peek** looks at the top without removing.

```csharp
var stack = new Stack<string>();
stack.Push("a");
stack.Push("b");
stack.Push("c");
string x = stack.Pop();   // "c"
string y = stack.Peek();  // "b"
```

A queue has **Enqueue** (add at the back) and **Dequeue** (remove from the front):

```csharp
var q = new Queue<string>();
q.Enqueue("a"); q.Enqueue("b"); q.Enqueue("c");
string first = q.Dequeue();   // "a"
```

Each of these actions is **O(1)**: it touches only one end, so the size of the collection does not matter.

```check
{"prompt": "You push 1, then 2, then 3 onto a stack and pop once. What do you get?", "options": ["1", "2", "3"], "answer": 2, "explanation": "A stack is last in, first out. The last value pushed was 3, so it sits on top and is the first one popped."}
```

```reveal
{"prompt": "Stack: Push 1, Push 2, Push 3, Pop, Push 4, Pop, Pop. What does the final Pop return? Then: what if it were a queue with Enqueue/Dequeue in the same order?", "answer": "Stack: after the pushes it holds 1,2,3; Pop gives 3; Push 4; Pop gives 4; the last Pop gives **2**. Queue: Dequeue gives 1, then 4 is added at the back, then Dequeue gives 2, and the last Dequeue gives **3**."}
```

## A stack at work: matching brackets

Is `{[()]}` written correctly? Walk through the text. On an opening bracket, push it. On a closing bracket, pop and check it pairs. The most recent opener must close first, which is exactly LIFO.

```steps
{"title": "Checking {[()]} with a stack", "frames": [
  {"visual": "text:  { [ ( ) ] }\n       ^\nstack: {", "caption": "Opening bracket: push it."},
  {"visual": "text:  { [ ( ) ] }\n         ^\nstack: { [", "caption": "Another opener: push."},
  {"visual": "text:  { [ ( ) ] }\n           ^\nstack: { [ (", "caption": "Push again. The newest opener, (, is on top."},
  {"visual": "text:  { [ ( ) ] }\n             ^\nstack: { [", "caption": "A closer: pop the top, (, and it pairs with ). Good."},
  {"visual": "text:  { [ ( ) ] }\n               ^\nstack: {", "caption": "] pops [. Pairs."},
  {"visual": "text:  { [ ( ) ] }\n                 ^\nstack: (empty)", "caption": "} pops {. The text ended with an empty stack, so the brackets balance."}
]}
```

```csharp
bool Balanced(string s) {
    var st = new Stack<char>();
    foreach (char c in s) {
        if ("([{".Contains(c)) st.Push(c);
        else {
            if (st.Count == 0) return false;
            char o = st.Pop();
            if ("([{".IndexOf(o) != ")]}".IndexOf(c)) return false;
        }
    }
    return st.Count == 0;
}
```

For `"([)]"`: push `(`, push `[`, then `)` pops `[`, which doesn't pair, so false.

## Queues model waiting

A printer receives jobs and prints them in arrival order. If that were a stack, the newest job would always jump the line and old jobs might starve. A **deque** (double-ended queue, said "deck") allows adding and removing at both ends.

```check
{"prompt": "A print server should handle jobs in the order they arrive. Which structure fits?", "options": ["Stack", "Queue", "Neither, you need sorting"], "answer": 1, "explanation": "First come, first served is FIFO, which is exactly a queue. A stack would serve the newest job first and could leave old jobs waiting forever."}
```

## Where you'll meet it

- **The call stack.** Calling a function pushes a frame; returning pops it. Deep recursion can overflow it.
- **Undo** in an editor: each action is pushed, Undo pops the latest.
- **Browser back button**: visited pages form a stack.
- **Task queues**: background jobs, message systems and web requests wait in queues.
- **Graph search**: BFS uses a queue, DFS a stack (see *Graphs, BFS & DFS*).

## Common mistakes

- **Popping from an empty collection.** It throws an `InvalidOperationException`. Check `Count` first.
- **Using a `List` and calling `RemoveAt(0)` as a queue.** Every item shifts, so each removal is O(n). Use `Queue<T>`.
- **Forgetting the final check.** `"(("` never fails mid-way, so you must also check the stack is empty at the end.

```check
{"prompt": "After scanning the whole string \"((\" with the bracket algorithm, what must you still check?", "options": ["That the stack is empty", "That the queue is full", "That the string length is even", "Nothing, it is done"], "answer": 0, "explanation": "Both characters were openers and were pushed, and nothing ever closed them. Only by checking that the stack is empty at the end do you catch unmatched openers."}
```

```reveal
{"prompt": "A service keeps pending jobs in a List<Job> and takes the next job with jobs.RemoveAt(0). With 1,000,000 waiting jobs, what is the problem and the fix?", "answer": "`RemoveAt(0)` slides all remaining items left, so each take costs **O(n)** and draining the list is O(n²). Use `Queue<Job>`: `Dequeue()` is O(1)."}
```

## Recap

- **Stack**: last in, first out. Operations: Push, Pop, Peek.
- **Queue**: first in, first out. Operations: Enqueue, Dequeue.
- Each main operation is O(1).
- Stacks fit "undo the most recent thing" and matching pairs. Queues fit "wait your turn".
- Never pop from an empty collection without checking.
