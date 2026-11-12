import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  covers,
  createReviewRequest,
  createSession,
  deriveSession,
  isKnownEvent,
  makeEvent,
  mergeSessions,
  newId,
  parseSession,
  requestPath,
  sessionHash,
  sessionPath,
  unionMs,
} from "@/lib/journal/events";
import type { JournalSession, StoredEvent } from "@/lib/journal/types";

const T0 = Date.parse("2026-11-13T10:00:00Z");
const MIN = 60_000;
const at = (min: number) => new Date(T0 + min * MIN).toISOString();

let seq = 0;
function ev(kind: string, min: number, extra: Record<string, unknown> = {}, device = "laptop"): StoredEvent {
  seq++;
  return { id: `e${String(seq).padStart(4, "0")}`, at: at(min), device, kind, ...extra } as StoredEvent;
}

function session(events: StoredEvent[]): JournalSession {
  return { v: 1, id: "s1", createdAt: at(0), device: "laptop", subject: "HLD", source: { kind: "atlas" }, events };
}

describe("unionMs", () => {
  it("counts overlapping intervals once", () => {
    expect(unionMs([{ start: 0, end: 10 }, { start: 5, end: 15 }])).toBe(15);
  });
  it("adds disjoint intervals and ignores empty or inverted ones", () => {
    expect(unionMs([{ start: 20, end: 30 }, { start: 0, end: 10 }, { start: 40, end: 40 }, { start: 50, end: 45 }])).toBe(20);
  });
  it("handles nested and touching intervals", () => {
    expect(unionMs([{ start: 0, end: 100 }, { start: 10, end: 20 }, { start: 100, end: 110 }])).toBe(110);
  });
});

describe("deriveSession", () => {
  it("start, pause, resume, end gives the active time and ended status", () => {
    const d = deriveSession(session([ev("start", 0), ev("pause", 25), ev("resume", 35), ev("end", 50)]), T0 + 999 * MIN);
    expect(d.status).toBe("ended");
    expect(d.activeMs).toBe(40 * MIN);
    expect(d.endedAt).toBe(at(50));
  });

  it("an active session runs to now; a paused one stops", () => {
    expect(deriveSession(session([ev("start", 0)]), T0 + 12 * MIN)).toMatchObject({ status: "active", activeMs: 12 * MIN });
    expect(deriveSession(session([ev("start", 0), ev("pause", 5)]), T0 + 60 * MIN)).toMatchObject({ status: "paused", activeMs: 5 * MIN });
  });

  it("two devices running at once are counted once (union, not sum)", () => {
    // Laptop starts at 0. Phone, thinking it was paused, resumes at 10. Laptop pauses at 30.
    const d = deriveSession(session([ev("start", 0), ev("resume", 10, {}, "phone"), ev("pause", 30)]), T0 + 99 * MIN);
    expect(d.intervals).toHaveLength(2);
    expect(d.activeMs).toBe(30 * MIN);
    expect(d.status).toBe("paused");
  });

  it("a pause from any device closes every open interval", () => {
    const d = deriveSession(session([ev("start", 0), ev("resume", 5, {}, "phone"), ev("pause", 10, {}, "phone"), ev("resume", 20)]), T0 + 30 * MIN);
    expect(d.activeMs).toBe(20 * MIN);
    expect(d.status).toBe("active");
  });

  it("the latest end wins; an earlier end from another device acts as a pause", () => {
    const d = deriveSession(
      session([ev("start", 0), ev("end", 20, { learned: "laptop view" }), ev("resume", 25, {}, "phone"), ev("end", 40, { learned: "phone view" }, "phone")]),
      T0 + 99 * MIN,
    );
    expect(d.status).toBe("ended");
    expect(d.endedAt).toBe(at(40));
    expect(d.activeMs).toBe(35 * MIN);
    // Both reflections are kept: nothing is silently dropped.
    expect(d.reflections.map((r) => r.learned)).toEqual(["laptop view", "phone view"]);
  });

  it("ignores timer events after the final end", () => {
    const d = deriveSession(session([ev("start", 0), ev("end", 10)]), T0 + 99 * MIN);
    expect(d.activeMs).toBe(10 * MIN);
  });

  it("discard marks the session discarded but keeps its content", () => {
    const d = deriveSession(session([ev("start", 0), ev("note", 1, { text: "keep me" }), ev("discard", 2)]), T0 + 5 * MIN);
    expect(d.status).toBe("discarded");
    expect(d.timeline.some((t) => t.text === "keep me")).toBe(true);
  });

  it("edits replace text but keep the original; empty text hides", () => {
    const note = ev("note", 1, { text: "consistent hashing uses mod N" });
    const topic = ev("topic", 2, { text: "Sharding" });
    const d = deriveSession(
      session([ev("start", 0), note, topic, ev("edit", 3, { target: note.id, text: "consistent hashing uses a ring" }), ev("edit", 4, { target: topic.id, text: "" })]),
      T0 + 5 * MIN,
    );
    const n = d.timeline.find((t) => t.id === note.id)!;
    expect(n).toMatchObject({ text: "consistent hashing uses a ring", original: "consistent hashing uses mod N", edited: true });
    expect(d.topics).toEqual([]);
  });

  it("topics are distinct, case-insensitive, in first-mention order", () => {
    const d = deriveSession(
      session([ev("start", 0), ev("topic", 1, { text: "Caching" }), ev("topic", 2, { text: " caching " }), ev("topic", 3, { text: "CAP theorem" })]),
      T0 + 5 * MIN,
    );
    expect(d.topics).toEqual(["Caching", "CAP theorem"]);
  });

  it("orders events by time, then id, whatever order they are stored in", () => {
    const a = ev("note", 1, { text: "first" });
    const b = ev("note", 2, { text: "second" });
    const d = deriveSession(session([b, ev("start", 0), a]), T0 + 5 * MIN);
    expect(d.timeline.map((t) => t.kind)).toEqual(["start", "note", "note"]);
    expect(d.timeline[1].text).toBe("first");
  });

  it("keeps events from newer app versions but ignores them", () => {
    const d = deriveSession(session([ev("start", 0), ev("photo", 1, { path: "x.webp" })]), T0 + 5 * MIN);
    expect(d.unknownEvents).toBe(1);
    expect(d.timeline).toHaveLength(1);
  });

  it("only non-empty reflections are listed; an end with nothing still ends", () => {
    const d = deriveSession(session([ev("start", 0), ev("end", 5, { learned: "  ", unclear: "" })]), T0 + 9 * MIN);
    expect(d.status).toBe("ended");
    expect(d.reflections).toEqual([]);
  });
});

