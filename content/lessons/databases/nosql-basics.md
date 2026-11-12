---
title: "NoSQL, from scratch"
summary: "What NoSQL databases are, the main kinds (document, key-value and others), and when to pick one over a table-based database."
---

## The idea

A relational database is like a filing cabinet with strict forms. Every form in a drawer has the same boxes, and information about one customer is spread across several drawers that link together.

Sometimes that is too rigid. Imagine a scrapbook instead. Each page holds everything about one thing: a photo, a note, a ticket stub. Pages can differ, and you grab a whole page at once.

**NoSQL** is a loose name for databases that are not built on the strict table-and-join model from "Tables, rows & keys". It is usually read as "not only SQL". They trade some relational features for flexibility, easy scaling, or speed on one kind of job.

## See it work

In a relational database, a blog post with tags uses three tables: `posts`, `tags`, and a link table. To show one post you join them. In a **document database** such as MongoDB, you store the post as one **document**, shaped like JSON:

```
{
  "_id": 7,
  "title": "Learning databases",
  "author": { "name": "Asha" },
  "tags": ["sql", "beginner"],
  "comments": [ { "by": "Ben", "text": "Nice!" } ]
}
```

Compare showing the post page both ways.

```steps
{"title":"Loading one post","frames":[{"visual":" posts      tags        post_tags\n 7 Title    1 sql       7 -> 1\n            2 beginner  7 -> 2\n reads: 3 tables, joined on ids","caption":"Relational: the post is split over three tables. The page needs all three."},{"visual":" posts(7) + post_tags(7->1,2) + tags(1,2)\n   = Title, sql, beginner\n work: a join","caption":"The database matches ids across tables and builds one result."},{"visual":" find({ _id: 7 })\n   -> { title, author, tags, comments }\n reads: 1 document, no join","caption":"Document: look up `_id` 7 once. Title, author, tags and comments come together."},{"visual":" post 7   author: Asha\n post 9   author: Asha\n post 14  author: Asha     <- three places to change","caption":"The cost: Asha's name is copied into each of her posts. A rename must update every copy."}]}
```

```check
{"prompt":"What is the main benefit of storing a post with its tags and comments in one document?","options":["You never need to update anything twice","The database enforces foreign keys for you","Documents can never contain duplicate data","One read returns everything the page needs"],"answer":3,"explanation":"Keeping related data together means a single lookup fetches it all, with no join. The trade-off is that copied data, like an author's name, may need updating in several places."}
```

## How it works

There are four common families:

- **Document:** JSON-like documents in **collections**; documents in one collection can have different fields. MongoDB, Couchbase.
- **Key-value:** a giant dictionary. Give a key, get a value, nothing more. Very fast. Redis, DynamoDB.
- **Wide-column:** rows grouped by a key, with many columns that can differ per row. Built for huge write volumes. Cassandra.
- **Graph:** stores things and the links between them, for questions like "friends of friends". Neo4j.

Many NoSQL systems are **schema-flexible**: the database does not force every document to have the same fields. Early changes are easy, but your code must cope with old shapes. Most are also built to **scale out**: spread data over many cheap machines instead of buying one bigger one. Joins make that hard, so many NoSQL databases avoid them.

That leads to the big rule: in NoSQL you design around **how you will read the data**. Decide the queries first, then shape the data to fit them. In a relational database you model the facts first and can write almost any query later.

```
                Relational          Document
Shape           fixed tables        flexible documents
Related data    joins               embedded or referenced
Ad-hoc queries  easy                harder
Scaling out     harder              designed for it
```

```check
{"prompt":"You need to store a login session: look up by session id, return a small blob, expire it after 30 minutes. Which family fits best?","options":["Graph database","A relational database with eight joined tables","Wide-column store","Key-value store"],"answer":3,"explanation":"A session is a single lookup by one key with a quick answer, which is what a key-value store like Redis does best. A graph or wide-column store solves different problems, and eight joined tables would be needless work."}
```

## Where you'll meet it

- Caches and sessions in nearly every web service, often Redis (`IDistributedCache` in ASP.NET Core).
- Product catalogues, where items have varying fields (a shirt has sizes, a laptop has RAM). In .NET you reach MongoDB through its C# driver.
- Huge event or activity logs, handled by wide-column stores.
- Social networks and recommendations, using graph databases.
- Interviews: "SQL or NoSQL for this system, and why?"

```reveal
{"prompt":"Which would you pick for each? (1) Bank ledger: accounts, transfers, balances that must add up. (2) Shopping-cart contents that expire after a day. (3) \"People you may know\" suggestions.","answer":"(1) **Relational**: linked records and strong correctness (transactions, constraints). (2) **Key-value** (Redis): one lookup by cart id, with expiry. (3) **Graph**: the question is about links of links."}
```

## Common mistakes

- **Choosing NoSQL because it sounds modern.** If your data is linked and must be consistent, relational is usually simpler.
- **Treating "schema-flexible" as "no design needed".** Your code still expects certain fields.
- **Copying data everywhere without a plan for updates.** Decide which copies must stay fresh.
- **Assuming all NoSQL databases are alike.** A key-value store and a graph database share a label and little else.

```check
{"prompt":"Your data is a set of highly linked records (customers, orders, payments) and money must never be lost or double-counted. Which is the sensible default?","options":["A relational database","A key-value store, because it is fastest","A graph database, because the records are linked","Plain text files, to stay flexible"],"answer":0,"explanation":"Linked records with strong correctness needs are what relational databases are built for: joins, constraints and transactions. Speed alone is not the goal here, and the other options give up guarantees you need."}
```

## Recap

- **NoSQL** means databases that do not use the strict table-and-join model.
- Four families: **document**, **key-value**, **wide-column** and **graph**.
- They offer flexible shapes and easier scaling out, and give up easy joins and ad-hoc queries.
- Design starts from the queries you will run.
- Pick by the job: it is not a competition between SQL and NoSQL.
