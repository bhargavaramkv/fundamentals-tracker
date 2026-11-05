import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { freshnessOf, isUsableState, mentorSessionUrl, workSince } from "@/lib/mentor/client";
import { buildPacket } from "@/lib/mentor/packet";
import { buildState, computeStatus, pointerFor } from "@/lib/mentor/run";
import { forDateOf, triggerOf } from "@/lib/mentor/time";
import type { Conversation, DimensionState, EvidenceItem, LearnerState, MentorActivity, MentorPacket, MentorStatus, Proposal, ProposedEvidence, RunRecord, SkillState, Submission } from "@/lib/mentor/types";
import { validateProposal } from "@/lib/mentor/validate";
import { emptyProgress } from "@/lib/progress";
import type { AnswerLog, Question, TopicMeta } from "@/lib/types";

const NOW = new Date("2026-11-01T19:30:00Z"); // 01:00 on 2 November in India
const FOR = "2026-11-02";
const topics: TopicMeta[] = [{ domain: "databases", topic: "indexing", title: "Indexing", summary: "" }];
const questions: Question[] = [{ id: "q1", domain: "databases", topic: "indexing", difficulty: 2, prompt: "Which?", options: ["a", "b"], answer: 0, explanation: "" }];
const SKILL = "databases/indexing";

const none: DimensionState = { level: null, confidence: "low", evidenceIds: [] };
function skill(concept: Partial<DimensionState>): SkillState {
  return { id: SKILL, title: "Indexing", dimensions: { concept: { ...none, ...concept }, problemSolving: none, reasoning: none, practical: none }, trend: "unknown", lastDemonstratedAt: null, nextRevisionAt: null };
}
const activity = (over: Partial<MentorActivity> = {}): MentorActivity => ({
  id: "a1", kind: "dialogue", title: "Diagnostic", skillIds: [SKILL], objective: "Find your baseline", why: "Nothing is known yet", whyEvidenceIds: [], noEvidenceYet: true,
  expectedOutcomes: ["A baseline"], exercise: "Talk it through", rubric: ["Explains why"], minutes: 20, resources: [], ...over,
});
const conversation = (id: string, text: string, at = "2026-11-01T10:00:00Z"): Conversation => ({ id, title: "t", startedAt: at, updatedAt: at, turns: [{ role: "mentor", text: "Why use a B-tree?" }, { role: "learner", text }] });
const submission = (id: string, answer: string): Submission => ({ id, forDate: "2026-11-01", activityId: "a1", skillIds: [SKILL], prompt: "p", answer, submittedAt: "2026-11-01T10:00:00Z" });
const answer = (id: string, at: string, over: Partial<AnswerLog> = {}): AnswerLog => ({ id, sessionId: "s", mode: "practice", questionId: "q1", domain: "databases", topic: "indexing", difficulty: 2, correct: false, selected: 1, selectedText: "b", timeMs: 3000, answeredAt: at, ...over });

function packet(over: Partial<Parameters<typeof buildPacket>[0]> = {}): MentorPacket {
  return buildPacket({ now: NOW, progress: emptyProgress(), questions, topics, resources: [], submissions: [], conversations: [], processed: new Set(), previousState: null, evidence: [], status: null, ...over });
}
function proposal(p: MentorPacket, over: Partial<Proposal> = {}, profile: Partial<Proposal["profile"]> = {}): Proposal {
  return {
    schema: 1, forDate: p.forDate, inputHash: p.inputHash,
    analysis: { summary: "s", improved: [], regressed: [], decisionRationale: "r" },
    evidence: [],
    profile: { skills: [], misconceptions: [], strengths: [], weaknesses: [], longTermObjectives: [], ...profile },
    roadmap: { items: [], changes: [] },
    plan: { forDate: p.forDate, primary: activity(), supporting: [], revision: [] },
    feedback: [],
    ...over,
  };
}
const check = (pr: unknown, p: MentorPacket, history: EvidenceItem[] = []) => validateProposal(pr, { packet: p, previous: p.previousState, history, resourceIds: new Set(["mit-6006"]) });
const ev = (id: string, source: ProposedEvidence["source"], over: Partial<ProposedEvidence> = {}): ProposedEvidence => ({ id, skillId: SKILL, dimension: "concept", direction: "supports", strength: "moderate", source, note: "n", ...over });
const past = (id: string, sessionKey: string, over: Partial<EvidenceItem> = {}): EvidenceItem => ({ ...ev(id, { kind: "submission", id: "old" }), forDate: "2026-10-30", sessionKey, occurredAt: "2026-10-30T10:00:00Z", ...over });

