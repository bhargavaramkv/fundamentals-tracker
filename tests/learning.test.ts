import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recentActivity } from "@/lib/activity";
import { attemptsFor, difficultyStats, dueProblems, nextRevisitDays, parseProblemInput, PATTERN_TOPICS, patternStats, problemStatus } from "@/lib/coding";
import { codingSolvesByTopic, computeTracks, levelFor, nextStep, REVISION_INTERVALS, topicProficiency, topicRevision, type TopicEvidence } from "@/lib/proficiency";
import { activeProgress, emptyProgress, mergeProgress, normalizeProgress, recordActivity, recordCodingAttempt, recordCodingProblem, recordRead, recordSession, summarizeSession } from "@/lib/progress";
import { isVerificationStale, resourcesForTopic, TIER_FOR_SOURCE, validateResources, type Resource } from "@/lib/resources";
import { buildTodayPlan, progressBefore, type PlanContext } from "@/lib/today";
import { DOMAINS, type CodingAttempt, type CodingProblem, type LearningActivity, type ProgressData, type Question, type TopicMeta, type TopicWorkspace } from "@/lib/types";
import { answer } from "./helpers";

const NOW = Date.parse("2026-11-01T12:00:00.000Z");
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString();
const START_OF_DAY = "2026-11-01T00:00:00.000Z";

const workspace: TopicWorkspace = {
  order: 1,
  prerequisites: [],
  objectives: ["x"],
  exercises: [
    { id: "ex1", prompt: "p", answer: "a", minutes: 5 },
    { id: "ex2", prompt: "p", answer: "a", minutes: 5 },
  ],
  practical: [{ id: "lab1", title: "t", task: "t", done: "d", minutes: 30 }],
};
const exercise = (refId: string, rating: "got-it" | "partial" | "missed", at: string): LearningActivity => ({ id: `${refId}-${at}`, domain: "dsa", topic: "hashing", kind: "exercise", refId, rating, at });
const practical: LearningActivity = { id: "p1", domain: "dsa", topic: "hashing", kind: "practical", refId: "lab1", at: iso(1) };
const a = (id: string, correct: boolean, difficulty: 1 | 2 | 3, daysAgo: number) => answer({ questionId: id, topic: "hashing", correct, difficulty, answeredAt: iso(daysAgo) });
const none: TopicEvidence = { answers: [], reads: [], activities: [], codingSolves: [] };
const read = { id: "r", domain: "dsa" as const, topic: "hashing", openedAt: iso(1), durationMs: 600_000 };

