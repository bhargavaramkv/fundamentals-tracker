---
title: "Design patterns you actually use"
summary: "Decorator, Strategy, Chain of Responsibility, Factory and Singleton as they appear in .NET and Angular."
---

## The idea

Plumbers do not invent a new way to join pipes each time. They use named fittings that others have already shown to work. A **design pattern** is the same: a named, proven shape for a problem that keeps coming up, such as "add logging around something" or "pick one algorithm at runtime".

Patterns are made from ideas you already have: [interfaces](/learn/oop/interfaces-abstraction/), [polymorphism](/learn/oop/inheritance-polymorphism/) and [composition](/learn/oop/composition-encapsulation/). Their value is a shared vocabulary ("it's a decorator") and a head start. The risk is the opposite: reaching for a pattern because it sounds clever. Start from the problem, then see which shape fits.

```check
{"prompt": "What is the best way to choose a design pattern?", "options": ["Pick the one with the most impressive name", "Start from the problem and match its shape", "Use as many as possible"], "answer": 1, "explanation": "Patterns are answers to recurring problems. Choosing from the problem avoids adding structure that gives you nothing."}
```

## Decorator: same interface, added behavior

Caching, logging, retries and metrics around a repository or HTTP client. In .NET use Scrutor's `services.Decorate<IRepo, CachedRepo>()`. `DelegatingHandler` for `HttpClient` is a decorator chain.

## Strategy: swap an algorithm behind an interface

Pricing rules, payment providers, export formats. Pair it with DI and a registry keyed by name.

## Chain of Responsibility: pass the request along

ASP.NET Core middleware (`app.Use(next => ...)`) and Angular `HttpInterceptorFn` both work this way. Each link can handle the request, modify it, or short-circuit. **Order matters**: exception handler first, then auth before endpoints.

```check
{"prompt": "A CachedProductRepository implements IProductRepository, wraps another IProductRepository and returns cached results when possible. Which pattern is it?", "options": ["Factory", "Singleton", "Decorator", "Observer"], "answer": 2, "explanation": "Same interface in, same interface out, wrapping an inner instance to add behaviour (caching): that is the Decorator shape."}
```

## Factory / Abstract Factory

Use one when creation logic is conditional or needs runtime data, e.g. `IHttpClientFactory` and `IDbContextFactory<T>`. It is also the standard way to resolve scoped services from singletons.

## Observer

C# events and `IObservable<T>`, RxJS `Subject`, MongoDB change streams. Watch for **leaks**: unsubscribed handlers keep their subscribers alive (use `takeUntilDestroyed()` in Angular).

## Singleton: prefer the container's lifetime

A static `Instance` hides dependencies and shares state across tests. A DI-registered singleton (`AddSingleton`, `providedIn: 'root'`) gives you one instance without those problems. A singleton must be thread-safe and must not capture scoped dependencies.

## Adapter vs Facade vs Proxy

- **Adapter** converts one interface into another.
- **Facade** simplifies a complex subsystem.
- **Proxy** has the same interface and controls access (lazy loading, remoting, auth).

## Telling look-alike patterns apart

Most wrong answers come from picking the pattern that sounds right instead of the one that matches the *shape* of the problem.

| You need to... | Pattern | The tell |
|---|---|---|
| Add behavior around an existing implementation without touching it or its callers | **Decorator** | Same interface in, same interface out, wraps an inner instance |
| Decide *which concrete type* to create | **Factory** | The problem is about creation, not about adding behavior |
| Let a request flow through ordered links that may short-circuit | **Chain of Responsibility** | Each link holds `next` and decides whether to call it |
| Fix the skeleton of an algorithm and let subclasses fill in steps | **Template Method** | Inheritance with a base-class method calling abstract hooks |

- A caching `IProductRepository` wrapper is a Decorator. A factory would only help choose *which* repository to build.
- Middleware is not Template Method: there is no base class fixing the steps. Links are composed at runtime, and any link can end the request.
- "Singleton can't be thread-safe" is wrong. Thread-safe static singletons are easy (`Lazy<T>`). The real objection is hidden global state and a hard-wired concrete type that tests cannot replace.