function stateWith(level: 0 | 1 | 2 | 3 | 4 | null, evidenceIds: string[]): LearnerState {
  const p = packet();
  const pr = proposal(p, {}, { skills: level === null ? [] : [skill({ level, evidenceIds })] });
  return { ...buildState(pr, p, "r0", "2026-11-01T00:00:00Z"), version: 3 };
}

function run(forDate: string, status: RunRecord["status"], trigger: RunRecord["trigger"] = "scheduled"): RunRecord {
  return { schema: 1, runId: forDate, forDate, trigger, startedAt: `${forDate}T00:00:00Z`, finishedAt: `${forDate}T00:05:00Z`, status, inputHash: "", promptVersion: 1, newInteractions: {}, stateVersion: null, levelChanges: [], checks: [], errors: [] };
}

describe("time", () => {
  it("plans for the India date and only counts night runs", () => {
    expect(forDateOf(NOW)).toBe(FOR);
    expect(triggerOf(NOW)).toBe("scheduled");
    expect(triggerOf(new Date("2026-11-02T07:00:00Z"))).toBe("manual");
  });
});

describe("packet", () => {
  it("bootstraps first, then processes only what's new", () => {
    expect(packet().decision).toBe("bootstrap");
    const progress = { ...emptyProgress(), answers: [answer("a1", "2026-11-01T01:00:00Z"), answer("a2", "2026-11-01T02:00:00Z")] };
    const p = packet({ progress, processed: new Set(["answer:a1"]), previousState: stateWith(null, []) });
    expect(p.decision).toBe("analyse");
    expect(p.newInteractions.answers.map((a) => a.id)).toEqual(["a2"]);
    expect(p.newInteractions.answers[0].correctOption).toBe("a");
    expect(p.facts.fastAnswers).toHaveLength(1);
  });

  it("finds a late-synced answer, which a timestamp watermark would miss", () => {
    const progress = { ...emptyProgress(), answers: [answer("late", "2026-10-29T01:00:00Z")] };
    expect(packet({ progress, previousState: stateWith(null, []) }).newInteractions.answers).toHaveLength(1);
  });

  it("keeps answers from before the rewrite as context, never as new interactions", () => {
    const progress = { ...emptyProgress(), answers: [answer("old", "2026-10-28T03:00:00Z")] };
    const p = packet({ progress, previousState: stateWith(null, []) });
    expect(p.decision).toBe("no-new-evidence");
    expect(p.newInteractions.answers).toHaveLength(0);
    expect(p.archived).toEqual({ count: 1, missedByTopic: { [SKILL]: 1 } });
  });

  it("stops when tonight already succeeded", () => {
    const status = computeStatus([run(FOR, "analysed")], null);
    expect(packet({ status, previousState: stateWith(null, []) }).decision).toBe("already-done");
  });

  it("reprocesses a conversation only after it changes", () => {
    const c = conversation("c1", "because of range scans");
    const processed = new Set([`conversation:c1@${c.updatedAt}`]);
    const previousState = stateWith(null, []);
    expect(packet({ previousState, conversations: [c], processed }).decision).toBe("no-new-evidence");
    expect(packet({ previousState, conversations: [{ ...c, updatedAt: "2026-11-01T12:00:00Z" }], processed }).decision).toBe("analyse");
  });

  it("hashes the same input the same way, and a new date differently", () => {
    expect(packet().inputHash).toBe(packet().inputHash);
    expect(packet().inputHash).not.toBe(packet({ now: new Date("2026-11-03T19:30:00Z") }).inputHash);
  });
});

