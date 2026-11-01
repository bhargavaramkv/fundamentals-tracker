import { weightedScore } from "./profile";
import type { AnswerLog, Domain, ExerciseRating, LearningActivity, ProgressData, TopicWorkspace } from "./types";

/**
 * Topic proficiency, built from evidence. Reading, quizzes, exercises and practical work are tracked separately, and
 * reading never raises a topic past "reading": being able to recognise an answer in a lesson isn't the same as being
 * able to produce it.
 */
export const LEVELS = ["not-started", "reading", "practising", "developing", "proficient", "mastered"] as const;
export type ProficiencyLevel = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<ProficiencyLevel, string> = {
  "not-started": "Not started",
  reading: "Reading only",
  practising: "Practising",
  developing: "Developing",
  proficient: "Proficient",
  mastered: "Mastered",
};

export const levelRank = (level: ProficiencyLevel) => LEVELS.indexOf(level);

/** Solving a mapped coding problem unaided counts as practical work, and takes this many to equal one lab. */
export const CODING_SOLVES_FOR_PRACTICAL = 2;

export interface TopicTracks {
  reading: { lessonReads: number; lessonMs: number; resources: number; lastAt: string | null };
  quizzes: { answers: number; distinctQuestions: number; score: number; hardestCorrect: number; days: number; lastAt: string | null };
  exercises: { total: number; attempted: number; gotIt: number; lastAt: string | null };
  practical: { total: number; done: number; codingSolves: number; lastAt: string | null };
}

export interface TopicProficiency {
  key: string;
  level: ProficiencyLevel;
  tracks: TopicTracks;
  /** What's still missing for the next level, in plain words. Empty once mastered. */
  needs: string[];
}

const dayOf = (iso: string) => iso.slice(0, 10);
const latest = (values: (string | null | undefined)[]): string | null =>
  values.reduce<string | null>((max, v) => (v && (!max || v > max) ? v : max), null);

/** Latest rating per exercise: re-doing an exercise replaces the earlier result, in both directions. */
export function latestRatings(activities: LearningActivity[]): Map<string, { rating: ExerciseRating; at: string }> {
  const out = new Map<string, { rating: ExerciseRating; at: string }>();
  for (const a of activities) {
    if (a.kind !== "exercise") continue;
    const prev = out.get(a.refId);
    if (!prev || a.at >= prev.at) out.set(a.refId, { rating: a.rating, at: a.at });
  }
  return out;
}

export interface TopicEvidence {
  answers: AnswerLog[];
  reads: ProgressData["reads"];
  activities: LearningActivity[];
  /** Times of unaided solves of coding problems mapped to this topic. */
  codingSolves: string[];
}

export function computeTracks(evidence: TopicEvidence, workspace: TopicWorkspace | undefined, now: number): TopicTracks {
  const { answers, reads, activities, codingSolves } = evidence;
  const resourceIds = new Set(activities.filter((a) => a.kind === "resource").map((a) => a.refId));
  const ratings = latestRatings(activities);
  const exerciseIds = new Set((workspace?.exercises ?? []).map((e) => e.id));
  const relevant = [...ratings].filter(([id]) => exerciseIds.has(id));
  const practicalIds = new Set((workspace?.practical ?? []).map((p) => p.id));
  const practicalDone = activities.filter((a) => a.kind === "practical" && practicalIds.has(a.refId));
  return {
    reading: {
      lessonReads: reads.length,
      lessonMs: reads.reduce((n, r) => n + r.durationMs, 0),
      resources: resourceIds.size,
      lastAt: latest([...reads.map((r) => r.openedAt), ...activities.filter((a) => a.kind === "resource").map((a) => a.at)]),
    },
    quizzes: {
      answers: answers.length,
      distinctQuestions: new Set(answers.map((a) => a.questionId)).size,
      score: weightedScore(answers, now),
      hardestCorrect: answers.reduce((m, a) => (a.correct ? Math.max(m, a.difficulty) : m), 0),
      days: new Set(answers.map((a) => dayOf(a.answeredAt))).size,
      lastAt: latest(answers.map((a) => a.answeredAt)),
    },
    exercises: {
      total: exerciseIds.size,
      attempted: relevant.length,
      gotIt: relevant.filter(([, r]) => r.rating === "got-it").length,
      lastAt: latest(relevant.map(([, r]) => r.at)),
    },
    practical: {
      total: practicalIds.size,
      done: new Set(practicalDone.map((a) => a.refId)).size,
      codingSolves: codingSolves.length,
      lastAt: latest([...practicalDone.map((a) => a.at), ...codingSolves]),
    },
  };
}