describe("proficiency", () => {
  const level = (e: Partial<TopicEvidence>) =>
    levelFor(computeTracks({ ...none, ...e }, workspace, NOW)).level;

  it("reading alone never counts for more than reading", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ ...read, id: `r${i}` }));
    expect(level({ reads: many })).toBe("reading");
    const resources: LearningActivity[] = [{ id: "x", domain: "dsa", topic: "hashing", kind: "resource", refId: "mit", at: iso(1) }];
    expect(level({ activities: resources })).toBe("reading");
    expect(levelFor(computeTracks({ ...none, reads: many }, workspace, NOW)).needs[0]).toMatch(/doesn't count as mastery/);
  });

  it("starts at not-started, and any retrieval moves it to practising", () => {
    expect(level({})).toBe("not-started");
    expect(level({ answers: [a("q1", false, 1, 1)] })).toBe("practising");
  });

  it("quizzes alone stop at developing: proficient needs an exercise", () => {
    const answers = [a("q1", true, 1, 1), a("q2", true, 2, 1), a("q3", true, 3, 1)];
    expect(level({ answers })).toBe("developing");
    expect(level({ answers, activities: [exercise("ex1", "got-it", iso(1))] })).toBe("proficient");
  });

  it("mastery needs quizzes, all exercises, practical work and more than one day", () => {
    const answers = [a("q1", true, 1, 5), a("q2", true, 2, 1), a("q3", true, 3, 1)];
    const exercises = [exercise("ex1", "got-it", iso(1)), exercise("ex2", "got-it", iso(1))];
    expect(level({ answers, activities: exercises })).toBe("proficient");
    expect(level({ answers, activities: [...exercises, practical] })).toBe("mastered");
    const oneDay = [a("q1", true, 1, 1), a("q2", true, 2, 1), a("q3", true, 3, 1)];
    expect(level({ answers: oneDay, activities: [...exercises, practical] })).toBe("proficient");
  });

  it("two unaided coding solves can stand in for the practical work", () => {
    const answers = [a("q1", true, 1, 5), a("q2", true, 2, 1), a("q3", true, 3, 1)];
    const exercises = [exercise("ex1", "got-it", iso(1)), exercise("ex2", "got-it", iso(1))];
    expect(level({ answers, activities: exercises, codingSolves: [iso(1)] })).toBe("proficient");
    expect(level({ answers, activities: exercises, codingSolves: [iso(1), iso(2)] })).toBe("mastered");
  });

  it("the latest exercise rating wins, and a later miss takes proficiency away", () => {
    const answers = [a("q1", true, 1, 1), a("q2", true, 2, 1), a("q3", true, 3, 1)];
    expect(level({ answers, activities: [exercise("ex1", "got-it", iso(3)), exercise("ex1", "missed", iso(1))] })).toBe("developing");
  });

  it("explains what's missing", () => {
    const { needs } = levelFor(computeTracks({ ...none, answers: [a("q1", true, 1, 1)] }, workspace, NOW));
    expect(needs.join(" ")).toMatch(/at least 3 different questions/);
    expect(needs.join(" ")).toMatch(/exercise/);
  });

  it("suggests read, then quiz, then exercise, then practical", () => {
    const step = (e: Partial<TopicEvidence>) => nextStep(computeTracks({ ...none, ...e }, workspace, NOW));
    expect(step({})).toBe("read");
    expect(step({ reads: [read] })).toBe("quiz");
    const answers = [a("q1", true, 1, 1), a("q2", true, 2, 1), a("q3", true, 3, 1)];
    expect(step({ reads: [read], answers })).toBe("exercise");
    const exercises = [exercise("ex1", "got-it", iso(1)), exercise("ex2", "got-it", iso(1))];
    expect(step({ reads: [read], answers, activities: exercises })).toBe("practical");
    expect(step({ reads: [read], answers, activities: [...exercises, practical] })).toBe("check");
  });
});

describe("topic revision", () => {
  const rev = (answers: ReturnType<typeof answer>[], activities: LearningActivity[] = []) => topicRevision("dsa/hashing", { answers, activities }, NOW);

  it("is nothing until you've been tested: reading doesn't schedule a revision", () => {
    expect(rev([])).toBeNull();
    expect(rev([], [{ id: "x", domain: "dsa", topic: "hashing", kind: "resource", refId: "m", at: iso(1) }])).toBeNull();
  });

  it("starts at one day and comes due", () => {
    const r = rev([a("q1", true, 1, 3)]);
    expect(r?.step).toBe(0);
    expect(r?.isDue).toBe(true);
    expect(r?.overdueDays).toBe(2);
    expect(rev([a("q1", true, 1, 0)])?.isDue).toBe(false);
  });

  it("stretches the interval with spaced successes", () => {
    const r = rev([a("q1", true, 1, 20), a("q2", true, 1, 19), a("q3", true, 1, 16), a("q4", true, 1, 9)]);
    expect(r?.step).toBe(3);
    expect(Date.parse(r?.dueAt as string) - Date.parse(r?.lastAt as string)).toBe(REVISION_INTERVALS[3] * 86_400_000);
  });

  it("doesn't reward cramming: same-day and next-day repeats at a long interval don't advance it", () => {
    const spaced = [a("q1", true, 1, 30), a("q2", true, 1, 29), a("q3", true, 1, 26), a("q4", true, 1, 19)];
    const step = rev(spaced)?.step as number;
    expect(rev([...spaced, a("q5", true, 1, 18)])?.step).toBe(step);
  });

  it("a failed day moves it back two steps", () => {
    const spaced = [a("q1", true, 1, 30), a("q2", true, 1, 29), a("q3", true, 1, 26), a("q4", true, 1, 19)];
    const step = rev(spaced)?.step as number;
    expect(rev([...spaced, a("q5", false, 1, 2)])?.step).toBe(step - 2);
  });

  it("counts exercises as retrieval", () => {
    expect(rev([], [exercise("ex1", "got-it", iso(1))])?.isDue).toBe(true);
  });
});

