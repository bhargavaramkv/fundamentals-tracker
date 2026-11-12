import { canonicalJson, deriveSession } from "../journal/events";
import type { JournalSession } from "../journal/types";
import type { SessionReview } from "./types";

/** Weekly coaching report (V2): pure statistics, the report contract and its validator. Weeks are ISO weeks in Asia/Kolkata. */

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** India has no daylight saving, so a fixed offset is exact. */
const IST_OFFSET_MS = 330 * 60_000;
export const MIN_SESSIONS_PER_WEEK = 3;
export const COMPLETE_WEEKS_NEEDED = 3;

export const weeklyPath = (week: string) => `journal/weekly/${week}.json`;

/** "2026-W46" for the ISO week containing the instant, in Asia/Kolkata. */
export function isoWeekOf(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const day = d.getUTCDay() || 7;
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day);
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.ceil(((thursday - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The instant the week starts: Monday 00:00 in Asia/Kolkata. Null for text that is not a valid week. */
export function weekStartMs(week: string): number | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const monday1 = Date.UTC(Number(m[1]), 0, 4 - ((jan4.getUTCDay() || 7) - 1));
  const start = monday1 + (Number(m[2]) - 1) * WEEK_MS - IST_OFFSET_MS;
  return isoWeekOf(start) === week ? start : null;
}

export function addWeeks(week: string, n: number): string {
  const start = weekStartMs(week);
  if (start === null) throw new Error(`Not an ISO week: ${week}`);
  return isoWeekOf(start + n * WEEK_MS);
}

/** The latest week that has fully ended. */
export function previousCompleteWeek(nowMs: number): string {
  return addWeeks(isoWeekOf(nowMs), -1);
}

export interface WeeklyActivity {
  week: string;
  /** Non-discarded sessions that started in the week. */
  sessions: number;
  endedSessions: number;
  activeMinutes: number;
  topics: string[];
  difficultyEvents: number;
  reviews: number;
  findings: { understood: number; misunderstandings: number; incomplete: number; unsupportedClaims: number; missingConcepts: number };
}

export function weeklyActivity(sessions: JournalSession[], reviews: SessionReview[], week: string, nowMs: number): WeeklyActivity {
  const out: WeeklyActivity = { week, sessions: 0, endedSessions: 0, activeMinutes: 0, topics: [], difficultyEvents: 0, reviews: 0, findings: { understood: 0, misunderstandings: 0, incomplete: 0, unsupportedClaims: 0, missingConcepts: 0 } };
  const inWeek = new Set<string>();
  const topics = new Map<string, string>();
  let activeMs = 0;
  for (const s of sessions) {
    const d = deriveSession(s, nowMs);
    if (d.status === "discarded" || isoWeekOf(Date.parse(d.startedAt)) !== week) continue;
    inWeek.add(s.id);
    out.sessions++;
    if (d.status === "ended") out.endedSessions++;
    activeMs += d.activeMs;
    out.difficultyEvents += d.timeline.filter((t) => t.kind === "difficulty" && t.text.trim()).length;
    for (const t of d.topics) if (!topics.has(t.toLowerCase())) topics.set(t.toLowerCase(), t);
  }
  out.activeMinutes = Math.round(activeMs / 60_000);
  out.topics = [...topics.values()].sort();
  for (const r of reviews) {
    if (!inWeek.has(r.sessionId)) continue;
    out.reviews++;
    for (const k of Object.keys(out.findings) as (keyof WeeklyActivity["findings"])[]) out.findings[k] += r[k].length;
  }
  return out;
}

export interface Sufficiency {
  sufficiency: "coaching" | "activity-only";
  reason: string;
}

/** Coaching needs each of the 3 complete weeks ending at `week` to have at least 3 ended, non-discarded sessions. */
export function sufficiencyFor(sessions: JournalSession[], week: string, nowMs: number): Sufficiency {
  const counts: string[] = [];
  let short = false;
  for (let i = COMPLETE_WEEKS_NEEDED - 1; i >= 0; i--) {
    const w = addWeeks(week, -i);
    const n = weeklyActivity(sessions, [], w, nowMs).endedSessions;
    counts.push(`${w}: ${n}`);
    if (n < MIN_SESSIONS_PER_WEEK) short = true;
  }
  const detail = `ended sessions per week (${counts.join(", ")}); coaching needs at least ${MIN_SESSIONS_PER_WEEK} in each of the last ${COMPLETE_WEEKS_NEEDED} complete weeks`;
  return short ? { sufficiency: "activity-only", reason: `not enough history: ${detail}` } : { sufficiency: "coaching", reason: detail };
}

export interface WeeklyCite {
  sessionId: string;
  eventId?: string;
}

export interface WeeklyFinding {
  concept: string;
  text: string;
  evidence: WeeklyCite[];
}

export interface WeeklyReport {
  v: 1;
  week: string;
  createdAt: string;
  model: string;
  sufficiency: Sufficiency["sufficiency"];
  activity: WeeklyActivity;
  improved: WeeklyFinding[];
  weak: WeeklyFinding[];
  repeatedMisunderstandings: WeeklyFinding[];
  revisit: WeeklyFinding[];
  learnNext: WeeklyFinding[];
  /** 1-2 */
  priorities: string[];
  previousRecommendations: { text: string; followed: "yes" | "no" | "unclear"; evidence: WeeklyCite[] }[];
}

export interface WeeklyContext {
  week: string;
  sessions: JournalSession[];
  reviews: SessionReview[];
  nowMs: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const PATTERN_LISTS = ["improved", "weak", "repeatedMisunderstandings"] as const;
const OTHER_LISTS = ["revisit", "learnNext"] as const;

/** Checks an unknown weekly report. Returns every problem; `report` is set only when there are none. */
export function validateWeekly(raw: unknown, ctx: WeeklyContext): { errors: string[]; report?: WeeklyReport } {
  const errors: string[] = [];
  const err = (path: string, msg: string) => void errors.push(`${path}: ${msg}`);
  if (!isObj(raw)) return { errors: ["report: must be a JSON object"] };
  const str = (v: unknown, path: string, max: number): v is string => {
    if (typeof v !== "string") return err(path, "must be a string"), false;
    if (v.trim().length < 1) return err(path, "must not be empty"), false;
    if (v.length > max) return err(path, `must be at most ${max} characters`), false;
    return true;
  };
  const arr = (v: unknown, path: string, min: number, max: number): v is unknown[] => {
    if (!Array.isArray(v)) return err(path, "must be an array"), false;
    if (v.length < min || v.length > max) return err(path, `must have ${min}-${max} items (has ${v.length})`), false;
    return true;
  };

  const events = new Map(ctx.sessions.map((s) => [s.id, new Set(s.events.map((e) => e.id))]));
  const reviewed = new Set(ctx.reviews.map((r) => r.sessionId));
  const cites = (v: unknown, path: string, min: number, needReview: boolean) => {
    if (!arr(v, path, min, 8)) return;
    v.forEach((c, i) => {
      const p = `${path}[${i}]`;
      if (!isObj(c) || typeof c.sessionId !== "string") return err(p, "must be {sessionId, eventId?}");
      const ids = events.get(c.sessionId);
      if (!ids) return err(p, `session ${c.sessionId} does not exist`);
      if (c.eventId !== undefined && (typeof c.eventId !== "string" || !ids.has(c.eventId))) err(p, `eventId is not an event of session ${c.sessionId}`);
      if (needReview && !reviewed.has(c.sessionId)) err(p, `session ${c.sessionId} has no review to cite`);
    });
  };
  const findings = (v: unknown, path: string, needReview: boolean) => {
    if (!arr(v, path, 0, 8)) return;
    v.forEach((f, i) => {
      if (!isObj(f)) return err(`${path}[${i}]`, "must be an object");
      str(f.concept, `${path}[${i}].concept`, 100);
      str(f.text, `${path}[${i}].text`, 1000);
      cites(f.evidence, `${path}[${i}].evidence`, 1, needReview);
    });
  };

  const expected = { week: ctx.week, activity: weeklyActivity(ctx.sessions, ctx.reviews, ctx.week, ctx.nowMs), ...sufficiencyFor(ctx.sessions, ctx.week, ctx.nowMs) };
  if (raw.v !== 1) err("v", "must be 1");
  if (raw.week !== expected.week) err("week", `must be ${expected.week}`);
  if (typeof raw.createdAt !== "string" || Number.isNaN(Date.parse(raw.createdAt))) err("createdAt", "must be an ISO 8601 time");
  str(raw.model, "model", 100);
  if (raw.sufficiency !== expected.sufficiency) err("sufficiency", `must be "${expected.sufficiency}" (${expected.reason})`);
  if (canonicalJson(raw.activity) !== canonicalJson(expected.activity)) err("activity", "does not match the computed activity; copy it from `weekly context`");

  const activityOnly = expected.sufficiency === "activity-only";
  for (const k of PATTERN_LISTS) {
    if (activityOnly && Array.isArray(raw[k]) && raw[k].length > 0) err(k, "must be empty: not enough history to claim a long-term pattern");
    else findings(raw[k], k, false);
  }
  for (const k of OTHER_LISTS) findings(raw[k], k, activityOnly);
  if (arr(raw.priorities, "priorities", 1, 2)) raw.priorities.forEach((s, i) => str(s, `priorities[${i}]`, 300));
  if (arr(raw.previousRecommendations, "previousRecommendations", 0, 10)) {
    raw.previousRecommendations.forEach((r, i) => {
      const p = `previousRecommendations[${i}]`;
      if (!isObj(r)) return err(p, "must be an object");
      str(r.text, `${p}.text`, 300);
      if (r.followed !== "yes" && r.followed !== "no" && r.followed !== "unclear") err(`${p}.followed`, 'must be "yes", "no" or "unclear"');
      cites(r.evidence, `${p}.evidence`, r.followed === "unclear" ? 0 : 1, false);
    });
  }
  return errors.length > 0 ? { errors } : { errors, report: raw as unknown as WeeklyReport };
}
