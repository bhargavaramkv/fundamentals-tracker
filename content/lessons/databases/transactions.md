---
title: "Transactions & isolation"
summary: "ACID, isolation levels, and the anomalies that bite real systems (write skew, lost update)."
---

## ACID in one line each

- **Atomicity:** all or nothing.
- **Consistency:** constraints hold before and after.
- **Isolation:** concurrent transactions don't expose intermediate state.
- **Durability:** a commit survives crashes.

## Isolation levels vs anomalies

| Level | Dirty read | Non-repeatable read | Phantom | Write skew |
|---|---|---|---|---|
| Read Uncommitted | possible | possible | possible | possible |
| Read Committed (Postgres/SQL Server default) | prevented | possible | possible | possible |
| Repeatable Read / Snapshot | prevented | prevented | engine-dependent | **possible** |
| Serializable | prevented | prevented | prevented | prevented |

## Lost update

Two transactions read `stock = 10`, each writes `stock = 9`, and one decrement is lost. Fixes:

- An atomic update: `UPDATE ... SET stock = stock - 1 WHERE id = @id AND stock > 0`
- Optimistic concurrency: a rowversion or ETag column, retried on conflict (EF Core `[Timestamp]`)
- A pessimistic lock: `SELECT ... FOR UPDATE`

## Write skew (the interview favorite)

Two transactions read an overlapping set, each checks a condition, and each writes **different** rows ("at least one doctor on call"). Snapshot isolation only catches write-write conflicts on the *same* row, so both commit. Fixes: `SERIALIZABLE` (Postgres SSI), locking the rows you read, or a constraint or materialized conflict row.

## MongoDB

Single-document writes are atomic. Multi-document transactions exist on replica sets, but model documents so most invariants fit inside one document, and keep transactions short (60 s default limit).
