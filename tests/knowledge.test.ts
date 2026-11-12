import { describe, expect, it } from "vitest";
import { createSession, makeEvent } from "@/lib/journal/events";
import { levelOf, normalizeConcept, reviewEvidence } from "@/lib/knowledge/levels";
import { mergeEvidence, migrate } from "@/lib/knowledge/migrate";
import type { Evidence } from "@/lib/knowledge/types";
import type { SessionReview } from "@/lib/review/types";
import type { AnswerLog } from "@/lib/types";

const DAY = 86_400_000;
const D0 = Date.UTC(2026, 10, 1);
const at = (days: number) => new Date(D0 + days * DAY).toISOString();
let n = 0;
function ev(p: Partial<Evidence> & Pick<Evidence, "kind" | "signal">): Evidence {
  n++;
  return { id: `e${n}`, concept: "caching", label: "Caching", strength: "moderate", at: at(0), source: { repo: "data", path: "x", ref: "r" }, historical: false, ...p };
}

describe("levelOf", () => {
  it("is none without evidence and exposed with any", () => {
    expect(levelOf([], D0).level).toBe("none");
    expect(levelOf([ev({ kind: "review-finding", signal: "exposed", strength: "weak" })], D0).level).toBe("exposed");
  });

  it("never gives Understood from multiple-choice answers alone", () => {
    const many = Array.from({ length: 10 }, () => ev({ kind: "mcq-answer", signal: "correct", strength: "strong" }));
    const r = levelOf(many, D0 + 30 * DAY);
    expect(r.level).toBe("exposed");
    expect(r.reasons).toContain("multiple-choice answers are weak evidence");
  });

  it("gives Understood for moderate written explanations and review findings, not weak ones", () => {
    expect(levelOf([ev({ kind: "written-explanation", signal: "correct" })], D0).level).toBe("understood");
    expect(levelOf([ev({ kind: "review-finding", signal: "correct", strength: "strong" })], D0).level).toBe("understood");
    expect(levelOf([ev({ kind: "review-finding", signal: "correct", strength: "weak" })], D0).level).toBe("exposed");
  });

  it("is cumulative: practical evidence without Understood stays Exposed", () => {
    expect(levelOf([ev({ kind: "practical", signal: "applied" })], D0).level).toBe("exposed");
    const r = levelOf([ev({ kind: "review-finding", signal: "correct" }), ev({ kind: "practical", signal: "applied" })], D0);
    expect(r.level).toBe("applied");
  });

  it("needs a delayed check at least 7 days after the first Understood evidence for Retained", () => {
    const base = ev({ kind: "review-finding", signal: "correct", at: at(0) });
    expect(levelOf([base, ev({ kind: "delayed-check", signal: "correct", at: at(6) })], D0 + 20 * DAY).level).toBe("understood");
    expect(levelOf([base, ev({ kind: "delayed-check", signal: "correct", at: at(7) })], D0 + 20 * DAY).level).toBe("retained");
    expect(levelOf([ev({ kind: "delayed-check", signal: "correct", at: at(9) })], D0 + 20 * DAY).level).toBe("exposed");
  });

  it("is due for verification after 7 days without Retained, or when contradicted", () => {
    const base = ev({ kind: "review-finding", signal: "correct", at: at(0) });
    expect(levelOf([base], D0 + 3 * DAY).dueForVerification).toBe(false);
    expect(levelOf([base], D0 + 7 * DAY).dueForVerification).toBe(true);
    const retained = [base, ev({ kind: "delayed-check", signal: "correct", at: at(8) })];
    expect(levelOf(retained, D0 + 30 * DAY).dueForVerification).toBe(false);
  });

  it("flags a later contradiction without erasing evidence or lowering the level", () => {
    const good = ev({ kind: "review-finding", signal: "correct", at: at(0) });
    const bad = ev({ kind: "review-finding", signal: "misconception", at: at(3) });
    const input = [good, bad];
    const r = levelOf(input, D0 + 4 * DAY);
    expect(r.level).toBe("understood");
    expect(r.needsReassessment).toBe(true);
    expect(r.dueForVerification).toBe(true);
    expect(r.contradictions).toEqual([bad]);
    expect(r.reasons.join()).toContain("contradicted on 2026-11-04; reassess");
    expect(input).toHaveLength(2);
  });

  it("ignores weak contradictions and ones before the level was reached", () => {
    const early = ev({ kind: "review-finding", signal: "misconception", at: at(0) });
    const good = ev({ kind: "review-finding", signal: "correct", at: at(2) });
    const weakBad = ev({ kind: "mcq-answer", signal: "incorrect", strength: "weak", at: at(3) });
    const r = levelOf([early, good, weakBad], D0 + 4 * DAY);
    expect(r.needsReassessment).toBe(false);
    expect(r.contradictions).toEqual([]);
  });
});

