import { applyAnswers } from "./srs";
import type { AnswerLog, Domain, ProgressData, ReadLog, ReviewState, SessionRecord } from "./types";

export function emptyProgress(): ProgressData {
  return { version: 1, updatedAt: new Date(0).toISOString(), answers: [], sessions: [], reviews: {}, reads: [] };
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
  };
}

export function recordSession(data: ProgressData, session: SessionRecord, answers: AnswerLog[]): ProgressData {
  return {
    version: 1,
    updatedAt: session.finishedAt,
    answers: [...data.answers, ...answers],
    sessions: [...data.sessions, session],
    reviews: applyAnswers(data.reviews, answers),
    reads: data.reads,
  };
}

export function recordRead(data: ProgressData, read: ReadLog): ProgressData {
  return { ...data, updatedAt: new Date().toISOString(), reads: [...data.reads, read] };
}

/** Most recent moment of any activity (answer given or lesson reading finished). */
export function latestActivityAt(data: ProgressData): string | null {
  let latest: string | null = null;
  for (const a of data.answers) if (!latest || a.answeredAt > latest) latest = a.answeredAt;
  for (const r of data.reads) {
    const end = new Date(Date.parse(r.openedAt) + r.durationMs).toISOString();
    if (!latest || end > latest) latest = end;
  }
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
