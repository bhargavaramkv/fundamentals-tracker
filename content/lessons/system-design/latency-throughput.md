---
title: "Latency, throughput & the numbers that matter"
summary: "How to measure how fast a system feels and how much it can handle, with rough numbers to reason with."
---

## The idea

Picture a water pipe. Two questions describe it. How long does one drop take to travel from one end to the other? And how much water comes out per second?

Those are two different things. A very long, very wide pipe takes a while for a drop to cross, yet delivers a lot of water each second.

Computer systems have the same two measures. **Latency** is how long one request takes, from sending to getting the answer. **Throughput** is how many requests the system handles per second. A user feels latency. Your servers feel throughput. You need to keep an eye on both.

```check
{"prompt": "A website takes 3 seconds to show one page, but can serve 10,000 visitors at the same time. Which is true?", "options": ["Latency is high and throughput is high", "Latency is low and throughput is high", "Latency is high and throughput is low"], "answer": 0, "explanation": "Each page takes 3 seconds (high latency), yet the site handles a huge number of visits per second (high throughput). The two measures are independent."}
```

## See it work

Say a coffee shop has one barista. Each coffee takes 2 minutes.

```
Latency    = 2 minutes per coffee (what one customer waits)
Throughput = 30 coffees per hour  (60 min / 2 min)
```

Hire a second barista working in parallel. Each coffee still takes 2 minutes, so latency is unchanged. But throughput doubles to 60 coffees per hour.

Now the queue. If customers arrive faster than 30 per hour, a line forms. The later customers wait in line plus 2 minutes, so what *they* experience gets much worse. A busy system slows down not because each task got slower, but because requests wait their turn.

## How it works

Some terms you will need.

- **Latency** is measured in milliseconds (ms). 1 ms is a thousandth of a second.
- **Throughput** is often written as **RPS**, requests per second.
- **Average latency can hide pain.** Imagine 99 requests at 10 ms and one at 5,000 ms. The average looks fine, but one user waited five seconds. So engineers use **percentiles**. The **p50** is the middle value: half of requests are faster. The **p99** is the value that 99 percent of requests beat, so it shows how bad the slow 1 percent are.
- **Bandwidth** is the size of the pipe: how many bytes per second can move. It is not the same as latency.

Useful rough numbers (approximate, and they change with hardware, but the orders of magnitude hold):

```
Read from memory (RAM)            ~100 nanoseconds
Read from a fast SSD              ~100 microseconds
Round trip inside one datacentre  ~0.5 milliseconds
Round trip across an ocean        ~100 milliseconds
```

Each step is roughly a thousand times slower than the one above (the last two differ by about 200 times). The lesson: avoid the slow things when you can. Keep data close, and make fewer trips.

A handy conversion: a day has about 86,400 seconds, so 1 million requests per day is only about 12 per second on average.

```check
{"prompt": "Your average latency is 50 ms, but your p99 is 4 seconds. What does this tell you?", "options": ["Everything is fine because the average is low", "About 1 in 100 requests is very slow, so some users have a bad time", "The server is exactly 4 seconds slower than before"], "answer": 1, "explanation": "The p99 is the speed that 99 percent of requests beat. A p99 of 4 seconds means the slowest 1 percent are at least that slow. The average hides this, which is why teams watch percentiles."}
```

## Where you'll meet it

- **Interviews:** "How would you handle 10,000 requests per second?" is a throughput question. "Keep it under 200 ms" is a latency goal.
- **Service goals:** teams promise things like "p99 under 300 ms". This kind of promise is often called an SLO (service level objective).
- **Choosing where to put things:** that is why companies place servers near users, and keep popular data in memory.

## Common mistakes

- **Mixing up the two.** Adding more servers usually raises throughput. It rarely makes a single request faster.
- **Trusting averages.** Always ask for p95 or p99 as well.
- **Ignoring queueing.** As a system nears its limit, waiting time grows sharply. A server at 95 percent busy is much slower than at 50 percent.
- **Quoting exact numbers from memory.** The figures above are rough. Use them to compare sizes, not to promise results.

```check
{"prompt": "Which is closest to the gap between reading one value from RAM and a round trip across an ocean?", "options": ["Both are about a millisecond", "RAM is about 1,000,000 times faster", "RAM is only about 10 times faster"], "answer": 1, "explanation": "RAM reads take around 100 nanoseconds, while a trip across an ocean takes around 100 milliseconds. That is a factor of about a million (these are approximate, but the gap is real)."}
```

## Recap

- **Latency** is the time for one request. **Throughput** is requests handled per second.
- Parallel workers raise throughput; they do not shorten each task.
- Look at **p50 / p99**, not only the average.
- Memory, disk, local network and long-distance network differ by orders of magnitude, so keep data close and trips few.
- A near-full system queues up, and latency climbs fast.