/** Whether practical work is evidenced: a finished lab, or enough unaided solves of mapped coding problems. */
export function hasPracticalEvidence(t: TopicTracks): boolean {
  return t.practical.done > 0 || t.practical.codingSolves >= CODING_SOLVES_FOR_PRACTICAL;
}

export function levelFor(t: TopicTracks): { level: ProficiencyLevel; needs: string[] } {
  const q = t.quizzes;
  const e = t.exercises;
  const anyRetrieval = q.answers > 0 || e.attempted > 0 || t.practical.done > 0 || t.practical.codingSolves > 0;
  const anyReading = t.reading.lessonReads > 0 || t.reading.resources > 0;

  const practical = hasPracticalEvidence(t);
  const developing = q.answers >= 3 && q.score >= 60;
  const proficient = q.distinctQuestions >= 3 && q.score >= 75 && q.hardestCorrect >= 2 && e.gotIt >= 1;
  const allExercises = e.total === 0 || e.gotIt >= e.total;
  const mastered = proficient && q.score >= 85 && q.hardestCorrect >= 3 && allExercises && practical && q.days >= 2;

  if (mastered) return { level: "mastered", needs: [] };
  if (proficient) {
    const needs: string[] = [];
    if (q.score < 85) needs.push(`Raise your recent quiz score to 85% (now ${q.score}%)`);
    if (q.hardestCorrect < 3) needs.push("Get a hard question right");
    if (!allExercises) needs.push(`Answer all ${e.total} exercises well (${e.gotIt} so far)`);
    if (!practical) needs.push("Complete the practical work, or solve 2 related coding problems unaided");
    if (q.days < 2) needs.push("Show it again on a different day");
    return { level: "proficient", needs };
  }
  const toProficient: string[] = [];
  if (q.distinctQuestions < 3) toProficient.push(`Answer at least 3 different questions (${q.distinctQuestions} so far)`);
  if (q.score < 75) toProficient.push(q.answers > 0 ? `Raise your recent quiz score to 75% (now ${q.score}%)` : "Score 75% on the quiz");
  if (q.hardestCorrect < 2) toProficient.push("Get an interview-level question right");
  if (e.gotIt < 1) toProficient.push("Answer an exercise well");
  if (developing) return { level: "developing", needs: toProficient };
  if (anyRetrieval) return { level: "practising", needs: toProficient };
  if (anyReading) return { level: "reading", needs: ["Reading doesn't count as mastery. Test yourself with a quiz or an exercise."] };
  return { level: "not-started", needs: ["Start with the reading, then test yourself"] };
}

export type TopicKeyed = { domain: Domain; topic: string };
export const keyOf = (t: TopicKeyed) => `${t.domain}/${t.topic}`;

