---
title: "Browser: CORS, preflight & HTTP caching"
summary: "What the same-origin policy and CORS really protect, when a preflight fires, and how to cache single-page apps correctly."
---

## The idea

A browser is a careful guest. Every website you open runs its own code on your machine, so the browser keeps each site in its own room. A page from one site is not allowed to read what another site sent you. Otherwise a random page could read your email just because you are logged in to your mail site in another tab. That rule is the **same-origin policy**.

An **origin** is the trio scheme + host + port, for example `https://app.example.com:443`. Change any one of the three and it is a different origin.

Sometimes sites need to cooperate, for example your page at `app.example.com` calling an API at `api.example.com`. The API can say "I allow that page" using response headers (the extra lines of an HTTP message, from the requests lesson). This permission system is **CORS** (Cross-Origin Resource Sharing). Separately, the browser saves copies of files it already downloaded so the next visit is faster. That is **HTTP caching**, and you control it with headers too.

```check
{"prompt": "What is the same-origin policy for?", "options": ["Stopping a page from reading another site's responses", "Making pages load faster", "Hiding the URL", "Compressing images"], "answer": 0, "explanation": "The browser keeps sites apart so a page you open cannot read data that belongs to another site you are logged in to. CORS is the controlled way to relax this."}
```

## See it work

Your page at `https://app.example.com` runs `fetch` against `https://api.example.com` with a JSON body. That is a different origin, and a JSON `Content-Type` is not "simple", so the browser asks permission first with a **preflight**: an `OPTIONS` request sent before the real one.

```steps
{"title": "A preflighted cross-origin request", "frames": [
  {"visual": "Browser (app.example.com)       api.example.com\n  JS: fetch(api, POST, JSON)\n  different origin -> must ask first\n", "caption": "The page's JavaScript calls the API. The browser sees a cross-origin request that needs a preflight."},
  {"visual": "Browser                         api.example.com\n  | OPTIONS /orders                 |\n  | Origin: https://app.example.com |\n  | Access-Control-Request-Method:  |\n  |   POST                          |\n  |-------------------------------->|", "caption": "Step 1, the **preflight**: the browser asks, may this origin send this kind of request?"},
  {"visual": "Browser                         api.example.com\n  |<--------------------------------|\n  | 204                             |\n  | Access-Control-Allow-Origin:    |\n  |   https://app.example.com       |\n  | Access-Control-Allow-Methods: POST", "caption": "The API says yes with CORS headers. If these were missing, the browser would stop here."},
  {"visual": "Browser                         api.example.com\n  | POST /orders  {json}            |\n  |-------------------------------->|\n  |<--------------------------------|\n  | 201  (+ Allow-Origin header)    |", "caption": "Step 2: the real request is sent, and the response must carry the allow header again."},
  {"visual": "Browser (app.example.com)       api.example.com\n  JS receives the response\n  (without the header, JS would see\n   a CORS error instead)", "caption": "Only now can the page's JavaScript read the reply."}
]}
```

```reveal
{"prompt": "Before you look: you call your API from curl and it works, but from the browser you get a CORS error. Is the server broken, and is CORS protecting your API from curl?", "answer": "The server is fine. CORS is enforced **by the browser only**; curl ignores it, so it protects nothing on the server. It only stops page JavaScript from *reading* cross-origin responses. Fix the browser case by sending the right CORS headers, and never use CORS as authorization."}
```

## How it works

A request is "simple", with no preflight, only if it uses GET, HEAD or POST, only CORS-safelisted headers, and a `Content-Type` of `text/plain`, `multipart/form-data` or `application/x-www-form-urlencoded`. Anything else, including an `Authorization` header or `Content-Type: application/json`, gets a preflight. The server answers with:

- `Access-Control-Allow-Origin`: a specific origin (not `*` when credentials are used)
- `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`
- `Access-Control-Allow-Credentials: true` if cookies are involved
- `Access-Control-Max-Age`: how long the browser may remember the preflight answer

In ASP.NET Core, configure it with `AddCors` and run `UseCors()` **before** authentication and the endpoints, or preflights get rejected:

```csharp
builder.Services.AddCors(o => o.AddPolicy("spa", p => p
    .WithOrigins("https://app.example.com")
    .AllowAnyHeader().AllowAnyMethod()));
// ...
app.UseCors("spa");     // before UseAuthentication/UseAuthorization
```

## Cache-Control for SPAs

A **SPA** (single-page application, such as an Angular app) is a few files: an `index.html` plus JavaScript bundles whose names contain a content hash, like `main.3f9a.js`. The hash changes whenever the code does. That lets you cache the bundles forever but never the HTML.

| Resource | Header |
|---|---|
| `index.html` | `no-cache` (store, but revalidate every time) + `ETag` |
| Hashed bundles `main.3f9a.js` | `public, max-age=31536000, immutable` |
| Authenticated API JSON | `private, no-cache` or `no-store` |
| Sensitive data | `no-store` |

`no-cache` does **not** mean "don't cache"; it means "revalidate before use". `no-store` means never save it. `private` means the browser only, not CDNs.

```check
{"prompt": "Which Cache-Control value means: you may store this, but check with the server before each use?", "options": ["no-store", "immutable", "no-cache", "max-age=31536000"], "answer": 2, "explanation": "no-cache is badly named: the browser may keep the file but must revalidate it before using it. no-store is the one that forbids saving it at all."}
```

## Where you'll meet it

- An Angular app on one domain calling an ASP.NET API on another: the classic CORS error in the DevTools console.
- Azure Static Web Apps, Front Door or a CDN serving your bundles with cache headers.
- Interview: "why did users see a broken app after the deploy?"

## Common mistakes

- Treating CORS as security for the API. Authenticate and authorize on the server.
- `Access-Control-Allow-Origin: *` together with cookies; browsers refuse it.
- Putting `UseCors` after auth in ASP.NET, so the preflight (which carries no credentials) gets a 401.
- Giving `index.html` a long `max-age`. It keeps referencing old bundle hashes, so users get a broken app after a deploy. Use `no-cache` on the HTML.

## Recap

- **Same-origin policy**: a page cannot read another origin's responses.
- **CORS** headers from the server relax it; the browser enforces it, not the server.
- Non-simple requests send an `OPTIONS` **preflight** first.
- Cache hashed bundles for a year; use `no-cache` for `index.html`; `no-store` for sensitive data.
