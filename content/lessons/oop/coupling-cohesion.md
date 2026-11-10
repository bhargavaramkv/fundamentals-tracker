---
title: "Coupling & cohesion"
summary: "Good code keeps related things together (cohesion) and unrelated things loosely tied (low coupling), so changes stay small."
---

## The idea

Picture two kitchens. In the first, everything is in one drawer: forks, batteries, tape, a screwdriver. In the second, cutlery is in one drawer, tools in another. When you want a fork, the second kitchen is faster because each drawer holds things that belong together.

That is **cohesion**: how closely the parts inside one class (or function) belong together. High cohesion is good. A class named `Utils` with forty unrelated methods has low cohesion.

Now think about a string of old fairy lights. One bulb breaks and the whole string goes dark, because each depends on the next. That is **coupling**: how much one piece of code depends on the details of another. High coupling is bad, because a change in one place breaks others.

The goal is simple: high cohesion inside, low coupling between. You will see why it matters every time you change code.

```check
{"prompt": "A class called Helpers contains email sending, tax maths, and date formatting. Which problem does it show?", "options": ["High coupling", "Low cohesion", "Too few methods"], "answer": 1, "explanation": "The methods have nothing in common, so the class has low cohesion. It is the junk drawer of code: you can never predict what is inside or why it changes."}
```

## See it work

A low-cohesion, tightly coupled class:

```csharp
class OrderService {
    public void Place(Order o) {
        var db = new SqlConnection("Server=prod;...");
        db.Execute("INSERT INTO Orders ...");
        var smtp = new SmtpClient("mail.shop.com");
        smtp.Send(o.CustomerEmail, "Thanks!");
    }
}
```

Trace one change. The shop switches from email to SMS. You must edit `OrderService`, even though your task had nothing to do with orders. A new database means editing it again. Tests cannot run without a real database and a mail server.

Better: each class does one job, and `OrderService` depends on small interfaces (see [interfaces and abstraction](/learn/oop/interfaces-abstraction/)):

```csharp
class OrderService {
    private readonly IOrderStore _store;
    private readonly INotifier _notifier;
    public OrderService(IOrderStore s, INotifier n) { _store = s; _notifier = n; }
    public void Place(Order o) { _store.Save(o); _notifier.Send("Thanks!"); }
}
```

Now switching to SMS means a new `INotifier` class. `OrderService` does not change.

## How it works

You can spot both by asking questions.

**Cohesion test:** describe the class in one sentence without "and". "Saves orders" passes. "Saves orders and sends emails and formats dates" fails: it is three classes.

**Coupling test:** if I change this class's internals, how many other files must change? If the answer is "many", coupling is high.

Coupling comes in strengths, from worst to best:

```
 reaches into another class's fields     (worst)
 uses another class's concrete type
 depends on an interface
 passes only simple data                  (loosest)
```

You cannot remove coupling completely, because code must talk to other code. The aim is for it to be through narrow, stable doors.

```check
{"prompt": "Which sentence best describes a highly cohesive class?", "options": ["It depends on many other classes", "Everything inside it serves one clear purpose", "It has only one method", "It never changes"], "answer": 1, "explanation": "Cohesion is about how well the parts inside belong together. A cohesive class can have several methods, as long as they all serve the same purpose."}
```

## Where you'll meet it

Code reviews: "this does too much" is a cohesion complaint, "this knows too much about that" is a coupling one. Microservices are a coupling decision at large scale: teams want services that change independently. Unit testing is where you feel it most. Tightly coupled code is hard to test because you cannot run one piece alone.

Interviewers often ask you to review a messy class and say what you would split.

## Common mistakes

- **Splitting too far.** Fifty tiny classes that all call each other can be harder to follow than one sensible class. Split along real reasons to change.
- **Hiding coupling instead of removing it.** Wrapping a class in an interface that mirrors its every detail changes nothing; the callers still depend on the same details.
- **Calling `new` on dependencies deep inside.** It welds the class to a concrete type. Pass the dependency in.
- **Treating "reuse" as a goal.** Sharing code between unrelated features couples them: a change for one breaks the other.

```check
{"prompt": "Two unrelated features share one big helper method to avoid duplicated code. A change for feature A breaks feature B. What happened?", "options": ["The features became coupled through the shared helper", "Cohesion went up", "Nothing unusual, this is normal"], "answer": 0, "explanation": "Sharing code ties the features together, so a change meant for one reaches the other. Duplication is sometimes cheaper than the wrong coupling."}
```

## Recap

- Cohesion: how well the parts inside a unit belong together. Aim high.
- Coupling: how much one unit depends on another's details. Aim low.
- Test cohesion by describing the class in one sentence without "and".
- Test coupling by counting what breaks when you change a class.
- Depend on small interfaces and pass dependencies in, instead of building them inside.
