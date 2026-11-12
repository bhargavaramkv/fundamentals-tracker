---
title: "Composition & encapsulation"
summary: "Protect an object's rules by hiding its data, and build big objects out of small ones instead of inheriting from them."
---

## The idea

Think of a car. You steer, press the pedals and turn a key. You cannot reach in and squirt fuel straight into a cylinder, and that is good, because one wrong squirt would wreck the engine. The car offers a few safe controls and keeps the dangerous parts inside.

That is **encapsulation**: an object keeps its data private and offers only methods that keep it valid. A rule that must always hold, such as "an order's total equals the sum of its lines", is an **invariant**.

**Composition** means building a bigger object out of smaller ones, the way a car *has an* engine. The car uses the engine through its controls and does not care how it is built. Compare [inheritance](/learn/oop/inheritance-polymorphism/), where a subclass *is a* kind of its parent and inherits everything. This lesson builds on [classes and objects](/learn/oop/classes-objects/).

```check
{"prompt":"What is an invariant?","options":["A method that never changes","A private field","A rule about an object's data that must always be true"],"answer":2,"explanation":"An invariant is a condition that must hold whenever the object is used, such as total = sum of lines. Encapsulation exists to protect it."}
```

## See it work: a leak in the wall

Here is an order that tries to protect its total:

```csharp
public class Order {
    public List<OrderLine> Lines { get; } = new();
    public decimal Total { get; private set; }
    public void AddLine(Product p, int qty) {
        Lines.Add(new OrderLine(p, qty));
        Total += p.Price * qty;
    }
}
```

`Total` has a private setter, so it looks safe. But `Lines` is a getter-only property: that stops anyone replacing the list, not changing what is in it.

```steps
{"title":"A caller bypasses AddLine","frames":[{"visual":" Lines:  (empty)\n Total:  0.00          rule holds: 0.00 = 0.00","caption":"Start: an empty order. The rule holds: Total equals the sum of lines."},{"visual":" Lines:  pen x2 = 4.00\n Total:  4.00          rule holds: 4.00 = 4.00","caption":"`order.AddLine(pen, 2)` goes through the method, which updates both."},{"visual":" Lines:  pen x2 = 4.00\n         book x1 = 12.00\n Total:  4.00          RULE BROKEN: 16.00 vs 4.00","caption":"`order.Lines.Add(new OrderLine(book, 1))` compiles, because the list is public. Total is not touched."}]}
```

## How it works: close the wall

Hide the list and show a read-only view:

```csharp
private readonly List<OrderLine> _lines = new();
public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();
```

`AsReadOnly()` returns a wrapper that refuses `Add`. Merely typing the property as `IReadOnlyList<T>` while returning the real `List<T>` is only a hint: a caller can cast it back and mutate it. Now all changes go through `AddLine`, which can also reject bad input such as `qty <= 0`. That is encapsulation: hide the data, expose behaviour.

```check
{"prompt":"A class exposes `public List<OrderLine> Lines { get; }` and keeps a Total updated in AddLine. What can go wrong?","options":["Nothing, the getter has no setter","The list will be null","A caller can call Lines.Add(...) and the Total no longer matches"],"answer":2,"explanation":"A getter-only property protects the reference, not the contents. Callers can still mutate the list and skip the Total update, breaking the invariant."}
```

## Composition over inheritance

Suppose you want a stack (last in, first out). The tempting way is to inherit from a list. Watch what follows.

```steps
{"title":"Refactor: inherit to compose","frames":[{"visual":" Stack<T> : List<T>\n   Push, Pop           <- what you wanted\n   Insert(0, x)        <- inherited, breaks the order\n   RemoveAt(2)         <- inherited\n   Clear, Sort ...     <- inherited","caption":"Inheritance: `class Stack<T> : List<T>`. Every List method comes along."},{"visual":" stack.Push(1); stack.Push(2); stack.Push(3);\n stack.Insert(0, 99);      // compiles\n stack.Pop()  -> 3         // fine\n stack.Pop()  -> 2\n stack.Pop()  -> 1         // 99 is stuck at the bottom","caption":"Problem: callers can use any inherited method, so the stack's rule can be broken from outside."},{"visual":" class Stack<T> {\n   private readonly List<T> _items = new();\n   public void Push(T x) => _items.Add(x);\n   public T Pop() { ... remove last ... }\n   public T Peek() => _items[^1];\n }","caption":"Composition: the stack *has a* private list and shows only three methods."},{"visual":" stack.Push(1);\n stack.Insert(0, 99);   // compile error: no such method","caption":"Now `Insert` does not exist on a Stack. The rule cannot be bypassed."}]}
```

Composition depends only on the other object's public contract, so you can swap the inner list for something else later. Inheritance ties you to how the parent works inside (the **fragile base class** problem). Default to composition; use inheritance for true "is a kind of" with stable parents, and mark classes `sealed` when you do not intend them to be subclassed.

## Where you'll meet it

- EF Core entities that expose `IReadOnlyCollection<OrderLine>` and change state only through methods, a core idea in domain-driven design.
- **Value objects** such as `Money`, `Email`, `DateRange`: small immutable types, validated in the constructor, so an invalid one cannot exist. C# `record` types make these short.
- ASP.NET Core: a controller *has* services injected rather than inheriting behaviour.
- Interviews: "why prefer composition over inheritance?" and "how would you stop callers corrupting this class?"

```reveal
{"prompt":"Spot the bug: a base constructor calls a `virtual` method, `Init()`. A subclass overrides `Init()` and uses a field it sets in its own constructor. What does the override see?","answer":"The field is still **its default value** (null or 0). In C#, the base constructor runs first, but the call goes to the subclass override anyway. Nothing throws, so the bug is silent. Do not call overridable members from constructors."}
```

## Common mistakes

- **Hiding the field but returning the live collection.** The leak shown above.
- **Inheriting to reuse code.** A `Stack` that extends `List` inherits methods that break it. Wrap instead.
- **Setters on everything.** Public setters let callers set any state in any order. Prefer methods named for what happens (`Ship()`, `Cancel()`).
- **Believing composition is about speed.** It is about coupling. The runtime cost is about the same.

```check
{"prompt":"Why did wrapping a List inside Stack beat inheriting from List?","options":["Wrapping makes pushes run faster","Only the three methods the Stack exposes can be called, so its rule is safe","C# does not allow inheriting from List","Inheritance cannot call base methods"],"answer":1,"explanation":"Composition lets the class choose exactly which operations exist. Inheritance exposes everything the parent has, including operations that break the new type's rules."}
```

## Recap

- Encapsulation: hide data and expose methods that keep invariants true.
- A getter-only collection property protects the reference, not the contents; return `AsReadOnly()` or a copy.
- Composition means "has a"; inheritance means "is a kind of". Prefer composition by default.
- Never call overridable members from a constructor.
- Small immutable value objects remove whole classes of invalid states.
