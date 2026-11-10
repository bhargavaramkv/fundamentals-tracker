---
title: "Joins & GROUP BY"
summary: "Combine rows from two tables with JOIN, and summarize many rows into totals and counts with GROUP BY."
---

## The idea

Picture two lists on your desk. One lists students and their class ids. The other lists classes and their names. To say "Mia is in Maths" you hold both lists side by side and match the ids.

A **join** does exactly that: it matches rows from two tables using a shared value, usually a foreign key and the primary key it points to (see "Tables, rows & keys"). The result is one wider table.

Then there is a second skill: summarizing. "How many students per class?" You don't want every row, you want one number per group. That is **aggregation**, and `GROUP BY` sets up the groups.

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

Trace it. For each order, find the customer whose `id` equals its `customer_id`:

- Order 10 (customer 1) pairs with Asha.
- Order 11 (customer 1) pairs with Asha.
- Order 12 (customer 2) pairs with Ben.

```
+-------+-------+
| name  | total |
+-------+-------+
| Asha  | 25.00 |
| Asha  | 8.50  |
| Ben   | 40.00 |
+-------+-------+
```

Chen has no orders, so he doesn't appear. That is how a plain `JOIN` works.

```check
{"prompt": "Using the plain JOIN above, how many rows come back?", "options": ["2, one per customer who ordered", "3, one per matching order", "4, one per customer plus one per order", "6, every customer paired with every order"], "answer": 1, "explanation": "A JOIN returns one row for each matching pair. There are three orders and each matches exactly one customer, so there are 3 rows. Asha appears twice because she has two orders."}
```

## How it works

The `ON` clause says how rows match. Without a correct `ON`, you get every combination, which is rarely useful.

The main join types differ in what they do with rows that have no match:

- `INNER JOIN` (the same as `JOIN`): keep only rows that match on both sides.
- `LEFT JOIN`: keep every row from the left table, and fill the right side with `NULL` when nothing matches.

```sql
SELECT customers.name, orders.total
FROM customers
LEFT JOIN orders ON orders.customer_id = customers.id;
```

Now Chen appears, with `total` as `NULL`. "Left" means the table written before the `JOIN`.

Now aggregation. An **aggregate function** turns many rows into one value: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`. With `GROUP BY`, you get one result per group:

```sql
SELECT customers.name, COUNT(orders.id) AS order_count, SUM(orders.total) AS spent
FROM customers
LEFT JOIN orders ON orders.customer_id = customers.id
GROUP BY customers.name;
```

```
+-------+-------------+-------+
| name  | order_count | spent |
+-------+-------------+-------+
| Asha  | 2           | 33.50 |
| Ben   | 1           | 40.00 |
| Chen  | 0           | NULL  |
+-------+-------------+-------+
```

The database sorts the joined rows into one bucket per name, then counts and adds inside each bucket. `COUNT(orders.id)` counts only non-`NULL` values, so Chen gets 0.

To filter groups, use `HAVING`. `WHERE` filters rows *before* grouping, and `HAVING` filters groups *after*:

```sql
SELECT customer_id, SUM(total) AS spent
FROM orders
GROUP BY customer_id
HAVING SUM(total) > 30;
```

```check
{"prompt": "You want to list only customers who have placed more than 5 orders. Where does the test COUNT(*) > 5 go?", "options": ["In WHERE, before GROUP BY", "In the ON clause of the JOIN", "In ORDER BY", "In HAVING, after GROUP BY"], "answer": 3, "explanation": "The count only exists once rows are grouped, so you filter it with HAVING. WHERE runs earlier, on individual rows, before any group or count has been formed."}
```

```check
{"prompt": "You want every customer listed, including those with no orders. Which join do you use (customers first)?", "options": ["customers INNER JOIN orders", "orders INNER JOIN customers", "customers LEFT JOIN orders", "customers JOIN orders"], "answer": 2, "explanation": "LEFT JOIN keeps every row from the left table (customers) even when no order matches, filling the order columns with NULL. INNER JOIN, including a plain JOIN, drops customers with no orders."}
```

## Where you'll meet it

- Reports: "revenue per month", "top 10 customers", "orders per country".
- Any page that shows data from several tables, such as an order with its customer and items.
- Interviews: "find customers who never ordered" (a `LEFT JOIN` where the right side `IS NULL`), "second highest salary", "count per group".
- Dashboards and analytics tools, which run `GROUP BY` queries all day.

## Common mistakes

- **Forgetting the `ON` clause or getting it wrong.** You get every combination of rows, and the result explodes in size.
- **Selecting a column that is neither grouped nor aggregated.** After `GROUP BY name`, you can't select `orders.total` raw, because each group has many totals.
- **Using `WHERE` for a group test.** Use `HAVING` for conditions on aggregates.
- **Using an `INNER JOIN` and losing rows by surprise.** If you need all rows from one side, use `LEFT JOIN`.

## Recap

- A **join** matches rows of two tables, usually foreign key to primary key, using `ON`.
- `INNER JOIN` keeps matches only. `LEFT JOIN` keeps every left row and fills gaps with `NULL`.
- Aggregates (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`) turn many rows into one value.
- `GROUP BY` makes one result per group, and `HAVING` filters those groups.
- `WHERE` filters rows before grouping, `HAVING` filters after.