describe("mergeSessions", () => {
  const base = session([ev("start", 0)]);
  const a = { ...base, events: [...base.events, ev("note", 1, { text: "a" })] };
  const b = { ...base, events: [...base.events, ev("note", 2, { text: "b" }, "phone"), ev("pause", 3, {}, "phone")] };
  const c = { ...base, events: [...base.events, ev("topic", 4, { text: "c" })] };

  it("is a union of events by id", () => {
    expect(mergeSessions(a, b).events.map((e) => e.id).sort()).toEqual([...new Set([...a.events, ...b.events].map((e) => e.id))].sort());
  });
  it("is commutative, associative and idempotent", () => {
    const j = (s: JournalSession) => canonicalJson(s);
    expect(j(mergeSessions(a, b))).toBe(j(mergeSessions(b, a)));
    expect(j(mergeSessions(mergeSessions(a, b), c))).toBe(j(mergeSessions(a, mergeSessions(b, c))));
    expect(j(mergeSessions(a, a))).toBe(j(mergeSessions(a, a)));
    expect(j(mergeSessions(mergeSessions(a, b), b))).toBe(j(mergeSessions(a, b)));
  });
  it("covers() tells whether one copy has every event of another", () => {
    const m = mergeSessions(a, b);
    expect(covers(m, a) && covers(m, b)).toBe(true);
    expect(covers(a, b)).toBe(false);
  });
  it("refuses to merge different sessions", () => {
    expect(() => mergeSessions(a, { ...b, id: "other" })).toThrow();
  });
  it("resolves a corrupted duplicate id deterministically", () => {
    const x = { ...base, events: [{ ...base.events[0], device: "x" }] };
    expect(canonicalJson(mergeSessions(base, x))).toBe(canonicalJson(mergeSessions(x, base)));
  });
});

describe("parseSession", () => {
  it("round-trips a valid session", () => {
    const s = createSession({ subject: "HLD", source: { kind: "atlas", title: "Caching" }, objective: "cache-aside", device: "d1" }, T0);
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual({ session: s, rejected: 0 });
  });
  it("rejects a bad header", () => {
    expect(parseSession({ v: 1, id: "x" })).toBeNull();
    expect(parseSession({ ...session([]), source: { kind: "nope" } })).toBeNull();
    expect(parseSession(null)).toBeNull();
  });
  it("counts unusable events instead of hiding the problem", () => {
    const p = parseSession({ ...session([ev("start", 0)]), events: [ev("start", 0), { kind: "note" }, { id: "x", at: "not a date", device: "d", kind: "note" }] });
    expect(p?.rejected).toBe(2);
    expect(p?.session.events).toHaveLength(1);
  });
});

