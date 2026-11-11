---
title: "NoSQL, from scratch"
summary: "What NoSQL databases are, the main kinds (document, key-value and others), and when to pick one over a table-based database."
---

## The idea

A relational database is like a filing cabinet with strict forms. Every form in a drawer has the same boxes, and information about one customer is spread across several drawers that link together.

Sometimes that is too rigid. Imagine a scrapbook instead. Each page holds everything about one thing: a photo, a note, a ticket stub. Pages can differ, and you grab a whole page at once.

**NoSQL** is a loose name for databases that are not built on the strict table-and-join model from "Tables, rows & keys". The name is usually read as "not only SQL". They trade some of the relational features for flexibility, simple scaling, or speed on one kind of job.

## See it work

In a relational database, a blog post with tags uses three tables: `posts`, `tags`, and a link table. To show one post, you join them (see "Joins & GROUP BY").

In a **document database** such as MongoDB, you store the post as one **document**, shaped like JSON:

```
{
  "_id": 7,
  "title": "Learning databases",
  "author": { "name": "Asha" },
  "tags": ["sql", "beginner"],
  "comments": [
    { "by": "Ben", "text": "Nice!" }
  ]
}
```

Trace showing the post page. Look up the document with `_id` 7. One read returns the title, author, tags and comments together. No join is needed.

Now the cost. Another post by Asha holds its own copy of `"name": "Asha"`. If she changes her name, you must update every document that copied it.

```check
{"prompt": "What is the main benefit of storing a post with its tags and comments in one document?", "options": ["You never need to update anything twice", "The database enforces foreign keys for you", "One read returns everything the page needs", "Documents can never contain duplicate data"], "answer": 2, "explanation": "Keeping related data together means a single lookup fetches it all, with no join. The trade-off is that copied data, like an author's name, may need updating in several places."}
```

## How it works

There are four common families:

- **Document:** stores JSON-like documents in **collections**. Documents in one collection can have different fields. Examples: MongoDB, Couchbase.
- **Key-value:** a giant dictionary. You give a key and get a value, and nothing more. Very fast. Examples: Redis, DynamoDB.
- **Wide-column:** rows grouped by a key, with many columns that can differ per row. Built for huge write volumes. Example: Cassandra.
- **Graph:** stores things and the links between them, built for questions like "friends of friends". Example: Neo4j.

Many NoSQL systems are **schema-flexible**: the database does not force every document to have the same fields. That makes early changes easy, but your code must cope with old shapes.

Most NoSQL systems are also designed to **scale out**: spread data over many cheap machines, instead of buying one bigger machine. Relational databases can do this too, but it is harder, particularly for joins. Many NoSQL databases avoid joins to make it easy.

That points to the big rule: in NoSQL you design around **how you will read the data**. You decide the queries first, then shape the data to fit them. In a relational database you model the facts first and then write almost any query you like.

A rough comparison:

```
                Relational          Document
Shape           fixed tables        flexible documents
Related data    joins               embedded or referenced
Ad-hoc queries  easy                harder
Scaling out     harder              designed for it
```

```check
{"prompt": "You need to store a login session: look up by session id, return a small blob, and expire it after 30 minutes. Which family fits best?", "options": ["Key-value store", "Graph database", "A relational database with eight joined tables", "Wide-column store"], "answer": 0, "explanation": "A session is a single lookup by one key with a quick answer, which is what a key-value store like Redis does best. A graph or wide-column store solves different problems, and eight joined tables would be needless work."}
```

## Where you'll meet it

- Caches and sessions in nearly every web service, often Redis.
- Product catalogues and content, where items have varying fields (a shirt has sizes, a laptop has RAM).
- Huge event or activity logs, handled by wide-column stores.
- Social networks and recommendations, using graph databases.
- Interviews: "SQL or NoSQL for this system, and why?" is a very common question.

## Common mistakes

- **Choosing NoSQL because it sounds modern.** If your data is naturally linked and you need strong consistency, a relational database is often the simpler choice.
- **Treating "schema-flexible" as "no design needed".** Your code still expects certain fields. Without a plan, the data becomes a mess.
- **Copying data everywhere without a plan for updates.** Decide which copies must stay fresh.
- **Assuming all NoSQL databases are alike.** A key-value store and a graph database share a label and little else.

```check
{"prompt": "Your data is a set of highly linked records (customers, orders, payments) and money must never be lost or double-counted. Which is the sensible default?", "options": ["A key-value store, because it is fastest", "A graph database, because the records are linked", "Plain text files, to stay flexible", "A relational database"], "answer": 3, "explanation": "Linked records with strong correctness needs are what relational databases are built for: joins, constraints and transactions. Speed alone is not the goal here, and the other options give up guarantees you need."}
```

## Recap

- **NoSQL** means databases that don't use the strict table-and-join model.
- Four families: **document**, **key-value**, **wide-column** and **graph**.
- They offer flexible shapes and easier scaling out, and give up easy joins and ad-hoc queries.
- Design starts from the queries you will run.
- Pick by the job: it is not a competition between SQL and NoSQL.
