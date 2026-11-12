---
title: "Coupling & cohesion"
summary: "Good code keeps related things together (cohesion) and unrelated things loosely tied (low coupling), so changes stay small."
---

## The idea

Picture two kitchens. In the first, everything is in one drawer: forks, batteries, tape, a screwdriver. In the second, cutlery is in one drawer, tools in another. When you want a fork, the second kitchen is faster because each drawer holds things that belong together.

That is **cohesion**: how closely the parts inside one class (or function) belong together. High cohesion is good. A class named `Utils` with forty unrelated methods has low cohesion.

Now think of an old string of fairy lights. One bulb breaks and the whole string goes dark, because each depends on the next. That is **coupling**: how much one piece of code depends on the details of another. High coupling is bad, because a change in one place breaks others.

The goal: high cohesion inside, low coupling between. You see why every time you change code.

```check
{"prompt":"A class called Helpers contains email sending, tax maths, and date formatting. Which problem does it show?","options":["High coupling","Too few methods","Low cohesion"],"answer":2,"explanation":"The methods have nothing in common, so the class has low cohesion. It is the junk drawer of code: you can never predict what is inside or why it changes."}
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

It saves to SQL Server *and* sends email, and it builds both tools itself. Now the shop wants SMS instead of email. Follow the change.

```steps
{"title":"One change request, two designs","frames":[{"visual":" OrderService\n   |-- new SqlConnection(...)    (storage)\n   |-- new SmtpClient(...)       (email)\n Files to edit for SMS: OrderService","caption":"Tight: `OrderService` builds `SmtpClient` itself. The task is \"use SMS\"."},{"visual":" OrderService\n   |-- new SqlConnection(...)\n   |-- new SmsGateway(...)       <- edited\n Files touched: OrderService + its tests","caption":"You edit `OrderService`, a class about orders, to change how messages go. Its tests now need a real SMS gateway."},{"visual":" OrderService\n   |-- IOrderStore  <-- SqlOrderStore\n   |-- INotifier    <-- EmailNotifier\n Files to edit for SMS: none yet","caption":"Loose: `OrderService` holds two small interfaces and asks for them in its constructor."},{"visual":" OrderService\n   |-- IOrderStore  <-- SqlOrderStore\n   |-- INotifier    <-- SmsNotifier  (new class)\n Files to edit: OrderService = 0","caption":"Add `SmsNotifier : INotifier` and hand it in. `OrderService` is untouched, and tests pass a fake."}]}
```

The loose version looks like this (see [interfaces and abstraction](/learn/oop/interfaces-abstraction/)):

```csharp
class OrderService {
    private readonly IOrderStore _store;
    private readonly INotifier _notifier;
    public OrderService(IOrderStore s, INotifier n) { _store = s; _notifier = n; }
    public void Place(Order o) { _store.Save(o); _notifier.Send("Thanks!"); }
}
```

## How it works

You can measure both with a question.

**Cohesion test:** describe the class in one sentence without "and". "Saves orders" passes. "Saves orders and sends emails and formats dates" fails: that is three classes.

**Coupling test:** if I change this class's insides, how many other files must change? If the answer is "many", coupling is high.

Coupling comes in strengths, worst to best:

```
 reaches into another class's fields     (worst)
 uses another class's concrete type
 depends on an interface
 passes only simple data                  (loosest)
```

You cannot remove coupling completely, because code must talk to other code. The aim is to do it through narrow, stable doors.

```check
{"prompt":"Which sentence best describes a highly cohesive class?","options":["Everything inside it serves one clear purpose","It depends on many other classes","It has only one method","It never changes"],"answer":0,"explanation":"Cohesion is about how well the parts inside belong together. A cohesive class can have several methods, as long as they all serve the same purpose."}
```

## Where you'll meet it

Code reviews: "this does too much" is a cohesion complaint, "this knows too much about that" is a coupling one. Microservices are a coupling decision at large scale: teams want services that change independently. Unit testing is where you feel it most, because tightly coupled code cannot run one piece alone. In ASP.NET Core, a controller that calls `new SqlConnection` instead of taking a service in its constructor is the classic case.

Interviewers often hand you a messy class and ask what you would split.

```reveal
{"prompt":"Two features, A and B, both call one shared `FormatForDisplay(object x)` helper to avoid duplicate code. A needs a change that makes it behave differently for dates. What is the risk, and what might you do instead?","answer":"The change reaches **B too**, because both depend on the same helper: they are now coupled. Either give each feature its own small formatter (a little duplication is cheap), or keep the shared one only if A and B truly change for the same reasons."}
```

## Common mistakes

- **Splitting too far.** Fifty tiny classes that all call each other can be harder to follow than one sensible class. Split along real reasons to change.
- **Hiding coupling instead of removing it.** An interface that mirrors a class's every detail changes nothing; callers still depend on the same details.
- **Calling `new` on dependencies deep inside.** It welds the class to a concrete type. Pass the dependency in.
- **Treating "reuse" as a goal.** Sharing code between unrelated features couples them.

```check
{"prompt":"Two unrelated features share one big helper method to avoid duplicated code. A change for feature A breaks feature B. What happened?","options":["Cohesion went up","The features became coupled through the shared helper","Nothing unusual, this is normal"],"answer":1,"explanation":"Sharing code ties the features together, so a change meant for one reaches the other. Duplication is sometimes cheaper than the wrong coupling."}
```

## Recap

- Cohesion: how well the parts inside a unit belong together. Aim high.
- Coupling: how much one unit depends on another's details. Aim low.
- Test cohesion: describe the class in one sentence without "and".
- Test coupling: count what breaks when you change a class.
- Depend on small interfaces and pass dependencies in, instead of building them inside.
