import { describe, expect, it } from "vitest";
import { createSession, makeEvent } from "@/lib/journal/events";
import type { JournalSession } from "@/lib/journal/types";
import type { SessionReview } from "@/lib/review/types";
import { addWeeks, isoWeekOf, previousCompleteWeek, sufficiencyFor, validateWeekly, weekStartMs, weeklyActivity, type WeeklyReport } from "@/lib/review/weekly";

/** 2026-11-02 is a Monday; 2026-W45. */
const MON = Date.UTC(2026, 10, 2, 4, 0, 0);
const DAY = 86_400_000;

function ended(t: number, topic = "Caching", id?: string): JournalSession {
  const s = createSession({ subject: "HLD", source: { kind: "docs" }, device: "d" }, t);
  const events = [...s.events, makeEvent({ kind: "topic", text: topic }, "d", t + 1000), makeEvent({ kind: "difficulty", text: "hard" }, "d", t + 2000), makeEvent({ kind: "end" }, "d", t + 30 * 60_000)];
  return { ...s, ...(id ? { id } : {}), events };
}

function review(session: JournalSession): SessionReview {
  return {
    v: 1, id: `r-${session.id}`, sessionId: session.id, inputHash: "h", createdAt: "2026-11-09T00:00:00.000Z", model: "m", summary: "s",
    understood: [{ concept: "c", text: "t", evidence: [] }], misunderstandings: [], incomplete: [], unsupportedClaims: [], missingConcepts: [],
    explanationQuality: { level: "clear", note: "n", evidence: [] }, learningBehaviour: { observations: [], improvements: [] },
    nextSteps: ["x"], verificationQuestions: [{ concept: "c", question: "q" }], insufficientEvidence: false,
  };
}

describe("ISO weeks in Asia/Kolkata", () => {
  it("uses IST for the week boundary", () => {
    // Sunday 2026-11-08 20:00 UTC is Monday 01:30 IST, already the next week.
    expect(isoWeekOf(Date.UTC(2026, 10, 8, 20, 0))).toBe("2026-W46");
    expect(isoWeekOf(Date.UTC(2026, 10, 8, 18, 0))).toBe("2026-W45");
    expect(isoWeekOf(Date.UTC(2026, 10, 8, 18, 29))).toBe("2026-W45");
    expect(isoWeekOf(Date.UTC(2026, 10, 8, 18, 30))).toBe("2026-W46");
  });
  it("handles year boundaries", () => {
    expect(isoWeekOf(Date.UTC(2026, 0, 1, 12))).toBe("2026-W01");
    expect(isoWeekOf(Date.UTC(2027, 0, 1, 12))).toBe("2026-W53");
    expect(addWeeks("2026-W53", 1)).toBe("2027-W01");
    expect(addWeeks("2026-W01", -1)).toBe("2025-W52");
  });
  it("round-trips week starts and finds the previous complete week", () => {
    expect(isoWeekOf(weekStartMs("2026-W45")!)).toBe("2026-W45");
    expect(isoWeekOf(weekStartMs("2026-W45")! - 1)).toBe("2026-W44");
    expect(weekStartMs("2026-W54")).toBeNull();
    expect(previousCompleteWeek(MON)).toBe("2026-W44");
  });
});

describe("weeklyActivity", () => {
  it("counts sessions, minutes, topics, difficulty and findings, ignoring discarded sessions", () => {
    const a = ended(MON, "Caching");
    const b = ended(MON + DAY, "caching");
    const c = ended(MON + 2 * DAY, "Queues");
    const gone = { ...ended(MON + 3 * DAY), events: [...ended(MON + 3 * DAY).events, makeEvent({ kind: "discard" }, "d", MON + 3 * DAY + 5000)] };
    const other = ended(MON + 8 * DAY);
    const act = weeklyActivity([a, b, c, gone, other], [review(a), review(other)], "2026-W45", MON + 20 * DAY);
    expect(act).toMatchObject({ sessions: 3, endedSessions: 3, difficultyEvents: 3, reviews: 1 });
    expect(act.activeMinutes).toBe(90);
    expect(act.topics).toEqual(["Caching", "Queues"]);
    expect(act.findings.understood).toBe(1);
  });
});

