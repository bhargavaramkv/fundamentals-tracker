import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/mentor/Markdown";
import { MemoryStore } from "@/lib/idb";
import { createSession, makeEvent } from "@/lib/journal/events";
import type { JournalSession } from "@/lib/journal/types";
import type { Evidence } from "@/lib/knowledge/types";
import { buildConcepts, filterConcepts } from "@/lib/mentor/concepts";
import { parseMarkdown } from "@/lib/mentor/markdown";
import { parseReview } from "@/lib/mentor/parse";
import { discussPrompt, reviewNowPrompt } from "@/lib/mentor/prompts";
import { GitHubMentorSource, loadMentor, type MentorSource } from "@/lib/mentor/remote";
import type { SessionReview } from "@/lib/review/types";

const NOW = Date.parse("2026-12-01T10:00:00Z");

function review(over: Partial<SessionReview> = {}): SessionReview {
  return {
    v: 1, id: "r1", sessionId: "s1", inputHash: "h", createdAt: "2026-11-10T10:00:00Z", model: "sonnet", summary: "Good session.",
    understood: [{ concept: "Caching", text: "Explained cache-aside.", evidence: [{ eventId: "e1", quote: "cache" }] }],
    misunderstandings: [], incomplete: [], unsupportedClaims: [], missingConcepts: [],
    explanationQuality: { level: "clear", note: "ok", evidence: [] },
    learningBehaviour: { observations: [], improvements: [] },
    nextSteps: ["Read more"], verificationQuestions: [{ concept: "Caching", question: "Why TTL jitter?" }], insufficientEvidence: false,
    ...over,
  };
}

/** A fake data repo: path -> text. Blob shas are derived from the text, so changed text means a new sha. */
function fakeSource(files: Record<string, string>) {
  const sha = (t: string) => `sha-${t.length}-${[...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)}`;
  const byPath = new Map(Object.entries(files).map(([p, t]) => [p, sha(t)]));
  const blobs = new Map(Object.values(files).map((t) => [sha(t), t]));
  const fetched: string[] = [];
  const src: MentorSource = {
    tree: async () => new Map(byPath),
    blob: async (s) => {
      fetched.push(s);
      const t = blobs.get(s);
      if (t === undefined) throw new Error("missing");
      return t;
    },
  };
  return { src, fetched };
}

const request = (id: string, sid: string) => JSON.stringify({ v: 1, id, sessionId: sid, requestedAt: "2026-11-11T10:00:00Z", device: "d", inputHash: "h" });

describe("loadMentor", () => {
  const files = {
    "journal/reviews/s1/r1.json": JSON.stringify(review()),
    "journal/reviews/s2/bad.json": JSON.stringify({ v: 1, nope: true }),
    "journal/reviews/s3/r3.json": "{not json",
    "journal/requests/s1/r1.json": request("r1", "s1"),
    "journal/requests/s4/r4.json": request("r4", "s4"),
    "journal/review-failures/r4.json": JSON.stringify([{ at: "2026-11-12T00:00:00Z", error: "quote mismatch" }]),
    "archive/mentor-v1/reports/2026-11-01.md": "# Report",
    "archive/mentor-v1/README.md": "# Archive",
    "README.md": "ignored",
  };

  it("parses valid files, counts invalid ones and finds pending requests", async () => {
    const { src } = fakeSource(files);
    const snap = await loadMentor(src, new MemoryStore<string>());
    expect(snap.reviews.map((r) => r.id)).toEqual(["r1"]);
    expect(snap.invalid).toBe(2);
    expect(snap.pending.map((p) => p.request.id)).toEqual(["r4"]);
    expect(snap.pending[0].failures[0].error).toBe("quote mismatch");
    expect(snap.archive.map((a) => a.name)).toEqual(["2026-11-01"]);
    expect(snap.archiveReadme).toBe("# Archive");
    expect(snap.evidence).toEqual([]);
  });

  it("skips evidence items with a bad shape and keeps the rest", async () => {
    const good: Evidence = { id: "a", concept: "x", label: "X", kind: "mcq-answer", signal: "correct", strength: "weak", at: "2026-11-01T00:00:00Z", source: { repo: "data", path: "p", ref: "r" }, historical: true };
    const { src } = fakeSource({ "knowledge/evidence.json": JSON.stringify({ v: 1, generatedBy: "t", items: [good, { id: "b" }] }) });
    const snap = await loadMentor(src, new MemoryStore<string>());
    expect(snap.evidence).toHaveLength(1);
    expect(snap.invalid).toBe(1);
  });

  it("refetches only changed blobs and works offline from the cache", async () => {
    const cache = new MemoryStore<string>();
    const first = fakeSource(files);
    await loadMentor(first.src, cache);
    const second = fakeSource(files);
    await loadMentor(second.src, cache);
    expect(second.fetched).toEqual([]);

    const changed = fakeSource({ ...files, "journal/reviews/s1/r1.json": JSON.stringify(review({ summary: "Changed." })) });
    const snap = await loadMentor(changed.src, cache);
    expect(changed.fetched).toHaveLength(1);
    expect(snap.reviews[0].summary).toBe("Changed.");

    const offline: MentorSource = { tree: async () => Promise.reject(new Error("offline")), blob: async () => Promise.reject(new Error("offline")) };
    const stale = await loadMentor(offline, cache);
    expect(stale.stale).toBe(true);
    expect(stale.reviews).toHaveLength(1);
    await expect(loadMentor(offline, new MemoryStore<string>())).rejects.toThrow("offline");
  });

  it("GitHubMentorSource only issues GET requests", async () => {
    const methods: string[] = [];
    const fake = (async (_url: string, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      return new Response(JSON.stringify({ object: { sha: "c" } }), { status: 404 });
    }) as unknown as typeof fetch;
    expect((await new GitHubMentorSource("tok", fake).tree()).size).toBe(0);
    expect(methods).toEqual(["GET"]);
  });
});

