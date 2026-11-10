---
title: "Logging in: cookies, sessions & tokens"
summary: "How a website remembers who you are between requests, using cookies, server sessions or signed tokens."
---

## The idea

Imagine entering a concert. At the door, staff check your ticket once. Then they put a wristband on you. Inside, nobody checks your ticket again. They just look at the wristband.

Websites need this because HTTP has no memory (see the requests and responses lesson). Every request stands alone, so the server cannot tell that two requests come from the same person. Logging in solves it the wristband way. You prove who you are once with a password. The server then gives you something small to show on every later request. That is the whole idea of **authentication**: proving who you are.

```check
{"prompt": "Why can't a server remember a user between requests by default?", "options": ["Passwords expire quickly", "Browsers delete everything immediately", "HTTP treats every request as separate", "Servers have no memory at all"], "answer": 2, "explanation": "HTTP is stateless: each request stands alone. A login system adds the memory by giving the client something to send each time."}
```

## See it work

Here is a login with a **session cookie**, traced step by step.

```
POST /login HTTP/1.1
Content-Type: application/json

{"user":"asha","password":"s3cret"}
```

The server checks the password. It is correct, so the server creates a record of your login and replies:

```
HTTP/1.1 200 OK
Set-Cookie: sid=9f8a7c; HttpOnly; Secure
```

The browser stores the cookie. On every later request to that site, it adds the cookie automatically:

```
GET /profile HTTP/1.1
Host: www.example.com
Cookie: sid=9f8a7c
```

The server looks up `9f8a7c` in its list of sessions, finds "asha", and answers with her profile.

## How it works

- **Authentication** means proving who you are. **Authorization** means deciding what you may do once the server knows. Logging in is the first; "only admins can delete" is the second.
- A **cookie** is a small piece of text the server asks the browser to keep. The browser sends it back on every request to that site.
- A **session** is the server's record of one login. The cookie holds only a random **session ID**. The server keeps the details (who you are) in memory or a database. To log you out, it deletes the record.
- A **token** is another way. Instead of a record on the server, the server hands you a signed string that contains your identity. The most common kind is a **JWT** (JSON Web Token). The server checks the **signature**, which proves the server made it and nobody changed it. No lookup is needed.

The client sends a token in a header:

```
GET /profile HTTP/1.1
Authorization: Bearer eyJhbGciOi...
```

Trade-off: sessions are easy to cancel (delete the record) but the server must store them. Tokens need no storage but are hard to cancel before they expire, so they are kept short-lived.

Passwords are never stored as plain text. The server stores a **hash**, a one-way scramble, and compares hashes at login.

```check
{"prompt": "What does the session cookie hold in a server-side session system?", "options": ["The user's password", "The user's whole profile", "The server's private key", "A random ID that points to the session on the server"], "answer": 3, "explanation": "The cookie is only a lookup key. The real data stays on the server, so the browser can't edit it, and deleting the server record logs the user out."}
```

## Where you'll meet it

- **Every login form.** Banks, shops and social sites all use one of these patterns.
- **"Remember me" and "Log out everywhere".** These work by lasting or deleting sessions.
- **APIs.** Mobile apps usually send a `Bearer` token in the `Authorization` header.
- **Login with Google.** The big provider checks who you are and gives the site a token.
- **ASP.NET Core.** Cookie authentication and JWT bearer authentication are both built in.

```check
{"prompt": "A user logged in, then an admin must instantly end their access. Which approach makes this easiest?", "options": ["A long-lived signed token with no server record", "A server-side session that the server can delete", "A longer password", "A cookie with a bigger name"], "answer": 1, "explanation": "With a session, the server just deletes the record and the next request fails. A signed token stays valid until it expires, unless you add extra tracking."}
```

## Common mistakes

- **Storing passwords as plain text.** Always store a salted hash from a password-hashing algorithm, never the password.
- **Sending credentials over plain HTTP.** Anyone on the network can read them. Use HTTPS, and mark cookies `Secure`.
- **Putting secrets inside a token.** A JWT payload is only encoded, not encrypted. Anyone can read it.
- **Confusing the two words.** A logged-in user is not necessarily allowed to do everything. Check authorization on every action.
- **Cookies readable by scripts.** Use `HttpOnly` so page JavaScript cannot steal the session ID.

## Recap

- HTTP forgets you, so logging in gives you something to show on each request.
- Authentication proves who you are; authorization decides what you may do.
- A session cookie holds an ID, and the server keeps the real record.
- A token is signed and carries your identity, with no server lookup.
- Always use HTTPS, hash passwords and keep tokens short-lived.
