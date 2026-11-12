---
title: "Design patterns you actually use"
summary: "Decorator, Strategy, Chain of Responsibility, Factory, Observer and Singleton, and the .NET features where you already use them."
---

## The idea

Plumbers do not invent a new way to join pipes each time. They use named fittings that others have shown to work. A **design pattern** is the same: a named, proven shape for a problem that keeps coming up, such as "add logging around something" or "pick one algorithm at runtime".

Patterns are made from ideas you already know: [interfaces](/learn/oop/interfaces-abstraction/), [polymorphism](/learn/oop/inheritance-polymorphism/) and [composition](/learn/oop/composition-encapsulation/). Their value is a shared vocabulary ("it's a decorator") and a head start. The risk is reaching for one because it sounds clever. Start from the problem, then see which shape fits.

```check
{"prompt":"What is the best way to choose a design pattern?","options":["Pick the one with the most impressive name","Use as many as possible","Start from the problem and match its shape"],"answer":2,"explanation":"Patterns are answers to recurring problems. Choosing from the problem avoids adding structure that gives you nothing."}
```

## See it work: Decorator

Problem: you have a repository and want to cache its results without touching it or its callers.

```csharp
class CachedRepo : IProductRepo {
    private readonly IProductRepo _inner;
    private readonly Dictionary<int, Product> _cache = new();
    public CachedRepo(IProductRepo inner) => _inner = inner;
    public Product Get(int id) =>
        _cache.TryGetValue(id, out var p) ? p : _cache[id] = _inner.Get(id);
}
```

It implements the same interface and wraps another instance of it. That "same interface in, same interface out, wraps an inner one" is the **Decorator** shape.

```steps
{"title":"A decorator in action","frames":[{"visual":" caller --> CachedRepo --> SqlRepo --> database\n Get(7)","caption":"Callers hold an `IProductRepo`. They do not know it is a `CachedRepo` wrapping the real one."},{"visual":" caller --> CachedRepo --> SqlRepo --> database\n            cache: {}       Get(7) runs a query","caption":"First `Get(7)`: not in the cache, so the decorator passes the call through."},{"visual":" caller <-- CachedRepo <-- SqlRepo <-- database\n            cache: {7}","caption":"The result is stored on the way back."},{"visual":" caller --> CachedRepo\n            cache: {7}   hit! returns at once\n            (SqlRepo idle)","caption":"Second `Get(7)`: answered from the cache. The database is never touched."}]}
```

## How it works: the other shapes

- **Strategy:** swap an algorithm behind an interface (pricing rules, payment providers, export formats). Same wiring as in [SOLID](/learn/oop/solid/).
- **Chain of Responsibility:** a request passes along ordered links; each can handle it, change it or stop it. **ASP.NET Core middleware** is exactly this, and `HttpClient`'s `DelegatingHandler` chain is a decorator chain. Order matters: put exception handling first, authentication before the endpoints.
- **Factory:** an object whose job is creating other objects, when creation needs runtime data or conditions. `IHttpClientFactory` and `IDbContextFactory<T>` are factories.
- **Observer:** things subscribe and are told when something happens. C# events, `IObservable<T>`, MongoDB change streams. Unsubscribe when done, or the publisher keeps the subscriber alive (a leak).
- **Singleton:** exactly one instance. Prefer the DI container (`AddSingleton`) over a static `Instance`, which hides dependencies and shares state across tests.

```check
{"prompt":"A CachedProductRepository implements IProductRepository, wraps another IProductRepository and returns cached results when possible. Which pattern is it?","options":["Factory","Singleton","Observer","Decorator"],"answer":3,"explanation":"Same interface in, same interface out, wrapping an inner instance to add behaviour (caching): that is the Decorator shape."}
```

```steps
{"title":"Middleware as a chain","frames":[{"visual":" req -> [Errors] -> [Auth] -> [Routing] -> endpoint","caption":"A request enters the pipeline. Each link holds `next`."},{"visual":" req -> [Errors] -> [Auth] -> [Routing] -> endpoint\n        try { next }   ok, call next","caption":"The exception link calls `next` inside a try. Auth checks the token and calls `next`."},{"visual":" req -> [Errors] -> [Auth] x\n                             |\n response 401 <--------------+","caption":"If the token is missing, Auth does not call `next`. It answers 401 itself (short-circuit)."},{"visual":" request -> [Routing] -> endpoint     (Auth never ran)","caption":"Swap the order and an unauthenticated request could reach the endpoint first. Order is part of the design."}]}
```

## Where you'll meet it

All through .NET: middleware (chain), `ILogger` providers (strategy), `IHttpClientFactory` (factory), events and Rx (observer), `AddSingleton` (singleton). Interviews give you a situation and ask which pattern fits, or ask you to tell look-alikes apart. The tells:

| You need to... | Pattern | The tell |
|---|---|---|
| Add behaviour around an implementation | **Decorator** | Same interface, wraps an inner one |
| Choose which type to create | **Factory** | The problem is creation |
| Let a request pass through ordered links that may stop it | **Chain** | Each link holds `next` |
| Convert one interface into another | **Adapter** | Two shapes that do not fit |

**Facade** simplifies a complex subsystem behind one door; **Proxy** has the same interface and controls access (lazy loading, auth).

```reveal
{"prompt":"A teammate says \"singleton is bad because it cannot be thread-safe.\" Is that right? What is the real objection?","answer":"**Not right.** Thread-safe singletons are easy (`Lazy<T>`, or the DI container). The real objection is to a *static global*: it hides dependencies, shares state between tests, and hard-wires a concrete type. A container-managed singleton avoids those."}
```

## Common mistakes

- **Pattern first, problem second.** A factory around a class that is only ever built one way is clutter.
- **Calling every wrapper a decorator.** If it adds no behaviour on the same interface, it may be an adapter or facade.
- **Wrong middleware order.** Auth after the endpoint is no auth.
- **Forgotten subscriptions.** Event handlers that are never removed keep objects alive.

## Recap

- A pattern is a named solution shape; pick it from the problem.
- Decorator wraps the same interface to add behaviour; Strategy swaps an algorithm; Chain passes a request along links.
- Factory creates objects; Observer notifies subscribers; prefer container singletons over static ones.
- Adapter converts, Facade simplifies, Proxy controls access.