describe("coding", () => {
  const problem = (id: string, over: Partial<CodingProblem> = {}): CodingProblem => ({ id, title: id, difficulty: "medium", patterns: ["arrays-hashing"], notes: "", createdAt: iso(30), updatedAt: iso(30), ...over });
  const attempt = (problemId: string, outcome: CodingAttempt["outcome"], daysAgo: number, id = `${problemId}-${daysAgo}`): CodingAttempt => ({ id, problemId, outcome, at: iso(daysAgo) });
  const data = (problems: CodingProblem[], attempts: CodingAttempt[]): ProgressData => ({ ...emptyProgress(), codingProblems: problems, codingAttempts: attempts });

  it.each([
    ["https://leetcode.com/problems/two-sum/", { id: "lc-two-sum", title: "Two Sum", url: "https://leetcode.com/problems/two-sum/" }],
    ["https://leetcode.com/problems/two-sum/description/?envType=x", { id: "lc-two-sum", title: "Two Sum", url: "https://leetcode.com/problems/two-sum/" }],
    ["https://www.leetcode.com/problems/word-break-ii/", { id: "lc-word-break-ii", title: "Word Break II", url: "https://leetcode.com/problems/word-break-ii/" }],
    ["1. Two Sum", { id: "lc-two-sum", title: "Two Sum", number: 1 }],
    ["Two Sum", { id: "lc-two-sum", title: "Two Sum" }],
  ])("parses %s", (input, expected) => {
    expect(parseProblemInput(input)).toEqual(expected);
  });

  it("rejects links that aren't LeetCode problems, and never guesses a link from a title", () => {
    expect(parseProblemInput("https://example.com/problems/two-sum")).toBeNull();
    expect(parseProblemInput("https://leetcode.com/explore/")).toBeNull();
    expect(parseProblemInput("   ")).toBeNull();
    expect(parseProblemInput("Two Sum")?.url).toBeUndefined();
  });

  it("the same problem from a link and from a title gets one id, so it merges across devices", () => {
    expect(parseProblemInput("Two Sum")?.id).toBe(parseProblemInput("https://leetcode.com/problems/two-sum/")?.id);
  });

  it("schedules a retry by how the last attempt went", () => {
    expect(nextRevisitDays([])).toBeNull();
    expect(nextRevisitDays([attempt("p", "not-solved", 1)])).toBe(3);
    expect(nextRevisitDays([attempt("p", "solved-with-help", 1)])).toBe(7);
    expect(nextRevisitDays([attempt("p", "solved", 1)])).toBe(14);
    expect(nextRevisitDays([attempt("p", "solved", 40), attempt("p", "solved", 1)])).toBe(30);
    expect(nextRevisitDays([attempt("p", "solved", 90), attempt("p", "solved", 40), attempt("p", "solved", 1)])).toBe(90);
    expect(nextRevisitDays([attempt("p", "solved", 90), attempt("p", "solved", 40), attempt("p", "solved", 20), attempt("p", "solved", 1)])).toBeNull();
    expect(nextRevisitDays([attempt("p", "solved", 40), attempt("p", "not-solved", 1)])).toBe(3);
  });

  it("finds problems due to retry, and skips deleted ones", () => {
    const d = data([problem("old"), problem("new"), problem("gone", { deletedAt: iso(1) })], [attempt("old", "not-solved", 5), attempt("new", "solved", 1), attempt("gone", "not-solved", 5)]);
    expect(dueProblems(d, NOW).map((s) => s.problem.id)).toEqual(["old"]);
    expect(problemStatus(d, problem("old"), NOW).overdueDays).toBe(2);
    expect(attemptsFor(d, "old")).toHaveLength(1);
  });

  it("calls a pattern weak from the latest attempts, and refuses to judge on one problem", () => {
    const d = data(
      [problem("a", { patterns: ["trees"] }), problem("b", { patterns: ["trees"] }), problem("c", { patterns: ["graphs"] }), problem("d", { patterns: ["heap"] }), problem("e", { patterns: ["heap"] })],
      [attempt("a", "not-solved", 5), attempt("b", "solved-with-help", 4), attempt("c", "not-solved", 5), attempt("d", "not-solved", 9), attempt("d", "solved", 1), attempt("e", "solved", 1)],
    );
    const stats = Object.fromEntries(patternStats(d).map((s) => [s.id, s.verdict]));
    expect(stats).toEqual({ trees: "weak", graphs: "too-few", heap: "strong" });
    expect(patternStats(d)[0].id).toBe("trees");
    expect(difficultyStats(d).find((s) => s.difficulty === "medium")).toEqual({ difficulty: "medium", problems: 5, unaided: 2 });
  });

  it("only unaided solves count toward a topic", () => {
    const d = data([problem("a"), problem("b", { deletedAt: iso(1) })], [attempt("a", "solved", 1), attempt("a", "solved-with-help", 2), attempt("b", "solved", 1)]);
    expect(codingSolvesByTopic(d, PATTERN_TOPICS).get("dsa/hashing")).toHaveLength(1);
    expect(topicProficiency("dsa/hashing", d, workspace, codingSolvesByTopic(d, PATTERN_TOPICS), NOW).tracks.practical.codingSolves).toBe(1);
  });
});

