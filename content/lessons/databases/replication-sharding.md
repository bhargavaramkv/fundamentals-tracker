---
title: "Replication & sharding"
summary: "Copy data to survive failures (replication) and split data to grow past one machine (sharding), plus replica lag and shard-key choice."
---

## The idea

One database on one machine has two weaknesses. If the machine dies, your data is gone or unavailable. And one machine can only handle so much work.

**Replication** fixes the first: keep copies of the data on several machines, like photocopying an important document and storing it in different buildings. If one copy is lost, another is used, and copies can also serve reads.

**Sharding** fixes the second: split the data across machines, like dividing a phone book into volumes A-H, I-P and Q-Z so no one holds it all. Each machine (a **shard**) holds only part.

They solve different problems and are often combined. Both lean on earlier ideas: the key decides which piece a row belongs to ("Tables, rows & keys"), and lookups that include the key stay fast ("Indexing").

```check
{"prompt":"Which problem does sharding solve that replication does not?","options":["Copies of data surviving a machine failure","Reading your own writes immediately","Data too big or too busy for one machine","Making indexes unnecessary"],"answer":2,"explanation":"Replication keeps full copies, so every machine still holds all the data. Sharding splits the data so each machine holds only a part, which lets you grow beyond one machine's capacity."}
```

## See it work: a write and a stale read

In the common setup, **primary/secondary** (also leader/follower), all writes go to one **primary**. It sends changes to **secondaries**, usually asynchronously, meaning it does not wait for them.

```steps
{"title":"Replication lag","frames":[{"visual":" client --write x=2--> PRIMARY   x=2\n                       SECONDARY A  x=1\n                       SECONDARY B  x=1","caption":"A write arrives at the primary. Secondaries still hold the old value."},{"visual":" client <--ok--------- PRIMARY   x=2\n                       |--> SECONDARY A  x=1  (sent)\n                       |--> SECONDARY B  x=1  (sent)","caption":"The primary acknowledges the client straight away, then ships the change."},{"visual":" client --read x-----> SECONDARY B  x=1\n client got x=1       (its own write is invisible)","caption":"The client reads from secondary B before the change arrives. It sees the old value."},{"visual":" PRIMARY      x=2\n SECONDARY A  x=2\n SECONDARY B  x=2","caption":"A moment later the copies catch up. The gap was the replication lag."}]}
```

That stale read breaks **read-your-writes**. Mitigations: read from the primary right after you write, use causally consistent sessions (MongoDB), or require acknowledgment from more replicas.

```check
{"prompt":"A user saves a profile, then the page reloads from a replica and shows the old profile. What is this?","options":["A sharding bug","Replica lag, since the write had not reached that replica yet","A failed index","A transaction rollback"],"answer":1,"explanation":"With asynchronous replication, a secondary can be behind the primary. Reading from it right after a write can show the previous value."}
```

## How it works: write and read concerns

MongoDB lets you choose how much to trust an acknowledgment:

| Setting | Meaning |
|---|---|
| `w: 1` | acknowledged by the primary only; can be rolled back on failover |
| `w: "majority"` | acknowledged by most nodes; survives a primary election |
| `readConcern: "local"` | latest data on this node; may later be rolled back |
| `readConcern: "majority"` | only majority-committed data |

Stronger settings cost latency. SQL Server and Postgres have similar choices (synchronous vs asynchronous replicas).

## Sharding

Data is split by a **shard key** (the column or field that decides where a row lives). A good shard key has:

1. **High cardinality:** many distinct values.
2. **Even write spread:** no key that always grows (like a timestamp or `ObjectId`) under range sharding, because every new insert lands on the last shard (a **hot shard**).
3. **Query isolation:** common queries include the key, so one shard answers instead of asking all of them (**scatter-gather**).

```steps
{"title":"Routing by shard key","frames":[{"visual":" Shard 1: ids   1 - 3000\n Shard 2: ids 3001 - 6000\n Shard 3: ids 6001 - 9000","caption":"Range sharding by user id: three shards each hold a slice."},{"visual":" router --> Shard 2 only\n Shard 1: idle   Shard 3: idle","caption":"A query with the key goes to one shard. `WHERE userId = 4200`."},{"visual":" router --> Shard 1, Shard 2, Shard 3\n scatter-gather: slow and busy","caption":"A query without the key must ask every shard and merge. `WHERE email = 'a@b'`."},{"visual":" inserts:  Shard 1 0%   Shard 2 0%   Shard 3 100%","caption":"With growing ids, all new users land on the last shard. That one is hot."},{"visual":" inserts:  Shard 1 33%  Shard 2 33%  Shard 3 33%","caption":"A hashed key spreads inserts evenly, but range queries now scatter."}]}
```

Options for hot keys: a **hashed** shard key (even writes, range queries scatter), or a **compound** key like `{ tenantId, createdAt }`, which spreads load by tenant and keeps one tenant's range queries on one shard.

## Where you'll meet it

- Managed databases: Azure SQL read replicas, Postgres streaming replicas, MongoDB replica sets and sharded clusters.
- .NET apps use read replicas by sending read-only work to a replica connection (with `ApplicationIntent=ReadOnly` in SQL Server).
- Interviews and system design: "how would you scale the database?", "choose a shard key for a chat app".

```reveal
{"prompt":"You shard an orders collection by `createdAt` (a timestamp) using ranges. What happens to inserts, and what would you change?","answer":"All new orders carry the **latest timestamp**, so they all go to the last shard: a hot shard, while the others sit idle. Use a hashed key for even writes, or a compound key like `{ customerId: 1, createdAt: 1 }` so inserts spread by customer."}
```

## Common mistakes

- **Reading from a replica and expecting fresh data.**
- **Believing replication is a backup.** A bad delete replicates too; keep real backups.
- **Picking a shard key that always grows**, or one that queries do not include.
- **Sharding too early.** First try indexes, caching and a bigger machine. Changing the shard key later is a heavy operation (MongoDB 5+ supports live resharding, but it is costly).

## Recap

- Replication keeps copies for availability and read scale; replicas can lag.
- Sharding splits data across machines for size and write scale.
- A shard key should have many values, spread writes evenly, and appear in common queries.
- Monotonic keys cause hot shards; hashing evens them out at the cost of range queries.
- Choose the shard key early and carefully.
