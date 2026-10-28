---
title: "SOLID in practice"
summary: "Each principle as a smell you can spot in a C#/TypeScript code review."
---

| Principle | Smell | Refactor |
|---|---|---|
| **S**ingle Responsibility | A class changes for unrelated reasons (data access + formatting + email) | Split by axis of change and compose |
| **O**pen/Closed | `switch(type)` repeated across files; every new type edits old code | Polymorphism or strategies registered in DI |
| **L**iskov Substitution | Overrides throw `NotSupportedException`, or a subtype strengthens preconditions | Rethink the hierarchy; use composition or separate interfaces |
| **I**nterface Segregation | Implementers stub out methods they don't need | Split into role interfaces (`IReader`, `IWriter`) |
| **D**ependency Inversion | `new SqlRepository()` inside domain logic | Depend on an abstraction owned by the domain; inject it |

## LSP is about behavior, not taxonomy

Square-extends-Rectangle fails because callers rely on setting width and height independently. `ReadOnlyCollection<T>` implementing `IList<T>` and throwing on `Add` is a real .NET LSP wart.

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
