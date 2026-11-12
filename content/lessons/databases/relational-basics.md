---
title: "Tables, rows & keys"
summary: "How a relational database stores data in tables, and how keys tell rows apart and link them together."
---

## The idea

Think of a spreadsheet. Each sheet holds one kind of thing: one sheet for customers, another for orders. Every row is one customer or one order. Every column is one fact, like a name or a date.

A **relational database** stores data in exactly this shape, only stricter. The sheets are **tables**. The rows are **rows** (or records). The columns are **columns** (or fields).

Why not just use a spreadsheet? A database is built to hold millions of rows, let many programs use them at once, and refuse bad data. Your app talks to it in a language called **SQL**, which the next lesson covers. SQL Server, PostgreSQL, MySQL and SQLite are all relational databases.

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

A second table holds orders. Each order says which customer placed it, by storing that customer's `id`:

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

Follow order 11 to its customer:

```steps
{"title":"Following an id to a row","frames":[{"visual":" orders                         customers\n id  customer_id  total         id  name\n 10  1            25.00         1   Asha\n 11  1            8.50    <-    2   Ben\n 12  2            40.00","caption":"Start at order 11. It stores only a number in `customer_id`."},{"visual":" orders                         customers\n id  customer_id  total         id  name\n 11  [1]          8.50          1   Asha\n                                2   Ben","caption":"Read that number: `customer_id` is 1."},{"visual":" orders                         customers\n id  customer_id  total         id  name\n 11  [1]          8.50   ---->  [1] Asha\n                                2   Ben","caption":"Look for the customers row whose `id` is 1."},{"visual":" order 11 -> customer 1 -> Asha","caption":"Found: Asha placed an 8.50 order. Her name is stored once, so a change happens in one row."}]}
```

We did not copy Asha's name into every order. If she changes her email, we change one row in one place.

```check
{"prompt":"In the orders table above, who placed order 12?","options":["Ben","Asha","Nobody, the table has no names","Both of them"],"answer":0,"explanation":"Order 12 has customer_id 2. The row in customers with id 2 is Ben. The orders table stores only the number, and you follow it to find the name."}
```

## How it works

Each column has a **type**: whole number, text, date, true/false, and so on. The database rejects a value of the wrong type, so you cannot put the word "hello" in a `total` column.

A column can also have **constraints**, rules the database enforces:

- `NOT NULL`: a value must be present. `NULL` means "no value / unknown".
- `UNIQUE`: no two rows may share this value (useful for emails).

```sql
CREATE TABLE customers (
  id    integer PRIMARY KEY,
  name  text NOT NULL,
  email text UNIQUE
);
```

Two kinds of **key** hold the design together.

A **primary key** identifies each row. It must be unique and never `NULL`. Think of a passport number: two people can share a name, but not a passport number. Here `id` is the primary key.

A **foreign key** is a column that stores the primary key of a row in another table. In `orders`, `customer_id` is a foreign key pointing at `customers.id`:

```sql
CREATE TABLE orders (
  id          integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id),
  total       numeric(10, 2) NOT NULL
);
```

Now the database enforces the link. This promise is called **referential integrity**.

```steps
{"title":"The database guards the link","frames":[{"visual":" INSERT INTO orders VALUES (13, 2, 5.00);\n customers: 1 Asha, 2 Ben       customer 2 found\n result: OK, 4 orders","caption":"Insert an order for customer 2. That customer exists, so it is accepted."},{"visual":" INSERT INTO orders VALUES (14, 99, 5.00);\n customers: 1 Asha, 2 Ben       customer 99 not found","caption":"Insert an order for customer 99. No such customer exists."},{"visual":" ERROR: violates foreign key constraint\n result: rejected, still 4 orders","caption":"The database refuses. You cannot have an order pointing at nobody."}]}
```

```check
{"prompt":"Which column in the orders table is the foreign key?","options":["id","total","customer_id","orders itself, the whole table"],"answer":2,"explanation":"A foreign key stores the primary key of a row in another table. customer_id holds values from customers.id, so it is the foreign key. The id column is orders' own primary key."}
```

## Where you'll meet it

- Almost every web app: users, products, payments and messages sit in tables. In EF Core, each entity class maps to a table and a navigation property maps to a foreign key.
- SQLite runs inside phone apps, and SQL Server is the usual pair for .NET.
- Interviews: "Design the tables for a library / a shop / a chat app." You name the tables, pick the primary keys, and draw the foreign keys.

```reveal
{"prompt":"Predict: a `customers` table has Asha as `id` 1, and orders 10 and 11 point at her. You run `DELETE FROM customers WHERE id = 1;`. With the foreign key in place and no special delete rule, what happens, and what would you do instead?","answer":"The database **refuses the delete** because orders still reference her. Either delete or reassign her orders first, or declare the foreign key with `ON DELETE CASCADE` (deletes her orders too) if that is really the intent."}
```

## Common mistakes

- **Using a name or email as the primary key.** Names repeat and emails change. Prefer a meaningless `id` that never changes.
- **Copying data instead of pointing at it.** A `customer_name` in every order means a rename must touch every copy.
- **Treating `NULL` like zero or an empty string.** `NULL` means unknown; it is a different thing from `0` or `''`.
- **Skipping the foreign key.** Without it, nothing stops orders pointing at customers who were deleted.

```check
{"prompt":"You want to store each person's country. Which design avoids copying the same data again and again?","options":["Type the country's full name into every person row","Add one column per country to the people table","Keep a countries table and store a country_id in each person row","Store countries in a text file next to the database"],"answer":2,"explanation":"A countries table holds each country once, and each person stores only its id as a foreign key. A fix to a country's name then happens in one row."}
```

## Recap

- A relational database stores data in **tables** made of **rows** and **columns**.
- Each column has a type, and constraints such as `NOT NULL` and `UNIQUE` reject bad data.
- A **primary key** identifies each row uniquely.
- A **foreign key** stores another table's primary key, linking rows and keeping the link valid.
- Store each fact once and point to it, rather than copying it.
