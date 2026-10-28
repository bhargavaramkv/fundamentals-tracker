---
title: "Browser: CORS, preflight & HTTP caching"
summary: "What CORS really protects, when preflights fire, and how to cache SPAs correctly."
---

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

## Common SPA deploy bug

`index.html` cached with a long `max-age` keeps referencing old bundle hashes, so users see a broken app after a deploy. Use `no-cache` on the HTML.
