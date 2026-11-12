---
title: "Your first SQL queries"
summary: "Read, filter, sort and change rows with SELECT, WHERE, ORDER BY, INSERT, UPDATE and DELETE."
---

## The idea

Imagine asking a very literal librarian for books. You cannot say "something good". You must say exactly what you want: "From the shelf called Fiction, bring me every book published after 2020, newest first."

**SQL** (Structured Query Language) is how you talk to a relational database in that exact way. A **query** is one request. You say which table, which rows and which columns, and the database does the searching.

SQL is **declarative**: you describe *what* you want, not *how* to loop through rows. The database decides the best way to fetch it. This builds on the tables, rows and keys from "Tables, rows & keys".

## See it work

We will use this small table of books.

```
books
+----+-------------------+---------+------+-------+
| id | title             | author  | year | price |
+----+-------------------+---------+------+-------+
| 1  | Dune              | Herbert | 1965 | 9.99  |
| 2  | Neuromancer       | Gibson  | 1984 | 7.50  |
| 3  | The Martian       | Weir    | 2011 | 12.00 |
| 4  | Project Hail Mary | Weir    | 2021 | 14.00 |
+----+-------------------+---------+------+-------+
```

Query: titles of books published after 2000, newest first.

```sql
SELECT title, year
FROM books
WHERE year > 2000
ORDER BY year DESC;
```

You read it top to bottom, but the database thinks in a different order. Step through it:

```steps
{"title":"How the query runs","frames":[{"visual":" id  title              year\n 1   Dune               1965\n 2   Neuromancer        1984\n 3   The Martian        2011\n 4   Project Hail Mary  2021","caption":"`FROM books`: start with every row of the table."},{"visual":" id  title              year\n 3   The Martian        2011\n 4   Project Hail Mary  2021","caption":"`WHERE year > 2000`: throw away rows that fail the test. Rows 1 and 2 go."},{"visual":" title              year\n The Martian        2011\n Project Hail Mary  2021","caption":"`SELECT title, year`: keep only the columns you asked for. `id` goes."},{"visual":" title              year\n Project Hail Mary  2021\n The Martian        2011","caption":"`ORDER BY year DESC`: sort, biggest year first. That is the result."}]}
```

```check
{"prompt":"Which query returns only the title of every book by Weir?","options":["SELECT * FROM books","SELECT author FROM books WHERE title = 'Weir'","SELECT title WHERE author = 'Weir'","SELECT title FROM books WHERE author = 'Weir'"],"answer":3,"explanation":"SELECT chooses the columns (title), FROM names the table, and WHERE keeps only the rows where author is Weir. Text values go in single quotes. The third option is missing FROM."}
```

## How it works

A query is built from **clauses**, each doing one job:

- `SELECT`: which columns to return. `*` means all of them.
- `FROM`: which table to read.
- `WHERE`: which rows to keep. Combine tests with `AND`, `OR` and `NOT`.
- `ORDER BY`: how to sort. `ASC` (default) is smallest first, `DESC` biggest first.
- `LIMIT`: stop after this many rows (SQL Server writes `TOP n` instead).

In `WHERE`, `=` means "equals" (one equals sign, not two). Other tests: `<>` (not equal), `>`, `<`, `BETWEEN 5 AND 10`, `IN ('Weir', 'Gibson')`, and `LIKE 'The%'` where `%` matches any text.

To test for missing values, write `IS NULL`. Writing `= NULL` never matches, because `NULL` means "unknown" and nothing equals an unknown.

Three more statements change data:

```sql
INSERT INTO books (title, author, year, price)
VALUES ('Hyperion', 'Simmons', 1989, 8.00);

UPDATE books SET price = 10.50 WHERE id = 1;

DELETE FROM books WHERE year < 1970;
```

`INSERT` adds a row. `UPDATE` changes existing rows. `DELETE` removes them. Both `UPDATE` and `DELETE` act on every row that passes the `WHERE`.

```steps
{"title":"One missing WHERE","frames":[{"visual":" id  title              price\n 1   Dune               9.99\n 2   Neuromancer        7.50\n 3   The Martian        12.00\n 4   Project Hail Mary  14.00","caption":"Before: `UPDATE books SET price = 5;` has no WHERE. All four rows qualify."},{"visual":" id  title              price\n 1   Dune               5.00\n 2   Neuromancer        5.00\n 3   The Martian        5.00\n 4   Project Hail Mary  5.00","caption":"After: every row changed. The database did not ask or warn."},{"visual":" SELECT * FROM books WHERE id = 1;       -- check\n UPDATE books SET price = 5 WHERE id = 1; -- then change","caption":"With `WHERE id = 1` only Dune would change. Habit: run the WHERE as a SELECT first."}]}
```

```check
{"prompt":"You run: UPDATE books SET price = 5; with no WHERE clause. What happens?","options":["The database asks which row you meant","Only the first row changes","Nothing changes, because WHERE is required","Every row in books gets price 5"],"answer":3,"explanation":"Without a WHERE clause, UPDATE applies to every row in the table. The database does not guess or ask. Always write the WHERE first, or test it with a SELECT, before you change data."}
```

## Where you'll meet it

- Every backend that uses a relational database. EF Core's LINQ (`db.Books.Where(b => b.Year > 2000)`) turns into this SQL, and knowing SQL tells you what it really sends.
- Debugging: open a console and run `SELECT * FROM orders WHERE id = 42` to see what is truly stored.
- Interviews often start with "write a query that returns..." on a small table.

```reveal
{"prompt":"Predict: how many rows does `SELECT title FROM books WHERE author = 'Weir' AND year < 2015;` return, and which?","answer":"**One row: The Martian.** Both rows by Weir pass the author test, but only The Martian (2011) is before 2015. Project Hail Mary (2021) fails the second test, and `AND` needs both to be true."}
```

## Common mistakes

- **Forgetting `WHERE` on `UPDATE` or `DELETE`.** It hits every row.
- **Writing `= NULL`.** Use `IS NULL`.
- **Using double quotes for text.** In standard SQL single quotes are for text values; double quotes name a column or table.
- **Relying on row order without `ORDER BY`.** A table has no guaranteed order.
- **`SELECT *` in application code.** It fetches columns you do not need and breaks when the table changes.

```check
{"prompt":"How do you find books whose price has not been recorded (the price is NULL)?","options":["WHERE price = NULL","WHERE price = 0","WHERE price = ''","WHERE price IS NULL"],"answer":3,"explanation":"NULL means unknown, so a comparison such as price = NULL is never true. Use IS NULL. A price of 0 or an empty string is a real value, which is not the same as a missing one."}
```

## Recap

- SQL describes what you want, and the database works out how to get it.
- `SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT` reads and shapes rows.
- Text goes in single quotes, and missing values are tested with `IS NULL`.
- `INSERT`, `UPDATE` and `DELETE` change data; the last two touch every row that matches `WHERE`.
- Always check your `WHERE` before changing data.
