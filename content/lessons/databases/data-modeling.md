---
title: "Data modeling (relational & document)"
summary: "How to split data into tables (normalization), when to embed or reference in MongoDB, and what copying data costs."
---

## The idea

Data modeling is deciding what your tables (or documents) look like before you fill them. Think of planning a wardrobe: you can toss everything in one big pile, or give socks, shirts and coats their own drawers. The pile is quick to build but hard to search, and a change (say, a new coat) is awkward.

In "Tables, rows & keys" you saw that each fact should be stored once and linked with keys. **Normalizing** is the rule-set for splitting facts into the right tables. In "NoSQL, from scratch" you saw the opposite choice: keep related data together in one document so one read is fast. This lesson is about when to pick each, and what each costs.

## See it work: normalizing a messy table

Here is one table that holds orders and customer details together:

```
orders
id  customer  email          item   price
10  Asha      asha@mail.com  pen    2.00
11  Asha      asha@mail.com  book   12.00
12  Ben       ben@mail.com   pen    2.00
```

Asha's email is stored twice. Watch what goes wrong, then fix it.

```steps
{"title":"Splitting out repeated facts","frames":[{"visual":" id  customer  email              item\n 10  Asha      asha@new.com   <-  pen     (updated)\n 11  Asha      asha@mail.com  <-  book    (missed!)","caption":"Asha changes her email. We update one row and forget the other."},{"visual":" Asha -> asha@new.com\n Asha -> asha@mail.com      two answers","caption":"Now the database disagrees with itself: which email is Asha's?"},{"visual":" customers            orders\n id  name  email      id  customer_id  item\n 1   Asha  asha@..    10  1            pen\n 2   Ben   ben@..     11  1            book\n                      12  2            pen","caption":"Fix: move customer facts to their own table. Each customer is stored once."},{"visual":" customers: 1 Asha asha@new.com\n orders 10, 11 -> customer 1 -> asha@new.com","caption":"Change the email in one row. Every order sees it through `customer_id`."}]}
```

```check
{"prompt":"A customer's email is stored on every one of their 500 orders. What is the main risk?","options":["Queries on orders will fail to run","The database will run out of columns","Orders can no longer have a primary key","Changing the email means updating 500 places, and some may be missed"],"answer":3,"explanation":"Repeating a fact means each copy must be changed together. Miss one and your data disagrees with itself. Normalizing stores the email once in a customers table, which the orders point to."}
```

## How it works: normal forms

Normal forms are named steps of tidying:

- **1NF:** each cell holds one value, with no repeating groups (no "pen, book" in one cell).
- **2NF:** every non-key column depends on the *whole* key, not just part of a composite key.
- **3NF:** non-key columns depend only on the key, not on other non-key columns (for example `zip` determines `city`, so `city` belongs in a zip table).

Short version: **one fact, one place.** Normalize to keep writes correct. Denormalize (copy data) deliberately, for a read path you have measured as slow.

## Embed or reference in MongoDB

In a document database you model for your **access patterns**, meaning the queries you will run most, rather than for the entities.

| Embed (store inside) when | Reference (store an id) when |
|---|---|
| The data is read together | The child set is large or unbounded |
| The child has no life of its own | The child is queried or updated alone |
| One-to-few | Many-to-many |

Useful patterns: **subset** (embed the latest 10 comments, keep the rest in a `comments` collection), **extended reference** (copy a few hot fields like `customer.name` into orders), and **bucket** (group time-series points per hour). A document has a hard 16 MB limit, and ever-growing arrays slow writes.

```steps
{"title":"Embed vs reference as it grows","frames":[{"visual":" post { title, tags: [\"sql\",\"db\",\"index\"] }\n reads: 1","caption":"A post with 3 tags: embed. One read returns the post and tags together."},{"visual":" post { title, comments: [ c1, c2, ... c5000 ] }\n document is getting big, every write touches it","caption":"Comments start to pile up. Embedded, the array keeps growing."},{"visual":" post     { _id: 7, title }\n comments { postId: 7, text }  x 5000\n index on { postId: 1, createdAt: -1 }","caption":"Reference instead: comments become their own collection, keyed by `postId`."},{"visual":" post { title, latestComments: [c4999, c5000] }\n comments collection holds the full history","caption":"Subset pattern: embed only the latest few for fast display."}]}
```

```check
{"prompt":"A blog post has a few tags that are always shown with the post. Embed or reference?","options":["Reference, in a separate collection joined at read time","Neither, tags cannot be stored in MongoDB","Embed the tags inside the post document","Reference, because arrays are not allowed in documents"],"answer":2,"explanation":"Tags are read together with the post, are few, and have no life of their own, so embedding gives one fast read. Reference instead when the child set is unbounded or shared."}
```

## Where you'll meet it

- Every schema design: EF Core models map to normalized tables, and migrations change them over time.
- Data warehouses and reporting tables are deliberately denormalized for fast reads.
- Interviews: "design the schema for X", then "would you denormalize anything, and what is the cost?"

## The cost of copying

Copying `customerName` into every order means a rename must fan out to every copy, or you accept stale data. Decide per field. If the name at purchase time is the correct one (a **snapshot**), no sync is needed. If it must stay fresh, update copies with change streams or outbox events, written to be safe to repeat.

For changes over time, add a `schemaVersion` field to documents and migrate lazily on read or in a background job. In SQL, use expand/contract migrations (add the new column, copy, switch code, then drop the old) so deploys stay compatible.

```reveal
{"prompt":"Design choice: an order must show the product's name and price **as they were when bought**, even if the catalog later changes. Do you reference the product, copy its fields into the order line, or both? Why?","answer":"**Copy** the name and price into the order line (a snapshot), and optionally keep the product id too. A pure reference would rewrite history when the price changes. This is a good case for deliberate denormalization."}
```

## Common mistakes

- **One giant table.** It repeats facts and invites inconsistent updates.
- **Over-normalizing.** Ten joins for one screen can be slower than one denormalized read.
- **Embedding unbounded arrays** until a document hits the size limit.
- **Copying fields without deciding how they stay correct.**

## Recap

- Normalize: store each fact once, link with keys.
- Denormalize on purpose, for measured read paths, and know how copies stay correct.
- In MongoDB, embed what is read together and bounded; reference what is large, shared or independent.
- Snapshot copies need no syncing; fresh copies do.
- Plan schema changes so old and new code can both run.