describe("coding context in the packet", () => {
  it("is carried along but never changes what counts as new input", () => {
    const ctx = { problems: 3, solved: 2, lastSubmittedAt: null, recentForm: "1 of 3 solved first try", neverPassed: [], review: null };
    const base = packet();
    const withCoding = packet({ coding: ctx });
    expect(withCoding.coding).toEqual(ctx);
    expect(base.coding).toBeNull();
    expect(withCoding.inputHash).toBe(base.inputHash);
    expect(withCoding.decision).toBe(base.decision);
  });
});

describe("proposal validation", () => {
  const fb = (id = "s1") => ({ feedback: [{ submissionId: id, verdict: "partial" as const, feedback: "f" }] });

  it("accepts an honest bootstrap with nothing assessed", () => {
    const p = packet();
    expect(check(proposal(p), p).errors).toEqual([]);
  });

  it("rejects a stale or mismatched proposal", () => {
    const p = packet();
    expect(check(proposal(p, { inputHash: "x" }), p).errors.join()).toMatch(/inputHash/);
    expect(check(proposal(p, { forDate: "2026-01-01" }), p).errors.join()).toMatch(/forDate/);
    expect(check(null, p).errors).not.toEqual([]);
  });

  it("rejects a quote the learner never wrote, including the mentor's own words", () => {
    const p = packet({ conversations: [conversation("c1", "indexes speed up reads")], previousState: stateWith(null, []) });
    for (const quote of ["I fully understand B-trees", "Why use a B-tree?"]) {
      const pr = proposal(p, { evidence: [ev("e1", { kind: "conversation", id: "c1" }, { quote })] }, { skills: [skill({})] });
      expect(check(pr, p).errors.join()).toMatch(/word for word/);
    }
  });

  it("rejects written evidence with no quote, and evidence from an unknown source", () => {
    const p = packet({ submissions: [submission("s1", "text")], previousState: stateWith(null, []) });
    expect(check(proposal(p, { evidence: [ev("e1", { kind: "submission", id: "s1" })], ...fb() }, { skills: [skill({})] }), p).errors.join()).toMatch(/verbatim quote/);
    expect(check(proposal(p, { evidence: [ev("e1", { kind: "answer", id: "ghost" })], ...fb() }, { skills: [skill({})] }), p).errors.join()).toMatch(/isn't among tonight/);
  });

  it("never lets reading support a skill", () => {
    const read = { id: "r1", domain: "databases" as const, topic: "indexing", openedAt: "2026-11-01T01:00:00Z", durationMs: 60000 };
    const p = packet({ progress: { ...emptyProgress(), reads: [read] }, previousState: stateWith(null, []) });
    expect(check(proposal(p, { evidence: [ev("e1", { kind: "read", id: "r1" })] }, { skills: [skill({})] }), p).errors.join()).toMatch(/reading a lesson/);
  });

  const correct = answer("a1", "2026-11-01T01:00:00Z", { correct: true, timeMs: 9000 });

  it("won't raise a level from one ambiguous answer", () => {
    const p = packet({ progress: { ...emptyProgress(), answers: [correct] }, previousState: stateWith(null, []) });
    const pr = proposal(p, { evidence: [ev("e1", { kind: "answer", id: "a1" })] }, { skills: [skill({ level: 2, evidenceIds: ["e1"] })] });
    expect(check(pr, p).errors.join()).toMatch(/2\+ pieces/);
  });

  it("allows a modest first level from one piece of evidence", () => {
    const p = packet({ progress: { ...emptyProgress(), answers: [correct] }, previousState: stateWith(null, []) });
    const pr = proposal(p, { evidence: [ev("e1", { kind: "answer", id: "a1" })] }, { skills: [skill({ level: 1, evidenceIds: ["e1"] })] });
    expect(check(pr, p).errors).toEqual([]);
  });

  it("lets one good diagnostic establish a demonstrated baseline, but only with real proof", () => {
    const c = { ...conversation("c1", ""), turns: [{ role: "learner" as const, text: "ordering enables range scans. writes pay for it. selectivity decides whether it helps." }] };
    const p = packet({ conversations: [c], previousState: stateWith(null, []) });
    const e = (id: string, quote: string, strength: ProposedEvidence["strength"] = "strong") => ev(id, { kind: "conversation", id: "c1" }, { quote, strength });
    const good = proposal(p, { evidence: [e("e1", "ordering enables range scans"), e("e2", "writes pay for it"), e("e3", "selectivity decides")] }, { skills: [skill({ level: 3, evidenceIds: ["e1", "e2", "e3"] })] });
    expect(check(good, p).errors).toEqual([]);
    const thin = proposal(p, { evidence: [e("e1", "ordering enables range scans", "moderate"), e("e2", "writes pay for it", "moderate")] }, { skills: [skill({ level: 3, evidenceIds: ["e1", "e2"] })] });
    expect(check(thin, p).errors.join()).toMatch(/strong evidence/);
  });

  it("requires two separate sessions for a rise", () => {
    const history = [past("e0", "submission:old")];
    const p = packet({ submissions: [submission("s1", "range scans need ordering")], previousState: stateWith(1, ["e0"]), evidence: history });
    const base = { evidence: [ev("e1", { kind: "submission", id: "s1" }, { quote: "range scans need ordering" })], ...fb() };
    expect(check(proposal(p, base, { skills: [skill({ level: 2, evidenceIds: ["e1"] })] }), p, history).errors.join()).toMatch(/2\+ separate sessions/);
    expect(check(proposal(p, base, { skills: [skill({ level: 2, evidenceIds: ["e0", "e1"] })] }), p, history).errors).toEqual([]);
  });

  it("rejects a jump of more than one level, and a change with nothing new behind it", () => {
    const history = [past("e0", "a"), past("e9", "b")];
    const p = packet({ submissions: [submission("s1", "words")], previousState: stateWith(1, ["e0"]), evidence: history });
    const base = { evidence: [ev("e1", { kind: "submission", id: "s1" }, { quote: "words" })], ...fb() };
    expect(check(proposal(p, base, { skills: [skill({ level: 3, evidenceIds: ["e0", "e1"] })] }), p, history).errors.join()).toMatch(/rise by 1/);
    expect(check(proposal(p, base, { skills: [skill({ level: 2, evidenceIds: ["e0", "e9"] })] }), p, history).errors.join()).toMatch(/evidence from tonight/);
  });

  it("doesn't count self-graded exercises as proof", () => {
    const history = [past("e0", "activity:old", { source: { kind: "activity", id: "old" } })];
    const ex = { id: "x1", kind: "exercise" as const, refId: "r", rating: "got-it" as const, domain: "databases" as const, topic: "indexing", at: "2026-11-01T01:00:00Z" };
    const p = packet({ progress: { ...emptyProgress(), activities: [ex] }, previousState: stateWith(1, ["e0"]), evidence: history });
    const pr = proposal(p, { evidence: [ev("e1", { kind: "activity", id: "x1" })] }, { skills: [skill({ level: 2, evidenceIds: ["e0", "e1"] })] });
    expect(check(pr, p, history).errors.join()).toMatch(/2\+ separate sessions/);
  });

  it("needs repeated evidence before a level falls", () => {
    const history = [past("e0", "a")];
    const p = packet({ submissions: [submission("s1", "words")], previousState: stateWith(2, ["e0"]), evidence: history });
    const pr = proposal(p, { evidence: [ev("e1", { kind: "submission", id: "s1" }, { quote: "words", direction: "contradicts" })], ...fb() }, { skills: [skill({ level: 1, evidenceIds: ["e0", "e1"] })] });
    expect(check(pr, p, history).errors.join()).toMatch(/2\+ contradicting/);
  });

  it("can't drop a skill, return it to untested, or invent evidence for it", () => {
    const history = [past("e0", "a")];
    const p = packet({ submissions: [submission("s1", "w")], previousState: stateWith(2, ["e0"]), evidence: history });
    expect(check(proposal(p, fb(), { skills: [] }), p, history).errors.join()).toMatch(/history can't be dropped/);
    expect(check(proposal(p, fb(), { skills: [skill({ level: null, evidenceIds: [] })] }), p, history).errors.join()).toMatch(/tested to untested/);
    expect(check(proposal(p, fb(), { skills: [skill({ level: 2, evidenceIds: ["ghost"] })] }), p, history).errors.join()).toMatch(/unknown evidence/);
  });

  it("holds the plan to its limits", () => {
    const p = packet();
    const plan = (over: Partial<Proposal["plan"]>) => proposal(p, { plan: { forDate: p.forDate, primary: activity(), supporting: [], revision: [], ...over } });
    expect(check(plan({ supporting: [activity(), activity(), activity()] }), p).errors.join()).toMatch(/at most 2/);
    expect(check(plan({ primary: activity({ noEvidenceYet: false }) }), p).errors.join()).toMatch(/cite evidence/);
    expect(check(plan({ primary: activity({ resources: [{ id: "made-up", why: "w" }] }) }), p).errors.join()).toMatch(/isn't in the registry/);
    expect(check(plan({ primary: activity({ resources: [{ id: "mit-6006", why: "w" }] }) }), p).errors).toEqual([]);
    expect(check(plan({ primary: activity({ expectedOutcomes: [] }) }), p).errors.join()).toMatch(/expected outcomes/);
  });

  it("requires feedback on every submission, and none on work that doesn't exist", () => {
    const p = packet({ submissions: [submission("s1", "w")], previousState: stateWith(null, []) });
    expect(check(proposal(p), p).errors.join()).toMatch(/has no feedback/);
    const ghost = proposal(p, { feedback: [...fb().feedback, ...fb("ghost").feedback] });
    expect(check(ghost, p).errors.join()).toMatch(/unknown submission/);
  });
});

describe("run history", () => {
  const nights = (statuses: RunRecord["status"][]) => statuses.map((s, i) => run(`2026-11-0${i + 1}`, s));

  it("switches only after five nights in a row with at least one real analysis", () => {
    expect(computeStatus(nights(["analysed", "analysed", "analysed", "analysed"]), null).primaryEligible).toBe(false);
    expect(computeStatus(nights(["analysed", "no-new-evidence", "no-new-evidence", "no-new-evidence", "no-new-evidence"]), null).primaryEligible).toBe(true);
    expect(computeStatus(nights(["no-new-evidence", "no-new-evidence", "no-new-evidence", "no-new-evidence", "no-new-evidence"]), null).primaryEligible).toBe(false);
  });

  it("resets the streak on a failure or a gap, and ignores daytime runs", () => {
    expect(computeStatus(nights(["analysed", "failed", "analysed"]), null).consecutiveNights).toBe(1);
    const gap = computeStatus([run("2026-11-01", "analysed"), run("2026-11-03", "analysed")], null);
    expect(gap.consecutiveNights).toBe(1);
    expect(gap.missedDates).toEqual(["2026-11-02"]);
    expect(computeStatus([run("2026-11-01", "bootstrapped", "manual")], null).consecutiveNights).toBe(0);
  });

  it("counts a successful retry after a failure on the same night", () => {
    const failed = { ...run("2026-11-01", "failed"), runId: "x", finishedAt: "2026-11-01T00:01:00Z" };
    const s = computeStatus([failed, run("2026-11-01", "analysed")], null);
    expect(s.consecutiveNights).toBe(1);
    expect(s.lastRunStatus).toBe("analysed");
  });

  it("keeps the last success through a failure, and stays switched once it has passed", () => {
    const s = computeStatus(nights(["analysed", "failed"]), null);
    expect(s.lastRunStatus).toBe("failed");
    expect(s.lastSuccessForDate).toBe("2026-11-01");
    const eligible = computeStatus(nights(["analysed", "analysed", "analysed", "analysed", "analysed"]), null);
    expect(computeStatus(nights(["analysed", "failed"]), eligible).primaryEligible).toBe(true);
  });
});

describe("state and frontend", () => {
  it("works out level changes itself and numbers versions", () => {
    const p = packet({ previousState: stateWith(1, ["e0"]) });
    const st = buildState(proposal(p, {}, { skills: [skill({ level: 2, evidenceIds: ["e0", "e1"] })] }), p, "r1", "2026-11-02T00:00:00Z");
    expect(st.version).toBe(4);
    expect(st.levelChanges).toEqual([{ skillId: SKILL, dimension: "concept", from: 1, to: 2, evidenceIds: ["e0", "e1"] }]);
    expect(pointerFor(st).stateFile).toBe(`mentor/states/${st.forDate}.json`);
    expect(isUsableState(st)).toBe(true);
    expect(isUsableState({ version: 1 })).toBe(false);
  });

  it("is honest about how old a plan is", () => {
    const st = stateWith(null, []);
    expect(freshnessOf(st, NOW).kind).toBe("fresh");
    expect(freshnessOf(st, new Date("2026-11-04T04:00:00Z")).kind).toBe("carried");
    expect(freshnessOf(st, new Date("2026-11-07T04:00:00Z")).kind).toBe("stale");
  });

  it("counts a quiet night as hearing from the mentor", () => {
    const st = stateWith(null, []);
    const later = new Date("2026-11-04T04:00:00Z");
    const status = { lastSuccessForDate: forDateOf(later) } as MentorStatus;
    expect(freshnessOf(st, later).kind).toBe("carried");
    expect(freshnessOf(st, later, status)).toEqual({ kind: "fresh", ageDays: 0 });
    expect(freshnessOf(st, new Date("2026-11-09T04:00:00Z"), status).kind).toBe("stale");
  });

  it("counts only answers and exercises given after the last analysis", () => {
    const data = emptyProgress();
    data.answers.push(answer("a1", "2026-11-01T10:00:00Z"), answer("a2", "2026-11-03T10:00:00Z"));
    data.activities.push({ id: "x1", kind: "exercise", domain: "databases", topic: "indexing", refId: "e", at: "2026-11-03T11:00:00Z" } as never, { id: "x2", kind: "resource", domain: "databases", topic: "indexing", refId: "r", at: "2026-11-03T12:00:00Z" } as never);
    expect(workSince(data, "2026-11-02T00:00:00Z")).toEqual({ answers: 1, activities: 1 });
  });

  it("hands off to a Claude Code session on the data repo only", () => {
    const u = new URL(mentorSessionUrl("Hello there"));
    expect(u.origin + u.pathname).toBe("https://claude.ai/code");
    expect(u.searchParams.get("prompt")).toBe("Hello there");
    expect(u.searchParams.get("repositories")).toMatch(/fundamentals-tracker-data$/);
  });

  it("keeps API billing and gateways out of the mentor", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const files = ["lib/mentor/client.ts", "lib/mentor/packet.ts", "lib/mentor/run.ts", "lib/mentor/validate.ts", "scripts/mentor.ts"];
    for (const f of files) expect(fs.readFileSync(path.join(root, f), "utf8")).not.toMatch(/ANTHROPIC_API_KEY|@anthropic-ai\/sdk|api\.anthropic\.com/);
  });
});
