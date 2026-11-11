---
title: "Linked lists"
summary: "A chain of items where each one points to the next, and what that costs and buys you."
---

## The idea

Picture a treasure hunt. Each clue card holds a prize and a note saying where the next card is hidden. You do not know where card 5 is until you have followed cards 1 to 4.

A **linked list** works the same way. It is a chain of small objects called **nodes**. Each node holds a value and a **pointer** (also called a reference) to the next node. A pointer is just a stored address of another object. The last node points to nothing, written `null`.

Unlike an array, the nodes do not need to sit side by side in memory. They can be anywhere, joined only by their pointers. You met arrays in *Arrays & strings*, and the difference between the two is the whole point.

## See it work

```csharp
class Node {
    public int Value;
    public Node Next;
}
```

Build the list 10 → 20 → 30:

```csharp
var head = new Node { Value = 10 };
head.Next = new Node { Value = 20 };
head.Next.Next = new Node { Value = 30 };
```

```
head
 |
 v
[10|*]--->[20|*]--->[30|null]
```

`head` is a pointer to the first node. It is the only thing you keep. To reach 30, you must walk from the head:

```csharp
Node cur = head;
while (cur != null) {
    Console.WriteLine(cur.Value);
    cur = cur.Next;
}
```

Trace: `cur` is 10, print it, move to 20, print it, move to 30, print it, move to `null`, stop. The walk visits n nodes, so it is O(n).

```check
{"prompt": "You only hold a pointer to the head of a list of 1,000 nodes. What is the cost to reach the last node?", "options": ["One step", "About 1,000 steps", "About 10 steps"], "answer": 1, "explanation": "There is no index to jump with. You must follow Next pointers one node at a time from the head, so reaching the end takes n steps: O(n)."}
```

## How it works

The strength of a linked list is changing it. To insert a new node after a known node, you only rewire two pointers:

```
insert 25 after 20:

[20|*]--->[30|null]        before

[20|*]-->[25|*]-->[30|null]   after
```

```csharp
var n = new Node { Value = 25 };
n.Next = after20.Next;   // 25 points to 30
after20.Next = n;        // 20 points to 25
```

Order matters. If you set `after20.Next = n` first, you lose the way to 30. Nothing shifts, so the insert is **O(1)** once you are standing at the right spot. Inserting at the front is always O(1): make a new node and point it at the old head.

Compare with an array:

| Job | Array | Linked list |
|---|---|---|
| Read item number k | O(1) | O(k) |
| Insert at the front | O(n) | O(1) |
| Insert after a known node | O(n) | O(1) |
| Find a value | O(n) | O(n) |

A **doubly linked list** adds a `Prev` pointer to each node, so you can walk backwards and remove a node without searching for its neighbour. C# ships it as `LinkedList<T>`.

A classic trick is reversing a list by flipping each pointer as you walk:

```csharp
Node prev = null, cur = head;
while (cur != null) {
    Node next = cur.Next;  // save the rest
    cur.Next = prev;       // flip the arrow
    prev = cur; cur = next;
}
head = prev;
```

```check
{"prompt": "When inserting a new node n after node a, which order is safe?", "options": ["a.Next = n; then n.Next = a.Next", "n.Next = a.Next; then a.Next = n", "Either order works the same", "Set both to null first"], "answer": 1, "explanation": "If you set a.Next = n first, the old link to the rest of the list is overwritten and lost. Copying a.Next into n.Next first keeps the chain connected."}
```

## Where you'll meet it

- **Undo history** and browser back/forward can be modelled as chains of states.
- **Queues and stacks** are often built on linked nodes (next lessons).
- **Hash tables** use short linked lists to hold items that land in the same bucket.
- **Interviews** love pointer puzzles: reverse a list, find the middle, detect a loop.

In practice, arrays often win on real hardware because their items sit together and load quickly. Linked lists shine when you insert and delete a lot at known positions.

## Common mistakes

- **Losing the rest of the list** by rewiring in the wrong order.
- **Forgetting `null`.** Calling `cur.Next.Value` when `cur.Next` is null throws a `NullReferenceException`. Check before you step.
- **Losing the head.** If you move `head` itself while walking, you can no longer reach the start. Walk with a separate `cur`.
- **Assuming fast lookup by position.** There is no `list[5]`. Getting there costs 5 steps.

## Recap

- A linked list is a chain of **nodes**, each with a value and a pointer to the next.
- You hold the **head** and must walk to reach anything: finding or indexing is O(n).
- Inserting or removing next to a known node is O(1): only pointers change.
- Rewire in an order that never loses the rest of the chain.
- Always guard against `null` at the end.