describe("existing data stays safe", () => {
  const legacyFile = {
    version: 1,
    updatedAt: "2026-10-29T00:00:00.000Z",
    answers: [answer({ id: "old-1", correct: true, answeredAt: "2026-10-29T00:00:00.000Z" })],
    sessions: [{ id: "s1", mode: "practice", startedAt: "2026-10-29T00:00:00.000Z", finishedAt: "2026-10-29T00:00:00.000Z", total: 1, correct: 1, domainScores: {} }],
    reviews: {},
    reads: [{ id: "r1", domain: "dsa", topic: "hashing", openedAt: "2026-10-29T00:00:00.000Z", durationMs: 30000 }],
  };

  it("loads a progress file from before these fields existed, keeping every record", () => {
    const d = normalizeProgress(legacyFile);
    expect(d.answers.map((x) => x.id)).toEqual(["old-1"]);
    expect(d.sessions.map((x) => x.id)).toEqual(["s1"]);
    expect(d.reads.map((x) => x.id)).toEqual(["r1"]);
    expect(d).toMatchObject({ version: 1, activities: [], codingProblems: [], codingAttempts: [] });
  });

  it("merging with an old-format copy loses nothing on either side", () => {
    const withNew: ProgressData = {
      ...normalizeProgress(legacyFile),
      activities: [exercise("ex1", "got-it", iso(1))],
      codingProblems: [{ id: "lc-x", title: "X", difficulty: "easy", patterns: [], notes: "", createdAt: iso(1), updatedAt: iso(1) }],
      codingAttempts: [{ id: "at1", problemId: "lc-x", at: iso(1), outcome: "solved" }],
    };
    for (const merged of [mergeProgress(withNew, legacyFile as unknown as ProgressData), mergeProgress(legacyFile as unknown as ProgressData, withNew)]) {
      expect(merged.answers).toHaveLength(1);
      expect(merged.activities).toHaveLength(1);
      expect(merged.codingProblems).toHaveLength(1);
      expect(merged.codingAttempts).toHaveLength(1);
    }
  });

  it("merges two devices as a union, the newest problem edit winning", () => {
    const base = emptyProgress();
    const p: CodingProblem = { id: "lc-x", title: "X", difficulty: "easy", patterns: [], notes: "old", createdAt: iso(5), updatedAt: iso(5) };
    const one = recordCodingAttempt(recordCodingProblem(base, p), { id: "a1", problemId: "lc-x", at: iso(2), outcome: "solved" });
    const two = recordCodingAttempt(recordCodingProblem(base, { ...p, notes: "new", updatedAt: iso(1) }), { id: "a2", problemId: "lc-x", at: iso(1), outcome: "not-solved" });
    for (const merged of [mergeProgress(one, two), mergeProgress(two, one)]) {
      expect(merged.codingProblems).toHaveLength(1);
      expect(merged.codingProblems[0].notes).toBe("new");
      expect(merged.codingAttempts.map((x) => x.id)).toEqual(["a1", "a2"]);
    }
  });

  it("a soft delete survives merging with a device that still has the problem", () => {
    const p: CodingProblem = { id: "lc-x", title: "X", difficulty: "easy", patterns: [], notes: "", createdAt: iso(5), updatedAt: iso(5) };
    const merged = mergeProgress({ ...emptyProgress(), codingProblems: [p] }, { ...emptyProgress(), codingProblems: [{ ...p, deletedAt: iso(1), updatedAt: iso(1) }] });
    expect(merged.codingProblems[0].deletedAt).toBeDefined();
  });

  it("merging is idempotent for the new records", () => {
    const d = recordActivity(emptyProgress(), exercise("ex1", "got-it", iso(1)));
    expect(mergeProgress(d, d).activities).toHaveLength(1);
  });

  it("recording a session or a read keeps the new records", () => {
    const d = recordActivity(recordCodingProblem(emptyProgress(), { id: "x", title: "X", difficulty: "easy", patterns: [], notes: "", createdAt: iso(1), updatedAt: iso(1) }), exercise("ex1", "got-it", iso(1)));
    const logs = [answer({ id: "n1", correct: true })];
    const after = recordRead(recordSession(d, summarizeSession("s", "practice", iso(1), logs), logs), read);
    expect(after.activities).toHaveLength(1);
    expect(after.codingProblems).toHaveLength(1);
    expect(after.answers).toHaveLength(1);
  });

  it("archiving old answers doesn't touch the new records", () => {
    const d = recordActivity(emptyProgress(), exercise("ex1", "got-it", iso(1)));
    expect(activeProgress(d).activities).toHaveLength(1);
  });

  it("drops malformed new records rather than failing", () => {
    const d = normalizeProgress({ activities: [null, { id: 1 }, { id: "ok", at: iso(1) }], codingProblems: "nope", codingAttempts: [{ id: "noat" }] });
    expect(d.activities).toHaveLength(1);
    expect(d.codingProblems).toEqual([]);
    expect(d.codingAttempts).toEqual([]);
  });
});

