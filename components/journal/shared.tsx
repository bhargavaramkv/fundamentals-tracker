"use client";

import { useEffect, useState } from "react";
import { deriveSession, type TimelineItem } from "@/lib/journal/events";
import type { SessionRecord } from "@/lib/journal/local";
import type { RecordStatus } from "@/lib/journal/sync";
import { StatusPill } from "../ui/StatusPill";

export const SYNC_LABEL: Record<RecordStatus, string> = {
  local: "On this device",
  pending: "Waiting to sync",
  syncing: "Syncing",
  synced: "Synced",
  retrying: "Will retry",
  conflict: "Needs attention",
};

export const KIND_LABEL: Record<TimelineItem["kind"], string> = {
  start: "Started",
  pause: "Paused",
  resume: "Resumed",
  topic: "Topic",
  note: "Note",
  difficulty: "Difficulty",
  bookmark: "Bookmark",
  end: "Ended",
  attach: "Photo",
};

export const isOpen = (r: SessionRecord) => ["active", "paused"].includes(deriveSession(r.session).status);
export const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** Re-renders every second while mounted, for the live timer. */
export function useTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">
      {message}
    </p>
  ) : null;
}

/** Elapsed wall time since the session began, for the mono time gutter ("0:04", "1:02:03"). */
export function gutterOf(startIso: string, atIso: string): string {
  const s = Math.max(0, Math.floor((Date.parse(atIso) - Date.parse(startIso)) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

const SYNC_TONE: Record<RecordStatus, "good" | "warn" | "bad" | "info" | "neutral"> = {
  local: "neutral",
  pending: "neutral",
  syncing: "info",
  synced: "good",
  retrying: "warn",
  conflict: "bad",
};

/** Per-session sync state as a status pill; the conflict state stands out. */
export function SyncBadge({ status }: { status: RecordStatus }) {
  return <StatusPill tone={SYNC_TONE[status]}>{SYNC_LABEL[status]}</StatusPill>;
}
