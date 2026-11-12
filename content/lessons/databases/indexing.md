---
title: "Indexing"
summary: "How a B-tree index finds rows without scanning the table, and the rules (leftmost prefix, sargability, covering) that decide whether it is used."
---

## The idea

An index is the index at the back of a textbook. To find "photosynthesis" you do not read every page. You look it up in the sorted list at the back, which gives the page number, and you jump there.

A database does the same. Without an index, finding rows means reading the whole table, row by row (a **full scan**). With an index, the database jumps straight to the matching rows. This is what makes the `WHERE` clauses from "Your first SQL queries" fast on big tables, and it speeds up the joins from "Joins & GROUP BY" too.

There is a price: the index must be kept up to date on every insert, update and delete, so each extra index slows writes and takes space. Indexing is choosing which lookups are worth that cost.

```check
{"prompt":"You add five more indexes to a table that is read rarely but written constantly. What is the likely effect?","options":["Everything gets faster","Reads get slower","Nothing changes unless you run a query","Writes get slower, because each index must be updated too"],"answer":3,"explanation":"Every insert, update or delete must also update every index on the table. Indexes pay off for read-heavy lookups and cost you on write-heavy tables."}
```

## See it work: how a B-tree finds a row

Most indexes are **B-trees**: a small tree of sorted keys. Each step down the tree throws away most of the remaining data. Suppose users are indexed by `id`, and we run `WHERE id = 60`.

```steps
{"title":"A B-tree lookup for id = 60","frames":[{"visual":"               [ 40 ]\n              /      \\\n    [10 20 30]        [50 60 70]\n   (leaf: row ptrs)    (leaf: row ptrs)","caption":"The root holds one key, 40. Left of it: ids below 40. Right: 40 and above."},{"visual":"               [ 40 ]\n                     \\\n                      v\n                      [50 60 70]","caption":"60 is at least 40, so go right. The whole left half is skipped."},{"visual":"                      [50 [60] 70]\n                           |\n                           v\n                      pointer -> row 60","caption":"Inside that leaf, find 60. The leaf stores a pointer to the row."},{"visual":" index steps: 2 nodes     table rows read: 1\n full scan:   all rows","caption":"Follow the pointer: one row read. A full scan would have read every row."}]}
```

With millions of rows, such a tree is only 3 or 4 levels deep, so a lookup takes a handful of reads instead of millions. The leaves are sorted, so ranges (`id BETWEEN 50 AND 70`) and `ORDER BY id` come cheaply too.

## How it works: composite indexes and the leftmost prefix

An index can cover several columns, like a phone book sorted by last name, then first name. An index on `(last, first)` helps you find "Smith", or "Smith, Ann". It does not help find "Ann" alone, because first names are scattered through the book.

That is the **leftmost-prefix rule**: an index on `(a, b, c)` serves filters on `a`, on `a, b`, and on `a, b, c`, but not on `b` alone.

**Covering index:** if the index contains every column the query needs, the engine never visits the table. In SQL Server and PostgreSQL, add extra columns with `INCLUDE (...)`.

**Sargability** (can the engine *seek* in the index?). Wrapping the column in a function hides the sorted order:

```sql
-- cannot seek:
WHERE LOWER(email) = 'a@b.com'
WHERE YEAR(created) = 2026
WHERE name LIKE '%son'
-- can seek:
WHERE email = 'a@b.com'
WHERE created >= '2026-01-01' AND created < '2027-01-01'
```

Also watch implicit conversions: in SQL Server, comparing a `varchar` column to an `nvarchar` parameter can disable the seek. EF Core string parameters are `nvarchar` by default, so map columns to `varchar` with `.IsUnicode(false)` when they are.

```check
{"prompt":"An index exists on users.email. Which filter can use it to seek?","options":["WHERE LOWER(email) = 'a@b.com'","WHERE email LIKE '%@b.com'","WHERE email = 'a@b.com'","WHERE email + '' = 'a@b.com'"],"answer":2,"explanation":"Only the plain comparison on the stored column is sargable. A function around the column or a leading wildcard means the engine cannot seek in the sorted index and must scan."}
```

```reveal
{"prompt":"You have an index on `(country, city)`. Which of these can use it to seek? (a) `WHERE country = 'IN'` (b) `WHERE city = 'Pune'` (c) `WHERE country = 'IN' AND city = 'Pune'`","answer":"**(a) and (c).** Both start with the leftmost column `country`. (b) skips it, so the engine cannot narrow down by `city` alone; it usually scans (some engines do a \"skip scan\"). Reordering the index to `(city, country)` would flip which queries are fast."}
```

## MongoDB: the ESR order

MongoDB indexes are B-trees too. For a compound index, order fields **E**quality, **S**ort, **R**ange:

```js
// find({status:'open', createdAt:{$gte:d}}).sort({priority:-1})
db.tickets.createIndex(
  { status: 1, priority: -1, createdAt: 1 })
```

Equality fields narrow to one slice, the sort field is already in order inside it, and the range goes last. A range before the sort forces an in-memory sort. Check `explain('executionStats')`: you want an `IXSCAN`, `totalKeysExamined` close to `nReturned`, and no `SORT` stage. Covered queries project only indexed fields and exclude `_id`.

## Where you'll meet it

- Slow-query tickets: the fix is often one missing index, found via the query plan (`EXPLAIN`, or the execution plan in SQL Server Management Studio).
- Every foreign key column you join on, and every column you filter or sort by often.
- Interviews: "why is this query slow?", "what index would you add?", "why does adding indexes hurt writes?"

## Common mistakes

- **Indexing everything.** Every index slows writes and uses space.
- **Wrong column order** in a composite index (see the reveal).
- **Functions on the indexed column** in `WHERE`.
- **Indexing a low-variety column alone**, like a true/false flag: it matches half the table, so scanning is as good. Use it as the first column of a compound index, or a partial index (`WHERE status = 'open'`).

## Recap

- An index is a sorted structure (usually a B-tree) that lets the database seek rather than scan.
- It speeds reads and slows writes, and costs storage.
- Composite indexes follow the leftmost-prefix rule.
- Keep filters sargable: no functions, no leading wildcards on the column.
- Covering indexes avoid the table; in MongoDB order fields Equality, Sort, Range.
