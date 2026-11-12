import { dayKey } from "./activity";
import { PATTERN_TOPICS } from "./coding";
import { codingSolvesByTopic, levelRank, topicProficiency } from "./proficiency";
import type { Curriculum, CurriculumTrack, ProgressData, WorkspaceSummary } from "./types";

export const GOAL_ANSWERS = 10;
const DAY_MS = 86_400_000;

export const trackKeys = (track: CurriculumTrack): string[] => track.stages.flatMap((s) => s.topics.map((t) => `${track.domain}/${t}`));

/** Every topic key in course order: track by track, stage by stage. */
export const allKeys = (c: Curriculum): string[] => c.tracks.flatMap(trackKeys);

/** The topic keys finished: proficiency has reached "practising" (a lesson checkpoint or any quiz answer). */
export function doneTopics(keys: string[], data: ProgressData, workspaces: Record<string, WorkspaceSummary>, now: number): Set<string> {
  const solves = codingSolvesByTopic(data, PATTERN_TOPICS);
  const bar = levelRank("practising");
  return new Set(keys.filter((k) => levelRank(topicProficiency(k, data, workspaces[k], solves, now).level) >= bar));
}

/** First topic of the track that isn't done, or null when the track is finished. */
export function currentTopic(track: CurriculumTrack, done: Set<string>): string | null {
  return trackKeys(track).find((k) => !done.has(k)) ?? null;
}

/** Latest answer, read or activity on any topic of the track. */
function lastTouched(track: CurriculumTrack, data: ProgressData): string {
  const keys = new Set(trackKeys(track));
  const inTrack = (x: { domain: string; topic: string }) => keys.has(`${x.domain}/${x.topic}`);
  let latest = "";
  for (const a of data.answers) if (a.answeredAt > latest && inTrack(a)) latest = a.answeredAt;
  for (const r of data.reads) if (r.openedAt > latest && inTrack(r)) latest = r.openedAt;
  for (const a of data.activities) if (a.at > latest && inTrack(a)) latest = a.at;
  return latest;
}

/**
 * The lesson to continue with: the current topic of the track touched most recently. A new learner gets the first
 * track's first topic. If that track is finished, the next most recent track with something left; null when all is done.
 */
export function nextLesson(c: Curriculum, data: ProgressData, done: Set<string>): string | null {
  const ranked = c.tracks
    .map((t, i) => ({ t, i, at: lastTouched(t, data) }))
    .sort((a, b) => b.at.localeCompare(a.at) || a.i - b.i);
  for (const { t } of ranked) {
    const k = currentTopic(t, done);
    if (k) return k;
  }
  return null;
}

/** Any answer, read or activity, as the local days it happened on. */
function activeDays(data: ProgressData): Set<string> {
  const days = new Set<string>();
  const add = (iso: string) => days.add(dayKey(new Date(iso)));
  data.answers.forEach((a) => add(a.answeredAt));
  data.reads.forEach((r) => add(r.openedAt));
  data.activities.forEach((a) => add(a.at));
  return days;
}

/** Consecutive local days with any activity, ending today, or yesterday while today has nothing yet. */
export function streak(data: ProgressData, now: number): number {
  const days = activeDays(data);
  const d = new Date(now);
  d.setHours(12, 0, 0, 0); // noon keeps day-stepping safe across DST changes
  if (!days.has(dayKey(d))) d.setTime(d.getTime() - DAY_MS);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setTime(d.getTime() - DAY_MS);
  }
  return n;
}

export interface Goal {
  lessons: number;
  answers: number;
  met: boolean;
}

/** Today's goal: read 1 lesson or answer 10 questions. */
export function todayGoal(data: ProgressData, now: number): Goal {
  const today = dayKey(new Date(now));
  const lessons = data.reads.filter((r) => dayKey(new Date(r.openedAt)) === today).length;
  const answers = data.answers.filter((a) => dayKey(new Date(a.answeredAt)) === today).length;
  return { lessons, answers, met: lessons >= 1 || answers >= GOAL_ANSWERS };
}
