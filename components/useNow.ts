"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 60_000);
  return () => clearInterval(t);
};
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;

/** The current time to the minute; null during the static render, so the build and the browser agree. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, minuteNow, () => null);
}

/** Local midnight of the given moment, as an ISO string. */
export function startOfLocalDay(now: number): string {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

export function relativeDays(iso: string, now: number): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

export function untilDays(iso: string, now: number): string {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return "due now";
  // Rounded, because "now" is floored to the minute: 7 days from a moment ago should read as 7, not 8.
  const days = Math.max(1, Math.round(ms / 86_400_000));
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
