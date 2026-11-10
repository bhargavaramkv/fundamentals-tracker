---
title: "Clients & servers"
summary: "How an app on your phone asks another computer for things, and how that computer answers."
---

## The idea

Think of a restaurant. You sit at a table and ask for food. You don't go into the kitchen. A waiter takes your order to the kitchen, and brings back a plate.

Most apps work the same way. The app on your phone is the **client**: it asks for things. Somewhere else, a computer called a **server** is waiting to answer. It does the work, then sends back a reply.

A server is just a program running on a computer that is always on and connected to the internet. Nothing magic. The client and the server are two programs that talk by sending messages.

```check
{"prompt": "You open a weather app and it shows today's forecast. Which part is the client?", "options": ["The computer that stores the forecast data", "The app on your phone that asked for the forecast", "The internet cable between them"], "answer": 1, "explanation": "The client is whoever asks. Your app asked for the forecast, so it is the client. The computer that held the data and answered is the server."}
```

## See it work

Let's follow one request. You open a shopping app and tap "My orders".

```
 Phone (client)                          Server
      |  1. "GET /orders for user 42"      |
      |----------------------------------->|
      |                                    | 2. looks up orders
      |                                    |    in its database
      |  3. "200 OK, here are 3 orders"    |
      |<-----------------------------------|
      |
 4. app draws the list
```

The client sends a **request**. The server does some work and sends back a **response**. The client then shows the result. Every tap that loads new data is a small round of this: ask, wait, answer.

## How it works

A few words you will hear all the time.

- **Request:** a message from client to server. It says what you want, for example "give me the orders for user 42".
- **Response:** the server's reply. It holds a **status code** (a number saying how it went) and usually some data.
- **Address:** to find a server, the client needs its address, like a street address for a building. On the internet this is an **IP address** (for example `203.0.113.7`). People use names like `shop.example.com`, and the internet translates the name to the address.
- **Protocol:** an agreed set of rules for the messages, so both sides understand each other. The one the web uses is **HTTP**.

Two status codes are worth knowing now: `200` means "all good", and `404` means "I could not find that".

Here is the client side in C#. It sends one request and reads the reply:

```csharp
using var http = new HttpClient();
var response = await http.GetAsync("https://shop.example.com/orders");
Console.WriteLine((int)response.StatusCode);      // 200
string body = await response.Content.ReadAsStringAsync();
```

One more idea: the server does not remember you between requests unless you tell it who you are each time. Each request arrives on its own, like a customer who keeps walking up to the counter with a fresh order. We say HTTP is **stateless**.

```check
{"prompt": "A client sends a request and gets back status code 404. What does that most likely mean?", "options": ["The server could not find what was asked for", "The request worked perfectly", "The client's phone has run out of battery", "The server is giving the client a gift"], "answer": 0, "explanation": "404 means 'not found': the server is running and understood the request, but nothing exists at that address. A successful reply would be 200."}
```

## Where you'll meet it

Almost everything you use online:

- A browser loading a web page: the browser is the client, the website's computer is the server.
- A mobile app showing your feed or messages.
- One server calling another. A shop's server may ask a payment company's server to charge a card. Here the shop's server is the client of the payment server. "Client" and "server" are roles in one conversation, not types of machines.

When someone says "design a system", they usually mean: decide what the servers are, what they store, and what clients can ask of them.

## Common mistakes

- **Thinking the client is trustworthy.** The client runs on the user's device, so anyone can change it. A server must check every request itself, for example that you really own order 42.
- **Assuming the server remembers you.** Because requests arrive alone, you must send proof of who you are (such as a token) with each one.
- **Forgetting the network can fail.** A request may be slow, lost or answered with an error. Calling a server is not like calling a function in your own program.
- **Mixing up the roles.** "Server" does not mean a big powerful machine. It means the one that answers.

```check
{"prompt": "Why must a server re-check, on every request, that you are allowed to see order 42?", "options": ["Because servers forget how to read", "Because the client is on the user's device and could be changed to send anything", "Because status codes expire after a minute"], "answer": 1, "explanation": "The client is outside the server's control. Someone could edit the app or craft a request by hand, so the server cannot trust what arrives. It has to verify who is asking and what they may see."}
```

## Recap

- A **client** asks; a **server** answers. These are roles, and one program can be both.
- A **request** goes out, a **response** comes back, with a status code such as 200 or 404.
- Servers are found by an **address**, and they talk to clients using a **protocol** such as HTTP.
- Each request stands alone, so the client sends proof of identity every time.
- Never trust the client; the server decides what is allowed.
