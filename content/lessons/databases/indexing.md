---
title: "Indexing"
summary: "B-tree mechanics, leftmost prefix, ESR ordering, covering indexes and sargability."
---

## The idea

An index is the index at the back of a textbook. To find "photosynthesis" you do not read every page. You look it up in the sorted list at the back, which tells you the page number, and you jump there.

A database does the same. Without an index, finding rows means reading the whole table, row by row (a **full scan**). With an index, the database jumps straight to the matching rows. This is what makes the `WHERE` clauses from "Your first SQL queries" fast on big tables, and it speeds up the joins from "Joins & GROUP BY" too.

There is a price: the index must be kept up to date every time you insert, update or delete, so each extra index slows writes and takes space. Indexing is choosing which lookups are worth that cost.


## B-tree basics

An index is a sorted structure that points to rows. It makes reads faster (seeks and ordered scans) at the cost of slower writes and extra storage. Every write updates every index.

```check
{"prompt":"You add five more indexes to a table that is read rarely but written constantly. What is the likely effect?","options":["Everything gets faster","Reads get slower","Writes get slower, because each index must be updated too","Nothing changes unless you run a query"],"answer":2,"explanation":"Every insert, update or delete must also update every index on the table. Indexes pay off for read-heavy lookups and cost you on write-heavy tables."}
```

## Composite indexes: the leftmost-prefix rule

An index on `(a, b, c)` serves filters on `a`, `a,b` and `a,b,c`, and sorts that follow that order. It does **not** serve filters on `b` alone (except via a skip-scan on some engines).

## MongoDB ESR guideline

Order compound index fields as **Equality → Sort → Range**:

```js
// find({ status: 'open', createdAt: { $gte: d } }).sort({ priority: -1 })
db.tickets.createIndex({ status: 1, priority: -1, createdAt: 1 })
```

Putting the range before the sort forces an in-memory `SORT` stage. Check `explain('executionStats')`: you want `IXSCAN` with `totalKeysExamined ≈ nReturned` and no `SORT` stage.

## Covering indexes

If the index contains every column the query needs, the engine never touches the table. Use `INCLUDE (...)` in SQL Server or Postgres. In MongoDB, project only indexed fields and exclude `_id`.

A covered MongoDB query shows `totalDocsExamined: 0` and no `FETCH` stage in `explain`. If you forget `_id: 0`, the query isn't covered (unless `_id` is in the index).

## MongoDB multikey indexes

Indexing an array field creates one key per element (a **multikey** index).

| Rule | When it breaks |
|---|---|
| A compound index may have at most **one** array field per document | An insert with arrays in both fields fails: `cannot index parallel arrays` |
| Multikey indexes can't cover queries on the array field | A projection of `tags` still needs `FETCH` |

## Sargability: things that silently disable an index

- Functions on the column: `WHERE LOWER(email) = ...`, `WHERE YEAR(created) = 2026`
- Leading wildcards: `LIKE '%foo'`
- Implicit conversions (`nvarchar` vs `varchar` parameters in SQL Server)
- `OR` across different columns, on some engines

Fix by rewriting as a range (`created >= '2026-01-01' AND created < '2027-01-01'`) or by indexing the expression.

```check
{"prompt":"An index exists on users.email. Which filter can use it to seek?","options":["WHERE LOWER(email) = 'a@b.com'","WHERE email LIKE '%@b.com'","WHERE email = 'a@b.com'","WHERE email || '' = 'a@b.com'"],"answer":2,"explanation":"Only the plain comparison on the stored column is sargable. A function around the column or a leading wildcard means the engine cannot seek in the sorted index and must scan."}
```

## Selectivity

An index on a boolean or low-cardinality column rarely helps on its own. Use it as an equality prefix in a compound index, or use a partial index (`WHERE status = 'open'`).
