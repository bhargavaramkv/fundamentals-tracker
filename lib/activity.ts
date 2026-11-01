import type { AnswerLog, ProgressData, SessionRecord } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface Activity {
  streak: number;
  lastActive: string | null;
  daysSinceActive: number | null;
  activeDays: number;
}

/** Streak counts consecutive days with at least one answer, ending today or yesterday. */
export function computeActivity(answers: AnswerLog[], now: Date = new Date()): Activity {
  if (answers.length === 0) return { streak: 0, lastActive: null, daysSinceActive: null, activeDays: 0 };

  const days = new Set(answers.map((a) => dayKey(new Date(a.answeredAt))));
  const lastActive = answers.reduce((max, a) => (a.answeredAt > max ? a.answeredAt : max), answers[0].answeredAt);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(lastActive);
  const lastMidnight = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());
  const daysSinceActive = Math.round((today.getTime() - lastMidnight.getTime()) / DAY_MS);

  let streak = 0;
  if (daysSinceActive <= 1) {
    const cursor = new Date(lastMidnight);
    while (days.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  return { streak, lastActive, daysSinceActive, activeDays: days.size };
}

export interface ActivityRow {
  id: string;
  at: string;
  /** What kind of evidence this is, shown as text so reading can't be mistaken for practice. */
  kind: "Quiz" | "Assessment" | "Reading" | "Exercise" | "Practical" | "Coding";
  title: string;
  detail?: string;
  href?: string;
}

const RATING: Record<string, string> = { "got-it": "got it", partial: "partly", missed: "missed" };

/** The latest things you did, across every kind of evidence, newest first. */
export function recentActivity(data: ProgressData, titleOf: (key: string) => string, limit = 6): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const s of data.sessions) {
    rows.push({
      id: s.id,
      at: s.finishedAt,
      kind: s.mode === "assessment" ? "Assessment" : "Quiz",
      title: `${s.correct} of ${s.total} correct`,
    });
  }
  for (const r of data.reads) {
    const key = `${r.domain}/${r.topic}`;
    rows.push({ id: r.id, at: r.openedAt, kind: "Reading", title: titleOf(key), detail: `${Math.max(1, Math.round(r.durationMs / 60_000))} min`, href: `/learn/${key}/` });
  }
  for (const a of data.activities) {
    const key = `${a.domain}/${a.topic}`;
    if (a.kind === "resource") rows.push({ id: a.id, at: a.at, kind: "Reading", title: titleOf(key), detail: "source marked as read", href: `/learn/${key}/` });
    else if (a.kind === "exercise") rows.push({ id: a.id, at: a.at, kind: "Exercise", title: titleOf(key), detail: RATING[a.rating], href: `/learn/${key}/?tab=exercises` });
    else rows.push({ id: a.id, at: a.at, kind: "Practical", title: titleOf(key), detail: "completed", href: `/learn/${key}/?tab=exercises` });
  }
  const problems = new Map(data.codingProblems.map((p) => [p.id, p.title]));
  for (const a of data.codingAttempts) {
    rows.push({ id: a.id, at: a.at, kind: "Coding", title: problems.get(a.problemId) ?? a.problemId, detail: a.outcome.replace(/-/g, " "), href: `/coding/?problem=${encodeURIComponent(a.problemId)}` });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export interface HistoryPoint {
  at: string;
  score: number;
  mode: SessionRecord["mode"];
  total: number;
}

export function scoreHistory(sessions: SessionRecord[]): HistoryPoint[] {
  return [...sessions]
    .filter((s) => s.total > 0)
    .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
    .map((s) => ({
      at: s.finishedAt,
      score: Math.round((100 * s.correct) / s.total),
      mode: s.mode,
      total: s.total,
    }));
}
