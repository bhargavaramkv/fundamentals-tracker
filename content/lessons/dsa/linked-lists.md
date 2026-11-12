---
title: "Linked lists"
summary: "A chain of items where each one points to the next, and what that costs and buys you."
---

## The idea

Picture a treasure hunt. Each clue card holds a prize and a note saying where the next card is hidden. You do not know where card 5 is until you have followed cards 1 to 4.

A **linked list** works the same way. It is a chain of small objects called **nodes**. Each node holds a value and a **pointer** (also called a reference), which is just a stored address of another object. The last node points to nothing, written `null`.

Unlike an array (see *Arrays & strings*), the nodes do not need to sit side by side in memory. They can be anywhere, joined only by their pointers. That difference is the whole point.

## See it work

```csharp
class Node {
    public int Value;
    public Node Next;
}

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

`head` is a pointer to the first node, and it is the only thing you keep. To reach 30 you walk from the head:

```csharp
Node cur = head;
while (cur != null) {
    Console.WriteLine(cur.Value);
    cur = cur.Next;
}
```

`cur` is 10, print, move to 20, print, move to 30, print, move to `null`, stop. Visiting n nodes is O(n).

```check
{"prompt": "You only hold a pointer to the head of a list of 1,000 nodes. What is the cost to reach the last node?", "options": ["One step", "About 1,000 steps", "About 10 steps"], "answer": 1, "explanation": "There is no index to jump with. You must follow Next pointers one node at a time from the head, so reaching the end takes n steps: O(n)."}
```

## Relinking: the real strength

Changing a linked list means rewiring pointers, nothing shifts. Insert 25 after the node holding 20 (call it `after20`):

```steps
{"title": "Insert 25 after 20", "frames": [
  {"visual": "[10]--->[20]--->[30]--->null\n\n[25]--->null", "caption": "A new node 25 exists, but nothing points to it yet."},
  {"visual": "[10]--->[20]--->[30]--->null\n                 ^\n[25]-------------+", "caption": "Step 1: n.Next = after20.Next. The new node points at 30, so 30 is safe."},
  {"visual": "[10]--->[20]    [30]--->null\n          |      ^\n          v      |\n         [25]----+", "caption": "Step 2: after20.Next = n. Now 20 points at 25. The chain reads 10, 20, 25, 30."}
]}
```

```csharp
var n = new Node { Value = 25 };
n.Next = after20.Next;   // 25 points to 30
after20.Next = n;        // 20 points to 25
```

No item moved, so the insert is **O(1)** once you stand at the right spot. Inserting at the front is always O(1): make a node and point it at the old head.

```reveal
{"prompt": "What goes wrong if you run the two lines in the opposite order: after20.Next = n; first, then n.Next = after20.Next;?", "answer": "After the first line `after20.Next` *is* `n`, so the second line makes `n.Next = n`: the node points at itself. Node 30 is lost, and any walk loops forever. **Always point the new node at the rest first.**"}
```

```check
{"prompt": "When inserting a new node n after node a, which order is safe?", "options": ["a.Next = n; then n.Next = a.Next", "n.Next = a.Next; then a.Next = n", "Either order works the same", "Set both to null first"], "answer": 1, "explanation": "If you set a.Next = n first, the old link to the rest of the list is overwritten and lost. Copying a.Next into n.Next first keeps the chain connected."}
```

## Array or linked list?

| Job | Array | Linked list |
|---|---|---|
| Read item number k | O(1) | O(k) |
| Insert at the front | O(n) | O(1) |
| Insert after a known node | O(n) | O(1) |
| Find a value | O(n) | O(n) |

A **doubly linked list** adds a `Prev` pointer, so you can walk backwards and remove a node without searching for its neighbour. C# ships it as `LinkedList<T>`.

## Where you'll meet it

- **Undo history** and browser back/forward can be chains of states.
- **Stacks and queues** are often built on linked nodes (next lesson).
- **Hash tables** use short linked lists for items landing in the same bucket.
- **Interviews** love pointer puzzles: reverse a list, find the middle, detect a loop.

In practice arrays often win on real hardware because their items sit together and load quickly. Linked lists shine when you insert and delete a lot at known positions.

## Common mistakes

- **Losing the rest of the list** by rewiring in the wrong order.
- **Forgetting `null`.** `cur.Next.Value` when `cur.Next` is null throws a `NullReferenceException`.
- **Losing the head.** If you move `head` itself while walking, you can't reach the start. Walk with a separate `cur`.
- **Expecting `list[5]`.** There is no jump. Getting there costs 5 steps.

## Recap

- A linked list is a chain of **nodes**, each with a value and a pointer to the next.
- You hold the **head** and walk to reach anything: finding or indexing is O(n).
- Inserting or removing next to a known node is O(1): only pointers change.
- Rewire in an order that never loses the rest of the chain.
- Guard against `null` at the end.
