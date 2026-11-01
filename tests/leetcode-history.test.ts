import { describe, expect, it } from "vitest";
import { buildCodingAnalysis, buildCodingPacket, computeCodingStats, isLeetCodeStore, validateCodingReview, type CodingReview, type LeetCodeSubmission } from "@/lib/leetcode-history";

let n = 0;
const sub = (p: Partial<LeetCodeSubmission>): LeetCodeSubmission => ({ id: String(++n), title: "Two Sum", slug: "two-sum", number: "1", difficulty: "Easy", tags: ["array"], status: "Accepted", lang: "cpp", timestamp: 1_780_000_000, code: "x", ...p });

const review = (p: Partial<CodingReview> = {}): CodingReview => ({
  forDate: "2026-11-02",
  summary: "Guards are missing.",
  focus: [{ title: "Edge cases", why: "Both failures were empty input." }],
  mistakes: [{ pattern: "No null check", detail: "h->next on empty list", check: "Trace []", problems: ["two-sum"] }],
  nextProblems: [{ slug: "middle-of-the-linked-list", title: "Middle of the Linked List", why: "Same guard." }],
  reviews: [{ slug: "two-sum", title: "Two Sum", verdict: "improve", note: "Use a map." }],
  ...p,
});

describe("coding stats", () => {
  const subs = [
    sub({ status: "Wrong Answer", timestamp: 1000, totalCorrect: 9, totalTestcases: 10, lastTestcase: "[]\n1" }),
    sub({ status: "Runtime Error", timestamp: 1600, runtimeError: "Line 1: null pointer\nmore" }),
    sub({ timestamp: 2200, runtimePercentile: 50, memoryPercentile: 20 }),
    sub({ slug: "valid-anagram", title: "Valid Anagram", tags: ["array", "string"], timestamp: 900000, runtimePercentile: 90, memoryPercentile: 40 }),
    sub({ slug: "lru-cache", title: "LRU Cache", difficulty: "Medium", status: "Time Limit Exceeded", tags: ["design"], timestamp: 900100 }),
  ];
  const s = computeCodingStats(subs);

  it("counts totals, failures and first-try problems", () => {
    expect([s.total, s.accepted, s.problems]).toEqual([5, 2, 3]);
    expect(s.failures.map((f) => f.count)).toEqual([1, 1, 1]);
    expect(s.quarters.reduce((a, q) => a + q.firstTry, 0)).toBe(1);
  });

  it("ranks the hardest problem, with attempts and time from first submit to accept", () => {
    expect(s.hardest[0]).toMatchObject({ slug: "two-sum", attempts: 3, acceptedOnTry: 3, minutesToAccept: 20 });
    expect(s.hardest.find((h) => h.slug === "lru-cache")).toMatchObject({ acceptedOnTry: null, minutesToAccept: null });
  });

  it("only times the sitting that got accepted", () => {
    const later = computeCodingStats([sub({ status: "Wrong Answer", timestamp: 1000 }), sub({ status: "Wrong Answer", timestamp: 500000 }), sub({ timestamp: 500300 })]);
    expect(later.hardest[0].minutesToAccept).toBe(5);
  });

  it("finds near misses, first error lines, and topics with 2+ problems", () => {
    expect(s.nearMisses[0]).toMatchObject({ passed: 9, of: 10, failedOn: "[] 1" });
    expect(s.errors[0].message).toBe("Line 1: null pointer");
    expect(s.topics.map((t) => t.tag)).toEqual(["array"]);
  });

  it("handles an empty history", () => {
    expect(computeCodingStats([])).toMatchObject({ total: 0, recent: null, lastSubmittedAt: null });
  });
});

describe("coding review", () => {
  const subs = [sub({ id: "a" }), sub({ id: "b", status: "Wrong Answer" })];

  it("reviews only what's new, and nothing when all is reviewed", () => {
    const first = buildCodingPacket(subs, null, "2026-11-02");
    expect(first.decision).toBe("analyse");
    const analysis = buildCodingAnalysis(review(), first, "2026-11-02T00:00:00Z");
    expect(buildCodingPacket(subs, analysis, "2026-11-03").decision).toBe("no-new");
    const next = buildCodingPacket([...subs, sub({ id: "c" })], analysis, "2026-11-03");
    expect(next.newSubmissions.map((s) => s.id)).toEqual(["c"]);
  });

  it("caps the code sent for review but marks everything reviewed", () => {
    const many = Array.from({ length: 60 }, (_, i) => sub({ id: `m${i}`, timestamp: i }));
    const p = buildCodingPacket(many, null, "2026-11-02");
    expect(p.newSubmissions).toHaveLength(40);
    expect(p.newSubmissions[39].id).toBe("m59");
    expect(p.unreviewedCount).toBe(60);
    expect(buildCodingAnalysis(review(), p, "t").reviewedIds).toHaveLength(60);
  });

  it("keeps older problem reviews, and replaces one reviewed again", () => {
    const p1 = buildCodingPacket(subs, null, "2026-11-02");
    const a1 = buildCodingAnalysis(review({ reviews: [{ slug: "old", title: "Old", verdict: "good", note: "n" }, { slug: "two-sum", title: "Two Sum", verdict: "improve", note: "old note" }] }), p1, "t");
    const p2 = buildCodingPacket([...subs, sub({ id: "c" })], a1, "2026-11-03");
    const a2 = buildCodingAnalysis(review({ forDate: "2026-11-03" }), p2, "t");
    expect(a2.reviews.map((r) => [r.slug, r.note])).toEqual([["two-sum", "Use a map."], ["old", "n"]]);
  });

  it("accepts a good review and rejects made-up evidence", () => {
    const p = buildCodingPacket(subs, null, "2026-11-02");
    expect(validateCodingReview(review(), p)).toEqual([]);
    expect(validateCodingReview(review({ forDate: "2026-11-01" }), p)[0]).toContain("forDate");
    expect(validateCodingReview(review({ mistakes: [{ pattern: "p", detail: "d", check: "c", problems: ["never-tried"] }] }), p)[0]).toContain("unknown problem");
    expect(validateCodingReview(review({ reviews: [{ slug: "never-tried", title: "t", verdict: "good", note: "n" }] }), p)[0]).toContain("tonight");
    expect(validateCodingReview(review({ nextProblems: [{ slug: "../x", title: "t", why: "w" }] }), p)[0]).toContain("nextProblems");
    expect(validateCodingReview(null, p)).toHaveLength(1);
  });

  it("validates the store shape", () => {
    expect(isLeetCodeStore({ version: 1, username: "u", submissions: subs })).toBe(true);
    expect(isLeetCodeStore({ version: 2, submissions: [] })).toBe(false);
    expect(isLeetCodeStore({ version: 1, submissions: [{ id: 1 }] })).toBe(false);
  });
});
