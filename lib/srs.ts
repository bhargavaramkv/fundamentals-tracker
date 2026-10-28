import type { AnswerLog, ReviewState } from "./types";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Leitner boxes: a wrong answer resets to box 0 (back in 4h), each correct
 * review promotes one box. Questions enter the deck the first time they are
 * missed; questions answered correctly first time never need review.
 */
export const BOX_INTERVAL_HOURS = [4, 24, 72, 168, 336, 720] as const;
export const MAX_BOX = BOX_INTERVAL_HOURS.length - 1;

export function nextReview(prev: ReviewState | undefined, answer: AnswerLog): ReviewState | undefined {
  if (!prev && answer.correct) return undefined;
  const at = Date.parse(answer.answeredAt);
  const box = answer.correct ? Math.min(MAX_BOX, (prev?.box ?? 0) + 1) : 0;
  return {
    questionId: answer.questionId,
    box,
    dueAt: new Date(at + BOX_INTERVAL_HOURS[box] * HOUR_MS).toISOString(),
    lapses: (prev?.lapses ?? 0) + (answer.correct ? 0 : 1),
    lastAnsweredAt: answer.answeredAt,
  };
}

export function applyAnswers(
  reviews: Record<string, ReviewState>,
  answers: AnswerLog[],
): Record<string, ReviewState> {
  const next = { ...reviews };
  const ordered = [...answers].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  for (const a of ordered) {
    const prev = next[a.questionId];
    // Ignore answers older than what the state already reflects (e.g. merged from another device).
    if (prev && prev.lastAnsweredAt >= a.answeredAt) continue;
    const state = nextReview(prev, a);
    if (state) next[a.questionId] = state;
  }
  return next;
}

export function dueReviews(reviews: Record<string, ReviewState>, now: number = Date.now()): ReviewState[] {
  return Object.values(reviews)
    .filter((r) => Date.parse(r.dueAt) <= now)
    .sort((a, b) => a.box - b.box || a.dueAt.localeCompare(b.dueAt));
}
