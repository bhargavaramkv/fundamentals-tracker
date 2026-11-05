import { describe, expect, it } from "vitest";
import { buildCodingAnalysis, buildCodingPacket, computeCodingStats, isLeetCodeStore, summarizeProblems, validateCodingReview, type CodingReview, type LeetCodeSubmission } from "@/lib/leetcode-history";

let n = 0;
const sub = (p: Partial<LeetCodeSubmission>): LeetCodeSubmission => ({ id: String(++n), title: "Two Sum", slug: "two-sum", number: "1", difficulty: "Easy", tags: ["array"], status: "Accepted", lang: "cpp", timestamp: 1_780_000_000, code: "x", ...p });

const review = (p: Partial<CodingReview> = {}): CodingReview => ({
  forDate: "2026-11-02",
  headline: "Guards are missing on empty input.",
  trend: { direction: "steady", note: "Same two failures as last week." },
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
    expect(computeCodingStats([])).toMatchObject({ total: 0, recent: null, lastSubmittedAt: null, solved: 0, unsolved: [], lately: [], form: { previous: null } });
  });

  it("stops a problem's failures at the first pass and counts what came after separately", () => {
    const re = computeCodingStats([
      sub({ status: "Wrong Answer", timestamp: 1000 }),
      sub({ timestamp: 1100 }),
      sub({ status: "Wrong Answer", timestamp: 900000, lang: "python3" }),
      sub({ timestamp: 900100, lang: "python3" }),
    ]);
    expect(re.hardest[0]).toMatchObject({ attempts: 2, acceptedOnTry: 2, later: 2, failures: [{ status: "Wrong Answer", count: 1 }] });
  });

  it("lists unsolved problems and compares the last 10 problems with the 10 before", () => {
    const problems = Array.from({ length: 21 }, (_, i) => [
      ...(i < 10 || i === 20 ? [sub({ slug: `p${i}`, status: "Wrong Answer", timestamp: i * 1000 })] : []),
      ...(i === 20 ? [] : [sub({ slug: `p${i}`, timestamp: i * 1000 + 10 })]),
    ]).flat();
    const f = computeCodingStats(problems);
    expect(f.unsolved.map((u) => u.slug)).toEqual(["p20"]);
    expect(f.solved).toBe(20);
    expect(f.form.last).toMatchObject({ problems: 10, firstTry: 9, avgTries: 1 });
    expect(f.form.previous).toMatchObject({ problems: 10, firstTry: 1, avgTries: 1.9 });
    expect(f.lately).toHaveLength(12);
  });

  it("doesn't list the same near miss twice", () => {
    const miss = { status: "Wrong Answer", totalCorrect: 9, totalTestcases: 10, lastTestcase: "[9,9]" };
    expect(computeCodingStats([sub({ ...miss, timestamp: 1 }), sub({ ...miss, timestamp: 2 })]).nearMisses).toHaveLength(1);
  });

  it("summarises each problem's history in one line", () => {
    const [p] = summarizeProblems([sub({ status: "Wrong Answer", timestamp: 1000 }), sub({ status: "Compile Error", timestamp: 1100 }), sub({ timestamp: 900000 })]);
    expect(p).toMatchObject({ slug: "two-sum", history: ["WA", "CE", "AC"], acceptedOnTry: 3, attempts: 3, sittings: 2, firstAt: 1000, lastAt: 900000 });
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

  it("gives the nightly review every problem's history, newest first, and says what it left out", () => {
    const many = Array.from({ length: 160 }, (_, i) => sub({ slug: `p${i}`, timestamp: i }));
    const p = buildCodingPacket(many, null, "2026-11-02");
    expect(p.problems).toHaveLength(150);
    expect(p.problems[0].slug).toBe("p159");
    expect(p.problemsOmitted).toBe(10);
    expect(buildCodingPacket(subs, null, "2026-11-02").problems[0]).toMatchObject({ slug: "two-sum", history: ["AC", "WA"] });
  });

  it("reviews a large backlog over several nights, newest first, until none is left", () => {
    const many = Array.from({ length: 60 }, (_, i) => sub({ id: `m${i}`, timestamp: i }));
    const p1 = buildCodingPacket(many, null, "2026-11-02");
    expect(p1.newSubmissions).toHaveLength(40);
    expect(p1.newSubmissions[39].id).toBe("m59");
    expect(p1.unreviewedCount).toBe(60);
    const a1 = buildCodingAnalysis(review(), p1, "t");
    const p2 = buildCodingPacket(many, a1, "2026-11-03");
    expect(p2.decision).toBe("analyse");
    expect(p2.newSubmissions.map((s) => s.id)).toEqual(Array.from({ length: 20 }, (_, i) => `m${i}`));
    const a2 = buildCodingAnalysis(review({ forDate: "2026-11-03" }), p2, "t");
    expect(buildCodingPacket(many, a2, "2026-11-04").decision).toBe("no-new");
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
    expect(validateCodingReview(review({ headline: "" }), p)[0]).toContain("headline");
    expect(validateCodingReview(review({ trend: { direction: "soaring" as "steady", note: "n" } }), p)[0]).toContain("trend");
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
