---
title: "Trees & graphs"
summary: "Traversals, shortest paths, cycle detection and topological sort, with when each one breaks."
---

## The idea

Trees and graphs describe things that are connected: folders inside folders, towns joined by roads, packages that depend on other packages. You met the basics in *Trees, from scratch* and *Graphs, BFS & DFS*. A tree has a root and no loops. A graph is any set of dots and lines, and may loop.

Think of a road map. A basic search tells you whether you can reach a town. The deeper questions are different. What is the cheapest route when roads have different lengths? Which tasks must happen before others? Is there a circular dependency that can never be satisfied? This lesson covers those sharper questions, and where each tool breaks.

```check
{"prompt": "What is the difference between a tree and a general graph?", "options": ["A tree has no cycles and one root; a graph may have cycles", "A tree has more nodes", "A graph cannot have edges", "A tree must be sorted"], "answer": 0, "explanation": "A tree is a connected graph with no cycles, usually viewed from a root. A general graph can have cycles and any pattern of connections."}
```

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

```check
{"prompt": "Edges have different costs and none are negative. Which algorithm finds the cheapest path from one start node?", "options": ["Plain BFS", "Dijkstra's algorithm", "In-order traversal", "Binary search"], "answer": 1, "explanation": "BFS counts edges, not cost. Dijkstra always expands the cheapest unfinished node, which is correct when all edge weights are non-negative."}
```

## Cycle detection depends on direction

- **Undirected:** Union-Find, or DFS that ignores the edge back to the parent.
- **Directed:** DFS with three colors (white / gray = on the stack / black). A gray→gray edge means a cycle. Or run Kahn's algorithm: if fewer than V nodes are output, there is a cycle.

Real-world uses: build systems, DI container resolution, and microservice call graphs are all directed graphs where you need topological order and cycle errors.
