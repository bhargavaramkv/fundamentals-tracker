---
title: "Web security essentials"
summary: "Cookies, JWTs, XSS, CSRF and SameSite, explained for SPA + API architectures."
---

## Cookie attributes

| Attribute | Effect |
|---|---|
| `HttpOnly` | JavaScript can't read the cookie (limits token theft via XSS) |
| `Secure` | sent only over HTTPS |
| `SameSite=Strict` | never sent on cross-site requests, including link clicks |
| `SameSite=Lax` (browser default) | sent on cross-site **top-level GET navigations** only |
| `SameSite=None; Secure` | always sent (needed for third-party embeds) |

## XSS

Attacker-controlled script runs in your origin. Angular escapes interpolation by default. The danger is `bypassSecurityTrust*`, `innerHTML` with untrusted data, and server-side template injection. Add a **Content Security Policy** as defense in depth.

## CSRF

The browser attaches cookies automatically, so another site can trigger an authenticated request. Defenses: SameSite cookies, anti-forgery tokens (ASP.NET `[ValidateAntiForgeryToken]`), checking the `Origin` header, and **never changing state in GET handlers**. Bearer tokens in an `Authorization` header aren't attached automatically, so they aren't CSRF-prone, but where you store them matters.

## JWT access tokens

- Self-contained and signed (prefer RS256/ES256 for multi-service setups), and verified without a database lookup.
- **Hard to revoke**, so keep them short-lived (5–15 min). Use **refresh tokens** that are rotated and stored server-side.
- Always validate `iss`, `aud`, `exp` and the algorithm. Reject `alg: none`.
- Don't put secrets in the payload: it's only base64-encoded, not encrypted.

## SPA token storage trade-off

`localStorage` is readable by any XSS. An HttpOnly cookie isn't readable but needs CSRF protection. A common middle ground is the BFF pattern: the backend keeps the tokens and the SPA uses an HttpOnly, SameSite session cookie.
