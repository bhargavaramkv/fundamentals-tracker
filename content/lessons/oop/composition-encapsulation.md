---
title: "Composition & encapsulation"
summary: "Protecting invariants, fragile base classes, and constructor-time traps in C#."
---

## Encapsulation means protecting invariants

Hiding fields is not enough. The question is whether a caller can put the object into an invalid state.

```csharp
public class Order {
    private readonly List<OrderLine> _lines = new();
    public IReadOnlyList<OrderLine> Lines => _lines;
    public void AddLine(Product p, int qty) {
        if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty));
        _lines.Add(new OrderLine(p, qty));
        Total += p.Price * qty;
    }
    public decimal Total { get; private set; }
}
```

A `public List<OrderLine> Lines { get; }` with only a getter still lets callers mutate the list and skip the `Total` update. In TypeScript, use `readonly` arrays and `ReadonlyArray<T>`.

## Composition over inheritance

Inheritance couples a subclass to **how** the parent works internally (the fragile base class problem). Composition depends only on a collaborator's public contract and can be swapped at runtime. Use inheritance for true *is-a* relationships with stable base classes, and prefer `sealed` by default.

## Constructor traps

- In **C#**, a virtual call from a base constructor dispatches to the **derived override** before the derived constructor body runs. Derived field initializers *have* run, but constructor-assigned fields are still default.
- In **C++**, the same call dispatches to the base version.
- In **TypeScript**, the same issue exists, and class fields declared in the subclass aren't initialized until after `super()` returns.

The rule: don't call overridable members from constructors.

## Value objects

Make small concepts (Money, Email, DateRange) immutable types with validation in the constructor. That eliminates whole classes of invalid states.
