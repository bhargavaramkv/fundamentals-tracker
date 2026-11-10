---
title: "Composition & encapsulation"
summary: "Protecting invariants, fragile base classes, and constructor-time traps in C#."
---

## The idea

Think of a car. You steer, press the pedals and turn a key. You cannot reach in and squirt fuel straight into a cylinder, and that is a good thing, because one wrong squirt would wreck the engine. The car offers a few safe controls and keeps the dangerous parts inside.

That is **encapsulation**: an object keeps its data private and offers only methods that keep it valid. The rule that must always hold, such as "an order's total equals the sum of its lines", is called an **invariant**. Building on [classes and objects](/learn/oop/classes-objects/), this lesson is about making a class that cannot be broken from outside.

**Composition** means building a bigger object out of smaller ones, the way a car has an engine. It is often a better choice than [inheritance](/learn/oop/inheritance-polymorphism/), because you depend only on what the engine offers, not on how it is built. It also keeps [coupling](/learn/oop/coupling-cohesion/) low.

```check
{"prompt": "What is an invariant?", "options": ["A method that never changes", "A rule about an object's data that must always be true", "A private field"], "answer": 1, "explanation": "An invariant is a condition that must hold whenever the object is used, such as total = sum of lines. Encapsulation exists to protect it."}
```

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

```check
{"prompt": "A class exposes `public List<OrderLine> Lines { get; }` and keeps a Total field updated in AddLine. What can go wrong?", "options": ["Nothing, the getter has no setter", "A caller can call Lines.Add(...) and the Total no longer matches", "The list will be null"], "answer": 1, "explanation": "A getter-only property protects the reference, not the contents. Callers can still mutate the list and skip the Total update, breaking the invariant."}
```

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
