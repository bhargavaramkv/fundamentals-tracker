import { applyAnswers } from "./srs";
import type { AnswerLog, CodingAttempt, CodingProblem, Domain, LearningActivity, ProgressData, ReadLog, ReviewState, SessionRecord } from "./types";

/**
 * Answers given before this moment were on question sets that have since been
 * rewritten (on 2026-10-28 the correct option was usually the longest, so they
 * could be guessed). They stay in the progress file, but no score, review or
 * recommendation counts them. Bump this only for a full question rewrite.
 */
export const CONTENT_EPOCH = "2026-10-28T04:55:06Z";

/**
 * Review schedules restart here: earlier answers still count for scores, but only answers from this moment on
 * put questions in the review deck. Set by the owner on 2026-11-12 to clear the backlog (midnight IST, 13 Nov).
 */
export const REVIEW_EPOCH = "2026-11-12T18:30:00Z";

/** The progress that counts: answers and sessions since the content epoch, with reviews rebuilt from answers since the review epoch. */
export function activeProgress(data: ProgressData, epoch: string = CONTENT_EPOCH, reviewEpoch: string = REVIEW_EPOCH): ProgressData {
  const answers = data.answers.filter((a) => a.answeredAt >= epoch);
  return {
    ...data,
    answers,
    sessions: data.sessions.filter((s) => s.finishedAt >= epoch),
    reviews: applyAnswers({}, answers.filter((a) => a.answeredAt >= reviewEpoch)),
  };
}

export function archivedAnswerCount(data: ProgressData, epoch: string = CONTENT_EPOCH): number {
  return data.answers.filter((a) => a.answeredAt < epoch).length;
}

export function emptyProgress(): ProgressData {
  return { version: 1, updatedAt: new Date(0).toISOString(), answers: [], sessions: [], reviews: {}, reads: [], activities: [], codingProblems: [], codingAttempts: [] };
}

/** Coerces unknown JSON (localStorage, remote file, import) into ProgressData without dropping valid records. */
export function normalizeProgress(raw: unknown): ProgressData {
  if (!raw || typeof raw !== "object") return emptyProgress();
  const r = raw as Partial<ProgressData>;
  return {
    version: 1,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date(0).toISOString(),
    answers: Array.isArray(r.answers) ? r.answers.filter((a) => a && typeof a.id === "string") : [],
    sessions: Array.isArray(r.sessions) ? r.sessions.filter((s) => s && typeof s.id === "string") : [],
    reviews: r.reviews && typeof r.reviews === "object" ? r.reviews : {},
    reads: Array.isArray(r.reads) ? r.reads.filter((x) => x && typeof x.id === "string") : [],
    activities: Array.isArray(r.activities) ? r.activities.filter((x) => x && typeof x.id === "string" && typeof x.at === "string") : [],
    codingProblems: Array.isArray(r.codingProblems) ? r.codingProblems.filter((x) => x && typeof x.id === "string" && typeof x.updatedAt === "string") : [],
    codingAttempts: Array.isArray(r.codingAttempts) ? r.codingAttempts.filter((x) => x && typeof x.id === "string" && typeof x.at === "string") : [],
  };
}

/**
 * Merges two copies of progress (e.g. this browser and the synced file).
 * Append-only union by id, so no device can ever delete another's history.
 */
