---
title: "Graphs, BFS & DFS"
summary: "Dots joined by lines, how to store them, and the two basic ways to explore them."
---

## The idea

Think of a map of friendships, or the subway. People or stations are dots. Lines show who knows whom, or which stations connect.

A **graph** is exactly that: a set of **nodes** (also called vertices) joined by **edges**. It is the general version of a tree (see *Trees, from scratch*). A tree is a graph with no loops. A general graph may have loops, and a node may connect to any other.

Edges can be **undirected** (friendship goes both ways) or **directed** (a one-way street, or "follows" on social media). Two nodes joined by an edge are **neighbours**.

Typical questions: can I get from A to B? What is the fewest hops? Is everything connected?

## See it work

Five nodes with these undirected edges:

```
A - B - D
|   |
C   E
```

Edges: A-B, A-C, B-D, B-E. The easy way to store a graph is an **adjacency list**: for each node, the list of its neighbours.

```csharp
var g = new Dictionary<string, List<string>> {
    ["A"] = new() { "B", "C" },
    ["B"] = new() { "A", "D", "E" },
    ["C"] = new() { "A" },
    ["D"] = new() { "B" },
    ["E"] = new() { "B" },
};
```

To explore without going in circles, you keep a **visited** set, because a graph can loop back. Without it, you would bounce A, B, A, B forever.

```check
{"prompt": "Why does graph exploration need a visited set?", "options": ["To sort the nodes", "To avoid revisiting nodes and looping forever", "To count the edges", "To make edges directed"], "answer": 1, "explanation": "Graphs can contain cycles, so you may reach a node you already handled. Recording visited nodes ensures each one is processed once and the search ends."}
```

## How it works

**Breadth-first search (BFS)** explores in rings: all neighbours first, then their neighbours. It uses a **queue** (see *Stacks & queues*).

```csharp
void Bfs(string start) {
    var seen = new HashSet<string> { start };
    var q = new Queue<string>();
    q.Enqueue(start);
    while (q.Count > 0) {
        string cur = q.Dequeue();
        Console.Write(cur + " ");
        foreach (string nb in g[cur])
            if (seen.Add(nb)) q.Enqueue(nb);
    }
}
```

Trace from A: queue `[A]`. Take A, add B and C: `[B, C]`. Take B, add D and E: `[C, D, E]`. Then C, D, E add nothing new. Output: `A B C D E`.

Because BFS visits nodes in order of distance, the first time it reaches a node is by the **fewest edges**. That makes it the tool for shortest path in an unweighted graph.

**Depth-first search (DFS)** goes as deep as it can along one path, then backs up. It uses a **stack**, or just recursion (see *Recursion*), whose call stack does the job:

```csharp
void Dfs(string cur, HashSet<string> seen) {
    seen.Add(cur);
    Console.Write(cur + " ");
    foreach (string nb in g[cur])
        if (!seen.Contains(nb)) Dfs(nb, seen);
}
```

From A: visit A, then B, then B's first unseen neighbour D, back up to E, back up to A's next neighbour C. Output: `A B D E C`.

Both visit each node once and look at each edge once, so both run in **O(V + E)**, where V is the number of nodes and E the number of edges.

```check
{"prompt": "You need the route with the fewest hops between two stations on an unweighted map. Which search fits?", "options": ["Depth-first search", "Breadth-first search", "Binary search", "Either, they always give the same path"], "answer": 1, "explanation": "BFS explores in rings of increasing distance, so the first time it reaches the target is via the fewest edges. DFS may find a long winding path first."}
```

## Where you'll meet it

- **Maps and navigation**: roads are edges, junctions are nodes.
- **Social networks**: friends of friends is a BFS two steps deep.
- **Dependencies**: which package or build step must come first.
- **Web crawlers**: pages are nodes, links are edges.
- Interviews: count islands in a grid, clone a graph, word ladder, course schedule.

## Common mistakes

- **No visited set.** Cycles make the search run forever.
- **Marking visited too late in BFS.** If you mark a node when you dequeue it, it can enter the queue many times. Mark when you enqueue.
- **Using DFS for shortest path.** It does not promise the fewest edges.
- **Forgetting disconnected parts.** One search from a single start only reaches that node's component. Loop over all nodes to cover the rest.

## Recap

- A **graph** is nodes plus edges, directed or undirected; a tree is a graph with no cycles.
- Store it as an **adjacency list**: node to neighbours.
- **BFS** uses a queue, explores by distance, and finds fewest-edge paths.
- **DFS** uses a stack or recursion and goes deep first.
- Always track visited nodes; both searches cost O(V + E).
