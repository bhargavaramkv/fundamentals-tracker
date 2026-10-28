---
title: "Consistency, idempotency & distributed writes"
summary: "CAP/PACELC, idempotency keys, the dual-write problem and the outbox pattern."
---

## CAP and PACELC

During a **P**artition, choose **C**onsistency or **A**vailability. **E**lse (normal operation), choose **L**atency or **C**onsistency. Most real systems are tunable per operation (MongoDB read and write concerns, Cassandra quorum levels).

## Consistency models, from strongest to weakest

Linearizable → sequential → causal (read-your-writes, monotonic reads) → eventual. Name the guarantee each user flow needs. "The user sees their own comment" is causal, not linearizable.

## Idempotency

Networks lose responses, so clients retry. Make retries safe:

- **Idempotency-Key header:** the server stores `(key, response)` under a unique constraint and replays the stored response for a repeat key.
- **Natural idempotency:** `PUT` sets state, upserts, and conditional updates (`WHERE version = @v`).

## The dual-write problem

```
save(order)        ✔ committed
publish(event)     ✘ broker down → downstream never learns
```

Reversing the order is no better. **Transactional outbox**: insert the event into an `outbox` table *in the same transaction* as the state change. A relay (poller, or CDC with Debezium or MongoDB change streams) publishes it and marks it sent. That gives at-least-once delivery, so consumers deduplicate by event ID.

## Sagas

Long-running workflows across services use a series of local transactions plus **compensations** (refund, release inventory), coordinated by an orchestrator or by choreography over events. Design every step to be idempotent and every compensation to be retryable.