describe("today's plan", () => {
  const topics: TopicMeta[] = [
    { domain: "dsa", topic: "hashing", title: "Hashing", summary: "" },
    { domain: "web", topic: "http", title: "HTTP", summary: "" },
  ];
  const questions: Question[] = ["q1", "q2", "q3"].map((id, i) => ({ id, domain: "dsa", topic: "hashing", difficulty: (i + 1) as 1 | 2 | 3, prompt: "prompt text", options: ["a", "b"], answer: 0, explanation: "explanation" }));
  const ctx: PlanContext = { topics, questions, workspaces: { "dsa/hashing": workspace, "web/http": { ...workspace, order: 2 } } };
  const plan = (d: ProgressData) => buildTodayPlan(d, ctx, NOW, START_OF_DAY);
  const withAnswers = (answers: ReturnType<typeof answer>[]): ProgressData => recordSession(emptyProgress(), summarizeSession("s", "practice", iso(9), answers), answers);

  it("starts a new learner with the baseline and one topic", () => {
    const tasks = plan(emptyProgress());
    expect(tasks.map((t) => t.kind)).toEqual(["baseline", "learn"]);
    expect(tasks[1].href).toBe("/learn/dsa/hashing/");
  });

  it("brings back missed questions and fading topics", () => {
    const tasks = plan(withAnswers([a("q1", false, 1, 5), a("q2", true, 1, 5)]));
    expect(tasks[0]).toMatchObject({ kind: "reviews", title: "Review 1 question you missed", done: false });
    expect(tasks.map((t) => t.kind)).toContain("revise");
  });

  it("gives a real reason for each task, and sends you to the right tab", () => {
    const tasks = plan(withAnswers([a("q1", true, 1, 0.9)]));
    const learn = tasks.find((t) => t.kind === "learn");
    expect(learn?.why).toBeTruthy();
    for (const t of tasks) expect(t.why.length).toBeGreaterThan(10);
    expect(tasks.find((t) => t.id === "learn:web/http")?.href).toBe("/learn/web/http/?tab=read");
  });

  it("stays stable through the day: finishing a task marks it done and doesn't change the list", () => {
    const before = withAnswers([a("q1", false, 1, 5), a("q2", true, 1, 5)]);
    const list = plan(before);
    const logs = [answer({ id: "t1", questionId: "q1", topic: "hashing", correct: true, answeredAt: iso(0) })];
    const after = recordSession(before, summarizeSession("t", "practice", iso(0), logs), logs);
    const again = plan(after);
    expect(again.map((t) => t.id)).toEqual(list.map((t) => t.id));
    expect(again.find((t) => t.kind === "reviews")?.done).toBe(true);
    expect(again.find((t) => t.kind === "revise")?.done).toBe(true);
  });

  it("marks reading as done only for a read step, and a quiz step needs answers", () => {
    const d = recordRead(withAnswers([a("q1", true, 1, 0.9)]), { ...read, id: "today", domain: "web", topic: "http", openedAt: iso(0) });
    const task = plan(d).find((t) => t.id === "learn:web/http");
    expect(task?.done).toBe(true);
  });

  it("includes coding problems due for a retry", () => {
    const d = recordCodingAttempt(recordCodingProblem(withAnswers([a("q1", true, 1, 0.9)]), { id: "lc-x", title: "Two Sum", difficulty: "easy", patterns: [], notes: "", createdAt: iso(9), updatedAt: iso(9) }), { id: "a", problemId: "lc-x", at: iso(5), outcome: "not-solved" });
    const task = plan(d).find((t) => t.kind === "coding");
    expect(task).toMatchObject({ title: "Retry Two Sum", href: "/coding/?problem=lc-x" });
  });

  it("never lists more than four tasks", () => {
    const d = withAnswers([a("q1", false, 1, 5), a("q2", false, 1, 5), a("q3", false, 1, 5)]);
    expect(plan(d).length).toBeLessThanOrEqual(4);
  });

  it("works out the plan from before today", () => {
    const d = withAnswers([a("q1", false, 1, 0)]);
    expect(progressBefore(d, START_OF_DAY).answers).toHaveLength(0);
  });
});

