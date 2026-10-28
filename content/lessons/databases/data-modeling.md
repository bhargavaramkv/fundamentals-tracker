---
title: "Data modeling (relational & document)"
summary: "Normal forms, embed vs reference in MongoDB, and the real cost of denormalization."
---

## Normal forms, briefly

- **1NF:** atomic values, no repeating groups.
- **2NF:** no dependency on *part* of a composite key.
- **3NF:** no **transitive** dependencies (a non-key column depending on another non-key column, e.g. `zip → city`).

Normalize to keep writes correct, and denormalize deliberately for read paths you have measured.

## MongoDB: embed or reference?

**Model for your access patterns**, not your entities.

| Embed when | Reference when |
|---|---|
| The data is read together | The child set is **unbounded** or large |
| The child has no independent lifecycle | The child is queried or updated independently |
| One-to-few | Many-to-many |

Useful patterns:

- **Subset:** embed the latest 10 comments and keep the rest in a `comments` collection indexed on `{postId: 1, createdAt: -1}`.
- **Extended reference:** copy a few hot fields (`customer.name`) into orders.
- **Bucket:** group time-series points per hour or day.

Hard limit: 16 MB per document. Growing arrays also hurt write performance and the working set.

## The cost of denormalization

Copying `customerName` into every order means a rename has to fan out to every copy, or you accept stale data. Decide per field:

- **Snapshot semantics** (the name at purchase time is correct): no sync needed.
- **Needs freshness:** propagate with change streams or outbox events, idempotently.

## Schema evolution

Add a `schemaVersion` field to documents and migrate lazily on read or with a background job. In SQL, use expand/contract migrations so deploys stay backward compatible.
