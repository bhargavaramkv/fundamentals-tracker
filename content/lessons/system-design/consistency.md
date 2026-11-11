---
title: "Consistency, idempotency & distributed writes"
summary: "CAP/PACELC, idempotency keys, the dual-write problem and the outbox pattern."
---

## The idea

Two friends keep a shared shopping list, each on their own phone. One adds "milk" while the other, with no signal, adds "eggs". For a while the two lists disagree. Should the app refuse to show anything until they match, or show what it has and sort it out later?

That is **consistency**: whether every copy of the data agrees, and how soon. Once data lives on several machines (copies kept for the reasons in "Scalability & load" and "Caching"), the copies can drift apart, and messages between them can be lost or repeated. This lesson is about choosing how much disagreement is acceptable, and how to make repeated or half-finished work safe.

```check
{"prompt": "Two copies of your data briefly disagree, then match a moment later. What is this called?", "options": ["Strong consistency", "Eventual consistency", "Data corruption"], "answer": 1, "explanation": "Eventual consistency means copies may differ for a short time but converge if no new writes arrive. Strong consistency would never show the disagreement, usually at the cost of speed or availability."}
```

## CAP and PACELC

During a **P**artition, choose **C**onsistency or **A**vailability. **E**lse (normal operation), choose **L**atency or **C**onsistency. Most real systems are tunable per operation (MongoDB read and write concerns, Cassandra quorum levels).

## Consistency models, from strongest to weakest

Linearizable → sequential → causal (read-your-writes, monotonic reads) → eventual. Name the guarantee each user flow needs. "The user sees their own comment" is causal, not linearizable.

## Idempotency

Networks lose responses, so clients retry. Make retries safe:

- **Idempotency-Key header:** the server stores `(key, response)` under a unique constraint and replays the stored response for a repeat key.
- **Natural idempotency:** `PUT` sets state, upserts, and conditional updates (`WHERE version = @v`).

**Common trap:** switching `POST /payments` to `PUT` doesn't make a charge safe. `PUT` is idempotent only when the URL names the resource and the body fully sets its state. A payment the server creates is still a new charge on every retry unless the client sends an `Idempotency-Key` (or a client-generated payment id used as the resource id) that the server de-duplicates.

## The dual-write problem

```
save(order)        ✔ committed
publish(event)     ✘ broker down → downstream never learns
```

Reversing the order is no better. **Transactional outbox**: insert the event into an `outbox` table *in the same transaction* as the state change. A relay (poller, or CDC with Debezium or MongoDB change streams) publishes it and marks it sent. That gives at-least-once delivery, so consumers deduplicate by event ID.

```check
{"prompt": "A client retries 'charge card' with the same idempotency key after a timeout. What should the server do?", "options": ["Charge again, to be safe", "Return the stored result of the first attempt without charging again", "Reject all retries"], "answer": 1, "explanation": "The key lets the server recognise a repeat. It replays the saved response, so the customer is charged once even if the first reply was lost."}
```

## Sagas

Long-running workflows across services use a series of local transactions plus **compensations** (refund, release inventory), coordinated by an orchestrator or by choreography over events. Design every step to be idempotent and every compensation to be retryable.

## Common traps

- `POST` to `PUT` doesn't fix double charges: the payment still needs a stored idempotency key.
- A consumer under at-least-once delivery sees duplicates. Deduplicate by event ID.
- Two-phase commit across a database and a broker is rarely available; use the outbox.
