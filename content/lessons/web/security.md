---
title: "Web security essentials"
summary: "XSS, CSRF, cookie attributes and JWT handling for SPA and API setups, with the attack and the fix side by side."
---

## The idea

Think of a house. Locking the door is not enough if a visitor can talk you into handing over the key, or if a stranger can forge a note in your handwriting. Web security is the same: attackers rarely break the maths, they trick the people or the browser.

Two classic tricks:

- **XSS** (cross-site scripting): an attacker gets their own script to run inside *your* page, so it acts with that page's powers.
- **CSRF** (cross-site request forgery): another site makes your browser send a request to a site you are logged in to, and the browser helpfully attaches your cookie.

This builds on the logging-in lesson (cookies, sessions and tokens are what attackers steal or misuse) and the browser lesson (the same-origin policy). Here you learn which settings close each gap.

```check
{"prompt": "Which attack makes your browser send a request to a site you're logged in to, without you meaning to?", "options": ["XSS", "CSRF", "DNS caching", "Packet loss"], "answer": 1, "explanation": "CSRF abuses the fact that browsers attach cookies automatically. XSS is different: it runs attacker script inside the trusted page."}
```

## See it work

A bank uses a session cookie. You are logged in. You then open an evil page in another tab.

```steps
{"title": "A CSRF attack, and the SameSite fix", "frames": [
  {"visual": "Browser holds:  bank.com cookie  sid=abc\nTab 1: bank.com   (logged in)\nTab 2: evil.com   (just opened)\n", "caption": "You are logged in to the bank. The browser stores your cookie."},
  {"visual": "evil.com page contains a hidden form:\n  POST https://bank.com/transfer\n  to=attacker  amount=500\nit auto-submits when the page loads\n", "caption": "The evil page quietly makes your browser send a POST to the bank."},
  {"visual": "Browser --> bank.com\n  POST /transfer to=attacker amount=500\n  Cookie: sid=abc     <- added automatically!\n", "caption": "Without a SameSite restriction, browsers attach the cookie to requests for that site, whoever started them. The bank sees a valid session."},
  {"visual": "Browser --> bank.com\n  POST /transfer to=attacker amount=500\n  (no cookie: SameSite=Lax blocks it)\nbank.com: 401, no transfer\n", "caption": "Fix: `SameSite=Lax` (or Strict) stops the cookie being sent on cross-site POSTs. Anti-forgery tokens add a second check."}
]}
```

```reveal
{"prompt": "Before you look: the bank's transfer is a GET link, /transfer?to=attacker&amount=500, and the cookie is SameSite=Lax. Is it safe?", "answer": "**No.** Lax still sends the cookie on cross-site top-level GET navigations (a plain link click), so the attack works. Rule: **never change state in a GET handler**, and use anti-forgery tokens for POSTs."}
```

## Cookie attributes

| Attribute | Effect |
|---|---|
| `HttpOnly` | JavaScript can't read the cookie (limits token theft via XSS) |
| `Secure` | sent only over HTTPS |
| `SameSite=Strict` | never sent on cross-site requests |
| `SameSite=Lax` (browser default) | sent on cross-site top-level GET navigations only |
| `SameSite=None; Secure` | always sent (for third-party embeds) |

```csharp
services.ConfigureApplicationCookie(o =>
{
    o.Cookie.HttpOnly = true;
    o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    o.Cookie.SameSite = SameSiteMode.Lax;
});
```

## XSS

```steps
{"title": "XSS: script smuggled into a comment", "frames": [
  {"visual": "Attacker posts a comment:\n  <script>send(document.cookie)</script>\n", "caption": "The attacker submits a comment that contains a script tag."},
  {"visual": "Server stores it.\nVictim opens the page:\n  <div> ...<script>send(document.cookie)</script></div>\n", "caption": "The page inserts the comment as raw HTML, so the browser treats it as part of the page."},
  {"visual": "Victim's browser runs the script\n  with the bank page's powers\n  -> sends cookies/tokens to attacker\n", "caption": "The script runs with the site's own origin, so same-origin policy does not stop it."},
  {"visual": "Escaped output:\n  <div>&lt;script&gt;send(...)&lt;/script&gt;</div>\nshown as harmless text\n", "caption": "Fix: escape output so the comment is text, not code. Angular does this for `{{ }}` by default."}
]}
```

The danger in Angular is `bypassSecurityTrust*`, `innerHTML` with untrusted data, and server-side template injection. Add a **Content Security Policy** (a header listing where scripts may load from) as defense in depth.

## JWT and token storage

- A JWT is signed (prefer RS256 or ES256 across services) and verified without a database lookup. Always validate `iss`, `aud`, `exp` and the algorithm; reject `alg: none`.
- It is **hard to revoke**, so keep it short-lived (5 to 15 minutes) and use rotating **refresh tokens** stored server-side.
- The payload is only base64-encoded, not encrypted. No secrets in it.
- `localStorage` is readable by any XSS. An HttpOnly cookie is not, but needs CSRF protection. A common compromise is the **BFF** pattern (backend for frontend): the backend holds the tokens and the SPA uses an HttpOnly, SameSite session cookie.

```check
{"prompt": "Which cookie attribute stops page JavaScript from reading the cookie?", "options": ["Secure", "SameSite=Lax", "Path=/", "HttpOnly"], "answer": 3, "explanation": "HttpOnly hides the cookie from scripts, so an XSS bug cannot simply copy the session ID. Secure only limits it to HTTPS."}
```

## Where you'll meet it

- ASP.NET Core's `[ValidateAntiForgeryToken]`, cookie authentication and JWT bearer middleware.
- Angular's built-in sanitisation and `HttpClient` XSRF support.
- Security headers on Azure Front Door or nginx (CSP, HSTS).
- Interview: "XSS vs CSRF, and where do you store the token?"

## Common mistakes

- Changing state in GET handlers.
- `bypassSecurityTrustHtml` on user input.
- Long-lived JWTs in `localStorage`.
- Trusting CORS to stop CSRF; it only restricts reading responses.

## Recap

- **XSS** runs attacker script in your page; escape output and add a CSP.
- **CSRF** rides your cookie from another site; use `SameSite`, anti-forgery tokens, no state change on GET.
- `HttpOnly` and `Secure` protect the cookie itself.
- Keep JWTs short-lived and validated; choose token storage knowing the XSS/CSRF trade-off.
