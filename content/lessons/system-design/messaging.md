---
title: "Messaging & event streaming"
summary: "Queues vs pub/sub, delivery guarantees, ordering and partitioning in Kafka."
---

## Queue vs pub/sub

- **Work queue (competing consumers):** each message is processed by **one** consumer. Use it to spread work.
- **Pub/sub:** **every** subscriber gets a copy. Use it to fan out an event.
- **Kafka** does both: within a consumer group a partition goes to one consumer (a queue), and multiple groups each read everything (pub/sub).

## Delivery guarantees

| Guarantee | How | Consequence |
|---|---|---|
| At-most-once | ack before processing | can lose messages |
| **At-least-once** | ack after processing | **duplicates**, so consumers must be idempotent |
| "Exactly-once" | at-least-once + dedup/transactions | only within a boundary (e.g. Kafka→Kafka transactions) |

Idempotent consumers: keep a processed-ID table with a unique constraint, use upserts, or use state-setting operations.

## Ordering

Kafka orders messages **only within a partition**. Use the entity ID as the message key so one order's events stay in sequence while different orders run in parallel. Caveats:

- Changing the partition count remaps keys.
- Retries can reorder messages unless `enable.idempotence=true`, the default in modern clients.

## Failure handling

- **Retry with backoff**, then send to a **dead-letter queue** after N attempts, with alerting.
- **Poison messages** must not block a partition forever.
- **Consumer lag** is your key health metric and a good autoscaling signal (KEDA).

## When not to use a broker

For a simple request-reply that needs an immediate answer, use HTTP or gRPC. A broker adds latency, operational load and eventual consistency.
