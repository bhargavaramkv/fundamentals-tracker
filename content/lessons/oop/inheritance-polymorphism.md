---
title: "Inheritance & polymorphism"
summary: "A subclass reuses and specialises a parent class, and polymorphism lets one call do the right thing for each kind of object."
---

## The idea

A family recipe gets passed down. Your grandmother's soup recipe is the base. Your version keeps all her steps but adds chilli at the end. You did not rewrite the recipe, you said "same as hers, except this".

**Inheritance** works like that. A **subclass** (child) starts with everything its **base class** (parent) has, then adds or changes things. It is useful when you have a general kind of thing and several more specific kinds.

**Polymorphism** (Greek for "many shapes") is the payoff. You can treat different specific kinds as the general kind and ask them all the same question, and each answers in its own way. A teacher says "everyone, introduce yourself" and each student says something different. The teacher does not need to know who is who.

```check
{"prompt": "In the recipe analogy, what does the subclass do?", "options": ["Replaces the base recipe completely and shares nothing", "Keeps the base recipe and adds or changes some steps", "Deletes the base recipe"], "answer": 1, "explanation": "A subclass inherits everything from its base class and then adds or overrides parts. It builds on the parent rather than starting over."}
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

Both `Dog` and `Cat` get `Name` for free. Each replaces `Speak`. Now use them through the general type:

```csharp
Animal[] pets = { new Dog { Name = "Rex" }, new Cat { Name = "Mia" }, new Animal() };
foreach (var p in pets)
    Console.WriteLine(p.Speak());
```

Trace it. The loop variable `p` has type `Animal` every time. First pass: the object is a `Dog`, so it prints `Woof`. Second: `Meow`. Third: a plain `Animal`, so `...`. One line of calling code, three behaviours.

## How it works

Terms in order:

- **Base class / subclass**: `Animal` is the base, `Dog : Animal` is the subclass. Read the colon as "is a kind of".
- **virtual**: the base class marks a method as allowed to be replaced.
- **override**: the subclass supplies its own version.
- **Dynamic dispatch**: when you call `p.Speak()`, the program looks at the real object at that moment, not the variable's type, and runs that object's version. This is how polymorphism works underneath.

```
 variable type: Animal      real object: Dog     -->  Dog.Speak()  "Woof"
 variable type: Animal      real object: Cat     -->  Cat.Speak()  "Meow"
```

Subclasses can also call the parent's version with `base.Speak()` when they want to extend it, not replace it.

The "is a kind of" test matters. A `Dog` is an `Animal`. A `Car` is not an `Engine`, even though a car uses one. For "has a", you put an engine inside the car as a field instead. That choice comes up again in [composition and encapsulation](/learn/oop/composition-encapsulation/).

```check
{"prompt": "A variable of type Animal holds a Dog. You call Speak(), which Dog overrides. Which version runs?", "options": ["Animal's, because the variable is typed Animal", "Dog's, because the real object is a Dog", "Neither, it is a compile error"], "answer": 1, "explanation": "Overridden methods are chosen by the actual object at run time (dynamic dispatch), not by the variable's declared type."}
```

## Where you'll meet it

UI toolkits: a `Button`, `TextBox` and `Checkbox` all inherit from `Control`, and the window calls `Draw()` on each. In .NET, every exception type inherits from `Exception`, so one `catch (Exception e)` handles them all. Game loops call `Update()` on every `GameObject`, whatever it is.

Interviewers like "what is polymorphism?" Give the one-line answer (same call, different behaviour by real type) and the `Animal` example above.

## Common mistakes

- **Inheriting to reuse code only.** If the relationship is not truly "is a kind of", you will fight the parent forever. Pass in a helper object instead.
- **Deep hierarchies.** Five levels of subclasses are hard to follow, because behaviour is scattered across files.
- **Forgetting `virtual`.** Without it in the base, a subclass method with the same name does not override. Calls through the base type run the base version, which surprises people.
- **Breaking the parent's promise.** If `Bird` has `Fly()` and `Penguin : Bird` throws "can't fly", code that trusts every `Bird` will crash. The subclass must behave like its parent.

```check
{"prompt": "Penguin inherits from Bird, and Bird has Fly(). Penguin.Fly() throws an exception. What is the main problem?", "options": ["C# forbids this", "Code that handles any Bird can now crash, so Penguin is not a safe stand-in for Bird", "Penguin needs the virtual keyword"], "answer": 1, "explanation": "Polymorphism only works if subclasses honour what the base class promises. A Penguin that cannot fly breaks callers who trust every Bird to fly. The design needs rethinking, not a patch."}
```

## Recap

- Inheritance: a subclass gets its base class's members and can add or override.
- Use it only for a real "is a kind of" relationship.
- `virtual` allows replacing a method, `override` replaces it.
- Polymorphism: one call on the general type runs the right version for the real object.
- Subclasses must keep the base class's promises, or callers break.
