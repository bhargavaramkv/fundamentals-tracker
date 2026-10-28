---
title: "Indexing"
summary: "B-tree mechanics, leftmost prefix, ESR ordering, covering indexes and sargability."
---

## B-tree basics

An index is a sorted structure that points to rows. It makes reads faster (seeks and ordered scans) at the cost of slower writes and extra storage. Every write updates every index.

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

## Sargability: things that silently disable an index

- Functions on the column: `WHERE LOWER(email) = ...`, `WHERE YEAR(created) = 2026`
- Leading wildcards: `LIKE '%foo'`
- Implicit conversions (`nvarchar` vs `varchar` parameters in SQL Server)
- `OR` across different columns, on some engines

Fix by rewriting as a range (`created >= '2026-01-01' AND created < '2027-01-01'`) or by indexing the expression.

## Selectivity

An index on a boolean or low-cardinality column rarely helps on its own. Use it as an equality prefix in a compound index, or use a partial index (`WHERE status = 'open'`).