describe("recent activity", () => {
  it("lists every kind of evidence, newest first, labelled by kind", () => {
    const logs = [answer({ id: "n1", correct: true, answeredAt: iso(3) })];
    let d = recordSession(emptyProgress(), { ...summarizeSession("s", "practice", iso(3), logs), finishedAt: iso(3) }, logs);
    d = recordRead(d, { ...read, openedAt: iso(2) });
    d = recordActivity(d, exercise("ex1", "got-it", iso(1)));
    const rows = recentActivity(d, (k) => k);
    expect(rows.map((r) => r.kind)).toEqual(["Exercise", "Reading", "Quiz"]);
  });
});

describe("content: registry and workspaces", () => {
  const root = path.resolve(import.meta.dirname, "..", "content");
  const lessonKeys = new Set(DOMAINS.flatMap((d) => fs.readdirSync(path.join(root, "lessons", d)).filter((f) => f.endsWith(".md")).map((f) => `${d}/${f.replace(/\.md$/, "")}`)));
  const registry = JSON.parse(fs.readFileSync(path.join(root, "resources", "registry.json"), "utf8")) as Resource[];
  const spaces: Record<string, TopicWorkspace> = {};
  for (const d of DOMAINS) for (const [t, w] of Object.entries(JSON.parse(fs.readFileSync(path.join(root, "workspaces", `${d}.json`), "utf8")) as Record<string, TopicWorkspace>)) spaces[`${d}/${t}`] = w;

  it("the registry follows its rules", () => {
    expect(validateResources(registry, lessonKeys)).toEqual([]);
  });

  it("every topic has at least one authoritative source", () => {
    for (const key of lessonKeys) expect(resourcesForTopic(registry, key).filter((r) => r.tier === 1).length, key).toBeGreaterThanOrEqual(1);
  });

  it("blogs and videos can't be presented as authoritative", () => {
    expect(TIER_FOR_SOURCE.blog).toBe(3);
    expect(TIER_FOR_SOURCE.video).toBe(3);
    const bad = validateResources([{ ...registry[0], id: "x", url: "https://example.com/x", source: "blog", tier: 1 }], lessonKeys);
    expect(bad.join()).toMatch(/must be tier 3/);
    for (const r of registry) if (r.source === "blog" || r.source === "video") expect(r.tier, r.id).toBe(3);
  });

  it("rejects bad records", () => {
    const base = { ...registry[0], id: "x", url: "https://example.com/y" };
    expect(validateResources([base], lessonKeys)).toEqual([]);
    expect(validateResources([{ ...base, url: "http://example.com/y" }], lessonKeys).join()).toMatch(/https/);
    expect(validateResources([{ ...base, topics: ["no/such"] }], lessonKeys).join()).toMatch(/unknown topic/);
    expect(validateResources([{ ...base, verifiedAt: "2999-01-01" }], lessonKeys).join()).toMatch(/future/);
    expect(validateResources([base, base], lessonKeys).join()).toMatch(/duplicate id/);
  });

  it("flags a link for re-checking after six months", () => {
    expect(isVerificationStale("2026-10-30", NOW)).toBe(false);
    expect(isVerificationStale("2026-01-01", NOW)).toBe(true);
  });

  it("every lesson has a workspace with exercises and practical work, and no workspace lacks a lesson", () => {
    expect(new Set(Object.keys(spaces))).toEqual(lessonKeys);
    const ids = new Set<string>();
    for (const [key, w] of Object.entries(spaces)) {
      expect(w.objectives.length, key).toBeGreaterThan(0);
      expect(w.exercises.length, key).toBeGreaterThanOrEqual(2);
      expect(w.practical.length, key).toBeGreaterThanOrEqual(1);
      for (const x of [...w.exercises, ...w.practical]) {
        expect(ids.has(x.id), x.id).toBe(false);
        ids.add(x.id);
      }
      for (const e of w.exercises) expect(e.answer.length, e.id).toBeGreaterThan(40);
      for (const p of w.prerequisites) expect(lessonKeys.has(p), `${key} -> ${p}`).toBe(true);
    }
  });

  it("each domain has one path, in order, with no prerequisite cycles", () => {
    for (const d of DOMAINS) {
      const orders = Object.entries(spaces).filter(([k]) => k.startsWith(`${d}/`)).map(([, w]) => w.order).sort((a, b) => a - b);
      expect(orders).toEqual(orders.map((_, i) => i + 1));
    }
    const visit = (key: string, seen: string[]): void => {
      expect(seen.includes(key), `cycle at ${key}`).toBe(false);
      for (const p of spaces[key].prerequisites) visit(p, [...seen, key]);
    };
    for (const key of Object.keys(spaces)) visit(key, []);
  });
});
