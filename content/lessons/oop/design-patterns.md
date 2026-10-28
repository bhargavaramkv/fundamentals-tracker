---
title: "Design patterns you actually use"
summary: "Decorator, Strategy, Chain of Responsibility, Factory and Singleton as they appear in .NET and Angular."
---

## Decorator: same interface, added behavior

Caching, logging, retries and metrics around a repository or HTTP client. In .NET use Scrutor's `services.Decorate<IRepo, CachedRepo>()`. `DelegatingHandler` for `HttpClient` is a decorator chain.

## Strategy: swap an algorithm behind an interface

Pricing rules, payment providers, export formats. Pair it with DI and a registry keyed by name.

## Chain of Responsibility: pass the request along

ASP.NET Core middleware (`app.Use(next => ...)`) and Angular `HttpInterceptorFn` both work this way. Each link can handle the request, modify it, or short-circuit. **Order matters**: exception handler first, then auth before endpoints.

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