export function mergeProgress(a: ProgressData, b: ProgressData): ProgressData {
  const answers = new Map<string, AnswerLog>();
  for (const x of [...a.answers, ...b.answers]) answers.set(x.id, x);
  const reads = new Map<string, ReadLog>();
  for (const x of [...(a.reads ?? []), ...(b.reads ?? [])]) reads.set(x.id, x);
  const sessions = new Map<string, SessionRecord>();
  for (const x of [...a.sessions, ...b.sessions]) sessions.set(x.id, x);
  const activities = new Map<string, LearningActivity>();
  for (const x of [...(a.activities ?? []), ...(b.activities ?? [])]) activities.set(x.id, x);
  const attempts = new Map<string, CodingAttempt>();
  for (const x of [...(a.codingAttempts ?? []), ...(b.codingAttempts ?? [])]) attempts.set(x.id, x);
  // Problems can be edited, so the latest edit wins; a soft delete is just another edit.
  const problems = new Map<string, CodingProblem>();
  for (const x of [...(a.codingProblems ?? []), ...(b.codingProblems ?? [])]) {
    const prev = problems.get(x.id);
    if (!prev || x.updatedAt >= prev.updatedAt) problems.set(x.id, x);
  }

  const sortedAnswers = [...answers.values()].sort((x, y) => x.answeredAt.localeCompare(y.answeredAt));
  const reviews: Record<string, ReviewState> = {};
  for (const [id, r] of [...Object.entries(a.reviews), ...Object.entries(b.reviews)]) {
    if (!reviews[id] || r.lastAnsweredAt > reviews[id].lastAnsweredAt) reviews[id] = r;
  }

  return {
    version: 1,
    updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
    answers: sortedAnswers,
    sessions: [...sessions.values()].sort((x, y) => x.finishedAt.localeCompare(y.finishedAt)),
    // Replay so review state reflects every answer, including ones only one side had.
    reviews: applyAnswers(reviews, sortedAnswers),
    reads: [...reads.values()].sort((x, y) => x.openedAt.localeCompare(y.openedAt)),
    activities: [...activities.values()].sort((x, y) => x.at.localeCompare(y.at)),
    codingProblems: [...problems.values()].sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id)),
    codingAttempts: [...attempts.values()].sort((x, y) => x.at.localeCompare(y.at)),
  };
}

export function recordSession(data: ProgressData, session: SessionRecord, answers: AnswerLog[]): ProgressData {
  return {
    ...data,
    version: 1,
    updatedAt: session.finishedAt,
    answers: [...data.answers, ...answers],
    sessions: [...data.sessions, session],
    reviews: applyAnswers(data.reviews, answers),
  };
}

export function recordRead(data: ProgressData, read: ReadLog): ProgressData {
  return { ...data, updatedAt: new Date().toISOString(), reads: [...data.reads, read] };
}

export function recordActivity(data: ProgressData, activity: LearningActivity): ProgressData {
  return { ...data, updatedAt: new Date().toISOString(), activities: [...data.activities, activity] };
}

/** Adds a problem or replaces it by id (an edit). */
export function recordCodingProblem(data: ProgressData, problem: CodingProblem): ProgressData {
  return { ...data, updatedAt: new Date().toISOString(), codingProblems: [...data.codingProblems.filter((p) => p.id !== problem.id), problem] };
}

export function recordCodingAttempt(data: ProgressData, attempt: CodingAttempt): ProgressData {
  return { ...data, updatedAt: new Date().toISOString(), codingAttempts: [...data.codingAttempts, attempt] };
}

/** Most recent moment of any activity (answer given or lesson reading finished). */
export function latestActivityAt(data: ProgressData): string | null {
  let latest: string | null = null;
  for (const a of data.answers) if (!latest || a.answeredAt > latest) latest = a.answeredAt;
  for (const r of data.reads) {
    const end = new Date(Date.parse(r.openedAt) + r.durationMs).toISOString();
    if (!latest || end > latest) latest = end;
  }
  for (const x of data.activities) if (!latest || x.at > latest) latest = x.at;
  for (const x of data.codingAttempts) if (!latest || x.at > latest) latest = x.at;
  return latest;
}

export function summarizeSession(
  id: string,
  mode: SessionRecord["mode"],
  startedAt: string,
  answers: AnswerLog[],
): SessionRecord {
  const perDomain = new Map<Domain, { total: number; correct: number }>();
  for (const a of answers) {
    const s = perDomain.get(a.domain) ?? { total: 0, correct: 0 };
    s.total++;
    if (a.correct) s.correct++;
    perDomain.set(a.domain, s);
  }
  const domainScores: SessionRecord["domainScores"] = {};
  for (const [d, s] of perDomain) domainScores[d] = Math.round((100 * s.correct) / s.total);
  return {
    id,
    mode,
    startedAt,
    finishedAt: new Date().toISOString(),
    total: answers.length,
    correct: answers.filter((a) => a.correct).length,
    domainScores,
  };
}
