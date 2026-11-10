---
title: "Stacks & queues"
summary: "Two simple ways to hold items, last-in-first-out and first-in-first-out, and why they are everywhere."
---

## The idea

Two everyday pictures cover this whole lesson.

A **stack of plates**: you put a clean plate on top, and you take a plate from the top. The last plate you added is the first one you take. This is **LIFO**, short for last in, first out.

A **queue at a shop**: new people join the back, and the person at the front is served first. The first to arrive is the first to leave. This is **FIFO**, short for first in, first out.

Both are collections with strict rules about where you add and where you remove. The rules sound limiting, but they match many real problems perfectly. You can build both on an array or a linked list (see *Arrays & strings* and *Linked lists*).

## See it work

A stack has two main actions. **Push** adds to the top. **Pop** removes from the top.

```csharp
var stack = new Stack<string>();
stack.Push("a");
stack.Push("b");
stack.Push("c");
string x = stack.Pop();   // "c"
string y = stack.Peek();  // "b" (look, don't remove)
```

```
push a, b, c        pop
                   
 | c |  <- top      | b |  <- top
 | b |              | a |
 | a |              
```

A queue has **Enqueue** (add at the back) and **Dequeue** (remove from the front).

```csharp
var q = new Queue<string>();
q.Enqueue("a");
q.Enqueue("b");
q.Enqueue("c");
string first = q.Dequeue();   // "a"
```

```
front [ a | b | c ] back   ->   front [ b | c ] back
```

Each of these actions is **O(1)**: it touches only one end, so the size of the collection does not matter.

```check
{"prompt": "You push 1, then 2, then 3 onto a stack and pop once. What do you get?", "options": ["1", "2", "3"], "answer": 2, "explanation": "A stack is last in, first out. The last value pushed was 3, so it sits on top and is the first one popped."}
```

## How it works

Why both ends matter: a stack uses one end for both adding and removing. A queue adds at one end and removes at the other.

Now a famous use of a stack: checking that brackets match, such as `{[()]}`. Walk through the text. On an opening bracket, push it. On a closing bracket, pop and check that it pairs with it.

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

Trace `"([)]"`: push `(`, push `[`. Next is `)`. Pop gives `[`, which does not pair with `)`, so return false. The most recent opener must be closed first, which is exactly LIFO.

Queues model waiting. A printer receives jobs and prints them in arrival order. If a queue were a stack, the newest job would always jump ahead and early jobs might starve.

A **deque** (double-ended queue, said "deck") allows adding and removing at both ends. It is a flexible cousin of both.

```check
{"prompt": "A print server should handle jobs in the order they arrive. Which structure fits?", "options": ["Stack", "Queue", "Neither, you need sorting"], "answer": 1, "explanation": "First come, first served is FIFO, which is exactly a queue. A stack would serve the newest job first and could leave old jobs waiting forever."}
```

## Where you'll meet it

- **The call stack.** When a function calls another, the computer pushes a frame; when it returns, it pops. Deep recursion can overflow this stack.
- **Undo** in an editor: each action is pushed, and Undo pops the latest.
- **Browser back button**: pages visited form a stack.
- **Task queues**: background jobs, message systems and web requests wait in queues.
- **Breadth-first search** in graphs uses a queue, and depth-first search uses a stack (see *Graphs, BFS & DFS*).

## Common mistakes

- **Popping from an empty stack or queue.** It throws an `InvalidOperationException`. Check `Count` first.
- **Mixing up the two.** Picture plates versus shop line before choosing.
- **Using a `List` and removing from index 0 as a queue.** That shifts every item, costing O(n) each time. Use `Queue<T>`.
- **Forgetting the final check.** A bracket string like `"(("` never fails mid-way, so you must also check the stack is empty at the end.

```check
{"prompt": "After scanning the whole string \"((\" with the bracket algorithm, what must you still check?", "options": ["That the stack is empty", "That the queue is full", "That the string length is even", "Nothing, it is done"], "answer": 0, "explanation": "Both characters were openers and were pushed, and nothing ever closed them. Only by checking that the stack is empty at the end do you catch unmatched openers."}
```

## Recap

- **Stack**: last in, first out. Operations: Push, Pop, Peek.
- **Queue**: first in, first out. Operations: Enqueue, Dequeue.
- Each main operation is O(1).
- Stacks fit "undo the most recent thing" problems and matching pairs. Queues fit "wait your turn".
- Never pop from an empty collection without checking.
