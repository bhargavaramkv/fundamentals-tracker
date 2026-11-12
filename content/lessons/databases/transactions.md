---
title: "Transactions & isolation"
summary: "Group changes so they succeed or fail together (ACID), and understand the odd bugs when transactions overlap: lost update and write skew."
---

## The idea

Think of a bank transfer: take 100 from Asha, add 100 to Ben. If the power fails after the first step, 100 has vanished. You want those two steps to be one unit that either happens fully or not at all.

A **transaction** is that unit: a group of database changes treated as one. It uses the `INSERT`, `UPDATE` and `DELETE` statements from "Your first SQL queries", wrapped so they succeed together (**commit**) or are undone together (**rollback**).

The second problem is other people. Many users hit the database at once, and without rules they trip over each other's half-finished work. **Isolation levels** are the rules about how much of each other's work transactions may see.

```sql
BEGIN TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;   -- or ROLLBACK; to undo both
```

In EF Core, `SaveChanges()` already wraps its changes in one transaction; use `db.Database.BeginTransaction()` to span several calls.

## See it work: all or nothing

```steps
{"title":"A transfer that fails halfway","frames":[{"visual":" BEGIN\n Asha: 500      Ben: 300      total 800","caption":"Start: Asha has 500, Ben has 300. The transaction begins."},{"visual":" UPDATE Asha: balance - 100\n Asha: 400      Ben: 300      total 700 (in progress)","caption":"Step 1 runs: 100 leaves Asha. Right now the total looks like 700."},{"visual":" CRASH before \"Ben + 100\"\n Asha: 400      Ben: 300      uncommitted","caption":"The server crashes before step 2. The transaction never committed."},{"visual":" recovery: undo uncommitted changes\n Asha: 500      Ben: 300      total 800","caption":"On restart the database rolls back the unfinished work. No money is lost."}]}
```

```check
{"prompt":"A transfer subtracts from account A, then the server crashes before adding to account B. Which ACID property should make the database undo the subtraction?","options":["Durability","Isolation","Atomicity","Consistency"],"answer":2,"explanation":"Atomicity means all or nothing. The half-finished transaction is rolled back, so the money is not lost."}
```

## How it works: ACID

- **Atomicity:** all or nothing.
- **Consistency:** rules (constraints) hold before and after.
- **Isolation:** concurrent transactions do not expose intermediate state.
- **Durability:** once committed, it survives a crash.

Isolation is the one with choices. Weaker levels let overlapping transactions see odd things:

- **Dirty read:** reading another transaction's uncommitted change.
- **Non-repeatable read:** reading the same row twice and getting different values.
- **Phantom:** running the same query twice and getting extra rows.

| Level | Dirty | Non-repeatable | Phantom |
|---|---|---|---|
| Read Uncommitted | possible | possible | possible |
| Read Committed (default in SQL Server, Postgres) | no | possible | possible |
| Repeatable Read / Snapshot | no | no | engine-dependent |
| Serializable | no | no | no |

Higher levels are safer but slower and cause more waiting.

## Lost update

Two shoppers buy the last items at once. Both read `stock = 10`.

```steps
{"title":"Two transactions, one lost update","frames":[{"visual":" time  T1             T2             stock in DB\n 1     read 10                       10\n 2                    read 10        10","caption":"T1 and T2 both read the stock. Each sees 10."},{"visual":" 3     write 9\n 4     commit                        9","caption":"T1 computes 9 and writes it. Commit."},{"visual":" 5                    write 9\n 6                    commit         9","caption":"T2 also computes 9 (from its stale 10) and writes it. Commit."},{"visual":" expected stock: 8\n actual stock:   9     <- lost update","caption":"Two items sold, but stock only dropped by one. One decrement was lost."}]}
```

Fixes, from simplest:

- **Atomic update:** `UPDATE items SET stock = stock - 1 WHERE id = @id AND stock > 0`. The database does read-and-write in one step.
- **Optimistic concurrency:** keep a version column (EF Core `[Timestamp]` or `IsRowVersion()`). A write fails if the version changed, and you retry.
- **Pessimistic lock:** `SELECT ... FOR UPDATE` (Postgres) or `WITH (UPDLOCK)` (SQL Server) holds the row until you finish.

```check
{"prompt":"Two requests both read stock = 10, both write stock = 9. What went wrong?","options":["A dirty read","A deadlock","A phantom row","A lost update: one decrement vanished"],"answer":3,"explanation":"Each transaction read the old value and wrote back its own result, overwriting the other. The stock should now be 8. An atomic UPDATE ... SET stock = stock - 1 avoids it."}
```

## Write skew (the interview favorite)

Two transactions read an overlapping set, each checks a condition, and each writes a **different** row. Example: a hospital rule "at least one doctor must stay on call". Doctors Ann and Raj are both on call; each runs "if more than one is on call, take me off". Under snapshot isolation both see two on call, both leave, and none remain. Snapshot only detects two writes to the *same* row, and these are different rows, so both commit.

Fixes: `SERIALIZABLE` isolation, locking the rows you read, or a constraint or a shared row both must update.

```reveal
{"prompt":"Predict: under Read Committed, T1 runs `SELECT COUNT(*) FROM orders WHERE day = 'Mon'` and gets 5. Meanwhile T2 inserts a Monday order and commits. T1 runs the same count again. What can it return, and what is this called?","answer":"It can return **6**. That is a **phantom** (a new row appeared in a repeated query). Read Committed allows it; Serializable prevents it."}
```

## Where you'll meet it

- Payments, inventory and booking systems: the lost-update and write-skew patterns are exactly "two users at once".
- EF Core's `DbUpdateConcurrencyException` is optimistic concurrency reporting a conflict.
- MongoDB: a write to one document is atomic. Multi-document transactions exist on replica sets, but design so most rules fit inside one document and keep transactions short (60 seconds by default).
- Interviews: "explain ACID", "what is a dirty read", "how do you stop overselling stock?"

## Common mistakes

- **Read, compute in app code, write back** with no concurrency control.
- **Assuming Read Committed prevents everything.** It does not stop lost updates or write skew.
- **Long transactions.** They hold locks and block others.
- **Raising isolation everywhere** instead of fixing the one hot query.

## Recap

- A transaction makes several changes succeed or fail together.
- ACID: atomicity, consistency, isolation, durability.
- Weaker isolation allows dirty reads, non-repeatable reads and phantoms.
- Lost update: fix with atomic update, optimistic version check, or a lock.
- Write skew: two transactions write different rows after reading the same data; fix with serializable isolation, locks or constraints.
