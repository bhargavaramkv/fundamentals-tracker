---
title: "Dependency injection & lifetimes"
summary: "Hand a class what it needs instead of letting it build it, and know how long ASP.NET Core keeps each object alive."
---

## The idea

A coffee machine needs water. It can have a pipe welded into the wall, or a tank you fill and swap. With the welded pipe, you cannot move the machine or test it without the building's plumbing. With the tank, whoever sets it up decides where the water comes from.

A **dependency** is something a class needs to do its job: a database, a clock, an email sender. **Dependency injection** (DI) is the tank: the class does not build its dependencies with `new`. It receives them from outside, usually through its constructor. This follows from [interfaces](/learn/oop/interfaces-abstraction/): the class asks for a promise such as `INotifier` and does not care which real one arrives. That lowers [coupling](/learn/oop/coupling-cohesion/) and makes testing easy, because a test can hand in a fake.

A **container** is the helper that does the handing-in for the whole app. A **lifetime** says how long each handed-in object lives.

```check
{"prompt":"What does dependency injection change about a class that needs an email sender?","options":["It creates the sender itself with new","It no longer sends email","It receives the sender from outside, usually in its constructor"],"answer":2,"explanation":"The class stops building its own dependencies and is given them. That lets you swap the real sender for a fake in tests."}
```

## See it work

A controller needs a service, which needs a repository, which needs a database context. You register each once; the container builds the chain.

```csharp
builder.Services.AddScoped<AppDbContext>();
builder.Services.AddScoped<IOrderRepo, OrderRepo>();
builder.Services.AddScoped<OrderService>();
// OrderController(OrderService s) -- asks only for the top
```

```steps
{"title":"The container resolves a graph","frames":[{"visual":" need: OrderController\n   needs: OrderService      ?\n     needs: IOrderRepo      ?\n       needs: AppDbContext  ?","caption":"A request arrives. ASP.NET Core must build `OrderController`, whose constructor asks for `OrderService`."},{"visual":" need: OrderController\n   needs: OrderService      ?\n     needs: IOrderRepo      ?\n       needs: AppDbContext  BUILT (new for this request)","caption":"It walks down to find a thing with no dependencies first: `AppDbContext`. It creates one for this request."},{"visual":" need: OrderController\n   needs: OrderService      ?\n     needs: IOrderRepo      BUILT = OrderRepo(ctx)\n       needs: AppDbContext  BUILT","caption":"`IOrderRepo` is registered as `OrderRepo`, so it is built with that context."},{"visual":" need: OrderController      BUILT\n   needs: OrderService      BUILT = OrderService(repo)\n     needs: IOrderRepo      BUILT\n       needs: AppDbContext  BUILT","caption":"Then the service, then the controller. Your code never wrote `new`."},{"visual":" OrderController   disposed\n OrderService      disposed\n OrderRepo         disposed\n AppDbContext      disposed (connection returned)","caption":"Request ends: scoped objects are disposed. The next request builds a fresh set."}]}
```

## How it works: lifetimes

Registering a service means choosing a lifetime:

| Lifetime | One instance per | Typical use |
|---|---|---|
| Singleton | the whole application | config, caches |
| Scoped | web request (a "scope") | `DbContext`, unit of work |
| Transient | every time it is asked for | small stateless helpers |

A distinction worth keeping: **Dependency Inversion** is the design idea (high-level code depends on an abstraction, not a concrete class). **Dependency Injection** is the mechanism that delivers the concrete class.

Rule of thumb: a service may depend on services with the same or a *longer* lifetime, never a shorter one. Break it and you get a **captive dependency**: a singleton holding a scoped `DbContext` keeps that one context alive for the whole app, shared across threads, with its change tracker growing forever. In Development, ASP.NET Core's scope validation throws at startup to catch this.

```steps
{"title":"A captive dependency","frames":[{"visual":" App running\n   Cache (singleton) --holds--> DbContext #1 (no owner)","caption":"Singleton `Cache` is built once. It asks for a scoped `AppDbContext` and gets one that no request owns."},{"visual":" Request 1:  DbContext #A  created, then disposed\n Cache --holds--> DbContext #1   still alive","caption":"Request 1 comes and goes. Its own context is disposed, but #1 has no scope to end."},{"visual":" Req 2 --> Cache --> DbContext #1\n Req 3 --> Cache --> DbContext #1  same object","caption":"Requests 2 and 3 run at once, and both go through `Cache`, so both use the same context."},{"visual":" using var scope = factory.CreateScope();\n var db = scope.ServiceProvider\n               .GetRequiredService<AppDbContext>();","caption":"The context is not thread-safe and its change tracker only grows. Fix: take `IServiceScopeFactory`, make a scope per job."}]}
```

```check
{"prompt":"A singleton service takes a scoped DbContext in its constructor. What is this problem called?","options":["A service locator","A transient leak","A captive dependency"],"answer":2,"explanation":"A longer-lived service holding a shorter-lived one keeps it alive far beyond its intended scope. Here one request-sized DbContext is shared by the whole app."}
```

## Where you'll meet it

Every ASP.NET Core app: `builder.Services.Add...` is the container. `BackgroundService` classes are singletons, so they create scopes with `IServiceScopeFactory` when they need a `DbContext`. `IHttpClientFactory` and `IDbContextFactory<T>` exist for the same reason. Interviews ask "difference between AddScoped, AddSingleton and AddTransient" and "what is a captive dependency?" almost every time.

```reveal
{"prompt":"You register `AddTransient<IClock, SystemClock>()` and inject `IClock` into both `OrderService` and `ReportService` in the same request. How many `SystemClock` objects exist, and would `AddScoped` change that?","answer":"**Two** with transient: each class that asks gets its own new instance. With `AddScoped` there would be **one** shared within the request. Use scoped or singleton when sharing matters, transient when state must not be shared."}
```

## Common mistakes

- **Service locator.** Calling `provider.GetService<T>()` in the middle of code hides what a class needs. Ask in the constructor.
- **Captive dependencies**, shown above.
- **Constructors with 8+ parameters.** The class probably does too much; split it (see [SOLID](/learn/oop/solid/)).
- **`new`-ing infrastructure in domain code.** It brings the welded pipe back.

## Recap

- DI: a class receives its dependencies, usually through the constructor, instead of building them.
- The container builds the whole graph from your registrations.
- Lifetimes: singleton (app), scoped (request), transient (each ask).
- Depend only on equal or longer lifetimes; otherwise you get a captive dependency.
- Dependency Inversion is the idea, Dependency Injection is the tool.
