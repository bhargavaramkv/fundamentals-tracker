import type { AnswerLog } from "./types";

/**
 * Is learning sticking? Worked out from answers only, with no AI involved and nothing estimated.
 *
 * - Delayed recall: an answer to a question you last answered RECALL_GAP_DAYS or more earlier. This is the retention signal.
 * - First sight: your first answer to a question you'd never seen. Tracked over time, it shows whether understanding
 *   transfers to new questions rather than remembered ones.
 * - Answers faster than GUESS_MS count in neither, because they're more likely clicks than recall.
 *
 * Pass answers since the content epoch only (activeProgress), so a rewritten question never counts as a repeat.
 */
export const RECALL_GAP_DAYS = 3;
export const GUESS_MS = 2000;
/** Fewer attempts than this and a rate would mislead, so none is given. */
export const MIN_FOR_RATE = 3;
/** First-sight trend compares two windows of this many days. */
export const TREND_WINDOW_DAYS = 14;
const MIN_PER_WINDOW = 5;
const DAY = 86_400_000;

export interface Tally {
  attempts: number;
  correct: number;
  /** Percent, or null with fewer than MIN_FOR_RATE attempts. */
  rate: number | null;
}

export interface TopicRetention {
  key: string;
  recall: Tally;
}

export interface Retention {
  recall: Tally;
  firstSight: Tally;
  /** First-sight accuracy, the last TREND_WINDOW_DAYS against the window before. Null without enough answers in both. */
  firstSightTrend: { recent: number; before: number } | null;
  byTopic: TopicRetention[];
  /** Answers left out as likely guesses. */
  guesses: number;
  /** With no recall attempt yet: when the first one becomes possible (an answered question turns RECALL_GAP_DAYS old). */
  firstRecallAt: string | null;
}

function tally(attempts: number, correct: number): Tally {
  return { attempts, correct, rate: attempts >= MIN_FOR_RATE ? Math.round((100 * correct) / attempts) : null };
}

export function computeRetention(answers: AnswerLog[], now: number = Date.now()): Retention {
  const ordered = [...answers].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  const lastSeen = new Map<string, number>();
  const recall = { attempts: 0, correct: 0 };
  const first = { attempts: 0, correct: 0 };
  const windows = { recent: { n: 0, c: 0 }, before: { n: 0, c: 0 } };
  const topics = new Map<string, { attempts: number; correct: number }>();
  let guesses = 0;

  for (const a of ordered) {
    const at = Date.parse(a.answeredAt);
    const prev = lastSeen.get(a.questionId);
    // Every answer moves "last seen", guesses included: you did see the question.
    lastSeen.set(a.questionId, at);
    // An honest "I don't know" is a real answer however fast it was given.
    if (a.timeMs < GUESS_MS && !a.unsure) {
      guesses++;
      continue;
    }
    if (prev === undefined) {
      first.attempts++;
      if (a.correct) first.correct++;
      const age = now - at;
      const w = age < TREND_WINDOW_DAYS * DAY ? windows.recent : age < 2 * TREND_WINDOW_DAYS * DAY ? windows.before : null;
      if (w) {
        w.n++;
        if (a.correct) w.c++;
      }
    } else if (at - prev >= RECALL_GAP_DAYS * DAY) {
      recall.attempts++;
      if (a.correct) recall.correct++;
      const key = `${a.domain}/${a.topic}`;
      const t = topics.get(key) ?? { attempts: 0, correct: 0 };
      t.attempts++;
      if (a.correct) t.correct++;
      topics.set(key, t);
    }
  }

  const earliest = ordered.find((a) => a.timeMs >= GUESS_MS) ?? ordered[0];
  const pct = (w: { n: number; c: number }) => Math.round((100 * w.c) / w.n);
  return {
    recall: tally(recall.attempts, recall.correct),
    firstSight: tally(first.attempts, first.correct),
    firstSightTrend: windows.recent.n >= MIN_PER_WINDOW && windows.before.n >= MIN_PER_WINDOW ? { recent: pct(windows.recent), before: pct(windows.before) } : null,
    byTopic: [...topics.entries()].map(([key, t]) => ({ key, recall: tally(t.attempts, t.correct) })).sort((a, b) => b.recall.attempts - a.recall.attempts || a.key.localeCompare(b.key)),
    guesses,
    firstRecallAt: recall.attempts === 0 && earliest ? new Date(Date.parse(earliest.answeredAt) + RECALL_GAP_DAYS * DAY).toISOString() : null,
  };
}
