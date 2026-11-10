---
title: "Load balancers, from scratch"
summary: "How a front door spreads requests over many servers, and what it does when one breaks."
---

## The idea

Picture a supermarket with five checkouts and one person at the entrance. That person looks at the queues and says "you, go to till 3". Nobody waits at a till that is closed, and no single till gets swamped.

A **load balancer** is that person. It sits in front of several identical servers. Clients talk to the load balancer, and it passes each request to one of the servers. Spreading work this way means no single server is overwhelmed, and if one server breaks, the others carry on.

(Quick reminder: a **server** is a program that answers requests. "Load" just means the amount of work.)

```check
{"prompt": "What is the main job of a load balancer?", "options": ["To store the website's data", "To spread incoming requests across several servers", "To make each request faster by shortening cables"], "answer": 1, "explanation": "A load balancer does not store data or speed up one request. It shares requests among many servers so none is overloaded and one failure does not take the site down."}
```

## See it work

Three identical servers, A, B and C, sit behind one load balancer. Six requests arrive.

```
Clients --> [ Load balancer ] --> Server A   (requests 1, 4)
                              --> Server B   (requests 2, 5)
                              --> Server C   (requests 3, 6)
```

This simple rule is **round-robin**: go down the list in turn, then start again. Each server gets two requests.

Now server B crashes. The load balancer notices (more on that next) and stops sending to it:

```
Clients --> [ Load balancer ] --> Server A   (requests 7, 9)
                              --> Server C   (requests 8, 10)
```

Users never see an error page. They may not even notice. That is the point.

## How it works

**Choosing a server.** Common rules:

- **Round-robin:** take turns. Fine when requests cost about the same.
- **Least connections:** pick the server with the fewest open requests right now. Better when some requests are slow and some are quick.

**Health checks.** The load balancer regularly pings each server, for example asking `GET /health` every few seconds. If a server stops answering, it is taken out of the list. When it recovers, it is added back.

**Sticky sessions.** Sometimes a server remembers something about you, like a login held in its own memory. If your next request lands on a different server, it will not know you. Fix 1: send you to the same server each time ("sticky"). Fix 2, usually better: keep that memory outside the servers, in a shared database, so any server can answer anyone. A server that keeps nothing about you is called **stateless**.

**Layers.** A load balancer can work at two levels. **Layer 4** looks only at network connections and is very fast. **Layer 7** reads the HTTP request itself, so it can send `/images` to one group of servers and `/api` to another.

A catch: the load balancer is now a single door. If it dies, everything dies. So real systems run two or more of them.

```check
{"prompt": "Server B stops responding to health checks. What should the load balancer do?", "options": ["Keep sending it requests in case it recovers", "Shut down all the other servers too", "Stop sending it requests until its health checks pass again"], "answer": 2, "explanation": "The whole point of health checks is to remove broken servers from rotation so users do not hit errors. Once the server answers checks again, it can rejoin."}
```

## Where you'll meet it

- Cloud services offer them ready-made, such as AWS Elastic Load Balancer or Azure Load Balancer.
- Web servers like Nginx and HAProxy can act as one.
- Kubernetes spreads traffic over the copies of a service.
- In interviews, "put a load balancer in front of N app servers" is nearly always the first step when asked to scale.

## Common mistakes

- **Forgetting the balancer is a single point of failure.** Run more than one.
- **Keeping user data in a server's memory.** It breaks as soon as requests move between servers.
- **Using round-robin when requests vary a lot in cost.** One server may end up with all the slow work. Try least connections.
- **No health checks, or checks that are too shallow.** A server that answers "OK" but cannot reach its database is still broken for users.

```check
{"prompt": "A user logs in on server A, which stores the login in its own memory. The next request goes to server B. What happens?", "options": ["Server B knows the user, since servers share memory automatically", "The load balancer logs the user in again", "Server B does not know the user, so they appear logged out"], "answer": 2, "explanation": "Servers do not share memory. Either make requests sticky to server A, or better, keep login data in a shared store so any server can handle the user."}
```

## Recap

- A **load balancer** sits in front of identical servers and shares out requests.
- Rules include **round-robin** and **least connections**.
- **Health checks** remove broken servers from rotation automatically.
- Keep servers **stateless** so any of them can answer anyone.
- Run more than one balancer, or it becomes the weak point.
