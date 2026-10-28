---
title: "Replication & sharding"
summary: "Replica lag, read/write concerns, choosing shard keys and avoiding hot shards."
---

## Replication

- **Primary/secondary (leader/follower):** writes go to the primary and are replicated (usually asynchronously) to secondaries.
- **Replication lag** breaks read-your-writes when you read from replicas. Mitigations: read from the primary right after your own writes, use causally consistent sessions (MongoDB), or require write acknowledgment from replicas.

## MongoDB read and write concerns

| Setting | Meaning |
|---|---|
| `w: 1` | acknowledged by the primary only; can be rolled back on failover |
| `w: "majority"` | acknowledged by a majority; survives an election |
| `readConcern: "local"` | latest data on this node; may later be rolled back |
| `readConcern: "majority"` | only majority-committed data; never rolled back |
| `readConcern: "linearizable"` | strongest guarantee; single-document reads from the primary only |

## Sharding

Data is split by **shard key** into chunks spread across shards. A good shard key has:

1. **High cardinality**
2. **Even write distribution**, with no monotonically increasing key under range sharding
3. **Query isolation**: common queries include the key, so they hit one shard instead of scatter-gather

Monotonic keys (`ObjectId`, timestamps) make every insert land on the last chunk: a **hot shard**. Options:

- A **hashed** shard key: even writes, but range queries scatter.
- A **compound** key `{ tenantId: 1, createdAt: 1 }`: spreads load by tenant and keeps per-tenant range queries targeted.

## Resharding is expensive

Pick the shard key based on your top queries and write patterns before you have terabytes. MongoDB 5+ supports live resharding, but it is a heavy operation.
