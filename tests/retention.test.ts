import { describe, expect, it } from "vitest";
import { computeRetention } from "@/lib/retention";
import type { AnswerLog } from "@/lib/types";

const NOW = Date.parse("2026-11-20T12:00:00Z");
let n = 0;
const ans = (questionId: string, at: string, correct: boolean, over: Partial<AnswerLog> = {}): AnswerLog => ({
  id: `a${n++}`, sessionId: "s", mode: "practice", questionId, domain: "databases", topic: "indexing", difficulty: 2, correct, selected: 0, timeMs: 8000, answeredAt: at, ...over,
});

describe("retention", () => {
  it("is empty with no answers", () => {
    const r = computeRetention([], NOW);
    expect(r.recall).toEqual({ attempts: 0, correct: 0, rate: null });
    expect(r.firstRecallAt).toBeNull();
  });

  it("counts a fast \"I don't know\" as a real first-sight miss, not a guess", () => {
    const r = computeRetention([ans("q1", "2026-11-01T10:00:00Z", false, { timeMs: 500, unsure: true, selected: -1 })], NOW);
    expect(r.guesses).toBe(0);
    expect(r.firstSight).toMatchObject({ attempts: 1, correct: 0 });
  });

  it("counts a repeat as recall only after 3+ days, and a same-day repeat as neither", () => {
    const r = computeRetention([
      ans("q1", "2026-11-01T10:00:00Z", false),
      ans("q1", "2026-11-01T11:00:00Z", true), // same day: short-term, not retention
      ans("q1", "2026-11-04T11:00:00Z", true), // 3 days after the last sighting
    ], NOW);
    expect(r.firstSight).toMatchObject({ attempts: 1, correct: 0 });
    expect(r.recall).toMatchObject({ attempts: 1, correct: 1, rate: null });
  });

  it("gives a rate from 3 attempts, per topic too", () => {
    const answers = ["q1", "q2", "q3"].flatMap((q, i) => [ans(q, "2026-11-01T10:00:00Z", true), ans(q, "2026-11-10T10:00:00Z", i < 2)]);
    const r = computeRetention(answers, NOW);
    expect(r.recall).toEqual({ attempts: 3, correct: 2, rate: 67 });
    expect(r.byTopic).toEqual([{ key: "databases/indexing", recall: { attempts: 3, correct: 2, rate: 67 } }]);
  });

  it("leaves likely guesses out of both measures but still counts them as seen", () => {
    const r = computeRetention([ans("q1", "2026-11-01T10:00:00Z", true, { timeMs: 500 }), ans("q1", "2026-11-05T10:00:00Z", true)], NOW);
    expect(r.guesses).toBe(1);
    expect(r.firstSight.attempts).toBe(0);
    expect(r.recall.attempts).toBe(1);
  });

  it("compares first-sight accuracy across two 14-day windows only with enough answers in each", () => {
    const before = Array.from({ length: 5 }, (_, i) => ans(`old${i}`, "2026-10-28T10:00:00Z", i < 2));
    const recent = Array.from({ length: 5 }, (_, i) => ans(`new${i}`, "2026-11-15T10:00:00Z", i < 4));
    expect(computeRetention([...before, ...recent], NOW).firstSightTrend).toEqual({ recent: 80, before: 40 });
    expect(computeRetention(recent, NOW).firstSightTrend).toBeNull();
  });

  it("says when the first recall check becomes possible", () => {
    expect(computeRetention([ans("q1", "2026-11-05T14:00:00Z", true)], NOW).firstRecallAt).toBe("2026-11-08T14:00:00.000Z");
  });
});
