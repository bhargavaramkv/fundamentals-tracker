---
title: "Requests & responses"
summary: "How a browser and a server talk: the shape of an HTTP request, a response, and what the common status codes mean."
---

## The idea

Picture a restaurant. You give the waiter an order: what you want and any special notes. The waiter returns with a result: your food, or "sorry, we're out of that."

Web traffic is the same, and it follows a strict script called **HTTP** (HyperText Transfer Protocol). The client sends a **request**. The server sends back one **response**. Then the conversation is over. The server does not remember you unless you give it a reason to (more on that in the login lesson).

```check
{"prompt": "How many responses does a server send for one HTTP request?", "options": ["None until you log in", "Two: a header and a body", "As many as it likes", "One"], "answer": 3, "explanation": "HTTP is request and response, one for one. The client always speaks first, and the server answers once."}
```

## See it work

Here is a real request, as text. This is exactly what travels over the wire:

```
GET /docs/intro HTTP/1.1
Host: www.example.com
Accept: text/html
```

And the server's response:

```
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 46

<html><body>Welcome to the docs!</body></html>
```

Read the request line by line. The first line says **what to do** (`GET`), **on which resource** (`/docs/intro`) and which HTTP version. The next lines are **headers**: extra facts about the request. `Host` says which site you mean, since one server can host many.

The response starts with a **status line**: version, a numeric code (`200`) and a short reason (`OK`). Then headers describing the answer. A blank line separates the headers from the **body**, the actual content.

In C# you can make this call in a few lines:

```csharp
using var client = new HttpClient();
var response = await client.GetAsync("https://www.example.com/docs/intro");
Console.WriteLine((int)response.StatusCode); // 200
```

```check
{"prompt": "In the response above, which part is the body?", "options": ["HTTP/1.1 200 OK", "Content-Type: text/html", "The HTML after the blank line", "Host: www.example.com"], "answer": 2, "explanation": "A blank line ends the headers. Everything after it is the body, here the HTML page. The status line and headers describe the response but are not the content."}
```

## How it works

**Methods** say what you want to do:

- `GET`: read something. It should not change anything.
- `POST`: send data to create something or start an action.
- `PUT`: replace something. `DELETE`: remove it.

**Status codes** are grouped by their first digit:

| Range | Meaning | Examples |
|---|---|---|
| 2xx | It worked | 200 OK, 201 Created |
| 3xx | Go somewhere else | 301 Moved Permanently |
| 4xx | You made a mistake | 400 Bad Request, 404 Not Found |
| 5xx | The server failed | 500 Internal Server Error |

A request that sends data, such as `POST`, carries a body too:

```
POST /orders HTTP/1.1
Host: www.example.com
Content-Type: application/json
Content-Length: 22

{"item":"tea","qty":2}
```

The `Content-Type` header tells the receiver how to read the body. JSON is the most common format for APIs.

```check
{"prompt": "A client asks for /missing-page and the server has no such page. Which status fits best?", "options": ["200 OK", "500 Internal Server Error", "301 Moved Permanently", "404 Not Found"], "answer": 3, "explanation": "4xx means the client asked for something that cannot be served. 404 says the resource does not exist. A 500 would mean the server itself crashed."}
```

## Where you'll meet it

- **APIs.** Mobile apps and websites fetch data by sending HTTP requests and reading JSON in the response.
- **Browser DevTools.** The Network tab lists every request and response of a page, with method, status and headers.
- **`curl`.** `curl -i https://www.example.com` prints the raw response so you can read it.
- **Your own code.** Controllers in ASP.NET Core receive requests and return responses with status codes.

## Common mistakes

- **Using `GET` to change data.** Browsers and crawlers may call `GET` freely, so it must be harmless.
- **Returning 200 for errors.** If something failed, use a 4xx or 5xx code, so clients can react correctly.
- **Mixing up 4xx and 5xx.** 4xx means fix the request. 5xx means the server needs fixing.
- **Forgetting `Content-Type`.** Without it, the receiver may misread your body.

## Recap

- HTTP is a request followed by one response.
- A request has a method, a path, headers and sometimes a body.
- A response has a status code, headers and usually a body.
- Status codes: 2xx worked, 3xx redirect, 4xx client error, 5xx server error.
- Each request stands alone. The server does not remember the last one by itself.
