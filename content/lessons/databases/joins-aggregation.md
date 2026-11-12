---
title: "Joins & GROUP BY"
summary: "Combine rows from two tables with JOIN, and summarize many rows into totals and counts with GROUP BY."
---

## The idea

Picture two lists on your desk. One lists students and their class ids. The other lists classes and their names. To say "Mia is in Maths" you hold both lists side by side and match the ids.

A **join** does exactly that: it matches rows from two tables using a shared value, usually a foreign key and the primary key it points to (see "Tables, rows & keys"). The result is one wider table.

The second skill is summarizing. "How many students per class?" You do not want every row, you want one number per group. That is **aggregation**, and `GROUP BY` sets up the groups.

## See it work

Two tables:

```
customers            orders
+----+-------+       +----+-------------+-------+
| id | name  |       | id | customer_id | total |
+----+-------+       +----+-------------+-------+
| 1  | Asha  |       | 10 | 1           | 25.00 |
| 2  | Ben   |       | 11 | 1           | 8.50  |
| 3  | Chen  |       | 12 | 2           | 40.00 |
+----+-------+       +----+-------------+-------+
```

Show each order with the customer's name:

```sql
SELECT customers.name, orders.total
FROM orders
JOIN customers ON orders.customer_id = customers.id;
```

For each order, the database finds the customer whose `id` equals its `customer_id`.

```steps
{"title":"A JOIN matching rows","frames":[{"visual":" order 10 (cust 1, 25.00)  ----->  customer 1 Asha\n order 11 (cust 1,  8.50)\n order 12 (cust 2, 40.00)\n result so far:  Asha  25.00","caption":"Take order 10. Its `customer_id` is 1. Find the customer with `id` 1."},{"visual":" order 10 (cust 1, 25.00)\n order 11 (cust 1,  8.50)  ----->  customer 1 Asha\n order 12 (cust 2, 40.00)\n result so far:  Asha  25.00 / Asha  8.50","caption":"Order 11 also has `customer_id` 1, so it matches Asha again."},{"visual":" order 10 (cust 1, 25.00)\n order 11 (cust 1,  8.50)\n order 12 (cust 2, 40.00)  ----->  customer 2 Ben\n result so far:  Asha 25.00 / Asha 8.50 / Ben 40.00","caption":"Order 12 has `customer_id` 2, so it matches Ben."},{"visual":" name   total\n Asha   25.00\n Asha   8.50\n Ben    40.00","caption":"Chen (3) matched no order, so a plain JOIN leaves him out. Three rows come back."}]}
```

```check
{"prompt":"Using the plain JOIN above, how many rows come back?","options":["3, one per matching order","2, one per customer who ordered","4, one per customer plus one per order","6, every customer paired with every order"],"answer":0,"explanation":"A JOIN returns one row for each matching pair. There are three orders and each matches exactly one customer, so there are 3 rows. Asha appears twice because she has two orders."}
```

## How it works

The `ON` clause says how rows match. Without a correct `ON`, you get every combination, which is rarely useful.

Join types differ in what they do with rows that have no match:

- `INNER JOIN` (the same as `JOIN`): keep only rows that match on both sides.
- `LEFT JOIN`: keep every row from the left table (the one written first), and fill the right side with `NULL` when nothing matches.

```sql
SELECT customers.name, orders.total
FROM customers
LEFT JOIN orders ON orders.customer_id = customers.id;
```

Now Chen appears, with `total` as `NULL`.

Next, aggregation. An **aggregate function** turns many rows into one value: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`. With `GROUP BY`, you get one result per group:

```sql
SELECT customers.name, COUNT(orders.id) AS order_count,
       SUM(orders.total) AS spent
FROM customers
LEFT JOIN orders ON orders.customer_id = customers.id
GROUP BY customers.name;
```

```steps
{"title":"GROUP BY folding rows","frames":[{"visual":" name   order_id  total\n Asha   10        25.00\n Asha   11        8.50\n Ben    12        40.00\n Chen   NULL      NULL","caption":"First the LEFT JOIN produces four rows (Chen has a NULL order)."},{"visual":" bucket Asha:  (10, 25.00) (11, 8.50)\n bucket Ben:   (12, 40.00)\n bucket Chen:  (NULL, NULL)","caption":"`GROUP BY name` sorts the rows into one bucket per name."},{"visual":" name   order_count  spent\n Asha   2            33.50\n Ben    1            40.00\n Chen   0            NULL","caption":"Each bucket collapses to one row. `COUNT(orders.id)` skips NULLs, so Chen gets 0."}]}
```

To filter groups, use `HAVING`. `WHERE` filters rows *before* grouping, `HAVING` filters groups *after*:

```sql
SELECT customer_id, SUM(total) AS spent
FROM orders
GROUP BY customer_id
HAVING SUM(total) > 30;
```

```check
{"prompt":"You want only customers who have placed more than 5 orders. Where does the test COUNT(*) > 5 go?","options":["In WHERE, before GROUP BY","In the ON clause of the JOIN","In ORDER BY","In HAVING, after GROUP BY"],"answer":3,"explanation":"The count only exists once rows are grouped, so you filter it with HAVING. WHERE runs earlier, on individual rows, before any group or count has been formed."}
```

```check
{"prompt":"You want every customer listed, including those with no orders. Which join do you use (customers first)?","options":["customers INNER JOIN orders","orders INNER JOIN customers","customers LEFT JOIN orders","customers JOIN orders"],"answer":2,"explanation":"LEFT JOIN keeps every row from the left table (customers) even when no order matches, filling the order columns with NULL. INNER JOIN, including a plain JOIN, drops customers with no orders."}
```

## Where you'll meet it

- Reports: "revenue per month", "top 10 customers", "orders per country".
- EF Core: `db.Orders.Include(o => o.Customer)` becomes a JOIN, and LINQ `GroupBy(...).Select(g => g.Sum(...))` becomes `GROUP BY`.
- Interviews: "find customers who never ordered" (a `LEFT JOIN` where the right side `IS NULL`), "second highest salary", "count per group".

```reveal
{"prompt":"Predict: from the tables above, what does this return? `SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;`","answer":"**Chen.** The LEFT JOIN keeps every customer; only Chen has no matching order, so his `o.id` is `NULL`. Filtering on `IS NULL` leaves the customers who never ordered. This is the classic \"find the ones with none\" query."}
```

## Common mistakes

- **Forgetting the `ON` clause or getting it wrong.** You get every combination of rows, and the result explodes.
- **Selecting a column that is neither grouped nor aggregated.** After `GROUP BY name` you cannot select raw `orders.total`: each group has many totals.
- **Using `WHERE` for a group test.** Use `HAVING` for conditions on aggregates.
- **Using `INNER JOIN` and losing rows by surprise.** If you need all rows from one side, use `LEFT JOIN`.

## Recap

- A **join** matches rows of two tables, usually foreign key to primary key, using `ON`.
- `INNER JOIN` keeps matches only. `LEFT JOIN` keeps every left row and fills gaps with `NULL`.
- Aggregates (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`) turn many rows into one value.
- `GROUP BY` makes one result per group, and `HAVING` filters those groups.
- `WHERE` filters rows before grouping, `HAVING` filters after.