describe("parseReview", () => {
  it("rejects wrong shapes and unknown versions", () => {
    expect(parseReview(null)).toBeNull();
    expect(parseReview({ ...review(), v: 2 })).toBeNull();
    expect(parseReview({ ...review(), nextSteps: "no" })).toBeNull();
    expect(parseReview(review())?.summary).toBe("Good session.");
  });
});

function sessionWith(topic: string, id = "s1"): JournalSession {
  let s: JournalSession = { ...createSession({ subject: "HLD", source: { kind: "atlas" }, device: "d" }, NOW - 30 * 86_400_000), id };
  s = { ...s, events: [...s.events, { ...makeEvent({ kind: "topic", text: topic }, "d", NOW - 29 * 86_400_000), id: "e1" }] };
  return s;
}

describe("buildConcepts", () => {
  it("groups by normalised concept, merges the three sources and takes the level from levelOf", () => {
    const stored: Evidence = { id: "m1", concept: "caching", label: "Caching", subject: "HLD", kind: "mcq-answer", signal: "correct", strength: "weak", at: "2026-10-01T00:00:00Z", source: { repo: "data", path: "p", ref: "r" }, historical: true };
    const rows = buildConcepts({ evidence: [stored], reviews: [review()], sessions: [sessionWith("  CACHING "), sessionWith("Sharding", "s2")], now: NOW });
    const caching = rows.find((r) => r.key === "caching")!;
    expect(caching.evidence.map((e) => e.id).sort()).toEqual(["m1", "rev:r1:1", "rev:r1:2"]);
    expect(caching.result.level).toBe("understood");
    expect(caching.result.dueForVerification).toBe(true);
    expect(caching.sessions.map((s) => s.id)).toEqual(["s1"]);
    const sharding = rows.find((r) => r.key === "sharding")!;
    expect(sharding.result.level).toBe("exposed");
  });

  it("multiple-choice answers alone stay Exposed", () => {
    const mcq: Evidence = { id: "m1", concept: "x", label: "X", kind: "mcq-answer", signal: "correct", strength: "strong", at: "2026-10-01T00:00:00Z", source: { repo: "data", path: "p", ref: "r" }, historical: true };
    const rows = buildConcepts({ evidence: [mcq], reviews: [], sessions: [], now: NOW });
    expect(rows[0].result.level).toBe("exposed");
  });

  it("filters by query, subject and level", () => {
    const rows = buildConcepts({ evidence: [], reviews: [review()], sessions: [sessionWith("Sharding")], now: NOW });
    expect(filterConcepts(rows, { query: "shard", subject: "all", level: "all" }).map((r) => r.key)).toEqual(["sharding"]);
    expect(filterConcepts(rows, { query: "", subject: "all", level: "due" }).map((r) => r.key)).toEqual(["caching"]);
    expect(filterConcepts(rows, { query: "", subject: "Nope", level: "all" })).toEqual([]);
  });
});

describe("markdown", () => {
  it("parses headings, lists, bold, code and paragraphs", () => {
    const blocks = parseMarkdown("# Title\n\n- **Outcome:** ok\n- `x`\n\nText line\nmore\n\n```\ncode <b>\n```");
    expect(blocks.map((b) => b.t)).toEqual(["heading", "list", "paragraph", "code"]);
  });

  it("escapes HTML instead of rendering it", () => {
    const html = renderToStaticMarkup(createElement(Markdown, { source: "# <script>alert(1)</script>\n\n- **<img src=x onerror=alert(1)>**\n\n`<b>`\n\n```\n<script>x</script>\n```" }));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("prompts", () => {
  it("builds the review-now command and a discuss prompt with the questions", () => {
    expect(reviewNowPrompt("req1")).toContain("journal-review -- context req1 --data ../fundamentals-tracker-data");
    const p = discussPrompt(review(), { subject: "HLD", topics: ["Caching"] });
    expect(p).toContain("Socratic");
    expect(p).toContain("1. [Caching] Why TTL jitter?");
  });
});
