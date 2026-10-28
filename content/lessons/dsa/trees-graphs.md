---
title: "Trees & graphs"
summary: "Traversals, shortest paths, cycle detection and topological sort, with when each one breaks."
---

## Trees

- **BST in-order = sorted.** Validate a BST by checking that in-order output is strictly increasing, or by passing (min, max) bounds down. Don't just compare each node with its children.
- Balanced BSTs (red-black, AVL) give O(log n) operations. `SortedDictionary` in .NET is a red-black tree.

## Graph traversal

| Need | Use |
|---|---|
| Shortest path, unweighted | BFS |
| Shortest path, non-negative weights | Dijkstra (binary heap: O((V+E) log V)) |
| Negative weights / detect negative cycles | Bellman-Ford O(VE) |
| Dependency order | Topological sort (Kahn's or DFS post-order) |
| Connectivity, undirected | Union-Find (near O(1) per op) |

## Why Dijkstra breaks with negative edges

It marks a node final when it is popped from the heap. A later negative edge could make that distance smaller, but the node is already closed.

## Cycle detection depends on direction

- **Undirected:** Union-Find, or DFS that ignores the edge back to the parent.
- **Directed:** DFS with three colors (white / gray = on the stack / black). A gray→gray edge means a cycle. Or run Kahn's algorithm: if fewer than V nodes are output, there is a cycle.

Real-world uses: build systems, DI container resolution, and microservice call graphs are all directed graphs where you need topological order and cycle errors.
