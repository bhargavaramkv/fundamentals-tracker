---
title: "Messaging & event streaming"
summary: "Queues absorb bursts and decouple services: queue vs pub/sub, delivery guarantees, ordering and Kafka partitions."
---

## The idea

When you post a letter, you don't wait at the postbox until it is read. You drop it in and carry on with your day. The postal service holds it and delivers it when it can.

**Messaging** works like that between programs. Instead of calling another service and waiting for its answer (the request and response from "Clients & servers"), one service drops a **message** into a **queue** and moves on. The queue lives in a **broker**, a server whose job is to hold messages safely. A **producer** sends messages; a **consumer** takes them out and does the work when ready.

This smooths out bursts, lets slow work happen in the background, and means a service that is down does not lose the work. The cost: delivery is not instant, and the same message may arrive twice.

```check
{"prompt": "A user uploads a video and you want to transcode it without making them wait. What fits best?", "options": ["Do the transcode inside the upload request", "Put a 'transcode this' message on a queue and reply right away", "Ask the user to come back later"], "answer": 1, "explanation": "A queue decouples slow background work from the request. The user gets an instant reply, and workers process the job at their own pace, retrying if one fails."}
```

## See it work

A flash sale sends 6 orders in one second, but the consumer can process 2 per second.

```steps
{"title": "A queue absorbing a burst", "frames": [
  {"visual": "producer      queue                 consumer\n  idle        [ ]                   idle\n", "caption": "Quiet moment. Nothing is waiting."},
  {"visual": "producer      queue                 consumer\n  sends 6     [1 2 3 4 5 6]         idle\n", "caption": "The burst arrives. The producer is done at once because the broker accepted all 6."},
  {"visual": "producer      queue                 consumer\n  free        [3 4 5 6]       <-    working on 1, 2\n", "caption": "The consumer takes messages at its own pace, 2 per second. The rest wait safely."},
  {"visual": "producer      queue                 consumer\n  free        [5 6]           <-    working on 3, 4\n", "caption": "The queue shrinks. A direct call would have overloaded the consumer or failed."},
  {"visual": "producer      queue                 consumer\n  free        [ ]                   done: 1-6\n", "caption": "All six are processed. Adding a second consumer would drain it twice as fast."}
]}
```

## How it works

**Queue vs pub/sub.** In a **work queue** (competing consumers), each message is processed by **one** consumer; use it to spread work. In **pub/sub** (publish/subscribe), **every** subscriber gets a copy; use it to announce an event ("order placed") to several services. **Kafka** does both: inside a consumer group each partition goes to one consumer (a queue), and separate groups each read everything (pub/sub).

**Delivery guarantees** depend on when the consumer **acknowledges** (acks) a message, telling the broker "done, delete it".

| Guarantee | How | Consequence |
|---|---|---|
| At-most-once | ack before processing | can lose messages |
| **At-least-once** | ack after processing | **duplicates**, so consumers must be idempotent |
| "Exactly-once" | at-least-once + dedup/transactions | only within a boundary (e.g. Kafka to Kafka) |

```steps
{"title": "At-least-once: a crash causes a redelivery", "frames": [
  {"visual": "broker: [msg 7]  ->  consumer gets msg 7\nconsumer: charging customer...\n", "caption": "The consumer receives the message and starts the work. The broker keeps it until it is acknowledged."},
  {"visual": "broker: [msg 7]      consumer: CRASH\ncharge done, no ack sent\n", "caption": "The consumer dies after charging but before acknowledging."},
  {"visual": "broker: [msg 7]  ->  consumer 2 gets msg 7\nconsumer 2: charging customer...\n", "caption": "No ack arrived, so the broker redelivers. The charge could now run twice."},
  {"visual": "consumer 2: msg 7 already in processed table\n-> skip, send ack\n", "caption": "An **idempotent** consumer notices the repeat (by message id) and just acknowledges."}
]}
```

```check
{"prompt": "With at-least-once delivery, a consumer crashes after doing the work but before acknowledging. What happens next?", "options": ["The message is lost", "The message is redelivered, so the work may run twice", "The broker deletes the queue"], "answer": 1, "explanation": "Without an acknowledgement the broker assumes the message was not handled and sends it again. That is why consumers must be idempotent under at-least-once delivery."}
```

```reveal
{"prompt": "Before you look: two orders, A1 then A2, for the same customer are sent to a Kafka topic with 3 partitions and no key. Can a consumer see A2 before A1?", "answer": "Yes. Kafka orders messages **only within a partition**, and with no key they spread over partitions. Use the entity id (here the order or customer id) as the **message key** so related events land on one partition in order."}
```

**Ordering.** With the key trick, different orders still run in parallel. Changing the partition count remaps keys, and retries can reorder messages unless idempotent production (`enable.idempotence=true`, default in modern clients) is on.

**Consumer groups don't create order.** A group is how consumers share work: each partition is read by exactly one consumer in the group, and every group gets its own full copy of the topic. A group only *preserves* the order the partition already has. If one order's events are spread across partitions (no key, or a random key), no group setting puts them back in sequence.

| Producer keys by | Events for order 42 land in | Consumer sees them |
|---|---|---|
| `orderId` | one partition | in the order they were written |
| nothing (round-robin / sticky) | several partitions | interleaved by whichever partition is read first |

## Where you'll meet it

- Azure Service Bus and Storage Queues, AWS SQS, RabbitMQ (queues), Kafka and Azure Event Hubs (streams of events).
- Background jobs in ASP.NET: enqueue work, return `202 Accepted`, process in a worker.
- Kubernetes autoscaling on queue depth with KEDA.
- Writing to a database and publishing an event safely uses the transactional outbox from "Consistency, idempotency & distributed writes".

## Failure handling and mistakes

- **Retry with backoff** (wait longer each time), then send to a **dead-letter queue** (a parking place for failures) after N attempts, with an alert. A **poison message** that always fails must not block a partition forever.
- **Consumer lag** (how far behind consumers are) is the key health metric.
- Do not use a broker for a request that needs an answer right now; use HTTP or gRPC. A broker adds latency, operations work and eventual consistency.
- Assuming exactly-once. Design every consumer to survive duplicates.

## Recap

- A **queue** lets the producer drop work and move on; the **broker** holds it until a **consumer** acknowledges.
- Work queue: one consumer per message. Pub/sub: every subscriber gets a copy.
- **At-least-once** is the practical default, so make consumers idempotent.
- Kafka orders only **within a partition**; choose the key deliberately.
- Retry with backoff, then dead-letter; watch consumer lag.
