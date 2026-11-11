---
title: "Browser: CORS, preflight & HTTP caching"
summary: "What CORS really protects, when preflights fire, and how to cache SPAs correctly."
---

## The idea

A browser is a careful guest. Every website you open runs its own code on your machine, so the browser keeps each site in its own room. A page from one site is not allowed to peek at what another site sent you. That rule is the **same-origin policy**.

Sometimes sites need to cooperate, for example your page calling a separate API. The API can say "I allow that page" with special headers. This permission system is called **CORS**. The browser also saves copies of files it already downloaded, so the next visit is faster. That is **caching**, and you'll control it with headers.

This builds on the requests and responses lesson (headers are how these rules are written) and the HTTP semantics lesson.

```check
{"prompt": "What is the same-origin policy for?", "options": ["Stopping a page from reading another site's responses", "Making pages load faster", "Hiding the URL", "Compressing images"], "answer": 0, "explanation": "The browser keeps sites apart so a page you open cannot read data that belongs to another site you are logged in to. CORS is the controlled way to relax this."}
```

## CORS is enforced by the browser

The same-origin policy stops page JavaScript from **reading** cross-origin responses. CORS response headers relax that restriction. It is **not** server-side authorization: curl ignores it, and simple requests still reach your server and run.

## Simple vs preflighted requests

A request is "simple" only if it uses GET, HEAD or POST, CORS-safelisted headers, and a `Content-Type` of `text/plain`, `multipart/form-data` or `application/x-www-form-urlencoded`.

Anything else sends a **preflight** `OPTIONS` request first, with `Access-Control-Request-Method` and `-Headers`. That includes `Authorization` and `Content-Type: application/json`. The server must reply with:

- `Access-Control-Allow-Origin` (a specific origin, not `*`, when using credentials)
- `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`
- `Access-Control-Allow-Credentials: true` if cookies are involved
- `Access-Control-Max-Age` to cache the preflight result

In ASP.NET Core, `UseCors()` must run **before** auth and endpoints.

## Cache-Control for SPAs

| Resource | Header |
|---|---|
| `index.html` | `no-cache` (store, but revalidate every time) + `ETag` |
| Hashed bundles `main.3f9a.js` | `public, max-age=31536000, immutable` |
| Authenticated API JSON | `private, no-cache` or `no-store` |
| Sensitive data | `no-store` |

- `no-cache` ≠ "don't cache". It means "revalidate before use".
- `no-store` means never store the response.
- `private` means browser only, not CDNs or shared proxies.
- `stale-while-revalidate=60` serves stale content while refreshing in the background.

```check
{"prompt": "Which Cache-Control value means: you may store this, but check with the server before each use?", "options": ["no-store", "immutable", "no-cache", "max-age=31536000"], "answer": 2, "explanation": "no-cache is badly named: the browser may keep the file but must revalidate it before using it. no-store is the one that forbids saving it at all."}
```

## Common SPA deploy bug

`index.html` cached with a long `max-age` keeps referencing old bundle hashes, so users see a broken app after a deploy. Use `no-cache` on the HTML.
