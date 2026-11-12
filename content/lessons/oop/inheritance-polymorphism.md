---
title: "Inheritance & polymorphism"
summary: "A subclass reuses and specialises a parent class, and polymorphism lets one call do the right thing for each kind of object."
---

## The idea

A family recipe gets passed down. Your grandmother's soup recipe is the base. Your version keeps all her steps but adds chilli at the end. You did not rewrite the recipe, you said "same as hers, except this".

**Inheritance** works like that. A **subclass** (child) starts with everything its **base class** (parent) has, then adds or changes things. It suits a general kind of thing with several more specific kinds.

**Polymorphism** (Greek for "many shapes") is the payoff. You treat different specific kinds as the general kind and ask them all the same question, and each answers in its own way. A teacher says "everyone, introduce yourself" and each student says something different. The teacher does not need to know who is who.

```check
{"prompt":"In the recipe analogy, what does the subclass do?","options":["Replaces the base recipe completely and shares nothing","Keeps the base recipe and adds or changes some steps","Deletes the base recipe"],"answer":1,"explanation":"A subclass inherits everything from its base class and then adds or overrides parts. It builds on the parent rather than starting over."}
```

## See it work

```csharp
class Animal {
    public string Name;
    public virtual string Speak() => "...";
}
class Dog : Animal {
    public override string Speak() => "Woof";
}
class Cat : Animal {
    public override string Speak() => "Meow";
}
```

`Dog` and `Cat` both get `Name` for free. Each replaces `Speak`. Now call them through the general type:

```csharp
Animal[] pets = { new Dog(), new Cat(), new Animal() };
foreach (var p in pets)
    Console.WriteLine(p.Speak());
```

```steps
{"title":"One call, three behaviours","frames":[{"visual":" p (type Animal) --> real object: Dog\n p.Speak()       --> runs Dog.Speak()\n prints: Woof","caption":"The loop variable `p` has type `Animal` every time. Pass 1: the real object is a `Dog`."},{"visual":" p (type Animal) --> real object: Cat\n p.Speak()       --> runs Cat.Speak()\n prints: Meow","caption":"Pass 2: same line of code, but the real object is a `Cat`."},{"visual":" p (type Animal) --> real object: Animal\n p.Speak()       --> runs Animal.Speak()\n prints: ...","caption":"Pass 3: a plain `Animal` has no override, so the base version runs."}]}
```

## How it works

Terms in order:

- **Base class / subclass**: `Animal` is the base, `Dog : Animal` is the subclass. Read the colon as "is a kind of".
- **virtual**: the base class marks a method as allowed to be replaced.
- **override**: the subclass supplies its own version.
- **Dynamic dispatch**: when you call `p.Speak()`, the program looks at the real object at that moment, not the variable's declared type, and runs that object's version. Underneath, each object points to a table of its methods (a **vtable**), and the call goes through it. This is how polymorphism works.

A subclass can call the parent's version with `base.Speak()` when it wants to extend rather than replace.

The "is a kind of" test matters. A `Dog` is an `Animal`. A `Car` is not an `Engine`, even though a car uses one. For "has a", put the engine inside the car as a field. That choice comes up again in [composition and encapsulation](/learn/oop/composition-encapsulation/).

```check
{"prompt":"A variable of type Animal holds a Dog. You call Speak(), which Dog overrides. Which version runs?","options":["Animal's, because the variable is typed Animal","Neither, it is a compile error","Dog's, because the real object is a Dog"],"answer":2,"explanation":"Overridden methods are chosen by the actual object at run time (dynamic dispatch), not by the variable's declared type."}
```

```reveal
{"prompt":"Spot the bug: `Dog` declares `public string Speak() => \"Woof\";` with no `override`, and the base has `virtual`. What does `Animal a = new Dog(); a.Speak()` print?","answer":"It prints **...**. Without `override` the Dog method only *hides* the base one (the compiler warns), so a call through an `Animal` variable still runs `Animal.Speak`. Add `override` to get polymorphism."}
```

## Where you'll meet it

UI toolkits: a `Button`, `TextBox` and `Checkbox` all inherit from `Control`, and the window calls `Draw()` on each. In .NET every exception type inherits from `Exception`, so one `catch (Exception e)` handles them all. ASP.NET Core controllers inherit `ControllerBase`. Game loops call `Update()` on every `GameObject`, whatever it is.

Interviewers like "what is polymorphism?" Give the one-line answer (same call, different behaviour by real type) and the `Animal` example.

## Common mistakes

- **Inheriting only to reuse code.** If it is not truly "is a kind of", you will fight the parent forever. Pass in a helper object instead.
- **Deep hierarchies.** Five levels of subclasses scatter behaviour across files.
- **Forgetting `virtual`/`override`.** Without both, there is no dynamic dispatch (see the reveal above).
- **Breaking the parent's promise.** If `Bird` has `Fly()` and `Penguin : Bird` throws "can't fly", code that trusts every `Bird` will crash.

```check
{"prompt":"Penguin inherits from Bird, and Bird has Fly(). Penguin.Fly() throws an exception. What is the main problem?","options":["C# forbids this","Penguin needs the virtual keyword","Code that handles any Bird can now crash, so Penguin is not a safe stand-in for Bird"],"answer":2,"explanation":"Polymorphism only works if subclasses honour what the base class promises. A Penguin that cannot fly breaks callers who trust every Bird to fly. The design needs rethinking, not a patch."}
```

## Recap

- Inheritance: a subclass gets its base class's members and can add or override.
- Use it only for a real "is a kind of" relationship.
- `virtual` allows replacing a method, `override` replaces it.
- Polymorphism: one call on the general type runs the right version for the real object.
- Subclasses must keep the base class's promises, or callers break.