describe("ids, paths, hashes, requests", () => {
  it("ids are unique and sort by time", () => {
    const ids = Array.from({ length: 200 }, (_, i) => newId(T0 + i));
    expect(new Set(ids).size).toBe(200);
    expect([...ids].sort()).toEqual(ids);
  });
  it("paths use the UTC year and month of creation", () => {
    expect(sessionPath({ id: "abc", createdAt: "2026-11-30T23:30:00Z" })).toBe("journal/sessions/2026/11/abc.json");
    expect(requestPath({ id: "r1", sessionId: "abc" })).toBe("journal/requests/abc/r1.json");
  });
  it("the hash ignores event storage order and key order but changes with content", async () => {
    const s = session([ev("start", 0), ev("note", 1, { text: "x" })]);
    const shuffled = { ...s, events: [...s.events].reverse(), subject: s.subject };
    expect(await sessionHash(s)).toBe(await sessionHash(shuffled));
    expect(await sessionHash(s)).not.toBe(await sessionHash({ ...s, events: [...s.events, ev("note", 2, { text: "y" })] }));
  });
  it("a review request carries the session id and its hash", async () => {
    const s = session([ev("start", 0), ev("end", 5)]);
    const r = await createReviewRequest(s, "d1", T0);
    expect(r).toMatchObject({ v: 1, sessionId: "s1", device: "d1", inputHash: await sessionHash(s) });
  });
  it("makeEvent stamps id, time and device", () => {
    expect(makeEvent({ kind: "note", text: "hi" }, "d1", T0)).toMatchObject({ kind: "note", text: "hi", device: "d1", at: new Date(T0).toISOString() });
  });
});

describe("meta and attach events", () => {
  it("knows meta and attach, and still treats other kinds as unknown", () => {
    expect(isKnownEvent(ev("meta", 1, { subject: "x" }))).toBe(true);
    expect(isKnownEvent(ev("attach", 1, {}))).toBe(true);
    expect(isKnownEvent(ev("hologram", 1))).toBe(false);
  });

  it("derives the effective subject, objective and source: latest per field wins", () => {
    expect(deriveSession(session([ev("start", 0)]), T0 + MIN)).toMatchObject({ subject: "HLD", objective: undefined, source: { kind: "atlas" } });
    const d = deriveSession(
      session([
        ev("start", 0),
        ev("meta", 1, { subject: "System design", objective: "caching" }),
        ev("meta", 2, { source: { kind: "book", title: " DDIA " } }),
        ev("meta", 3, { subject: "Distributed systems" }),
      ]),
      T0 + 9 * MIN,
    );
    expect(d.subject).toBe("Distributed systems");
    expect(d.objective).toBe("caching");
    expect(d.source).toEqual({ kind: "book", title: "DDIA" });
  });

  it("ignores an empty subject, clears the objective with empty text, and ignores an invalid source", () => {
    const s = { ...session([ev("start", 0), ev("meta", 1, { subject: "  ", objective: "" }), ev("meta", 2, { source: { kind: "nonsense" } })]), objective: "old" };
    const d = deriveSession(s, T0 + 5 * MIN);
    expect(d.subject).toBe("HLD");
    expect(d.objective).toBeUndefined();
    expect(d.source).toEqual({ kind: "atlas" });
  });

  it("applies meta in time order even when stored out of order, and leaves the raw header untouched", () => {
    const s = session([ev("start", 0), ev("meta", 5, { subject: "later" }), ev("meta", 2, { subject: "earlier" })]);
    expect(deriveSession(s, T0 + 9 * MIN).subject).toBe("later");
    expect(s.subject).toBe("HLD");
  });

  it("meta events merge by id like any other, and do not appear in the timeline", () => {
    const m = ev("meta", 1, { subject: "X" });
    const a = session([ev("start", 0), m]);
    const b = session([m, ev("note", 2, { text: "n" })]);
    expect(mergeSessions(a, b).events).toHaveLength(3);
    expect(deriveSession(a, T0 + 5 * MIN).timeline.map((t) => t.kind)).toEqual(["start"]);
  });

  it("attach events appear in the timeline with their info", () => {
    const a = { attachmentId: "att1", mime: "image/webp", width: 10, height: 5, bytes: 123, sha256: "abc", name: "board.jpg" };
    const d = deriveSession(session([ev("start", 0), ev("attach", 1, a)]), T0 + 5 * MIN);
    expect(d.timeline[1]).toMatchObject({ kind: "attach", attachment: a });
    expect(d.unknownEvents).toBe(0);
  });

  it("edits apply to bookmark labels, with the original kept", () => {
    const b = ev("bookmark", 1, { label: "start of part 2", activeMs: 1000 });
    const d = deriveSession(session([ev("start", 0), b, ev("edit", 2, { target: b.id, text: "start of part 3" })]), T0 + 5 * MIN);
    expect(d.timeline[1]).toMatchObject({ text: "start of part 3", original: "start of part 2", edited: true });
  });
});
