---
title: "HTTP semantics & versions"
summary: "Safe and idempotent methods, the status codes people mix up, conditional requests, and what HTTP/2 and HTTP/3 change."
---

## The idea

Think of a postal service with a rulebook. Everyone agrees that "recorded delivery" means one thing and "return to sender" means another, so letters get handled the same way everywhere. HTTP is the rulebook for the web. Its **methods** (GET, POST...) say what you want done, and its **status codes** (200, 404...) say how it went.

The requests and responses lesson showed the basic shape. This lesson covers the precise meanings, because details matter: can a request be safely repeated if the network drops? Which code tells a client to log in, and which to give up? Two words come up constantly. A method is **safe** if it only reads and changes nothing. It is **idempotent** if doing it twice leaves the same end state as doing it once.

```check
{"prompt": "A network glitch means a client is unsure whether its request arrived. Which method is safest to simply send again?", "options": ["POST creating an order", "PUT replacing an order with the same data", "PATCH adding 1 to a counter", "POST charging a card"], "answer": 1, "explanation": "PUT is idempotent, so sending it twice leaves the same end state. Repeating a POST or an increment can create duplicates or double-count."}
```

## Methods

| Method | Safe | Idempotent | Notes |
|---|---|---|---|
| GET / HEAD | yes | yes | must not change state |
| PUT | no | yes | replace the resource at a known URI |
| DELETE | no | yes | deleting twice leaves the same end state (it may return 404) |
| POST | no | no | create or process; use an Idempotency-Key for safe retries |
| PATCH | no | not guaranteed | partial update |

## See it work

A **conditional request** saves bandwidth. The server labels each version of a resource with an `ETag` (a version fingerprint). The client sends it back later with `If-None-Match`, asking "only send it if it changed".

```steps
{"title": "ETag and 304 Not Modified", "frames": [
  {"visual": "Client                          Server\n  | GET /logo.png                 |\n  |------------------------------>|\n  |                               |", "caption": "First visit: the client has nothing stored and asks for the logo."},
  {"visual": "Client                          Server\n  |<------------------------------|\n  | 200 OK  ETag: \"v7\"  [40 KB]   |\n  | stores the file and \"v7\"       |", "caption": "The server sends the full file with its ETag. The client keeps both."},
  {"visual": "Client                          Server\n  | GET /logo.png                 |\n  | If-None-Match: \"v7\"           |\n  |------------------------------>|", "caption": "Next visit: the client asks, but says which version it already has."},
  {"visual": "Client                          Server\n  |<------------------------------|\n  | 304 Not Modified  [no body]   |\n  | uses its stored copy          |", "caption": "Still \"v7\", so the server replies 304 with no body. The client reuses its copy and saves 40 KB."}
]}
```

## Status codes people mix up

- **401** = not authenticated (who are you?). **403** = authenticated but not allowed.
- **400** = malformed request. **422** = well-formed but fails validation rules.
- **409** = conflict (duplicate, version mismatch). **412** = an `If-Match` precondition failed.
- **429** = rate limited (`Retry-After` says when to retry). **503** = temporarily unavailable.
- **301/308** = permanent redirect (308 keeps the method). **302/307** = temporary (307 keeps the method).

```reveal
{"prompt": "Before you look: an API receives a perfectly valid JSON order for a product that is out of stock. Which status do you return: 400, 409 or 500?", "answer": "Not **500**: the server did not fail. Not 400: the request is well formed. **409 Conflict** (or 422) fits: the request conflicts with the current state of the resource. Pick one and document it."}
```

```check
{"prompt": "A logged-in user requests a page that only admins may see. Which code fits?", "options": ["401", "404", "403", "422"], "answer": 2, "explanation": "403 means the server knows who you are but refuses. 401 would mean you aren't identified at all."}
```

`If-Match` on a PUT gives **optimistic concurrency**: the update succeeds only if the resource still has the ETag you read, otherwise the server returns 412.

## Versions

- **HTTP/1.1:** one request at a time per connection, so browsers open about 6 connections per origin.
- **HTTP/2:** binary framing and **multiplexing**: many requests share one TCP connection at the same time. A lost packet still stalls every stream, because TCP delivers bytes in order.
- **HTTP/3:** runs over **QUIC** (built on UDP) with loss recovery per stream. Transport and TLS setup share one handshake, and connections survive switching from Wi-Fi to mobile data.

The methods and status codes mean the same in every version.

## Where you'll meet it

- Designing ASP.NET Core controllers and choosing `Results.Conflict()`, `Results.Unauthorized()`, `Results.StatusCode(429)`.
- Browser DevTools Network tab: the "Protocol" column shows `h2` or `h3`.
- Azure Front Door, Kubernetes ingress and nginx terminate HTTP/2 or HTTP/3 for you.
- Interviews: "401 vs 403", "is PUT idempotent?", "what does HTTP/2 fix?"

## Common mistakes

- Using GET to change data, or returning 200 with an error in the body.
- Mixing up 401 and 403.
- Treating PATCH as idempotent ("add 1" is not).
- Returning 500 for bad client input. 4xx means the caller must change something; 5xx means the server failed.

## Recap

- **Safe** = reads only; **idempotent** = repeat gives the same end state.
- 401 identify yourself, 403 forbidden, 409 conflict, 429 slow down.
- `ETag` + `If-None-Match` gives **304** and saves bandwidth; `If-Match` gives optimistic concurrency.
- HTTP/2 multiplexes on one TCP connection; HTTP/3 uses QUIC to avoid TCP stalls.
