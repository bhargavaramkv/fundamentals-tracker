---
title: "Tables, rows & keys"
summary: "How a relational database stores data in tables, and how keys tell rows apart and link them together."
---

## The idea

Think of a spreadsheet. Each sheet holds one kind of thing: one sheet for customers, another for orders. Every row is one customer or one order. Every column is one fact, like a name or a date.

A **relational database** is a program that stores data in exactly this shape, only stricter. The sheets are called **tables**. The rows are called **rows** (or records). The columns are called **columns** (or fields).

Why not just use a spreadsheet? A database is built to hold millions of rows, let many programs use them at once, and refuse bad data. Your app talks to it, and it keeps the data safe.

Programs talk to it in a language called **SQL**. You will meet that in the next lesson.

## See it work

Here is a small shop. One table holds customers:

```
customers
+----+-------+-----------------+
| id | name  | email           |
+----+-------+-----------------+
| 1  | Asha  | asha@mail.com   |
| 2  | Ben   | ben@mail.com    |
+----+-------+-----------------+
```

A second table holds orders. Each order says which customer placed it:

```
orders
+----+-------------+-------+
| id | customer_id | total |
+----+-------------+-------+
| 10 | 1           | 25.00 |
| 11 | 1           | 8.50  |
| 12 | 2           | 40.00 |
+----+-------------+-------+
```

Trace order 11. Its `customer_id` is 1. Look up the row in `customers` where `id` is 1. That is Asha. So Asha placed an 8.50 order.

Notice we did not copy Asha's name into every order. We stored a number that points to her. If she changes her email, we change one row in one place.

```check
{"prompt": "In the orders table above, who placed order 12?", "options": ["Asha", "Ben", "Nobody, the table has no names", "Both of them"], "answer": 1, "explanation": "Order 12 has customer_id 2. The row in customers with id 2 is Ben. The orders table stores only the number, and you follow it to find the name."}
```

## How it works

Each column has a **type**: whole number, text, date, true/false, and so on. The database rejects a value of the wrong type, so you cannot put the word "hello" in a `total` column.

A column can also have **constraints**, which are rules the database enforces:

- `NOT NULL`: the value must be present. `NULL` means "no value / unknown".
- `UNIQUE`: no two rows may share this value (useful for emails).

Here is how you create the customers table in SQL:

```sql
CREATE TABLE customers (
  id    integer PRIMARY KEY,
  name  text NOT NULL,
  email text UNIQUE
);
```

Two kinds of **key** hold the whole design together.

A **primary key** is a column (or set of columns) that identifies each row. It must be unique and never `NULL`. Think of a passport number: two people can share a name, but not a passport number. Here `id` is the primary key.

A **foreign key** is a column that stores the primary key of a row in another table. In `orders`, `customer_id` is a foreign key pointing at `customers.id`. You declare it like this:

```sql
CREATE TABLE orders (
  id          integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id),
  total       numeric(10, 2) NOT NULL
);
```

Now the database enforces the link. Try to insert an order for `customer_id` 99 when no such customer exists, and it refuses. You cannot have an order that points at nobody. This promise is called **referential integrity**.

```check
{"prompt": "Which column in the orders table is the foreign key?", "options": ["id", "customer_id", "total", "orders itself, the whole table"], "answer": 1, "explanation": "A foreign key stores the primary key of a row in another table. customer_id holds values from customers.id, so it is the foreign key. The id column is orders' own primary key."}
```

## Where you'll meet it

- Almost every web app: users, products, payments and messages sit in tables.
- Popular relational databases include PostgreSQL, MySQL, SQL Server and SQLite. SQLite runs inside your phone's apps.
- Interviews: "Design the tables for a library / a shop / a chat app" is a classic. You name the tables, pick the primary keys, and draw the foreign keys between them.
- Reports and dashboards, which ask questions across tables.

## Common mistakes

- **Using a person's name or email as the primary key.** Names repeat, and emails change. Prefer a meaningless `id` that never changes.
- **Copying data instead of pointing at it.** Putting `customer_name` in every order means a rename must touch every copy, and some get missed.
- **Treating `NULL` like zero or an empty string.** `NULL` means "unknown". It is a different thing from `0` or `''`.
- **Skipping the foreign key.** Without it, nothing stops orders pointing at customers who were deleted.

```check
{"prompt": "You want to store each person's country. Which design avoids copying the same data again and again?", "options": ["Type the country's full name into every person row", "Keep a countries table and store a country_id in each person row", "Add one column per country to the people table", "Store countries in a text file next to the database"], "answer": 1, "explanation": "A countries table holds each country once, and each person stores only its id as a foreign key. A fix to a country's name then happens in one row. Typing the name everywhere repeats it, and a column per country would explode the table."}
```

## Recap

- A relational database stores data in **tables** made of **rows** and **columns**.
- Each column has a type, and constraints such as `NOT NULL` and `UNIQUE` reject bad data.
- A **primary key** identifies each row uniquely.
- A **foreign key** stores another table's primary key, linking rows together and keeping the link valid.
- Store each fact once and point to it, rather than copying it.
