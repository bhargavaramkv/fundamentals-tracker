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

A `public List<OrderLine> Lines { get; }` with only a getter still lets callers mutate the list and skip the `Total` update. A getter-only property protects the **reference**, not the **contents**. Whether it's a field or a property doesn't matter; a public field would be worse.

Exposing `IReadOnlyList<T>` that is really your `List<T>` is only a hint: `((List<OrderLine>)order.Lines).Add(...)` compiles and works. Return a wrapper instead:

```csharp
private readonly List<OrderLine> _lines = new();
private ReadOnlyCollection<OrderLine>? _view;
public IReadOnlyList<OrderLine> Lines => _view ??= _lines.AsReadOnly();
// cast to List<T> → InvalidCastException; cast to IList<T>.Add → NotSupportedException
```

In **TypeScript**, `readonly items: Item[]` only stops reassigning `items`; `cart.items.push(x)` still compiles. Type it as `readonly Item[]` (or `ReadonlyArray<Item>`) and mutate through methods.

## Composition over inheritance

Inheritance couples a subclass to **how** the parent works internally (the fragile base class problem). Composition depends only on a collaborator's public contract and can be swapped at runtime. Use inheritance for true *is-a* relationships with stable base classes, and prefer `sealed` by default.

The classic example is Java's `Stack extends Vector`. Every `Vector` method comes along, so callers can `insertElementAt` into the middle of a stack and break LIFO. A stack that *wraps* a private list exposes only `Push`/`Pop`/`Peek`, so its invariant can't be bypassed.

## Constructor traps

- In **C#**, a virtual call from a base constructor dispatches to the **derived override** before the derived constructor body runs. Derived field initializers *have* run, but constructor-assigned fields are still default.
- In **C++**, the same call dispatches to the base version.
- In **TypeScript**, the same issue exists, and class fields declared in the subclass aren't initialized until after `super()` returns.

The rule: don't call overridable members from constructors. Nothing throws: the code compiles and runs, and the bug is silent wrong state (analyzer CA2214 flags it).

## Common misconceptions

| Belief | Reality |
|---|---|
| "Composition over inheritance" is about performance | It's about **coupling**. Virtual dispatch and an extra object reference cost about the same either way. |
| A getter-only collection property is encapsulated | The caller can't swap the list, but can still `Add`/`Remove`/`Clear` it. |
| Returning `IReadOnlyList<T>` makes it read-only | Only at compile time. A cast back to `List<T>` mutates it; return `AsReadOnly()` or a copy. |
| A virtual call in a base constructor throws | It runs the **derived override** against half-initialized state, silently. |
| TypeScript `readonly arr: T[]` freezes the array | It only freezes the property binding; use `readonly T[]`. |

## Value objects

Make small concepts (Money, Email, DateRange) immutable types with validation in the constructor. That eliminates whole classes of invalid states.
