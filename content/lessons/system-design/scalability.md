---
title: "Scalability & load"
summary: "Stateless services, load balancing, consistent hashing, and scaling on the right signal in Kubernetes."
---

## Vertical vs horizontal

Vertical scaling is simple but has a ceiling and a single point of failure. Horizontal scaling requires **stateless** instances: sessions live in Redis or a database, or in signed tokens. Uploads go to object storage, not local disk.

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
