---
title: "SOLID in practice"
summary: "Five design habits, each shown as a smell you can spot in a C# code review and the small fix that removes it."
---

## The idea

Building codes exist because people learned the hard way what makes houses fall down. **SOLID** is the same for classes: five habits, learned from many painful projects, that keep code easy to change. The name is the first letter of each one.

You already know the ingredients. [Cohesion](/learn/oop/coupling-cohesion/) is behind the first, [interfaces](/learn/oop/interfaces-abstraction/) behind the fourth and fifth, and [inheritance and polymorphism](/learn/oop/inheritance-polymorphism/) behind the second and third. They are guides, not laws: following them blindly adds needless classes.

```check
{"prompt":"What is SOLID best described as?","options":["A set of five rules a compiler enforces","A C# library","Five design habits that keep code easy to change"],"answer":2,"explanation":"SOLID is a set of guidelines, not something tools enforce. They help you spot designs that will be painful to change, and need judgement to apply."}
```

## The five, in plain words

- **S, Single Responsibility:** a class should have one reason to change. A class that saves orders, formats receipts and sends email changes whenever any of those change.
- **O, Open/Closed:** add new behaviour by adding code, not by editing old, tested code.
- **L, Liskov Substitution:** wherever a base type is expected, any subtype must work without surprises. A subtype that refuses part of the base's promise breaks callers.
- **I, Interface Segregation:** prefer several small interfaces to one wide one, so nobody must implement methods they do not need.
- **D, Dependency Inversion:** high-level logic depends on an abstraction it owns, and low-level details (SQL, SMTP) plug into it. Not `new SqlRepository()` inside business code.

## See it work: Open/Closed

Here a discount calculator grows with every new customer type:

```csharp
decimal Discount(Order o) => o.CustomerType switch {
    "Regular" => 0m,
    "Gold"    => o.Total * 0.10m,
    _ => throw new NotSupportedException()
};
```

Adding "Student" means editing this method, and every other `switch` on `CustomerType` in the codebase. Watch the refactor.

```steps
{"title":"From switch to strategies","frames":[{"visual":" Discount(order)\n   switch CustomerType\n     \"Regular\" -> 0\n     \"Gold\"    -> 10%\n     (add \"Student\" here: edit old code)","caption":"Before: one method knows every customer type. A new type means editing it."},{"visual":" interface IDiscount { decimal For(Order o); }","caption":"Step 1: extract the promise as an interface. The choice moves out of the switch."},{"visual":" RegularDiscount : IDiscount   -> 0\n GoldDiscount    : IDiscount   -> 10%","caption":"Step 2: one small class per rule. Each can be tested alone."},{"visual":" services.AddScoped<IDiscount, RegularDiscount>();\n services.AddScoped<IDiscount, GoldDiscount>();\n d = discounts.Single(x => x.Key == order.CustomerType);","caption":"Step 3: register them all with DI and pick by key. `Discount` has no `switch`."},{"visual":" StudentDiscount : IDiscount   -> 15%     (new file)\n Discount(order)  unchanged\n GoldDiscount     unchanged","caption":"Now \"Student\" is a new class and a new registration. Nothing old is edited."}]}
```

Do not do this on day one. When the *second or third* variation appears, extract the strategy; before that, a plain `switch` is simpler.

```check
{"prompt":"Adding a new payment type forces you to edit the same switch in four classes. Which principle does this point to?","options":["Single Responsibility","Open/Closed","Interface Segregation","Liskov Substitution"],"answer":1,"explanation":"Open/Closed says new behaviour should arrive as new code, not edits to old code. Repeated switches on a type are the smell. Replace them with one implementation per type, resolved through DI."}
```

## Liskov in one picture

Liskov is about behaviour, not family trees. A square "is a" rectangle in maths, but code written for rectangles assumes width and height can change independently. A `Square : Rectangle` that links them breaks that assumption.

```csharp
void Widen(Rectangle r) { r.Width = 10; r.Height = 5; }
// Area should be 50. With a Square it is 25.
```

A real .NET wart: `ReadOnlyCollection<T>` implements `IList<T>` but throws on `Add`. Code that takes an `IList<T>` and calls `Add` crashes. The warning sign is an override that throws `NotSupportedException`.

```reveal
{"prompt":"Which principle does each symptom point to? (1) An implementer writes `throw new NotImplementedException()` for three of an interface's six methods. (2) Business logic calls `new SqlRepository()`.","answer":"(1) **Interface Segregation**: the interface is too wide, so split it into role interfaces like `IReader` and `IWriter`. (2) **Dependency Inversion**: the domain should own an `IRepository` abstraction and receive an implementation. If the throwing were in a *subclass override* of a base method, that would be Liskov instead."}
```

## Where you'll meet it

Code reviews and interviews, mostly. ASP.NET Core's design is DIP and ISP in practice: you depend on `ILogger<T>`, not a log file. Strategy lists resolved through DI (as above) are the usual OCP answer. In an interview, name the principle, show the concrete coupling it removes, and admit the cost: more types and more indirection.

## Common mistakes

- **Reading "one responsibility" as "one method".** It means one *reason to change*.
- **Fake OCP.** A `default: throw` branch only makes a missing case fail loudly; you still edit the `switch`. OCP removes the switch.
- **Interfaces for everything.** Abstract at the second variation, not the first.
- **Blaming the wrong principle.** DIP is about which way dependencies point. A subtype that misbehaves is Liskov.

```check
{"prompt":"Which is the clearest sign of a Liskov violation?","options":["A subclass override throws NotSupportedException for something the base class promises","A class has more than one public method","A class takes its dependencies in its constructor","A new feature adds a new class"],"answer":0,"explanation":"A subtype that refuses part of its base's contract cannot safely stand in for it. The other options describe ordinary, healthy code."}
```

## Recap

- **S**: one reason to change per class.
- **O**: extend by adding code, not by editing tested code.
- **L**: subtypes must keep the base type's promises.
- **I**: small, role-based interfaces.
- **D**: depend on abstractions that the high-level code owns.
- Apply them when the pain appears, not in advance.
