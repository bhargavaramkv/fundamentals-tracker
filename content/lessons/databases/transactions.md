---
title: "Transactions & isolation"
summary: "ACID, isolation levels, and the anomalies that bite real systems (write skew, lost update)."
---

## The idea

Think of a bank transfer: take 100 from Asha, add 100 to Ben. If the power fails after the first step, 100 has vanished. You want those two steps to be one unit that either happens fully or not at all.

A **transaction** is that unit: a group of database changes treated as one. It uses the `INSERT`, `UPDATE` and `DELETE` statements from "Your first SQL queries", but wraps them so they succeed together or are undone together.

The second problem is other people. Many users hit the database at once, and without rules they can trip over each other's half-finished work. **Isolation levels** are the rules about how much of each other's work transactions may see. This lesson names the guarantees (ACID) and the odd bugs that appear when the rules are weak.


## ACID in one line each

- **Atomicity:** all or nothing.
- **Consistency:** constraints hold before and after.
- **Isolation:** concurrent transactions don't expose intermediate state.
- **Durability:** a commit survives crashes.

```check
{"prompt":"A transfer subtracts from account A, then the server crashes before adding to account B. Which ACID property should make the database undo the subtraction?","options":["Durability","Isolation","Atomicity","Consistency"],"answer":2,"explanation":"Atomicity means all or nothing. The half-finished transaction is rolled back, so the money is not lost."}
```

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

```check
{"prompt":"Two requests both read stock = 10, both write stock = 9. What went wrong?","options":["A dirty read","A lost update: one decrement vanished","A deadlock","A phantom row"],"answer":1,"explanation":"Each transaction read the old value and wrote back its own result, overwriting the other. The stock should now be 8. An atomic UPDATE ... SET stock = stock - 1 avoids it."}
```

## Write skew (the interview favorite)

Two transactions read an overlapping set, each checks a condition, and each writes **different** rows ("at least one doctor on call"). Snapshot isolation only catches write-write conflicts on the *same* row, so both commit. Fixes: `SERIALIZABLE` (Postgres SSI), locking the rows you read, or a constraint or materialized conflict row.

## MongoDB

Single-document writes are atomic. Multi-document transactions exist on replica sets, but model documents so most invariants fit inside one document, and keep transactions short (60 s default limit).
