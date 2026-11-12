---
title: "URLs & DNS"
summary: "How a web address is built, and how a name like example.com is turned into an IP address."
---

## The idea

You remember a friend's name, not their phone number. Your phone keeps a contact list that turns the name into the number when you call.

Computers have the same problem. The network needs an IP address like `93.184.216.34` (the number that identifies a computer, from the internet basics lesson), but people prefer names like `example.com`. The **Domain Name System (DNS)** is the internet's contact list. You give it a name, and it gives back an IP address.

A **URL** is the full web address you type in the browser. It names the server to look up, but also says how to talk to it and what to ask for.

```check
{"prompt": "What does DNS do?", "options": ["Turns a name like example.com into an IP address", "Encrypts web pages", "Stores the web pages themselves", "Makes your internet faster"], "answer": 0, "explanation": "DNS is only a lookup service. It maps names to addresses, and the page itself comes from the server at that address."}
```

## See it work

Take this URL and cut it into parts:

```
https://www.example.com:443/docs/intro?lang=en#setup
\___/   \_____________/\_/\________/ \_____/ \____/
scheme       host     port   path     query  fragment
```

- **Scheme** (`https`): the protocol to use.
- **Host** (`www.example.com`): which server to contact.
- **Port** (`443`): which program on it. Usually left out, because `https` implies 443.
- **Path** (`/docs/intro`): which resource you want.
- **Query** (`?lang=en`): extra options as `key=value` pairs.
- **Fragment** (`#setup`): a spot inside the page. The browser keeps it and never sends it to the server.

C# can split a URL for you:

```csharp
var uri = new Uri("https://www.example.com:443/docs/intro?lang=en#setup");
Console.WriteLine(uri.Scheme);       // https
Console.WriteLine(uri.Host);         // www.example.com
Console.WriteLine(uri.AbsolutePath); // /docs/intro
Console.WriteLine(uri.Query);        // ?lang=en
Console.WriteLine(uri.Fragment);     // #setup
```

```check
{"prompt": "In https://shop.example.com/cart?id=7, which part is the host?", "options": ["https", "/cart", "shop.example.com", "id=7"], "answer": 2, "explanation": "The host sits between the scheme and the path. It names the server to contact. The path (/cart) says which resource to ask for."}
```

## How it works

A name like `www.example.com` is read from right to left. The last piece, `com`, is the **top-level domain (TLD)**. `example` sits inside it, and `www` is a **subdomain** of example.com.

No single computer knows every name. DNS is a tree of servers, each knowing a part. A **recursive resolver** (run by your internet provider or a public service) does the legwork for you. A **root server** knows who handles each TLD, a **TLD server** knows who handles each domain, and the domain's own **authoritative server** has the final answer.

```steps
{"title": "Looking up www.example.com (nothing cached)", "frames": [
  {"visual": "You --> Resolver\n  'where is www.example.com?'\n\nRoot   .com servers   example.com's server", "caption": "Your computer asks its resolver. The resolver has no cached answer."},
  {"visual": "You     Resolver --> Root\n          'who handles .com?'\n\n.com servers   example.com's server", "caption": "The resolver asks a root server which servers handle `.com`."},
  {"visual": "You     Resolver --> .com servers\n          'who handles example.com?'\n  (root said: ask the .com servers)\n\nexample.com's server", "caption": "The root points to the `.com` servers. The resolver asks them about `example.com`."},
  {"visual": "You     Resolver --> example.com's server\n          'what is www.example.com?'\n  (.com said: ask example.com's server)\n", "caption": "They point to example.com's authoritative server. The resolver asks it for the name."},
  {"visual": "You <-- Resolver <-- 93.184.216.34\n  answer cached for the TTL, e.g. 300 s\n", "caption": "The answer comes back, the resolver caches it, and your browser can now connect to that IP address."}
]}
```

How long it remembers is the record's **TTL** (time to live), in seconds. Your browser and operating system cache the answer too, so most lookups never leave your machine.

```reveal
{"prompt": "Before you look: you move your site to a new server and change the A record. Some visitors still reach the old server for the next hour. Why?", "answer": "Resolvers, operating systems and browsers have **cached** the old answer, and they keep it until the record's **TTL** runs out. Lower the TTL a day before a planned move."}
```

Common record types: **A** (name to IPv4 address), **AAAA** (name to IPv6), **CNAME** (this name is an alias of another name).

```check
{"prompt": "Why does DNS use caching with a TTL?", "options": ["To hide the website's real address", "To make names shorter", "To avoid repeating the whole lookup for every request", "To block bad websites"], "answer": 2, "explanation": "Answers rarely change, so remembering them saves many round trips. The TTL says how long the answer may be reused before asking again."}
```

## Where you'll meet it

- **Buying a domain.** You edit its DNS records to point the name at your server.
- **Moving a site.** Changing the IP behind a name takes time to spread, because caches keep the old answer until the TTL runs out.
- **Debugging.** `nslookup example.com` or `dig example.com` shows what DNS returns.
- **C# code.** `HttpClient` calls DNS for you when you give it a URL with a host name.
- **Query strings.** Search pages and filters use `?key=value` all the time.

## Common mistakes

- **Blaming the server when DNS is the problem.** "Site not found" often means the name did not resolve, not that the server is down.
- **Thinking a DNS change is instant.** Old answers live on in caches until their TTL expires.
- **Putting secrets in the URL.** Paths and query strings end up in logs and browser history. Never put passwords there.
- **Forgetting to encode.** Spaces and symbols in a query value must be escaped (a space becomes `%20`). Use `Uri.EscapeDataString` in C#.

## Recap

- A URL has a scheme, host, optional port, path, query and fragment.
- DNS turns a host name into an IP address.
- A lookup walks from the root to the TLD to the authoritative server, via a resolver.
- Answers are cached for the record's TTL, so changes spread slowly.
- A, AAAA and CNAME are the records you'll see most.
