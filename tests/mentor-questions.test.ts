import { describe, expect, it } from "vitest";
import { buildState } from "@/lib/mentor/run";
import { appendQuestions, bankCoverage, mergeQuestionPools, validateGeneratedQuestions, type GeneratedQuestion, type QuestionCheckContext } from "@/lib/mentor/questions";
import type { MentorPacket, Proposal } from "@/lib/mentor/types";
import type { Question } from "@/lib/types";

const FOR = "2026-11-06";
const existing: Question = {
  id: "databases-indexing-1", domain: "databases", topic: "indexing", difficulty: 1, prompt: "Which index helps a range query on created_at?",
  options: ["A B-tree on created_at", "A hash index on created_at", "A text index on created_at", "No index at all on it"], answer: 0, explanation: "B-trees keep keys ordered, so a range is one contiguous scan; a hash index can only find exact keys.",
};
const q = (n: number, over: Partial<GeneratedQuestion> = {}): GeneratedQuestion => ({
  id: `m-${FOR}-${n}`, forDate: FOR, domain: "databases", topic: "indexing", difficulty: 2,
  prompt: `Scenario ${n}: a compound index on (status, created_at) exists. Which query can't use it efficiently?`,
  options: ["Filter on created_at alone", "Filter on status alone too", "Filter on status, sort by date", "Filter on both of the fields"],
  answer: n % 4, explanation: "A compound index is ordered by its first field, so a query that skips status has to scan the whole index.",
  why: "Missed two compound-index questions on 2026-11-05", whyEvidenceIds: [], ...over,
});
const ctx: QuestionCheckContext = { forDate: FOR, existing: [existing], topicKeys: new Set(["databases/indexing"]), evidenceIds: new Set(["ev-2026-11-06-1"]) };

describe("generated questions", () => {
  it("accepts a well-formed batch, and no questions at all", () => {
    expect(validateGeneratedQuestions([q(0), q(1), q(2)], ctx)).toEqual([]);
    expect(validateGeneratedQuestions(undefined, ctx)).toEqual([]);
    expect(validateGeneratedQuestions([], ctx)).toEqual([]);
  });

  it("rejects ids that clash or don't belong to tonight", () => {
    expect(validateGeneratedQuestions([q(0, { id: "databases-indexing-1" })], ctx).join()).toMatch(/must start with|already exists/);
    expect(validateGeneratedQuestions([q(0), q(0, { prompt: "A different prompt, same id though?" })], ctx).join()).toMatch(/already exists/);
    expect(validateGeneratedQuestions([q(0, { id: "m-2026-11-01-0" })], ctx).join()).toMatch(/must start with m-2026-11-06-/);
  });

  it("rejects a repeated prompt, an unknown topic and unknown evidence", () => {
    expect(validateGeneratedQuestions([q(0, { prompt: existing.prompt.toUpperCase() })], ctx).join()).toMatch(/same prompt/);
    expect(validateGeneratedQuestions([q(0, { topic: "kubernetes" })], ctx).join()).toMatch(/unknown topic/);
    expect(validateGeneratedQuestions([q(0, { whyEvidenceIds: ["ev-made-up"] })], ctx).join()).toMatch(/unknown evidence/);
    expect(validateGeneratedQuestions([q(0, { whyEvidenceIds: ["ev-2026-11-06-1"] })], ctx)).toEqual([]);
  });

  it("rejects anything but 4 options, a missing why, and a thin explanation", () => {
    expect(validateGeneratedQuestions([q(0, { options: ["a", "b", "c"], answer: 0 })], ctx).join()).toMatch(/exactly 4/);
    expect(validateGeneratedQuestions([q(0, { why: "" })], ctx).join()).toMatch(/why is required/);
    expect(validateGeneratedQuestions([q(0, { explanation: "Because it's ordered by status." })], ctx).join()).toMatch(/explanation/);
  });

  it("rejects length tells, per question and across the batch", () => {
    const long = q(0, { options: ["A much longer correct answer that gives itself away", "Short", "Brief", "Tiny"], answer: 0 });
    expect(validateGeneratedQuestions([long], ctx).join()).toMatch(/length tell/);
    const longestEachTime = [0, 1, 2].map((n) => q(n, { options: ["Filter on created_at alone!", "Filter on status alone", "Filter on both fields", "Filter by status, sort"], answer: 0 }));
    expect(validateGeneratedQuestions(longestEachTime, ctx).join()).toMatch(/unique longest/);
  });

  it("caps a night at 12", () => {
    expect(validateGeneratedQuestions(Array.from({ length: 13 }, (_, n) => q(n)), ctx).join()).toMatch(/at most 12/);
  });

  it("appends without touching earlier questions, and never lets a generated id shadow a static one", () => {
    const first = appendQuestions(null, [q(0)]);
    const second = appendQuestions(first, [q(1)]);
    expect(second.questions.map((x) => x.id)).toEqual([`m-${FOR}-0`, `m-${FOR}-1`]);
    expect(second.questions[0]).toEqual(first.questions[0]);
    const pool = mergeQuestionPools([existing], [q(0), { ...q(1), id: existing.id }]);
    expect(pool.map((x) => x.id)).toEqual([existing.id, `m-${FOR}-0`]);
  });

  it("reports how many unseen questions each skill has left", () => {
    expect(bankCoverage([existing, q(0), q(1)], new Set([existing.id]))).toEqual([{ skillId: "databases/indexing", total: 3, unseen: 2, byDifficulty: [1, 2, 0] }]);
  });

  it("keeps questions out of the learner state", () => {
    const packet = { forDate: FOR, previousState: null, skillCatalogue: [] } as unknown as MentorPacket;
    const proposal = { schema: 1, forDate: FOR, inputHash: "h", analysis: { summary: "", improved: [], regressed: [], decisionRationale: "" }, evidence: [], profile: { skills: [], misconceptions: [], strengths: [], weaknesses: [], longTermObjectives: [] }, roadmap: { items: [], changes: [] }, plan: {} as Proposal["plan"], feedback: [], questions: [q(0)] } as Proposal;
    expect("questions" in buildState(proposal, packet, "r", "t")).toBe(false);
  });
});
