---
title: "Data modeling (relational & document)"
summary: "Normal forms, embed vs reference in MongoDB, and the real cost of denormalization."
---

## The idea

Data modeling is deciding what your tables (or documents) look like before you fill them. Think of planning a wardrobe: you can toss everything in one big pile, or give socks, shirts and coats their own drawers. The pile is quick to build but hard to search, and a change (say, a new coat) is awkward.

In "Tables, rows & keys" you saw that each fact should be stored once and linked with keys. In "Joins & GROUP BY" you saw how joins put the pieces back together. Normalizing is the rule-set for splitting facts into the right tables. In "NoSQL, from scratch" you saw the opposite choice: keep related data together in one document so a read is fast. This lesson is about when to pick each.


## Normal forms, briefly

- **1NF:** atomic values, no repeating groups.
- **2NF:** no dependency on *part* of a composite key.
- **3NF:** no **transitive** dependencies (a non-key column depending on another non-key column, e.g. `zip → city`).

Normalize to keep writes correct, and denormalize deliberately for read paths you have measured.

```check
{"prompt":"A customer's email is stored on every one of their 500 orders. What is the main risk?","options":["Queries on orders will fail to run","Changing the email means updating 500 places, and some may be missed","The database will run out of columns","Orders can no longer have a primary key"],"answer":1,"explanation":"Repeating a fact means each copy must be changed together. Miss one and your data disagrees with itself. Normalizing stores the email once in a customers table, which the orders point to."}
```

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

```check
{"prompt":"A blog post has a few tags that are always shown with the post. Embed or reference?","options":["Reference, in a separate collection joined at read time","Embed the tags inside the post document","Neither, tags cannot be stored in MongoDB","Reference, because arrays are not allowed in documents"],"answer":1,"explanation":"Tags are read together with the post, are few, and have no life of their own, so embedding gives one fast read. Reference instead when the child set is unbounded or shared."}
```

## The cost of denormalization

Copying `customerName` into every order means a rename has to fan out to every copy, or you accept stale data. Decide per field:

- **Snapshot semantics** (the name at purchase time is correct): no sync needed.
- **Needs freshness:** propagate with change streams or outbox events, idempotently.

## Schema evolution

Add a `schemaVersion` field to documents and migrate lazily on read or with a background job. In SQL, use expand/contract migrations so deploys stay backward compatible.