/** Times you solved a problem on your own, per topic, through the problem's patterns. */
export function codingSolvesByTopic(data: ProgressData, patternTopics: Record<string, string | undefined>): Map<string, string[]> {
  const problems = new Map(data.codingProblems.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
  const out = new Map<string, string[]>();
  for (const attempt of data.codingAttempts) {
    if (attempt.outcome !== "solved") continue;
    const problem = problems.get(attempt.problemId);
    if (!problem) continue;
    const topics = new Set(problem.patterns.map((p) => patternTopics[p]).filter((t): t is string => Boolean(t)));
    for (const t of topics) out.set(t, [...(out.get(t) ?? []), attempt.at]);
  }
  return out;
}

export function evidenceFor(key: string, data: ProgressData, codingSolves: Map<string, string[]>): TopicEvidence {
  return {
    answers: data.answers.filter((a) => `${a.domain}/${a.topic}` === key),
    reads: data.reads.filter((r) => `${r.domain}/${r.topic}` === key),
    activities: data.activities.filter((a) => `${a.domain}/${a.topic}` === key),
    codingSolves: codingSolves.get(key) ?? [],
  };
}

export function topicProficiency(
  key: string,
  data: ProgressData,
  workspace: TopicWorkspace | undefined,
  codingSolves: Map<string, string[]>,
  now: number = Date.now(),
): TopicProficiency {
  const tracks = computeTracks(evidenceFor(key, data, codingSolves), workspace, now);
  return { key, tracks, ...levelFor(tracks) };
}

export type NextStep = "read" | "quiz" | "exercise" | "practical" | "check";

export const STEP_TAB: Record<NextStep, string> = { read: "read", quiz: "practice", exercise: "exercises", practical: "exercises", check: "check" };
export const STEP_LABEL: Record<NextStep, string> = {
  read: "Read the sources",
  quiz: "Practise with questions",
  exercise: "Work through an exercise",
  practical: "Do the practical work",
  check: "Take the topic check",
};
export const STEP_MINUTES: Record<NextStep, number> = { read: 20, quiz: 5, exercise: 10, practical: 30, check: 5 };

/** The most useful thing to do next on a topic: read, then retrieve, then apply. */
export function nextStep(t: TopicTracks): NextStep {
  if (t.reading.lessonReads === 0 && t.reading.resources === 0) return "read";
  if (t.quizzes.distinctQuestions < 3 || t.quizzes.score < 75) return "quiz";
  if (t.exercises.total > 0 && t.exercises.gotIt < t.exercises.total) return "exercise";
  if (!hasPracticalEvidence(t) && t.practical.total > 0) return "practical";
  return "check";
}

/* Topic-level spaced repetition. Question reviews (lib/srs.ts) bring back what you got wrong; this brings back what you
 * got right before it fades. Derived entirely from the evidence on each read, so no schedule is stored and merging
 * devices can't make it disagree. */

const DAY = 86_400_000;
/** Days until the next review, by how many spaced successes in a row you've had. */
export const REVISION_INTERVALS = [1, 3, 7, 14, 30, 60] as const;

export interface TopicRevision {
  key: string;
  lastAt: string;
  dueAt: string;
  /** How far along the intervals: each spaced success moves it up, a failure moves it back two. */
  step: number;
  isDue: boolean;
  overdueDays: number;
}

/**
 * Replays retrieval evidence (quiz answers and exercises, never reading) one day at a time. A day counts as a success
 * at 70% correct or better. Cramming doesn't help: a success only advances the step once at least half of the current
 * interval has passed.
 */
export function topicRevision(key: string, evidence: Pick<TopicEvidence, "answers" | "activities">, now: number = Date.now()): TopicRevision | null {
  const byDay = new Map<string, { hit: number; total: number; lastAt: string }>();
  const add = (at: string, hit: number) => {
    const d = dayOf(at);
    const cur = byDay.get(d) ?? { hit: 0, total: 0, lastAt: at };
    cur.hit += hit;
    cur.total += 1;
    if (at > cur.lastAt) cur.lastAt = at;
    byDay.set(d, cur);
  };
  for (const a of evidence.answers) add(a.answeredAt, a.correct ? 1 : 0);
  for (const a of evidence.activities) {
    if (a.kind === "exercise") add(a.at, a.rating === "got-it" ? 1 : a.rating === "partial" ? 0.5 : 0);
  }
  if (byDay.size === 0) return null;

  let step = 0;
  let lastDay: number | null = null;
  let lastAt = "";
  for (const day of [...byDay.keys()].sort()) {
    const { hit, total, lastAt: at } = byDay.get(day) as { hit: number; total: number; lastAt: string };
    const today = Date.parse(`${day}T00:00:00Z`);
    if (hit / total < 0.7) step = Math.max(0, step - 2);
    else if (lastDay !== null && (today - lastDay) / DAY >= REVISION_INTERVALS[step] / 2) step = Math.min(REVISION_INTERVALS.length - 1, step + 1);
    lastDay = today;
    lastAt = at;
  }
  const dueAtMs = Date.parse(lastAt) + REVISION_INTERVALS[step] * DAY;
  return {
    key,
    lastAt,
    dueAt: new Date(dueAtMs).toISOString(),
    step,
    isDue: dueAtMs <= now,
    overdueDays: Math.max(0, Math.floor((now - dueAtMs) / DAY)),
  };
}
