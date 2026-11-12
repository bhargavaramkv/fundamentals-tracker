---
title: "Trees, from scratch"
summary: "Data arranged like a family tree: one root, branches, and a simple way to visit every node."
---

## The idea

Think of a family tree, or the folders on your computer. There is one starting point at the top. It has children, those have children, and so on. Nothing loops back.

A **tree** is a set of **nodes** (items) connected like that:

- The top node is the **root**.
- A node directly below another is its **child**; the one above is its **parent**.
- A node with no children is a **leaf**.
- The **height** is the number of levels from the root down to the lowest leaf.

A tree is like a linked list (see *Linked lists*) where each node may point to several next nodes instead of one.

## See it work

A **binary tree** allows at most two children per node, called left and right.

```csharp
class Node {
    public int Value;
    public Node Left, Right;
}
```

```
        8
       / \
      3   10
     / \    \
    1   6    14
```

Here 8 is the root. 3 and 10 are its children. 1, 6 and 14 are leaves. The height is 3 levels.

A **binary search tree** (BST) adds one rule: for every node, everything in its left subtree is smaller, and everything in its right subtree is bigger. The tree above follows it. That rule is what makes searching quick:

```steps
{"title": "Search the BST for 6", "frames": [
  {"visual": "         8*\n        / \\\n       3   10\n      / \\    \\\n     1   6    14\n\nlooking for 6, now at 8", "caption": "Start at the root. 6 is smaller than 8, so everything on the right is out. Go left."},
  {"visual": "         8\n        / \\\n       3*  10\n      / \\    \\\n     1   6    14\n\nlooking for 6, now at 3", "caption": "6 is bigger than 3, so the left child 1 is out. Go right."},
  {"visual": "         8\n        / \\\n       3   10\n      / \\    \\\n     1   6*   14\n\nlooking for 6, now at 6", "caption": "Found in three steps. Each step threw away a whole side, like binary search in *Sorting & binary search*."}
]}
```

```check
{"prompt": "In the tree above, which nodes are leaves?", "options": ["8 only", "3 and 10", "1, 6 and 14", "1, 3 and 8"], "answer": 2, "explanation": "A leaf is a node with no children. 1, 6 and 14 have nothing below them, while 8, 3 and 10 each have at least one child."}
```

```reveal
{"prompt": "You insert 7 into the tree above. Where does the new node end up?", "answer": "As the **right child of 6**. 7 < 8 so go left; 7 > 3 so go right; 7 > 6 so go right again, and that spot is empty. Insert follows the search path and attaches a new leaf where the search would have ended."}
```

## How it works

Searching a BST is a loop that goes left or right:

```csharp
bool Contains(Node n, int x) {
    while (n != null) {
        if (x == n.Value) return true;
        n = x < n.Value ? n.Left : n.Right;
    }
    return false;
}
```

When the tree is **balanced** (both sides roughly equal), the height is about log n, so search and insert are **O(log n)**.

```reveal
{"prompt": "You insert 1, 2, 3, 4, 5 in that order into an empty BST. What shape do you get, and what does searching cost?", "answer": "Each number is bigger than the last, so each goes to the right of the previous one: a **chain** leaning right, height 5. Search is O(n), no better than a list. Self-balancing trees (like the one behind `SortedDictionary`) prevent this."}
```

## Visiting every node

To visit every node, use a **traversal**. A tree is naturally recursive: a node is a value plus two smaller trees. The three depth-first orders differ only in when you handle the node:

```csharp
void InOrder(Node n) {
    if (n == null) return;     // base case
    InOrder(n.Left);
    Console.Write(n.Value + " ");
    InOrder(n.Right);
}
```

On our tree, in-order prints `1 3 6 8 10 14`: sorted! **Pre-order** handles the node first (8 3 1 6 10 14). **Post-order** handles it last (1 6 3 14 10 8). **Level order** goes row by row using a queue (see *Stacks & queues*): 8, then 3 10, then 1 6 14.

```check
{"prompt": "What does an in-order traversal of a binary search tree produce?", "options": ["Values from the bottom level up", "Values in sorted order", "Values in the order they were inserted", "Only the leaves"], "answer": 1, "explanation": "In-order visits the left subtree, then the node, then the right subtree. Since left values are smaller and right values are larger, that yields ascending order."}
```

## Where you'll meet it

- **File systems**: folders inside folders.
- **HTML**: the page is a tree of elements, the DOM.
- **Databases** keep indexes in balanced trees for fast lookup.
- **Decisions**: game moves, expression parsing, org charts.
- Interviews: tree height, check if two trees match, lowest common ancestor.

## Common mistakes

- **Forgetting the empty tree.** A `null` node is a valid input, so check for it first.
- **Mixing up BST and any binary tree.** The sorted rule is only for BSTs, and it applies to the whole subtree, not just direct children.
- **Assuming O(log n) always.** An unbalanced tree can degrade to O(n).
- **Confusing depth and height.** Depth counts down from the root to a node; height counts down from a node to its deepest leaf.

## Recap

- A **tree** has a root, parents and children, and no cycles; leaves have no children.
- A **binary tree** has up to two children per node.
- A **BST** keeps smaller values left and larger values right, giving O(log n) search when balanced.
- Traversals (pre-, in-, post-order) are short recursive functions; level order uses a queue.
- In-order on a BST gives sorted output.
