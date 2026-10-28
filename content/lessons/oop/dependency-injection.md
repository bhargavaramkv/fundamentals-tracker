---
title: "Dependency injection & lifetimes"
summary: "DIP vs DI, ASP.NET Core lifetimes, captive dependencies, and Angular injector hierarchy."
---

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
