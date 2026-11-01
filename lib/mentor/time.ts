import { MENTOR_TIME_ZONE, type RunRecord } from "./types";

function parts(d: Date): { date: string; hour: number } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: MENTOR_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** The day a run prepares, in the owner's time zone. */
export function forDateOf(now: Date): string {
  return parts(now).date;
}

/**
 * Runs start at 01:00 IST and can be delayed. Anything from midnight to 06:00 counts as the scheduled run; a test run
 * in the daytime still produces valid output but doesn't count towards the five-night gate.
 */
export function triggerOf(now: Date): RunRecord["trigger"] {
  return parts(now).hour < 6 ? "scheduled" : "manual";
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
