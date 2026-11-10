---
title: "Dependency injection & lifetimes"
summary: "DIP vs DI, ASP.NET Core lifetimes, captive dependencies, and Angular injector hierarchy."
---

## The idea

A coffee machine needs water. It can have a pipe welded into the wall, or it can have a tank you fill and swap. With the welded pipe, you cannot move the machine or test it without the building's plumbing. With the tank, whoever sets it up decides where the water comes from.

**Dependency injection** is the tank. A class that needs something (a database, a clock, an email sender) does not build it with `new`. It receives it from outside, usually through its constructor. This follows from [interfaces](/learn/oop/interfaces-abstraction/): the class asks for a promise, such as `INotifier`, and does not care which real one arrives. It lowers [coupling](/learn/oop/coupling-cohesion/) and makes code easy to test, because a test can hand in a fake.

A **container** is a helper that does the handing-in for the whole app, and a **lifetime** says how long each handed-in object lives.

```check
{"prompt": "What does dependency injection change about a class that needs an email sender?", "options": ["It creates the sender itself with new", "It receives the sender from outside, usually in its constructor", "It no longer sends email"], "answer": 1, "explanation": "The class stops building its own dependencies and is given them. That lets you swap the real sender for a fake in tests."}
```

## DIP vs DI

- **Dependency Inversion** (design): high-level policy depends on abstractions it owns.
- **Dependency Injection** (mechanism): dependencies are passed in, usually through the constructor, and wired by a container.

## ASP.NET Core lifetimes

| Lifetime | One instance per | Typical use |
|---|---|---|
| Singleton | application | config, caches, `HttpClient` handlers |
| Scoped | request (scope) | `DbContext`, unit of work |
| Transient | resolution | lightweight stateless services |

**Captive dependency:** a longer-lived service holds a shorter-lived one, e.g. a singleton holding a `DbContext`. The context is then shared across threads and its change tracker grows forever. `ValidateScopes` (on in Development) catches this at startup.

Fixes: make the consumer scoped, inject `IServiceScopeFactory` and create a scope per unit of work (the standard approach in `BackgroundService`), or use `IDbContextFactory<T>`.

```check
{"prompt": "A singleton service takes a scoped DbContext in its constructor. What is this problem called?", "options": ["A service locator", "A captive dependency", "A transient leak"], "answer": 1, "explanation": "A longer-lived service holding a shorter-lived one keeps it alive far beyond its intended scope. Here one request-sized DbContext is shared by the whole app."}
```

## Angular injector hierarchy

- `providedIn: 'root'` creates an app-wide singleton and is tree-shakable.
- `providers` on a **lazy route** creates a child environment injector with its own instance for that feature.
- `providers` on a **component** creates a new instance per component instance (useful for component-local state).

Resolution walks up from the requesting injector to the nearest provider. If state isn't shared as expected, check for a duplicate provider somewhere in the tree.

**Shadowing:** a route-level or component-level provider for a service that is also `providedIn: 'root'` does not get ignored. It *shadows* root for everything beneath it, so that subtree gets its own instance while the rest of the app keeps the root one.

## Smells

- Service locator (`provider.GetService<T>()` scattered through code)
- Constructors with 8+ dependencies, a sign of an SRP violation
- `new`-ing infrastructure inside domain code
