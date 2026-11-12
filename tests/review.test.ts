import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReviewRequest, makeEvent, mergeSessions, sessionHash, sessionPath, requestPath, createSession } from "@/lib/journal/events";
import type { JournalSession, ReviewRequest } from "@/lib/journal/types";
import { buildReviewContext } from "@/lib/review/context";
import { commitReview, findPending, recordFailure, reviewPath, writeJson } from "@/lib/review/data";
import type { SessionReview } from "@/lib/review/types";
import { validateReview } from "@/lib/review/validate";

const T0 = Date.UTC(2026, 10, 2, 10, 0, 0);

/** An ended session with a topic, a note, a difficulty and a reflection. */
function fixture(t = T0, device = "d1") {
  let s = createSession({ subject: "HLD", source: { kind: "docs" }, device }, t);
  const topic = makeEvent({ kind: "topic", text: "Cache stampede" }, device, t + 1000);
  const note = makeEvent({ kind: "note", text: "A stampede happens when many requests miss at once" }, device, t + 2000);
  const hard = makeEvent({ kind: "difficulty", text: "Not sure about jitter" }, device, t + 3000);
  const end = makeEvent({ kind: "end", learned: "Coalescing helps", difficult: "TTL jitter" }, device, t + 600_000);
  s = { ...s, events: [...s.events, topic, note, hard, end] };
  return { session: s, topic, note, hard, end };
}

