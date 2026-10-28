---
title: "eMudhra: eight CA private keys recoverable in under a second"
date: "2026-10-17"
updated: "2026-10-27"
severity: "critical"
tags: ["security", "pki", "tls", "certificates"]
relatesTo: ["web/security", "web/networking"]
summary: "Eight eMudhra intermediate CA keys had tiny private values and could be recovered from their public certificates. Browsers and OS vendors distrusted them within days; eMudhra says it is leaving the TLS business."
sources:
  - title: "BleepingComputer: Mozilla, Google, Apple block compromised eMudhra CA certificates"
    url: "https://www.bleepingcomputer.com/news/security/mozilla-google-apple-block-compromised-emudhra-ca-certificates/"
  - title: "BleepingComputer: Microsoft releases Windows OOB updates to distrust eMudhra certificates"
    url: "https://www.bleepingcomputer.com/news/microsoft/microsoft-releases-windows-oob-updates-to-distrust-emudhra-certificates/"
  - title: "Qualys: identifying compromised eMudhra certificates"
    url: "https://blog.qualys.com/product-tech/2026/10/23/how-to-identify-compromised-emudhra-certificates-with-qualys-cve-2026-111943-and-cve-2026-111944"
  - title: "Aikido: eMudhra CA compromise, eight weak private keys"
    url: "https://www.aikido.dev/blog/emudhra-ca-compromise"
check:
  prompt: "Why could anyone recover these CA private keys just from the public certificates?"
  options:
    - "The private values were tiny (below 256), so trying every value is instant"
    - "The keys used RSA-512, which consumer GPUs can factor in a few minutes"
    - "The private keys were embedded in the certificates by a misconfigured HSM"
    - "The certificates used SHA-1 signatures, so collisions revealed the key"
  answer: 0
  explanation: "An elliptic-curve private key is a number that must be drawn uniformly from a huge range (about 2^384 for P-384). These were reportedly below 256, so an attacker can simply try every value until one matches the public key. The curve was fine; key generation was not."
---

## What happened

On **17 Oct 2026** an independent researcher reported that **eight eMudhra
intermediate CA private keys** could be recovered almost instantly. The keys
were on the P-384 curve, but each private value was reportedly **below 256**,
so anyone with the public certificate could brute-force the key. Six of the
intermediates were for **TLS** and two for **code signing**.

- **Chrome and Firefox** blocked the certificates within hours. **Apple**
  followed on 19 Oct and **Microsoft** on 20 Oct. eMudhra revoked all eight.
- On **27 Oct** Microsoft shipped **out-of-band Windows updates** that remove
  related certificates from the Windows trust list, for systems that can't
  receive automatic trust-list updates.
- **Blast radius looks small:** Google reported no Certificate Transparency
  entries issued from the six TLS intermediates. eMudhra says only one of the
  eight was ever used, with none issued to customers.
- eMudhra has reportedly announced it will **leave the TLS certificate
  business**. It says its Indian digital-signature (DSC) and eSign services are
  unaffected.

## Why it matters to you

If anyone could recover a CA key, they could sign **certificates for any
domain** your clients trust, or **sign code** your Windows machines would run.
This also shows how fast the ecosystem acts: distrust took hours to days,
while a weak CA key could have gone unnoticed for years. If you run .NET
services on Windows, or build images with pinned CA bundles, that's where
stale trust lives.

## The fundamentals behind it

| Fundamental | How it applies here |
|---|---|
| **Key generation is the whole game** | ECC security assumes the private key is uniformly random over ~2^384 values. A strong curve with a tiny key is no security at all. Always use a vetted CSPRNG or HSM. |
| **Chain of trust** | Clients trust a root; intermediates borrow that trust. Compromise an intermediate and everything below it is suspect. |
| **Revocation vs distrust** | Revocation (CRL/OCSP) relies on clients checking; many soft-fail. Browsers and OS vendors also ship *distrust lists*, which is why they could block these immediately. |
| **Certificate Transparency** | CT logs make every publicly trusted TLS certificate auditable, which let Google say quickly that no TLS certs had been issued from these intermediates. |

## What to do

1. Keep OS and browser trust stores updated (apply Microsoft's OOB update on servers without automatic trust-list updates).
2. Check custom CA bundles in Docker images and Java/.NET trust stores for eMudhra intermediates.
3. If you sign code, make sure your pipeline's signing key lives in an HSM or Key Vault, never in a repo or build agent.
