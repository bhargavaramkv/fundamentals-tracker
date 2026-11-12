---
title: "Consistency, idempotency & distributed writes"
summary: "Replicas that disagree, retries that must be safe, and the outbox pattern for writes that span a database and a broker."
---

## The idea

Two friends keep a shared shopping list, each on their own phone. One adds "milk" while the other, with no signal, adds "eggs". For a while the two lists disagree. Should the app refuse to show anything until they match, or show what it has and sort it out later?

That is **consistency**: whether every copy of the data agrees, and how soon. Copies exist when data lives on several machines (for the reasons in "Scalability & load" and "Caching"). A **replica** is one such copy. Between machines, messages can also be lost or repeated. This lesson is about choosing how much disagreement is acceptable, and making repeated or half-finished work safe.

```check
{"prompt": "Two copies of your data briefly disagree, then match a moment later. What is this called?", "options": ["Strong consistency", "Eventual consistency", "Data corruption"], "answer": 1, "explanation": "Eventual consistency means copies may differ for a short time but converge if no new writes arrive. Strong consistency would never show the disagreement, usually at the cost of speed or availability."}
```

## See it work

A database has a **primary** (takes writes) and a **replica** (a copy that serves reads). The primary sends each change to the replica in the background, so it arrives a moment later.

```steps
{"title": "A replica lags, then catches up", "frames": [
  {"visual": "            primary        replica\nname:       Asha           Asha\n", "caption": "Both copies agree. Reads from either return Asha."},
  {"visual": "            primary        replica\nname:       Priya  ---->   Asha\n                 change in flight\n", "caption": "You change the name to Priya. The primary accepts it at once and starts sending the change."},
  {"visual": "            primary        replica\nname:       Priya          Asha   <- read here\n                 still in flight\n", "caption": "A read that lands on the replica now returns the **old** name. The copies disagree."},
  {"visual": "            primary        replica\nname:       Priya  ---->   Priya\n                 change applied\n", "caption": "The change arrives. Both copies agree again: **eventual consistency**."}
]}
```

```reveal
{"prompt": "Before you look: a user saves their profile, the page reloads and shows the old name. Which part of the picture above explains it, and how would you fix it for that user?", "answer": "The reload read from a **lagging replica**. Fix it with **read-your-own-writes**: send that user's reads to the primary for a short while after they write, or carry a version marker so the replica waits until it has caught up."}
```

## How it works

**CAP and PACELC.** During a network **P**artition (machines cannot reach each other), a system must choose **C**onsistency (refuse or wait) or **A**vailability (answer, possibly with old data). **E**lse, in normal operation, it trades **L**atency against **C**onsistency, as the replica example shows. Many databases let you tune this per operation (MongoDB read and write concerns, Cassandra quorum levels).

**Models, strongest to weakest:** linearizable (behaves like one copy) then sequential, causal (you see your own writes) and eventual. Name the guarantee each user flow needs. "The user sees their own comment" is causal, not linearizable.

**Idempotency.** Networks lose replies, so clients retry. An operation is **idempotent** if repeating it equals doing it once. `PUT` sets state and is naturally idempotent; "charge the card" is not. The fix is an **idempotency key**: the client sends a unique key, and the server stores `(key, response)` under a unique constraint and replays the stored response for a repeat.

**Common trap:** switching `POST /payments` to `PUT` doesn't make a charge safe. `PUT` is idempotent only when the URL names the resource and the body fully sets its state. A payment the server creates is still a new charge on every retry unless the client sends an `Idempotency-Key` (or a client-generated payment id used as the resource id) that the server de-duplicates.

```csharp
// Unique index on IdempotencyKey makes the second insert fail
var done = await db.Payments.FirstOrDefaultAsync(p => p.Key == key);
if (done is not null) return done.Result;      // repeat: replay
var result = await gateway.ChargeAsync(amount);
db.Payments.Add(new Payment(key, result));
await db.SaveChangesAsync();
return result;
```

## The dual-write problem

Saving an order and publishing an "order created" event are two writes to two systems.

```steps
{"title": "Dual write vs transactional outbox", "frames": [
  {"visual": "DUAL WRITE\n1. save order to DB      OK\n2. publish event         crash!\n", "caption": "The database commit worked, then the app died before publishing."},
  {"visual": "DUAL WRITE\nDB: order saved\nbroker: no event\n", "caption": "Downstream services never learn about the order. The data is now inconsistent for good."},
  {"visual": "OUTBOX\none DB transaction:\n  orders  <- order 7\n  outbox  <- event 'order 7 created'\n", "caption": "Fix: write the event into an **outbox** table in the *same* transaction as the order. Both commit or neither does."},
  {"visual": "OUTBOX\nrelay reads outbox rows\n  -> publishes to broker\n  -> marks them sent\n", "caption": "A separate **relay** publishes the rows. If it crashes it resends, so consumers must tolerate duplicates."}
]}
```

Why the tempting fixes fail:

| Fix | What breaks |
|---|---|
| Publish first, then save | The DB insert fails (constraint, deadlock, crash) after the event is out. Downstream now acts on an order that doesn't exist: the same dual write, failing the other way. |
| Two-phase commit (DB + Kafka) | Kafka doesn't join XA/distributed transactions with your database. Its own transactions cover only Kafka writes, and 2PC blocks everyone when the coordinator dies. |
| Retry the publish in a loop | The process can crash between commit and publish, and the retries die with it. |

The outbox gives **at-least-once** delivery, so consumers deduplicate by event id. A relay can be a poller or change-data-capture (CDC, reading the database log, for example with Debezium or MongoDB change streams).

```check
{"prompt": "A client retries 'charge card' with the same idempotency key after a timeout. What should the server do?", "options": ["Charge again, to be safe", "Return the stored result of the first attempt without charging again", "Reject all retries"], "answer": 1, "explanation": "The key lets the server recognise a repeat. It replays the saved response, so the customer is charged once even if the first reply was lost."}
```

## Where you'll meet it

- Read replicas in Azure SQL, PostgreSQL or Cosmos DB (Cosmos DB even offers named consistency levels such as Strong, Session and Eventual).
- Payment and order APIs with an `Idempotency-Key` header.
- Microservices that must update their own database and tell others (outbox with Kafka or Azure Service Bus).
- **Sagas**: long workflows across services made of local transactions plus **compensations** (refund, release stock). Every step must be idempotent and every compensation retryable.
- Interviews: "how do you avoid double charges?" and "how do you keep two services in sync?"

## Common mistakes

- Thinking `POST` to `PUT` alone stops double charges; the payment still needs a stored idempotency key.
- Forgetting that at-least-once delivery means duplicates, and not deduplicating by event id.
- Trying a two-phase commit across a database and a broker. It is rarely available; use the outbox.
- Demanding strong consistency everywhere. It costs latency and availability; use it only for flows that need it.

## Recap

- **Consistency** is whether copies agree; **eventual** consistency lets them differ briefly.
- Choose per flow: CAP in a partition, latency vs consistency otherwise.
- Make retries safe with **idempotency keys** or naturally idempotent operations.
- Never write to a database and a broker separately; use the **transactional outbox**.
- Cross-service workflows use **sagas** with compensations.
