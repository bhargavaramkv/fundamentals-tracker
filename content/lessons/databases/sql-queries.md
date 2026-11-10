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

Trace it:

1. `FROM books`: start with all four rows.
2. `WHERE year > 2000`: keep only rows 3 and 4.
3. `SELECT title, year`: keep only those two columns.
4. `ORDER BY year DESC`: sort, biggest year first.

Result:

```
+-------------------+------+
| title             | year |
+-------------------+------+
| Project Hail Mary | 2021 |
| The Martian       | 2011 |
+-------------------+------+
```

```check
{"prompt": "Which query returns only the title of every book by Weir?", "options": ["SELECT * FROM books", "SELECT title FROM books WHERE author = 'Weir'", "SELECT author FROM books WHERE title = 'Weir'", "SELECT title WHERE author = 'Weir'"], "answer": 1, "explanation": "SELECT chooses the columns (title), FROM names the table, and WHERE keeps only the rows where author is Weir. Text values go in single quotes. The last option is missing FROM."}
```

## How it works

A query is built from **clauses**, each doing one job:

- `SELECT`: which columns to return. `*` means all of them.
- `FROM`: which table to read.
- `WHERE`: which rows to keep. Combine tests with `AND`, `OR` and `NOT`.
- `ORDER BY`: how to sort. `ASC` is the default (smallest first), `DESC` is biggest first.
- `LIMIT`: stop after this many rows.

In `WHERE`, `=` means "equals" (one equals sign, not two). Other tests: `<>` (not equal), `>`, `<`, `BETWEEN 5 AND 10`, `IN ('Weir', 'Gibson')`, and `LIKE 'The%'` where `%` matches any text.

To test for missing values, write `IS NULL`. Writing `= NULL` never matches, because `NULL` means "unknown" and nothing equals an unknown.

SQL does not only read. Three more statements change data:

```sql
INSERT INTO books (title, author, year, price)
VALUES ('Hyperion', 'Simmons', 1989, 8.00);

UPDATE books SET price = 10.50 WHERE id = 1;

DELETE FROM books WHERE year < 1970;
```

`INSERT` adds a row. `UPDATE` changes existing rows. `DELETE` removes them. Both `UPDATE` and `DELETE` act on every row that passes the `WHERE`.

```check
{"prompt": "You run: UPDATE books SET price = 5; with no WHERE clause. What happens?", "options": ["The database asks which row you meant", "Only the first row changes", "Every row in books gets price 5", "Nothing changes, because WHERE is required"], "answer": 2, "explanation": "Without a WHERE clause, UPDATE applies to every row in the table. The database does not guess or ask. Always write the WHERE first, or test it with a SELECT, before you change data."}
```

## Where you'll meet it

- Every backend that uses a relational database, usually through a library that builds SQL for you. Knowing SQL helps you understand what that library actually sends.
- Analysts and data people ask questions of a database with `SELECT`.
- Interviews often start with "write a query that returns..." on a small table.
- Debugging: you open a database console and run `SELECT * FROM orders WHERE id = 42` to see what is really stored.

## Common mistakes

- **Forgetting `WHERE` on `UPDATE` or `DELETE`.** It hits every row. Many teams run the same `WHERE` as a `SELECT` first.
- **Writing `= NULL`.** Use `IS NULL` instead.
- **Using double quotes for text.** In standard SQL, single quotes are for text values. Double quotes mean a column or table name.
- **Relying on row order without `ORDER BY`.** A table has no guaranteed order. If order matters, say so.
- **Using `SELECT *` in application code.** It fetches columns you don't need and breaks when the table changes.

```check
{"prompt": "How do you find books whose price has not been recorded (the price is NULL)?", "options": ["WHERE price = NULL", "WHERE price = 0", "WHERE price IS NULL", "WHERE price = ''"], "answer": 2, "explanation": "NULL means unknown, so a comparison such as price = NULL is never true. Use IS NULL. A price of 0 or an empty string is a real value, which is not the same as a missing one."}
```

## Recap

- SQL describes what you want, and the database works out how to get it.
- `SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT` reads and shapes rows.
- Text goes in single quotes, and missing values are tested with `IS NULL`.
- `INSERT`, `UPDATE` and `DELETE` change data, and the last two touch every row that matches `WHERE`.
- Always check your `WHERE` before changing data.
