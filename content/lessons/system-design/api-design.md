---
title: "Designing an API"
summary: "How to define the menu of things a client can ask a server to do, so it is clear and hard to misuse."
---

## The idea

A restaurant gives you a menu. You can order only what is on it, in the way the menu describes. You don't need to know how the kitchen works.

An **API** (application programming interface) is a menu for programs. It lists what a client may ask a server to do, and what shape the requests and replies take. If the menu is clear, other developers can use your system without reading your code. If it is confusing, they will misuse it, and once people depend on it, it is hard to change.

In this lesson we design a **REST** API, the most common style on the web. It models your system as *things* (called resources) such as orders, and uses standard HTTP verbs for actions. (HTTP is the rule book clients and servers use to talk, and a verb such as GET or POST says what to do.)

```check
{"prompt": "What is an API best compared to?", "options": ["The kitchen of a restaurant", "The menu of a restaurant", "The bill at the end of the meal"], "answer": 1, "explanation": "An API tells callers what they can ask for and how, without exposing the inner workings, just like a menu hides the kitchen."}
```

## See it work

We are building a shop. The main thing is an **order**. Here is the API as a table:

```
POST   /orders           create a new order
GET    /orders/42        read order 42
GET    /orders?page=2    list orders, page 2
PUT    /orders/42        replace order 42
DELETE /orders/42        cancel order 42
```

Follow one request. A client sends:

```
POST /orders
{"item": "mug", "quantity": 2}
```

The server saves it, gives it the id 42 and replies:

```
201 Created
{"id": 42, "item": "mug", "quantity": 2, "status": "new"}
```

Notice the path is a noun (`/orders`) and the verb comes from the HTTP method. We write `POST /orders`, not `/createOrder`.

```steps
{"title": "One POST /orders, end to end", "frames": [
  {"visual": "Client                              Server\n  |                                   |\n  |                                   |\n  |                                   |", "caption": "The client wants to create an order. Nothing has been sent yet."},
  {"visual": "Client                              Server\n  |  POST /orders {mug, qty 2}        |\n  |---------------------------------->|\n  |                                   |", "caption": "The **request**: a verb (POST), a noun path (/orders) and a body with the details."},
  {"visual": "Client                              Server\n  |  POST /orders {mug, qty 2}        |\n  |---------------------------------->|\n  |                      saves, id = 42", "caption": "The server validates the body and saves the order. It chooses the id, not the client."},
  {"visual": "Client                              Server\n  |  POST /orders {mug, qty 2}        |\n  |---------------------------------->|\n  |<----------------------------------|\n  |  201 Created {id: 42, ...}        |", "caption": "The **response**: status 201 means created, and the body shows the new order."}
]}
```

## How it works

**Verbs.** `GET` reads and changes nothing. `POST` creates. `PUT` replaces. `DELETE` removes. Reading with `GET` must never change data, because browsers and caches assume it is safe to repeat.

**Status codes.** Tell the client what happened:

- `200` OK, `201` Created
- `400` the request was malformed, `401` who are you?, `404` not found
- `500` the server broke

**Idempotency.** An operation is **idempotent** if doing it twice has the same effect as doing it once. `GET`, `PUT` and `DELETE` are. `POST` is not: send "create order" twice and you may get two orders. Networks drop replies, so clients retry. For payments or orders, let the client send an **idempotency key**, a unique code per attempt, and have the server ignore repeats.

```steps
{"title": "A retry with an idempotency key", "frames": [
  {"visual": "Client                              Server\n  |  POST /orders  key=K1             |\n  |---------------------------------->|\n  |                       order 42 saved", "caption": "The first attempt reaches the server, which saves the order and remembers key K1."},
  {"visual": "Client                              Server\n  |  POST /orders  key=K1             |\n  |---------------------------------->|\n  |   X<------ 201 {id: 42} lost -----|\n  |                       order 42 saved", "caption": "The reply is lost on the way back. The client sees only a timeout and cannot know whether the order exists."},
  {"visual": "Client                              Server\n  |  POST /orders  key=K1  (retry)    |\n  |---------------------------------->|\n  |                       K1 seen before!", "caption": "The client retries with the same key. The server recognises K1."},
  {"visual": "Client                              Server\n  |<------ 201 {id: 42} (replayed) ---|\n  |                                   |\n  |                       still 1 order", "caption": "The server replays the saved answer. One order exists, not two."}
]}
```

**Pagination.** Never return a million orders in one reply. Return a page at a time, with a way to ask for the next one, such as `?page=2&size=20`.

**Versioning.** Once clients rely on your API, changing a field breaks them. Put a version in the path, `/v1/orders`, so you can release `/v2` and leave old clients alone.

A tiny C# handler (minimal API):

```csharp
app.MapGet("/orders/{id}", (int id, OrderStore store) =>
    store.Find(id) is { } order ? Results.Ok(order) : Results.NotFound());
```

```reveal
{"prompt": "Before you look: a client calls `GET /orders/9999`, but no such order exists. What should the handler above return, and why not 200 with an empty body?", "answer": "It returns **404 Not Found** (`Results.NotFound()`). A 200 would tell clients and monitoring that the call worked, so they would have to dig into the body to discover the failure."}
```

```check
{"prompt": "A client sends 'create order' and the connection drops before the reply arrives. It retries. What protects the customer from being charged twice?", "options": ["An idempotency key that lets the server recognise the repeat", "Using GET instead of POST", "Hoping the network is better the second time"], "answer": 0, "explanation": "The client cannot know if the first attempt worked. If each attempt carries the same unique key, the server can spot the repeat and return the original result instead of creating a second order."}
```

## Where you'll meet it

- Every mobile app and website talks to its backend through an API.
- Public APIs from payment, map and weather companies.
- Interview questions like "design a URL shortener" or "design a chat app" almost always start with: what are the endpoints?

## Common mistakes

- **Verbs in paths** (`/getOrder`, `/deleteOrder`). Use nouns and let the HTTP method be the verb.
- **Using 200 for everything**, even errors. Clients then must read the body to find out what happened.
- **Returning unlimited lists.** Always paginate.
- **Breaking changes without versioning.** Renaming a field can crash every client.
- **Leaking internals.** Return what clients need, not your raw database rows.

```check
{"prompt": "Which design is better for deleting order 42?", "options": ["GET /deleteOrder?id=42", "POST /order/remove with id in the body", "DELETE /orders/42"], "answer": 2, "explanation": "The path names the thing and the HTTP method says the action. GET must stay safe and never change data, so a delete behind GET could be triggered by a crawler or a cache prefetch."}
```

## Recap

- An **API** is the menu of what clients may ask; keep it clear and stable.
- In REST, **paths are nouns** and **HTTP methods are the verbs**.
- Return the right **status code**.
- Make creating operations safe to retry with an **idempotency key**.
- **Paginate** lists and **version** the API so you can change it later.
