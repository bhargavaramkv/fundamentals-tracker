import type { AnswerLog, SessionRecord } from "./types";

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
