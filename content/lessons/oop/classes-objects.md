---
title: "Classes & objects"
summary: "A class is a blueprint, an object is one thing built from it, and together they keep data and the code that uses it in one place."
---

## The idea

Think of a cookie cutter. The cutter is not a cookie. It is a shape you press into dough as many times as you like. Each cookie you press out is a separate thing: you can add sprinkles to one and leave the others plain.

Programming has the same split. A **class** is the cutter: a description of what a thing knows and what it can do. An **object** is one cookie: a single thing made from that description. Objects made from the same class have the same shape, but each keeps its own values.

Why bother? Without classes, related data ends up in loose variables and the code that works on it ends up somewhere else. A class bundles them together, so "a bank account" becomes one thing you can pass around.

```check
{"prompt": "In the cookie-cutter picture, what is the object?", "options": ["The cutter itself", "One cookie pressed out of the dough", "The whole recipe book"], "answer": 1, "explanation": "The class is the cutter (the description). Each object is one cookie made from it, with its own sprinkles."}
```

## See it work

Here is a class for a bank account. It has two **fields** (data it remembers) and one **method** (a function that belongs to the class).

```csharp
class Account {
    public string Owner;
    public int Balance;

    public void Deposit(int amount) {
        Balance = Balance + amount;
    }
}
```

Now we make two objects and use them:

```csharp
var a = new Account { Owner = "Asha", Balance = 100 };
var b = new Account { Owner = "Ben", Balance = 20 };
a.Deposit(50);
```

Trace it. After the first line, `a` holds Asha with 100. After the second, `b` holds Ben with 20. Calling `a.Deposit(50)` runs the method on `a` only: inside it, `Balance` means "this account's balance", so Asha's goes from 100 to 150. Ben's stays at 20.

```
 Account (class)         a                b
 Owner, Balance   -->  Asha, 150        Ben, 20
```

## How it works

Four terms to keep straight.

- **Field**: a variable that lives inside an object. Each object has its own copy.
- **Method**: a function defined in a class. It runs on one particular object and can read and change that object's fields.
- **Constructor**: a special method that runs when you write `new`. It sets up a fresh object.
- **Instance**: another word for object. "`a` is an instance of `Account`."

A constructor lets you refuse to build a broken object:

```csharp
public Account(string owner, int opening) {
    if (opening < 0) throw new ArgumentException("No negative balance");
    Owner = owner;
    Balance = opening;
}
```

Now `new Account("Asha", -5)` fails straight away instead of producing nonsense that you find three screens later.

Inside a method, the keyword `this` means "the object this method was called on". You usually do not need to write it, but it explains why `a.Deposit(50)` changes `a` and not `b`.

```check
{"prompt": "You create two Account objects, then call Deposit on the first. What happens to the second object's Balance?", "options": ["It also changes, because they share a class", "It stays the same, because each object has its own fields", "It resets to zero", "The program refuses to run"], "answer": 1, "explanation": "The class is shared, but field values are per object. A method call affects only the object it was called on."}
```

## Where you'll meet it

Almost everywhere. A `List<int>` in C# is a class, and each list you create is an object with its own items. A `DateTime`, a `StringBuilder`, an HTTP request, a database connection: all objects. In a game, every enemy on screen is an object of an `Enemy` class, each with its own health and position.

In interviews, "design a parking lot" or "design a library system" starts the same way: find the nouns (Car, Ticket, Book, Member), make each a class, and decide what each one knows and does.

## Common mistakes

- **Mixing up class and object.** `Account.Balance` has no meaning, because no account exists yet. You need an object: `a.Balance`.
- **Copying a reference, not an object.** For classes in C#, `var c = a;` does not make a second account. Both names point at the same object, so `c.Deposit(10)` changes what `a` sees too.
- **Public fields everywhere.** Anyone can set `Balance = -1000`. The next lessons show how to protect an object from that.
- **A class that is just a bag of data and a pile of helper functions elsewhere.** If the code that changes the data lives far from it, the class is not pulling its weight.

```check
{"prompt": "After `var a = new Account(...); var c = a;` you call `c.Deposit(10)`. What does `a.Balance` show?", "options": ["The old balance, because c is a copy", "The balance plus 10, because a and c are the same object", "An error"], "answer": 1, "explanation": "Classes are reference types: assigning copies the reference, not the object. Both variables point at the one Account, so the change is visible through either."}
```

## Recap

- A class is a blueprint. An object (instance) is one thing built from it with `new`.
- Fields hold each object's own data. Methods are the actions it can perform on that data.
- A constructor sets up a new object and can reject invalid input.
- Assigning an object to another variable shares it; it does not copy it.
- Good classes keep data and the code that changes it together.
