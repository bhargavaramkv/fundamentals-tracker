---
title: "Interfaces & abstraction"
summary: "An interface is a promise about what something can do, so the code using it does not care how it is done."
---

## The idea

A wall socket does not care what you plug in. A lamp, a phone charger, a kettle: if the plug fits, it works. The socket promises "I provide power through this shape of hole", and every device promises "I accept power through this shape of plug". Neither side needs to know how the other is built inside.

**Abstraction** means hiding the details and showing only what matters to the user. An **interface** is how code states that promise: a list of things an object can do, with no instructions on how. Any class that signs up to the list must provide all of them.

This is useful because you can swap one thing for another, as long as the plug still fits. It builds on [classes and objects](/learn/oop/classes-objects/): an interface describes what a class offers, not how it works.

```check
{"prompt": "In the socket analogy, what does the interface correspond to?", "options": ["The kettle's internal wiring", "The shape of the socket and plug", "The power station"], "answer": 1, "explanation": "The interface is the agreed shape both sides rely on. Internals on either side can change freely as long as the shape stays the same."}
```

## See it work

Suppose an app must send messages. We write the promise first:

```csharp
interface INotifier {
    void Send(string message);
}
```

Then two classes that keep it:

```csharp
class EmailNotifier : INotifier {
    public void Send(string message) => Console.WriteLine("Email: " + message);
}
class SmsNotifier : INotifier {
    public void Send(string message) => Console.WriteLine("SMS: " + message);
}
```

Now code that uses the promise, not a specific class:

```csharp
void Welcome(INotifier notifier) {
    notifier.Send("Welcome!");
}
```

Trace it. `Welcome(new EmailNotifier())` prints `Email: Welcome!`. `Welcome(new SmsNotifier())` prints `SMS: Welcome!`. The `Welcome` method never changed and never learned which kind it got.

## How it works

An interface holds **signatures**: a method name, its parameters and its return type, with no body. A class that writes `: INotifier` must supply every method on the list or the code will not compile. That is the compiler enforcing the promise.

```
   Welcome(...)  -- uses -->  INotifier  <-- implemented by -- EmailNotifier
                                                          \-- SmsNotifier
```

The method that uses the interface depends only on the top box. You can add `PushNotifier` next month without touching `Welcome`.

Two terms to know:

- **Implement**: a class implements an interface when it provides all its methods.
- **Abstract class**: a half-built class that cannot be created with `new`. It can hold some real code and some methods left blank for subclasses. An interface is the lighter tool: a pure list of promises, and a class can implement many of them.

Abstraction is also a skill, not only a keyword. `List<T>.Sort()` hides which sorting algorithm runs. You trust the promise "this ends up in order".

```check
{"prompt": "You add a new class PushNotifier that implements INotifier. Which existing code must change for Welcome(...) to work with it?", "options": ["Welcome must get a new overload", "EmailNotifier must be edited", "Nothing, because Welcome only depends on INotifier"], "answer": 2, "explanation": "Welcome was written against the promise, not a concrete class. Any new class that keeps the promise plugs in without edits elsewhere."}
```

## Where you'll meet it

.NET is full of interfaces: `IEnumerable<T>` lets `foreach` loop over arrays, lists and database results alike. `IDisposable` promises "I can clean up". `ILogger` lets your code log without knowing where logs go. In tests, you replace a real email sender with a fake one that implements the same interface, so no email is sent.

Interview questions like "how would you support several payment providers?" are asking for exactly this: define `IPaymentProvider`, write one class per provider.

## Common mistakes

- **An interface for everything.** If there is one class and no sign of a second, an interface is just extra typing. Add it when a second version appears or you need a fake for tests.
- **Fat interfaces.** A 15-method interface forces every class to implement things it does not need. Prefer small ones.
- **Leaking details.** `Send(SmtpClient client, string message)` bakes email into the promise. SMS cannot implement it honestly.
- **Confusing the promise with the guarantee.** The interface only lists signatures. Behaviour, such as "never throws for an empty message", must be documented and tested.

```check
{"prompt": "When is it best to introduce an interface?", "options": ["For every class, to be safe", "When there are, or soon will be, several interchangeable implementations or you need a fake for tests", "Only when a class has more than ten methods"], "answer": 1, "explanation": "An interface earns its place by letting things be swapped. With no variation and no need for a fake, it only adds indirection."}
```

## Recap

- An interface is a promise: method signatures with no bodies.
- A class implements the interface by providing every method.
- Code written against the interface works with any implementation, now or later.
- Abstraction means showing what something does and hiding how.
- Use interfaces where swapping matters; do not add them by reflex.
