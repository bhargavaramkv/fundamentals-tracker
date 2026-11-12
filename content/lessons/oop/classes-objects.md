---
title: "Classes & objects"
summary: "A class is a blueprint, an object is one thing built from it, and together they keep data and the code that uses it in one place."
---

## The idea

Think of a cookie cutter. The cutter is not a cookie. It is a shape you press into dough as many times as you like. Each cookie is a separate thing: you can add sprinkles to one and leave the others plain.

Programming has the same split. A **class** is the cutter: a description of what a thing knows and what it can do. An **object** is one cookie: a single thing made from that description. Objects from the same class have the same shape, but each keeps its own values.

Why bother? Without classes, related data ends up in loose variables and the code that works on it ends up somewhere else. A class bundles them, so "a bank account" becomes one thing you can pass around.

```check
{"prompt":"In the cookie-cutter picture, what is the object?","options":["The cutter itself","One cookie pressed out of the dough","The whole recipe book"],"answer":1,"explanation":"The class is the cutter (the description). Each object is one cookie made from it, with its own sprinkles."}
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

Now make two objects and use one of them:

```csharp
var a = new Account { Owner = "Asha", Balance = 100 };
var b = new Account { Owner = "Ben", Balance = 20 };
a.Deposit(50);
```

Step through it and watch what each variable holds.

```steps
{"title":"Two objects from one class","frames":[{"visual":" variables      objects in memory\n ---------      -----------------\n a              (nothing)\n b              (nothing)","caption":"Nothing exists yet. `Account` is only a description."},{"visual":" variables      objects in memory\n ---------      -----------------\n a  ---------->  Owner: Asha   Balance: 100\n b              (nothing)","caption":"`new Account {...}` builds an object. `a` points at it."},{"visual":" variables      objects in memory\n ---------      -----------------\n a  ---------->  Owner: Asha   Balance: 100\n b  ---------->  Owner: Ben    Balance: 20","caption":"A second `new` builds a second, separate object."},{"visual":" variables      objects in memory\n ---------      -----------------\n a  ---------->  Owner: Asha   Balance: 150\n b  ---------->  Owner: Ben    Balance: 20","caption":"`a.Deposit(50)` runs on the object `a` points at. Only that Balance changes."}]}
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

Now `new Account("Asha", -5)` fails straight away, instead of producing nonsense you find three screens later.

Inside a method, the keyword `this` means "the object this method was called on". You rarely write it, but it explains why `a.Deposit(50)` changes `a` and not `b`.

```check
{"prompt":"You create two Account objects, then call Deposit on the first. What happens to the second object's Balance?","options":["It also changes, because they share a class","It resets to zero","It stays the same, because each object has its own fields","The program refuses to run"],"answer":2,"explanation":"The class is shared, but field values are per object. A method call affects only the object it was called on."}
```

## Two names, one object

In C#, a variable holding a class instance holds a **reference**: an arrow to the object, not the object itself. Copying the variable copies the arrow.

```steps
{"title":"var c = a;","frames":[{"visual":" a  ---------->  Asha, 150","caption":"Before the copy: `a` points at one account."},{"visual":" a  ---------->  Asha, 150\n c  ------------^","caption":"`var c = a;` copies the arrow. There is still only one object."},{"visual":" a  ---------->  Asha, 160\n c  ------------^","caption":"`c.Deposit(10)` changes that one object, so `a` sees it too."}]}
```

```reveal
{"prompt":"Predict: after `var c = a; c.Deposit(10);` what do `a.Balance` and `c.Balance` show if `a.Balance` was 150? Then: how would you get a truly separate account?","answer":"Both show **160**, because `a` and `c` are the same object. To get a separate account, build a new one with `new Account(...)` and copy the values you need."}
```

## Where you'll meet it

Almost everywhere. A `List<int>` is a class, and each list you create is an object with its own items. A `DateTime`, a `StringBuilder`, an `HttpClient`, an EF Core `DbContext`: all objects. In a game, every enemy on screen is an object of an `Enemy` class, each with its own health.

In interviews, "design a parking lot" or "design a library system" starts the same way: find the nouns (Car, Ticket, Book, Member), make each a class, and decide what each one knows and does.

## Common mistakes

- **Mixing up class and object.** `Account.Balance` means nothing, because no account exists yet. You need an object: `a.Balance`.
- **Assuming assignment copies.** For classes, `var c = a;` shares the object, as the trace showed.
- **Public fields everywhere.** Anyone can set `Balance = -1000`. The next lessons show how to protect an object from that.
- **A class that is just a bag of data**, with the code that changes it living far away. Then the class is not pulling its weight.

```check
{"prompt":"After `var a = new Account(...); var c = a;` you call `c.Deposit(10)`. What does `a.Balance` show?","options":["The old balance, because c is a copy","An error","The balance plus 10, because a and c are the same object"],"answer":2,"explanation":"Classes are reference types: assigning copies the reference, not the object. Both variables point at the one Account, so the change is visible through either."}
```

## Recap

- A class is a blueprint. An object (instance) is one thing built from it with `new`.
- Fields hold each object's own data. Methods are the actions it can perform on that data.
- A constructor sets up a new object and can reject invalid input.
- Variables hold references: assigning one to another shares the object, it does not copy it.
- Good classes keep data and the code that changes it together.
