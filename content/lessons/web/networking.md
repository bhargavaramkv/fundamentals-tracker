---
title: "Networking: DNS, TCP, TLS & Kubernetes"
summary: "What happens before the first byte, and how traffic actually reaches a pod."
---

## Before the first HTTP byte

1. **DNS**: browser cache → OS cache → recursive resolver → root → TLD → authoritative server. Results are cached for the record's **TTL**.
2. **TCP handshake**: SYN, SYN-ACK, ACK = **1 RTT**.
3. **TLS 1.3 handshake** = **1 RTT** (TLS 1.2 = 2). Resumption with 0-RTT is possible, but 0-RTT data can be replayed, so only send idempotent requests that way.
4. Then the HTTP request.

So a cold HTTPS request costs at least 2 RTTs before the request goes out. Connection reuse, keep-alive, `preconnect` hints and HTTP/3 (which combines steps 2 and 3) all reduce that.

## DNS migrations

Lower the TTL **one old-TTL period before** the cutover, switch the record, verify, then raise the TTL again. Expect some clients to ignore TTLs.

## TCP behaviors that cause production bugs

- **Nagle + delayed ACK** add latency for small writes (disable with `TCP_NODELAY`).
- **TIME_WAIT / port exhaustion** from opening a connection per request. In .NET, reuse `HttpClient` via `IHttpClientFactory`; don't create one per call.
- **Idle timeouts** on load balancers silently drop pooled connections. Set the client's idle timeout below the LB's.

## How a Kubernetes Service routes traffic

- A **ClusterIP** is a virtual IP and nothing listens on it. **kube-proxy** (iptables or IPVS) or an eBPF CNI DNATs it to a pod IP from the **EndpointSlices**.
- Only **ready** pods are endpoints, so readiness probes directly affect traffic.
- **CoreDNS** resolves `svc.namespace.svc.cluster.local` to the ClusterIP. A **headless** Service (`clusterIP: None`) returns the pod IPs themselves.
- **Ingress / Gateway API** handles L7 HTTP routing from outside into Services.
