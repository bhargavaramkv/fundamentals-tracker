---
title: "How the internet works"
summary: "What the internet is, how computers find each other with addresses, and how data travels as small packets."
---

## The idea

Think of the postal system. You write a letter, put it in an envelope, write an address on it, and drop it in a box. You never drive it to the other city yourself. Many sorting offices pass it along until it arrives.

The internet works the same way. It is a huge network of connected computers. Each computer has an **address**. When one computer wants to talk to another, it wraps its message in an envelope with the address on it. Routers in between pass the envelope along until it arrives.

You don't need to know the route. You only need the address.

```check
{"prompt": "In the postal analogy, what does the address on the envelope let the network do?", "options": ["Deliver the message to the right computer", "Encrypt the message", "Make the message smaller", "Choose the colour of the website"], "answer": 0, "explanation": "An address only says where something should go. The network uses it to pass the message along until it reaches that computer."}
```

## See it work

Say your laptop wants a web page from a computer far away. Here is the trip, step by step.

```
You (laptop)                                   Server
     |                                            |
     |-- packet 1 --> [router] -> [router] ------>|
     |-- packet 2 --> [router] -> [router] ------>|
     |<-- reply ----- [router] <- [router] <------|
```

1. Your laptop cuts the request into small pieces called **packets**.
2. Each packet gets the destination address and your address (so the reply can find you).
3. Your router sends the packets towards the internet. Each router on the way looks at the address and picks the next hop.
4. The server collects the packets, puts them back in order, and reads the request.
5. The server sends its reply back the same way, also as packets.

## How it works

Now the real names for the pieces.

- A **client** is the computer that asks for something (your laptop or phone). A **server** is a computer that waits for requests and answers them. A server is just a computer that is always on and listening.
- An **IP address** is the computer's address, such as `93.184.216.34`. It is four numbers from 0 to 255 separated by dots (this is called IPv4). Newer addresses, IPv6, are longer, like `2606:2800:220:1::1`.
- A **packet** is a small chunk of data with an address attached. Splitting data into packets means one lost piece can be sent again without resending everything.
- A **router** is a device that reads a packet's destination and forwards it one step closer.
- A **protocol** is an agreed set of rules for talking. Two computers can only understand each other if they use the same protocol.
- A **port** is a number that picks one program on a computer. An IP address finds the building; a port finds the right door. Web servers usually listen on port 80 (HTTP) or 443 (HTTPS).

Two protocols do most of the work underneath the web. **IP** handles addressing and routing. **TCP** sits on top and makes delivery reliable: it numbers the packets, asks for missing ones again, and puts them back in order.

```check
{"prompt": "Why is data split into small packets instead of sent as one big block?", "options": ["Packets are always encrypted", "A lost piece can be resent without resending everything", "Routers cannot read large messages", "It makes the IP address shorter"], "answer": 1, "explanation": "Small packets can take different routes and be resent one by one if they are lost. That makes the network flexible and reliable even when single links fail."}
```

## Where you'll meet it

- **Every app you use.** Loading a web page, a video call, a game and an app update all send packets to servers.
- **`ping`.** This command-line tool sends a tiny packet to an address and tells you how long the round trip took.
- **Server settings.** When you deploy a service, you choose which port it listens on and which addresses may reach it.
- **Error messages.** "Connection refused" often means nothing is listening on that port. "Timed out" often means the packets never got an answer.
- **Interviews.** "What happens when you type a URL?" starts here.

## Common mistakes

- **Thinking the internet and the web are the same thing.** The internet is the network. The web is one service that runs on it, using HTTP. Email and games use the internet too.
- **Thinking the connection is a single wire.** There is no direct line between you and the server. Your packets can take different routes.
- **Forgetting the port.** An address alone is not enough. `93.184.216.34` and `93.184.216.34:8080` can reach two different programs.
- **Assuming the network is reliable.** Packets get lost and delayed. Good programs set timeouts and retry.

```check
{"prompt": "A server's IP address is like a building's street address. What is the port?", "options": ["The postcode of the city", "The door or room inside the building", "The postman who delivers", "The size of the letter"], "answer": 1, "explanation": "The IP address finds the computer, and the port picks which program on that computer should receive the data."}
```

## Recap

- The internet is a network of computers that pass small packets along using addresses.
- A client asks, a server answers. A server is just a computer that listens.
- An IP address finds the computer; a port finds the program.
- IP routes packets, and TCP makes sure they all arrive in order.
- The network can lose packets, so programs plan for delays and retries.