async function reviewFor(session: JournalSession, request: ReviewRequest, patch: Partial<SessionReview> = {}): Promise<SessionReview> {
  const note = session.events.find((e) => e.kind === "note")!;
  return {
    v: 1,
    id: request.id,
    sessionId: session.id,
    inputHash: request.inputHash,
    createdAt: "2026-11-03T05:00:00.000Z",
    model: "claude-sonnet-5-5",
    summary: "Explained cache stampedes.",
    understood: [{ concept: "cache stampede", text: "Defines it correctly.", evidence: [{ eventId: note.id, quote: "many requests miss at once" }] }],
    misunderstandings: [],
    incomplete: [],
    unsupportedClaims: [],
    missingConcepts: [{ concept: "negative caching", text: "Not mentioned.", question: "What is negative caching?", evidence: [] }],
    explanationQuality: { level: "partial", note: "Short but correct.", evidence: [{ eventId: note.id }] },
    learningBehaviour: { observations: [], improvements: [] },
    nextSteps: ["Read about request coalescing"],
    verificationQuestions: [{ concept: "ttl jitter", question: "Why add jitter to TTLs?" }],
    insufficientEvidence: false,
    ...patch,
  };
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "review-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

async function install(session: JournalSession, at = T0 + 700_000) {
  writeJson(path.join(dir, sessionPath(session)), session);
  const request = await createReviewRequest(session, "d1", at);
  writeJson(path.join(dir, requestPath(request)), request);
  return request;
}

describe("validateReview", () => {
  it("accepts a well-formed review", async () => {
    const { session } = fixture();
    const request = await createReviewRequest(session, "d1", T0 + 700_000);
    const r = validateReview(await reviewFor(session, request), { request, session, currentHash: request.inputHash });
    expect(r.errors).toEqual([]);
    expect(r.review?.sessionChangedSinceRequest).toBeUndefined();
  });

  it("rejects unknown event ids and quotes that are not exact substrings", async () => {
    const { session, note } = fixture();
    const request = await createReviewRequest(session, "d1", T0 + 700_000);
    const ctx = { request, session, currentHash: request.inputHash };
    const good = await reviewFor(session, request);
    const badEvent = { ...good, understood: [{ concept: "x", text: "y", evidence: [{ eventId: "nope" }] }] };
    expect(validateReview(badEvent, ctx).errors.join("\n")).toContain("is not an event");
    const badQuote = { ...good, understood: [{ concept: "x", text: "y", evidence: [{ eventId: note.id, quote: "Many requests miss at once" }] }] };
    expect(validateReview(badQuote, ctx).errors.join("\n")).toContain("not an exact substring");
  });

  it("quotes the text after edits, and the end reflection fields", async () => {
    const f = fixture();
    const edit = makeEvent({ kind: "edit", target: f.note.id, text: "Stampede: simultaneous misses" }, "d1", T0 + 5000);
    const session = { ...f.session, events: [...f.session.events, edit] };
    const request = await createReviewRequest(session, "d1", T0 + 700_000);
    const ctx = { request, session, currentHash: request.inputHash };
    const base = await reviewFor(session, request);
    const ev = (eventId: string, quote: string) => ({ ...base, understood: [{ concept: "c", text: "t", evidence: [{ eventId, quote }] }] });
    expect(validateReview(ev(f.note.id, "simultaneous misses"), ctx).errors).toEqual([]);
    expect(validateReview(ev(f.note.id, "many requests miss"), ctx).errors).not.toEqual([]);
    expect(validateReview(ev(f.end.id, "TTL jitter"), ctx).errors).toEqual([]);
    expect(validateReview(ev(f.session.events[0].id, "anything"), ctx).errors).not.toEqual([]);
  });

  it("checks identity fields and lengths", async () => {
    const { session } = fixture();
    const request = await createReviewRequest(session, "d1", T0 + 700_000);
    const ctx = { request, session, currentHash: request.inputHash };
    const good = await reviewFor(session, request);
    expect(validateReview({ ...good, id: "other" }, ctx).errors.join()).toContain("id:");
    expect(validateReview({ ...good, inputHash: "00" }, ctx).errors.join()).toContain("inputHash");
    expect(validateReview({ ...good, nextSteps: [] }, ctx).errors.join()).toContain("nextSteps");
    expect(validateReview({ ...good, verificationQuestions: Array(6).fill({ concept: "a", question: "b" }) }, ctx).errors.join()).toContain("verificationQuestions");
    expect(validateReview({ ...good, summary: "" }, ctx).errors.join()).toContain("summary");
    expect(validateReview({ ...good, understood: [{ concept: "c", text: "t", evidence: [] }] }, ctx).errors.join()).toContain("understood[0].evidence");
    expect(validateReview({ ...good, missingConcepts: [{ concept: "c", text: "t", evidence: [] }] }, ctx).errors.join()).toContain("question");
    expect(validateReview(null, ctx).errors).not.toEqual([]);
  });

  it("with insufficientEvidence, understood must be empty", async () => {
    const { session } = fixture();
    const request = await createReviewRequest(session, "d1", T0 + 700_000);
    const ctx = { request, session, currentHash: request.inputHash };
    const good = await reviewFor(session, request);
    expect(validateReview({ ...good, insufficientEvidence: true }, ctx).errors.join()).toContain("understood: must be empty");
    expect(validateReview({ ...good, insufficientEvidence: true, understood: [] }, ctx).errors).toEqual([]);
  });

  it("records sessionChangedSinceRequest when the session no longer hashes to the request's hash", async () => {
    const { session } = fixture();
    const request = await createReviewRequest(session, "d1", T0 + 700_000);
    const later = { ...session, events: [...session.events, makeEvent({ kind: "note", text: "later" }, "d1", T0 + 900_000)] };
    const r = validateReview(await reviewFor(session, request), { request, session: later, currentHash: await sessionHash(later) });
    expect(r.errors).toEqual([]);
    expect(r.review?.sessionChangedSinceRequest).toBe(true);
  });
});

describe("pending requests", () => {
  it("lists requests without a review, oldest first, and explains skips", async () => {
    const a = fixture(T0);
    const b = fixture(T0 + 86_400_000);
    const c = fixture(T0 + 2 * 86_400_000);
    const ra = await install(a.session, T0 + 700_000);
    const rb = await install(b.session, T0 + 86_400_000 + 700_000);
    const discarded = { ...c.session, events: [...c.session.events, makeEvent({ kind: "discard" }, "d1", T0 + 2 * 86_400_000 + 800_000)] };
    const rc = await install(discarded, T0 + 2 * 86_400_000 + 700_000);
    const orphan = await createReviewRequest(fixture(T0 + 5 * 86_400_000).session, "d1", T0 + 5 * 86_400_000);
    writeJson(path.join(dir, requestPath(orphan)), orphan);
    writeJson(path.join(dir, reviewPath(ra)), await reviewFor(a.session, ra));

    const r = findPending(dir);
    expect(r.pending.map((p) => p.requestId)).toEqual([rb.id]);
    expect(r.skipped.find((s) => s.requestId === rc.id)?.reason).toContain("discarded");
    expect(r.skipped.find((s) => s.requestId === orphan.id)?.reason).toContain("not found");
  });

  it("returns oldest first", async () => {
    const a = fixture(T0);
    const b = fixture(T0 + 86_400_000);
    const rb = await install(b.session, T0 + 86_400_000 + 700_000);
    const ra = await install(a.session, T0 + 700_000);
    expect(findPending(dir).pending.map((p) => p.requestId)).toEqual([ra.id, rb.id]);
  });
});

describe("commitReview", () => {
  it("writes once and then does nothing, leaving the file byte-identical", async () => {
    const { session } = fixture();
    const request = await install(session);
    const review = await reviewFor(session, request);
    const first = await commitReview(dir, request.id, review);
    expect(first.status).toBe("written");
    const file = path.join(dir, reviewPath(request));
    const bytes = fs.readFileSync(file, "utf8");
    const second = await commitReview(dir, request.id, { ...review, summary: "A different summary." });
    expect(second.status).toBe("exists");
    expect(fs.readFileSync(file, "utf8")).toBe(bytes);
    expect(findPending(dir).pending).toEqual([]);
  });

  it("rejects an invalid review without writing", async () => {
    const { session } = fixture();
    const request = await install(session);
    const bad = await reviewFor(session, request, { nextSteps: [] });
    const r = await commitReview(dir, request.id, bad);
    expect(r.status).toBe("rejected");
    expect(fs.existsSync(path.join(dir, reviewPath(request)))).toBe(false);
  });

  it("accepts the request's hash when the session changed, and records it", async () => {
    const { session } = fixture();
    const request = await install(session);
    writeJson(path.join(dir, sessionPath(session)), mergeSessions(session, { ...session, events: [makeEvent({ kind: "note", text: "later" }, "d2", T0 + 900_000)] }));
    const r = await commitReview(dir, request.id, await reviewFor(session, request));
    expect(r.status === "written" && r.review.sessionChangedSinceRequest).toBe(true);
  });

  it("never touches the session or request files", async () => {
    const { session } = fixture();
    const request = await install(session);
    const before = [path.join(dir, sessionPath(session)), path.join(dir, requestPath(request))].map((f) => fs.readFileSync(f, "utf8"));
    await commitReview(dir, request.id, await reviewFor(session, request));
    recordFailure(dir, request.id, "boom");
    const after = [path.join(dir, sessionPath(session)), path.join(dir, requestPath(request))].map((f) => fs.readFileSync(f, "utf8"));
    expect(after).toEqual(before);
  });
});

describe("recordFailure", () => {
  it("appends to the list and keeps earlier entries", () => {
    recordFailure(dir, "r1", "first", new Date("2026-11-03T00:00:00Z"));
    recordFailure(dir, "r1", "second", new Date("2026-11-04T00:00:00Z"));
    const list = JSON.parse(fs.readFileSync(path.join(dir, "journal/review-failures/r1.json"), "utf8"));
    expect(list).toEqual([
      { at: "2026-11-03T00:00:00.000Z", error: "first" },
      { at: "2026-11-04T00:00:00.000Z", error: "second" },
    ]);
  });
});

describe("buildReviewContext", () => {
  it("includes the timeline with event ids and labelled prior knowledge for overlapping topics", async () => {
    const earlier = fixture(T0 - 86_400_000 * 3);
    const re = await install(earlier.session, T0 - 86_400_000 * 3 + 700_000);
    await commitReview(dir, re.id, await reviewFor(earlier.session, re));
    writeJson(path.join(dir, "knowledge/evidence.json"), {
      v: 1,
      generatedBy: "test",
      items: [{ id: "e1", concept: "cache stampede", label: "Cache stampede", kind: "mcq-answer", signal: "correct", strength: "weak", at: "2026-10-30T00:00:00Z", source: { repo: "data", path: "progress.json", ref: "a1" }, historical: true }],
    });
    const { session } = fixture();
    const request = await install(session);
    const ctx = await buildReviewContext(dir, request.id);
    expect(ctx.session.timeline.map((t) => t.eventId)).toContain(session.events[1].id);
    expect(ctx.priorKnowledge.evidenceFile[0]).toMatchObject({ strength: "weak", kind: "mcq-answer", historical: true });
    expect(ctx.priorKnowledge.earlierReviews).toHaveLength(1);
    expect(JSON.stringify(ctx.priorKnowledge.earlierReviews[0])).toContain("moderate");
  });
});
