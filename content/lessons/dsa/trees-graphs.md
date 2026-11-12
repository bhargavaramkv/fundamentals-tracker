---
title: "Trees & graphs"
summary: "Validating BSTs, cheapest paths with Dijkstra, dependency order and cycle detection, and where each tool breaks."
---

## The idea

You met the basics in *Trees, from scratch* and *Graphs, BFS & DFS*. A tree has a root and no loops. A graph is any set of dots and lines, and may loop.

Think of a road map. A basic search tells you whether you can reach a town. The sharper questions are different. What is the *cheapest* route when roads have different lengths? Which tasks must happen *before* others? Is there a circular dependency that can never be satisfied? This lesson covers those, and where each tool breaks.

```check
{"prompt": "What is the difference between a tree and a general graph?", "options": ["A tree has no cycles and one root; a graph may have cycles", "A tree has more nodes", "A graph cannot have edges", "A tree must be sorted"], "answer": 0, "explanation": "A tree is a connected graph with no cycles, usually viewed from a root. A general graph can have cycles and any pattern of connections."}
```

## Validating a BST

A classic trap: checking only that each node is bigger than its left child and smaller than its right child. The rule applies to the *whole subtree*, so pass down the allowed range:

```csharp
bool IsBst(Node n, long lo, long hi) {
    if (n == null) return true;
    if (n.Value <= lo || n.Value >= hi) return false;
    return IsBst(n.Left, lo, n.Value)
        && IsBst(n.Right, n.Value, hi);
}
// IsBst(root, long.MinValue, long.MaxValue)
```

Another way: an in-order traversal of a valid BST is strictly increasing.

```reveal
{"prompt": "Root 5, left child 3, right child 8, and 8 has a left child 4. Every parent is bigger than its left child and smaller than its right child. Is it a valid BST?", "answer": "**No.** 4 sits in the right subtree of 5, so it must be bigger than 5. Comparing only parent and child misses this; the (lo, hi) range catches it, since 4 must satisfy 5 < 4 < 8."}
```

## Cheapest path: Dijkstra

BFS counts edges, so it fails when edges have different costs. **Dijkstra's algorithm** keeps the best known distance to every node and repeatedly finalizes the unfinished node with the smallest distance. Then it checks whether going through that node improves its neighbours (called **relaxing** an edge). Here is a small run from A:

```steps
{"title":"Dijkstra from A","frames":[{"visual":"edges: A-B 4, A-C 1, C-B 2, B-D 1, C-D 5\n\nnode    A    B    C    D\ndist    0    inf  inf  inf\ndone    -    -    -    -\n\nbest known distance from A","caption":"Start: A is 0 away, everything else unknown (inf)."},{"visual":"edges: A-B 4, A-C 1, C-B 2, B-D 1, C-D 5\n\nnode    A    B    C    D\ndist    0    4    1    inf\ndone    yes  -    -    -\n\nA done. B=0+4, C=0+1","caption":"Finalize A (smallest, 0). Relax its edges: B is at most 4, C at most 1."},{"visual":"edges: A-B 4, A-C 1, C-B 2, B-D 1, C-D 5\n\nnode    A    B    C    D\ndist    0    3    1    6\ndone    yes  -    yes  -\n\nC done. B=1+2=3 beats 4; D=1+5","caption":"Finalize C (1, the smallest unfinished). Through C, B drops from 4 to 3, and D becomes 6."},{"visual":"edges: A-B 4, A-C 1, C-B 2, B-D 1, C-D 5\n\nnode    A    B    C    D\ndist    0    3    1    4\ndone    yes  yes  yes  -\n\nB done. D=3+1=4 beats 6","caption":"Finalize B (3). Through B, D drops from 6 to 4."},{"visual":"edges: A-B 4, A-C 1, C-B 2, B-D 1, C-D 5\n\nnode    A    B    C    D\ndist    0    3    1    4\ndone    yes  yes  yes  yes\n\nD done. cheapest A->D is 4: A,C,B,D","caption":"Finalize D. Every node is final. The direct route A-B (4) and C-D (5) both lost to the cheaper detour."}]}
```

With a binary heap (`PriorityQueue<TElement, TPriority>` in .NET) it costs O((V + E) log V).

```check
{"prompt": "Edges have different costs and none are negative. Which algorithm finds the cheapest path from one start node?", "options": ["Plain BFS", "Dijkstra's algorithm", "In-order traversal", "Binary search"], "answer": 1, "explanation": "BFS counts edges, not cost. Dijkstra always expands the cheapest unfinished node, which is correct when all edge weights are non-negative."}
```

## Where Dijkstra breaks

Once a node is finalized its distance is never revisited. A negative edge could later make that distance smaller, but the node is already closed.

For example, with A to B costing 2, A to C costing 5 and C to B costing -4, Dijkstra finalizes B at 2, but the true cheapest is 1 (A, C, B). For negative edges use Bellman-Ford.

## Order and cycles in directed graphs

Build steps, project references and DI registrations are *directed* graphs: A points to B if A must come first. A **topological sort** lists nodes so every edge goes forward. **Kahn's algorithm** does it like this:

1. Count each node's incoming edges (its **in-degree**).
2. Put every node with in-degree 0 in a queue; they depend on nothing.
3. Take one, output it, and lower its neighbours' in-degree by 1; any that hit 0 join the queue.
4. If you output fewer than V nodes, the rest sit on a **cycle**.

```reveal
{"prompt": "Core must build before Web, Web before Tests, and Tests before Core. What happens when Kahn's algorithm runs?", "answer": "Every project has an incoming edge, so none has in-degree 0 and the queue starts **empty**. Zero of 3 nodes are output, which is fewer than V, so it reports a **cycle**. DI containers and build tools report the same thing as a circular dependency error."}
```

Cycle detection depends on direction. **Undirected:** Union-Find (tracks which nodes are connected, near O(1) per operation) or a DFS that ignores the edge back to its parent. **Directed:** a DFS that colours nodes white (new), gray (on the current path) and black (done); reaching a gray node means a cycle.

## Pick the tool

| Need | Use |
|---|---|
| Shortest path, unweighted | BFS |
| Shortest path, non-negative weights | Dijkstra |
| Negative weights, or detect negative cycles | Bellman-Ford, O(V·E) |
| Dependency order | Topological sort |
| Are these two nodes connected? | Union-Find |

## Common mistakes

- **Using BFS on weighted edges**, or Dijkstra with negative ones.
- **Validating a BST by checking children only.**
- **Using an undirected cycle check on a directed graph** (two nodes pointing at one shared node is not a cycle).

```check
{"prompt": "Kahn's algorithm outputs only 4 nodes of a 6-node directed graph. What does that tell you?", "options": ["The graph has a cycle", "The graph is a tree", "The graph is undirected", "Two nodes are duplicates"], "answer": 0, "explanation": "Nodes on a cycle never reach in-degree 0, so they are never output. Fewer than V nodes output means a cycle exists."}
```

## Recap

- Validate a BST with ranges, not parent-child comparisons.
- **Dijkstra** finds cheapest paths with non-negative weights; negative edges break it.
- **Topological sort** orders dependencies; if it can't finish, there is a cycle.
- Cycle detection differs for directed and undirected graphs.
- Match the tool to the question: edges counted, weights, order, or connectivity.
