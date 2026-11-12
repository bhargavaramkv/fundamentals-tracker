---
title: "Scalability & load"
summary: "Vertical vs horizontal scaling, stateless services, consistent hashing, and scaling on the right signal in Kubernetes."
---

## The idea

A food truck gets popular and the queue grows. You have two choices. Buy a bigger, faster grill, or open more trucks. The bigger grill is easy, but there is a biggest grill you can buy, and if it breaks you sell nothing. More trucks has no such limit, but customers must be split between them.

**Scalability** is a system's ability to cope with more users without falling over. The bigger grill is **vertical scaling** (a larger machine). More trucks is **horizontal scaling** (more machines). The usual first move is more copies of your server behind a load balancer, the front door from "Load balancers, from scratch". To check it helped, use the measures from "Latency, throughput & the numbers that matter": does each request still finish quickly, and how many per second can you handle?

```check
{"prompt": "Which statement about horizontal scaling is correct?", "options": ["It means buying one bigger machine", "It means adding more machines, so servers should not keep user data in their own memory", "It makes a single request run faster"], "answer": 1, "explanation": "Horizontal scaling adds machines and shares work between them, so any machine must be able to serve any user. That is why state moves to a shared store. It raises throughput; it does not speed up a single request."}
```

## Stateless services

Horizontal scaling needs **stateless** instances: a server keeps nothing about a user between requests. Sessions live in Redis or a database, or in signed tokens. Uploads go to object storage such as Azure Blob Storage, not local disk. Then any copy can answer anyone, and you can add or remove copies freely.

## Spreading keys: consistent hashing

Sometimes data, not just traffic, is split across machines (a cache cluster, a sharded database). The simple rule `node = hash(key) % N` breaks when N changes.

```steps
{"title": "Growing from 4 to 5 nodes with hash % N", "frames": [
  {"visual": "key hash:   1  2  3  4  5  6  7  8  9 10\nN=4 node:   1  2  3  0  1  2  3  0  1  2\n", "caption": "With 4 nodes, each key's node is its hash mod 4."},
  {"visual": "key hash:   1  2  3  4  5  6  7  8  9 10\nN=4 node:   1  2  3  0  1  2  3  0  1  2\nN=5 node:   1  2  3  4  0  1  2  3  4  0\n", "caption": "Add a fifth node and recompute with mod 5."},
  {"visual": "key hash:   1  2  3  4  5  6  7  8  9 10\nmoved?:     .  .  .  M  M  M  M  M  M  M\n", "caption": "Keys 4 to 10 moved: 7 of 10 here, and about 80% in general. A cache would go cold and flood the database."},
  {"visual": "ring: --A----B----C----D--  add E between C and D\n                  E takes over only part of D's keys\n", "caption": "**Consistent hashing** puts nodes on a ring and gives each key to the next node around it. A new node takes keys only from its neighbour, about 1/N of all keys."}
]}
```

Virtual nodes (each machine placed on the ring many times) even out the load.

**Why use it: stability, not speed or replication.** Hashing costs about the same either way, and you still replicate separately if you need copies. Example: 10 cache nodes, one dies. With `% N`, about 90% of keys change owner and the database eats the miss storm. With a ring, only that node's ~10% move.

**It does not give an even split.** A plain ring with one point per node is usually lopsided: positions are random, so one node can own a much bigger arc than another. Virtual nodes (100+ points per node) shrink the imbalance but never remove it, and a hot key still overloads whichever node owns it. Even spread is a side effect you tune; minimal remapping is the reason to use it.

```check
{"prompt": "You grow a cache from 4 nodes to 5 using hash(key) % N. Roughly what share of keys end up on a different node?", "options": ["About 20%", "About 50%", "About 80%"], "answer": 2, "explanation": "With mod N, about (N-1)/N of keys move when N changes, here around four fifths. Consistent hashing would move only about one fifth, the share the new node takes over."}
```

## Scaling on the right signal

In Kubernetes the Horizontal Pod Autoscaler (HPA) adds or removes pods (copies of your app). CPU is the default signal and works for CPU-bound services. An I/O-bound .NET API can have rising latency while CPU stays low, because requests are waiting on a database or another service.

```reveal
{"prompt": "Before you look: an API's CPU sits at 20% but p95 latency has tripled. The autoscaler (CPU-based) adds nothing. What is likely wrong, and what would you scale on instead?", "answer": "The pods are **waiting on I/O**, probably a saturated dependency such as the database or a small connection pool. First find that bottleneck; adding pods would make it worse. For the scaling signal use **in-flight requests per pod**, or queue depth / consumer lag (KEDA)."}
```

Better signals: in-flight requests or concurrency per pod, and queue depth. Keep p95 latency as a guardrail, not the scaling input. Also, in Kubernetes **readiness** controls whether a pod gets traffic and **liveness** controls restarts; never make liveness depend on a downstream database, or one database blip restarts every pod.

**Worked case:** p99 triples, CPU sits at 30%, pods wait on the DB. The CPU-based HPA never fires, and a fixed 50 replicas (or a bigger HPA max) just opens more connections against the same saturated database, so latency gets worse. Fix the bottleneck first (query or index, pool size, a cache, backpressure), then scale on concurrency or queue depth.

```check
{"prompt": "Ten cache nodes sit on a consistent-hash ring with no virtual nodes. One node dies. What is true?", "options": ["Only the dead node's keys move, but the remaining nodes may still own very uneven shares", "Every node now owns exactly one ninth of the keys", "Almost every key moves, just as with hash(key) % N"], "answer": 0, "explanation": "The ring hands the dead node's arc to its neighbour, so only about a tenth of keys move. It never promised an even split: with one point per node the arcs are random and lopsided, and the neighbour may now hold a double share. Virtual nodes reduce that imbalance."}
```

## Where you'll meet it

- Azure App Service or AKS scale-out rules; Kubernetes HPA and KEDA.
- Redis clusters and sharded databases (consistent hashing).
- Back-of-envelope sizing in interviews: 1 day is about 86,400 s, so 1M requests a day is about 12 requests per second on average (plan for 5 to 10 times that at peak).

## Common mistakes

- Scaling pods against a saturated database or connection pool.
- Keeping sessions or uploads on a server's local disk or memory.
- Scaling on CPU for an I/O-bound service.
- Using `hash % N` for a resizable cache.
- Skipping measurement. Use USE (Utilization, Saturation, Errors) for resources and RED (Rate, Errors, Duration) for services.

## Recap

- **Vertical** = bigger machine (ceiling, single point of failure); **horizontal** = more machines.
- Horizontal scaling needs **stateless** instances and shared state.
- **Consistent hashing** remaps about 1/N of keys when nodes change; `hash % N` remaps most.
- Scale on a signal that matches the bottleneck, and find the bottleneck first.
