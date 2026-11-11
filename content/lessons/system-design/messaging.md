---
title: "Messaging & event streaming"
summary: "Queues vs pub/sub, delivery guarantees, ordering and partitioning in Kafka."
---

## The idea

When you post a letter, you don't wait at the postbox until it is read. You drop it in and carry on with your day. The postal service holds it and delivers it when it can.

**Messaging** works like that between programs. Instead of calling another service and waiting for an answer (the request and response from "Clients & servers"), one service drops a **message** into a **queue** or **topic** run by a **broker**, and moves on. Another service picks it up when ready. This smooths out sudden bursts, lets slow work happen in the background, and means a down service does not lose the work. The cost: delivery is not instant, and the same message may arrive twice, which ties into the idempotency ideas in "Consistency, idempotency & distributed writes".

```check
{"prompt": "A user uploads a video and you want to transcode it without making them wait. What fits best?", "options": ["Do the transcode inside the upload request", "Put a 'transcode this' message on a queue and reply right away", "Ask the user to come back later"], "answer": 1, "explanation": "A queue decouples slow background work from the request. The user gets an instant reply, and workers process the job at their own pace, retrying if one fails."}
```

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

```check
{"prompt": "With at-least-once delivery, a consumer crashes after doing the work but before acknowledging. What happens next?", "options": ["The message is lost", "The message is redelivered, so the work may run twice", "The broker deletes the queue"], "answer": 1, "explanation": "Without an acknowledgement the broker assumes the message was not handled and sends it again. That is why consumers must be idempotent under at-least-once delivery."}
```

## Ordering

Kafka orders messages **only within a partition**. Use the entity ID as the message key so one order's events stay in sequence while different orders run in parallel. Caveats:

- Changing the partition count remaps keys.
- Retries can reorder messages unless `enable.idempotence=true`, the default in modern clients.

## Failure handling

- **Retry with backoff**, then send to a **dead-letter queue** after N attempts, with alerting.
- **Poison messages** must not block a partition forever.
- **Consumer lag** is your key health metric and a good autoscaling signal (KEDA).

## Transactional outbox

"Save to the database, then publish" is a **dual write**: a crash between the two steps loses the event.

| Step | What happens |
|---|---|
| 1 | In **one DB transaction**, save the order and insert the event into an `outbox` table |
| 2 | A relay (a poller or CDC) publishes the outbox rows, then marks them as sent |
| 3 | The relay can resend after a crash, so consumers dedupe by event id |

## When not to use a broker

For a simple request-reply that needs an immediate answer, use HTTP or gRPC. A broker adds latency, operational load and eventual consistency.