describe("sufficiencyFor", () => {
  const weeks = (counts: number[]) => counts.flatMap((n, w) => Array.from({ length: n }, (_, i) => ended(MON + (w - 2) * 7 * DAY + i * 3600_000)));
  it("is coaching when each of the last 3 complete weeks has at least 3 ended sessions", () => {
    expect(sufficiencyFor(weeks([3, 4, 3]), "2026-W45", MON + 10 * DAY).sufficiency).toBe("coaching");
  });
  it("is activity-only with a reason when any week is short", () => {
    const r = sufficiencyFor(weeks([3, 2, 3]), "2026-W45", MON + 10 * DAY);
    expect(r.sufficiency).toBe("activity-only");
    expect(r.reason).toContain("2026-W44: 2");
  });
  it("does not count unended sessions", () => {
    const open = createSession({ subject: "x", source: { kind: "docs" }, device: "d" }, MON);
    expect(sufficiencyFor([open, open, open], "2026-W45", MON + 10 * DAY).sufficiency).toBe("activity-only");
  });
});

describe("validateWeekly", () => {
  const now = MON + 10 * DAY;
  function ctx(sessions: JournalSession[], reviews: SessionReview[]) {
    return { week: "2026-W45", sessions, reviews, nowMs: now };
  }
  function report(c: ReturnType<typeof ctx>, patch: Partial<WeeklyReport> = {}): WeeklyReport {
    return {
      v: 1, week: c.week, createdAt: "2026-11-09T05:00:00Z", model: "opus",
      sufficiency: sufficiencyFor(c.sessions, c.week, c.nowMs).sufficiency,
      activity: weeklyActivity(c.sessions, c.reviews, c.week, c.nowMs),
      improved: [], weak: [], repeatedMisunderstandings: [], revisit: [], learnNext: [], priorities: ["Revisit caching"], previousRecommendations: [],
      ...patch,
    };
  }

  it("rejects pattern claims when activity-only, and revisit/learnNext without review evidence", () => {
    const a = ended(MON);
    const b = ended(MON + DAY);
    const c = ctx([a, b], [review(a)]);
    const cite = (s: JournalSession) => [{ sessionId: s.id }];
    const f = (s: JournalSession) => [{ concept: "c", text: "t", evidence: cite(s) }];
    expect(validateWeekly(report(c), c).errors).toEqual([]);
    expect(validateWeekly(report(c, { improved: f(a) }), c).errors.join()).toContain("improved: must be empty");
    expect(validateWeekly(report(c, { weak: f(a) }), c).errors.join()).toContain("weak: must be empty");
    expect(validateWeekly(report(c, { repeatedMisunderstandings: f(a) }), c).errors.join()).toContain("repeatedMisunderstandings: must be empty");
    expect(validateWeekly(report(c, { revisit: f(a), learnNext: f(a) }), c).errors).toEqual([]);
    expect(validateWeekly(report(c, { revisit: f(b) }), c).errors.join()).toContain("has no review to cite");
  });

  it("allows pattern claims with real citations when coaching, and rejects fabricated ones", () => {
    const sessions = [-2, -1, 0].flatMap((w) => [0, 1, 2].map((i) => ended(MON + w * 7 * DAY + i * 3600_000)));
    const c = ctx(sessions, []);
    const cite = [{ sessionId: sessions[0].id, eventId: sessions[0].events[0].id }];
    expect(validateWeekly(report(c, { improved: [{ concept: "c", text: "t", evidence: cite }] }), c).errors).toEqual([]);
    expect(validateWeekly(report(c, { improved: [{ concept: "c", text: "t", evidence: [{ sessionId: "ghost" }] }] }), c).errors.join()).toContain("does not exist");
    expect(validateWeekly(report(c, { improved: [{ concept: "c", text: "t", evidence: [{ sessionId: sessions[0].id, eventId: "ghost" }] }] }), c).errors.join()).toContain("eventId");
    expect(validateWeekly(report(c, { improved: [{ concept: "c", text: "t", evidence: [] }] }), c).errors.join()).toContain("evidence");
  });

  it("checks computed fields, priorities and previous recommendations", () => {
    const a = ended(MON);
    const c = ctx([a], []);
    expect(validateWeekly(report(c, { sufficiency: "coaching" }), c).errors.join()).toContain("sufficiency");
    expect(validateWeekly(report(c, { activity: { ...weeklyActivity([a], [], c.week, c.nowMs), sessions: 9 } }), c).errors.join()).toContain("activity");
    expect(validateWeekly(report(c, { priorities: [] }), c).errors.join()).toContain("priorities");
    expect(validateWeekly(report(c, { priorities: ["a", "b", "c"] }), c).errors.join()).toContain("priorities");
    expect(validateWeekly(report(c, { week: "2026-W44" }), c).errors.join()).toContain("week");
    expect(validateWeekly(report(c, { previousRecommendations: [{ text: "t", followed: "yes", evidence: [] }] }), c).errors.join()).toContain("evidence");
    expect(validateWeekly(report(c, { previousRecommendations: [{ text: "t", followed: "unclear", evidence: [] }] }), c).errors).toEqual([]);
  });
});