describe("reviewEvidence", () => {
  const s = createSession({ subject: "HLD", source: { kind: "docs" }, device: "d" }, D0);
  const session = { ...s, events: [...s.events, makeEvent({ kind: "topic", text: "  Cache   Stampede " }, "d", D0 + 1000)] };
  const f = (concept: string) => ({ concept, text: `about ${concept}`, evidence: [{ eventId: "x" }] });
  const review = {
    v: 1, id: "req1", sessionId: session.id, inputHash: "h", createdAt: at(1), model: "m", summary: "s",
    understood: [f("Cache Stampede")], misunderstandings: [f("Write path")], incomplete: [f("TTL")], unsupportedClaims: [], missingConcepts: [],
    explanationQuality: { level: "clear", note: "n", evidence: [] }, learningBehaviour: { observations: [], improvements: [] },
    nextSteps: ["a"], verificationQuestions: [{ concept: "c", question: "q" }], insufficientEvidence: false,
  } as SessionReview;

  it("maps findings and topics with the specified signals, strengths and ids", () => {
    const items = reviewEvidence(review, session);
    expect(items.map((i) => [i.id, i.concept, i.signal, i.strength])).toEqual([
      ["rev:req1:1", "cache stampede", "correct", "moderate"],
      ["rev:req1:2", "write path", "misconception", "moderate"],
      ["rev:req1:3", "ttl", "exposed", "weak"],
      ["rev:req1:4", "cache stampede", "exposed", "weak"],
    ]);
    expect(items[0].source).toEqual({ repo: "data", path: `journal/reviews/${session.id}/req1.json`, ref: "req1" });
  });

  it("is idempotent: mapping twice gives identical items", () => {
    expect(reviewEvidence(review, session)).toEqual(reviewEvidence(review, session));
  });

  it("normalises concepts", () => {
    expect(normalizeConcept("  Cache   STAMPEDE ")).toBe("cache stampede");
  });
});

describe("migration", () => {
  const EPOCH = "2026-10-28T00:00:00Z";
  const ans = (p: Partial<AnswerLog> & { id: string }): AnswerLog =>
    ({ sessionId: "s", mode: "practice", questionId: "q1", domain: "system-design", topic: "caching", difficulty: 1, correct: true, selected: 0, timeMs: 10_000, answeredAt: "2026-11-02T00:00:00Z", ...p }) as AnswerLog;
  const m = (o: Record<string, unknown>) => ({ id: "ev1", skillId: "system-design/caching", dimension: "concept", direction: "supports", strength: "moderate", source: { kind: "answer", id: "a1" }, note: "n", occurredAt: "2026-11-02T00:00:00Z", ...o });
  const run = (answers: AnswerLog[], mentor: unknown[]) =>
    migrate({ answers, questionTopics: new Map([["q1", { domain: "system-design", topic: "caching" }]]), mentor: mentor.map((raw) => ({ path: "mentor/evidence/x.jsonl", raw })), epoch: EPOCH });

  it("maps MCQ answers as weak, historical evidence and skips archived ones", () => {
    const r = run(
      [ans({ id: "a1" }), ans({ id: "a2", correct: false }), ans({ id: "a3", unsure: true }), ans({ id: "a4", timeMs: 2000 }), ans({ id: "old", answeredAt: "2026-10-01T00:00:00Z" })],
      [],
    );
    expect(r.items.map((i) => [i.id, i.signal])).toEqual([["mig:mcq:a1", "correct"], ["mig:mcq:a2", "incorrect"], ["mig:mcq:a3", "exposed"], ["mig:mcq:a4", "exposed"]]);
    expect(r.items.every((i) => i.strength === "weak" && i.historical && i.kind === "mcq-answer")).toBe(true);
    expect(r.skipped.archivedAnswers).toBe(1);
  });

  it("maps mentor entries conservatively and never to strong", () => {
    const r = run([ans({ id: "a1" })], [m({ strength: "strong" })]);
    const item = r.items.find((i) => i.id === "mig:mentor:ev1")!;
    expect(item).toMatchObject({ kind: "mcq-answer", signal: "correct", strength: "weak", historical: true });
    expect(item.note).toContain("strong");
  });

  it("leaves unclear mentor entries for reassessment, and drops exact duplicates", () => {
    const r = run(
      [ans({ id: "a1" })],
      [
        m({ id: "n", direction: "neutral" }),
        m({ id: "rd", source: { kind: "read", id: "x" } }),
        m({ id: "gone", source: { kind: "answer", id: "missing" } }),
        m({ id: "dis", direction: "contradicts" }),
        m({ id: "dupe" }),
        m({ id: "dupe" }),
        undefined,
      ],
    );
    expect(r.skipped.uncertain.map((u) => u.id).sort()).toEqual(["dis", "gone", "mentor/evidence/x.jsonl:?", "n", "rd"].sort());
    expect(r.skipped.duplicateMentor).toBe(1);
    expect(r.items.filter((i) => i.id.startsWith("mig:mentor:"))).toHaveLength(1);
  });

  it("merges by id without changing existing items, and is byte-stable", () => {
    const first = run([ans({ id: "a1" })], []).items;
    const file = mergeEvidence(null, first);
    const changed = first.map((i) => ({ ...i, signal: "incorrect" as const }));
    const again = mergeEvidence(file, [...changed, ...run([ans({ id: "a0" })], []).items]);
    expect(again.items.map((i) => i.id)).toEqual(["mig:mcq:a0", "mig:mcq:a1"]);
    expect(again.items.find((i) => i.id === "mig:mcq:a1")!.signal).toBe("correct");
    expect(JSON.stringify(mergeEvidence(again, [...first, ...run([ans({ id: "a0" })], []).items]))).toBe(JSON.stringify(again));
  });
});
