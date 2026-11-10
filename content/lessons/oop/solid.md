---
title: "SOLID in practice"
summary: "Each principle as a smell you can spot in a C#/TypeScript code review."
---

## The idea

Building codes exist because people learned the hard way what makes houses fall down. **SOLID** is the same for classes: five habits, learned from many painful projects, that keep code easy to change. The name is the first letter of each one.

You already know the ingredients. [Cohesion](/learn/oop/coupling-cohesion/) is behind Single Responsibility, [interfaces](/learn/oop/interfaces-abstraction/) behind Interface Segregation and Dependency Inversion, and [inheritance and polymorphism](/learn/oop/inheritance-polymorphism/) behind Open/Closed and Liskov. The table below gives each principle as a smell you can notice in code, plus the fix. They are guides, not laws: following them blindly adds needless classes.

```check
{"prompt": "What is SOLID best described as?", "options": ["A set of five rules a compiler enforces", "Five design habits that keep code easy to change", "A C# library"], "answer": 1, "explanation": "SOLID is a set of guidelines, not something tools enforce. They help you spot designs that will be painful to change, and need judgement to apply."}
```

## The five principles

| Principle | Smell | Refactor |
|---|---|---|
| **S**ingle Responsibility | A class changes for unrelated reasons (data access + formatting + email) | Split by axis of change and compose |
| **O**pen/Closed | `switch(type)` repeated across files; every new type edits old code | Polymorphism or strategies registered in DI |
| **L**iskov Substitution | Overrides throw `NotSupportedException`, or a subtype strengthens preconditions | Rethink the hierarchy; use composition or separate interfaces |
| **I**nterface Segregation | Implementers stub out methods they don't need | Split into role interfaces (`IReader`, `IWriter`) |
| **D**ependency Inversion | `new SqlRepository()` inside domain logic | Depend on an abstraction owned by the domain; inject it |

## LSP is about behavior, not taxonomy

Square-extends-Rectangle fails because callers rely on setting width and height independently. `ReadOnlyCollection<T>` implementing `IList<T>` and throwing on `Add` is a real .NET LSP wart.

```check
{"prompt": "An override throws NotSupportedException because the subclass cannot do what the base class promises. Which principle does this point to?", "options": ["Single Responsibility", "Open/Closed", "Liskov Substitution", "Dependency Inversion"], "answer": 2, "explanation": "A subtype that refuses part of the base type's contract cannot safely stand in for it. That is exactly what Liskov Substitution warns about."}
```

## OCP without over-engineering

Don't add abstractions speculatively. When the **second or third** variation appears, extract the strategy:

```csharp
public interface IPaymentMethod { string Key { get; } Task<Result> Charge(Order o); }
// register: services.AddScoped<IPaymentMethod, CardPayment>(); ...
// resolve: methods.Single(m => m.Key == order.PaymentKey)
```

## How to talk about SOLID in interviews

Name the principle, show the concrete coupling it removes, and acknowledge the cost: more types and more indirection.

## Which principle is it? Start from the symptom

| Symptom | Principle | Why not the others |
|---|---|---|
| Subtype breaks code written against the base type (Square/Rectangle) | **LSP** | The caller's assumptions fail, not the wiring |
| New feature means editing old, tested classes | **OCP** | Closed for modification, open for extension |
| Business logic does `new SqlRepository()` | **DIP** | The direction of the dependency is the issue |
| Implementers stub out methods | **ISP** | The interface is too wide |

**DIP is about who owns the abstraction and which way dependencies point.** It does not explain why a subclass misbehaves; that is LSP.

## Bad OCP fixes

A `default: throw new NotSupportedException()` branch makes a missing case fail loudly, but adding a payment method still means editing the same `switch` in every class. That is not OCP. The OCP fix removes the switch: one `IPaymentMethod` implementation per type, resolved through DI, so new types are *added* without editing existing code.
