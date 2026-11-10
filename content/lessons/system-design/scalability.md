---
title: "Scalability & load"
summary: "Stateless services, load balancing, consistent hashing, and scaling on the right signal in Kubernetes."
---

## The idea

A food truck gets popular and the queue grows. You have two choices. Buy a bigger, faster grill, or open more trucks. The bigger grill is easy, but there is a biggest grill you can buy, and if it breaks you sell nothing. More trucks has no such limit, but customers must be split between them.

**Scalability** is a system's ability to cope with more users without falling over. The first fix is usually more copies of your server behind a load balancer, which is the front door described in "Load balancers, from scratch". Because the work is now shared, "Latency, throughput & the numbers that matter" gives you the way to measure whether it helped: does each request still finish quickly, and how many can you handle per second?

## Vertical vs horizontal

Vertical scaling is simple but has a ceiling and a single point of failure. Horizontal scaling requires **stateless** instances: sessions live in Redis or a database, or in signed tokens. Uploads go to object storage, not local disk.

```check
{"prompt": "Which statement about horizontal scaling is correct?", "options": ["It means buying one bigger machine", "It means adding more machines, so servers should not keep user data in their own memory", "It makes a single request run faster"], "answer": 1, "explanation": "Horizontal scaling adds machines and shares work between them, so any machine must be able to serve any user. That is why state moves to a shared store. It raises throughput; it does not speed up a single request."}
```

## Load balancing

- **L4** (TCP) vs **L7** (HTTP, which can route by path or header).
- Algorithms: round-robin, least-connections (better for uneven request costs), consistent hashing (for affinity or cache locality).
- Health checks decide membership. In Kubernetes, **readiness** controls whether a pod gets traffic and **liveness** controls restarts. Never make liveness depend on a downstream DB.

## Consistent hashing

With `hash % N`, changing N remaps almost every key, so your cache goes cold all at once. With a hash ring, changing nodes moves only about 1/N of the keys. Virtual nodes even out the distribution.

## Scaling on the right signal

The HPA on CPU works for CPU-bound services. For I/O-bound .NET or Node APIs, latency can climb while CPU stays low. Better signals:

- In-flight requests or concurrency per pod
- Queue depth or consumer lag (KEDA)
- p95 latency as a guardrail, not as the scaling input

And **find the bottleneck first**: scaling pods against a saturated database or a small connection pool makes things worse. Use the USE method (Utilization, Saturation, Errors) for resources and RED (Rate, Errors, Duration) for services.

## Back-of-envelope numbers

- 1 day ≈ 86,400 s, so 1M requests/day ≈ 12 RPS on average (plan for 5–10× at peak).
- Same-datacenter round trip ≈ 0.5 ms; cross-region ≈ 50–150 ms.
- Main memory read ≈ 100 ns; SSD random read ≈ 100 µs.

## Why `hash % N` breaks

Changing N remaps about (N-1)/N of keys, so a cache resize empties the cache and floods the DB. Consistent hashing remaps only about 1/N. It is about *remapping*, not replication or speed.

```check
{"prompt": "You grow a cache from 4 nodes to 5 using hash(key) % N. Roughly what share of keys end up on a different node?", "options": ["About 20%", "About 50%", "About 80%"], "answer": 2, "explanation": "With mod N, about (N-1)/N of keys move when N changes, here around four fifths. Consistent hashing would move only about one fifth, the share the new node takes over."}
```

## Scaling signal

If CPU is low but latency is high, pods are waiting on I/O. Scale on in-flight requests or queue depth, and find the saturated dependency (DB, pool) before adding replicas.
