---
title: "HTTP semantics & versions"
summary: "Methods, status codes, caching headers in brief, and what HTTP/2 and HTTP/3 change."
---

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

## Conditional requests

`ETag` + `If-None-Match` returns **304 Not Modified** (saves bandwidth). `If-Match` gives optimistic concurrency on PUT or PATCH (412 on conflict).

## Versions

- **HTTP/1.1:** one request at a time per connection, so browsers open about 6 connections per origin.
- **HTTP/2:** binary framing, **multiplexed streams** over one TCP connection, header compression (HPACK). TCP head-of-line blocking remains: one lost packet stalls every stream.
- **HTTP/3:** runs over **QUIC** (UDP) with per-stream loss recovery. Transport and TLS share one handshake (0-RTT with resumption), and connections can migrate across networks.
