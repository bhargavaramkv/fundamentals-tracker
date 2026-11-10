---
title: "HTTP semantics & versions"
summary: "Methods, status codes, caching headers in brief, and what HTTP/2 and HTTP/3 change."
---

## The idea

Think of a postal service with a rulebook. Everyone agrees that "recorded delivery" means one thing and "return to sender" means another, so letters get handled the same way everywhere. HTTP is the rulebook for the web. Its **methods** (GET, POST...) say what you want done, and its **status codes** (200, 404...) say how it went.

The foundation lesson on requests and responses showed the basic shape. This lesson goes deeper on the precise meanings, because details matter: can a request be safely repeated if the network drops? Which code tells a client to log in, and which to give up? It also covers how newer HTTP versions send the same messages faster, without changing what they mean.

```check
{"prompt": "A network glitch means a client is unsure whether its request arrived. Which method is safest to simply send again?", "options": ["POST creating an order", "PUT replacing an order with the same data", "PATCH adding 1 to a counter", "POST charging a card"], "answer": 1, "explanation": "PUT is idempotent, so sending it twice leaves the same end state. Repeating a POST or an increment can create duplicates or double-count."}
```

## Methods

| Method | Safe | Idempotent | Notes |
|---|---|---|---|
| GET / HEAD | ✔ | ✔ | must not change state |
| PUT | ✘ | ✔ | replace the resource at a known URI |
| DELETE | ✘ | ✔ | deleting twice leaves the same end state (it may return 404) |
| POST | ✘ | ✘ | create or process; use an Idempotency-Key for safe retries |
| PATCH | ✘ | not guaranteed | partial update (JSON Patch / Merge Patch) |

## Status codes people mix up

- **401** = not authenticated (send `WWW-Authenticate`). **403** = authenticated but not allowed.
- **400** = malformed request. **422** = well-formed but fails semantic validation.
- **409** = conflict (version mismatch, duplicate). **412** = an `If-Match` precondition failed.
- **429** = rate limited (send `Retry-After`). **503** = temporarily unavailable.
- **301/308** = permanent redirect (308 keeps the method). **302/307** = temporary (307 keeps the method).

```check
{"prompt": "A logged-in user requests a page that only admins may see. Which code fits?", "options": ["401", "404", "403", "422"], "answer": 2, "explanation": "403 means the server knows who you are but refuses. 401 would mean you aren't identified at all."}
```

## Conditional requests

`ETag` + `If-None-Match` returns **304 Not Modified** (saves bandwidth). `If-Match` gives optimistic concurrency on PUT or PATCH (412 on conflict).

## Versions

- **HTTP/1.1:** one request at a time per connection, so browsers open about 6 connections per origin.
- **HTTP/2:** binary framing, **multiplexed streams** over one TCP connection, header compression (HPACK). TCP head-of-line blocking remains: one lost packet stalls every stream.
- **HTTP/3:** runs over **QUIC** (UDP) with per-stream loss recovery. Transport and TLS share one handshake (0-RTT with resumption), and connections can migrate across networks.
