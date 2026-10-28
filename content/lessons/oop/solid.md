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
