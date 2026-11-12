---
title: "Networking: DNS, TCP, TLS & Kubernetes"
summary: "What happens before the first byte of an HTTPS request, the TCP bugs that bite in production, and how traffic reaches a Kubernetes pod."
---

## The idea

Before you can talk on the phone, three things happen: you look up the number, the phone rings and someone picks up, and you agree you can hear each other. Only then do you say anything useful. A secure web request does the same. It looks up the address, opens a reliable connection, sets up secret-keeping, and only then sends the actual request.

Each step takes at least one **round trip** (RTT): a message goes to the server and the reply comes back. They add up as delay. The three steps are **DNS** (name to IP address, from the URLs lesson), **TCP** (a reliable connection built on packets, from the internet basics lesson) and **TLS** (encryption, the "S" in HTTPS).

```check
{"prompt": "Why can a cold HTTPS request feel slow even when the server is fast?", "options": ["Servers wait before answering", "Several round trips happen before the request is even sent", "HTTPS makes pages bigger", "DNS answers are always slow"], "answer": 1, "explanation": "A new connection needs a DNS lookup, a TCP handshake and a TLS handshake first. Each costs at least one round trip, no matter how quick the server is."}
```

## See it work

Opening a connection. First the **TCP handshake**, three messages, so both sides agree the connection exists and agree starting numbers for the packets (SYN means "synchronise", ACK means "acknowledged"). Then **TLS** agrees on encryption keys.

```steps
{"title": "TCP handshake, then TLS 1.3, then the request", "frames": [
  {"visual": "Client                         Server\n  | SYN                          |\n  |----------------------------->|\n  |                              |", "caption": "TCP step 1: the client says hello and proposes a starting number."},
  {"visual": "Client                         Server\n  |                              |\n  |<-----------------------------|\n  |                     SYN-ACK  |", "caption": "TCP step 2: the server agrees and proposes its own number."},
  {"visual": "Client                         Server\n  | ACK                          |\n  |----------------------------->|\n  | connection open (1 RTT spent)|", "caption": "TCP step 3: the client confirms. The connection is open after one round trip."},
  {"visual": "Client                         Server\n  | ClientHello (key share)      |\n  |----------------------------->|\n  |<-----------------------------|\n  |   ServerHello, certificate   |", "caption": "TLS 1.3: the client offers key material, the server answers with its **certificate** (proof of identity) and its own key share. One more RTT."},
  {"visual": "Client                         Server\n  | encrypted: GET /orders       |\n  |----------------------------->|\n  |<-----------------------------|\n  |   encrypted: 200 OK          |", "caption": "Both sides now have a shared secret. Only now does the HTTP request travel, encrypted."}
]}
```

So a cold HTTPS request to a new server costs the DNS lookup, then **1 RTT** for TCP and **1 RTT** for TLS 1.3 (TLS 1.2 needs 2) before the request even leaves. Connection reuse (keep-alive), `preconnect` hints and HTTP/3, which merges the TCP and TLS steps, all reduce this.

```reveal
{"prompt": "Before you look: a user in Sydney is 150 ms RTT from your server in Europe. Roughly how long before their first request byte is sent on a cold connection, ignoring DNS?", "answer": "About **300 ms**: 150 ms for the TCP handshake plus 150 ms for TLS 1.3, and only then the request (another 150 ms to get the reply). Reusing the connection or serving from a nearby CDN removes most of it."}
```

## TCP bugs that bite in production

- **Port exhaustion**: opening a new connection for every request leaves many sockets in `TIME_WAIT` and can use up local ports. In .NET, reuse `HttpClient` through `IHttpClientFactory`; do not create one per call.
- **Idle timeouts**: load balancers silently drop idle pooled connections. Set the client's idle timeout below the load balancer's.
- **Nagle + delayed ACK** can add delay to small writes; `TCP_NODELAY` turns Nagle off.

```check
{"prompt": "You will change a DNS record's IP at noon tomorrow and its TTL is 1 hour. When should you lower the TTL?", "options": ["At noon tomorrow, right after the change", "Just after noon tomorrow", "At least one hour before the change", "Never, TTL is fixed"], "answer": 2, "explanation": "Caches may hold the old long TTL until it expires, so lower it at least one old-TTL period ahead. Then the change spreads quickly at cutover."}
```

Lower the TTL one old-TTL period before the cutover, switch the record, verify, then raise the TTL again. Expect some clients to ignore TTLs.

## How a Kubernetes Service routes traffic

Kubernetes runs your app as **pods** (one or more containers with their own IP, which changes whenever a pod is replaced). A **Service** gives a stable name and address in front of a changing set of pods.

- A **ClusterIP** is a virtual IP that no machine really owns. **kube-proxy** (iptables or IPVS rules) or an eBPF network plugin rewrites it to the IP of one ready pod, listed in the Service's **EndpointSlices**.
- Only **ready** pods are listed, so readiness probes directly decide who gets traffic.
- **CoreDNS** resolves `orders.shop.svc.cluster.local` to the ClusterIP. A **headless** Service (`clusterIP: None`) returns the pod IPs themselves.
- **Ingress** (or Gateway API) routes HTTP from outside into Services.

## Where you'll meet it

- DevTools Network tab timing: DNS lookup, "Initial connection", "SSL", then waiting.
- Azure Front Door, App Gateway and AKS ingress terminating TLS.
- `HttpClient` socket exhaustion, a classic .NET incident.
- Interview: "what happens when you type a URL and press Enter?"

## Common mistakes

- Creating a new `HttpClient` per request.
- Assuming a DNS change is instant.
- Sending non-idempotent requests as TLS 0-RTT data; 0-RTT data can be replayed.
- Forgetting that a pod that fails readiness silently stops receiving traffic.

## Recap

- A cold HTTPS request pays DNS + 1 RTT (TCP) + 1 RTT (TLS 1.3) before the request is sent.
- Reuse connections; HTTP/3 merges the transport and TLS handshakes.
- Lower DNS TTLs ahead of a migration.
- A Kubernetes Service is a stable virtual IP rewritten to ready pods.
