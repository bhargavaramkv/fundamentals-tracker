"use client";

import { useEffect, useState } from "react";
import { deriveSession, type TimelineItem } from "@/lib/journal/events";
import type { SessionRecord } from "@/lib/journal/local";
import type { RecordStatus } from "@/lib/journal/sync";

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

/** Per-session sync state as a small pill; the conflict state stands out. */
export function SyncBadge({ status }: { status: RecordStatus }) {
  const tone = status === "conflict" ? "border-bad text-bad font-bold" : status === "synced" ? "text-good" : status === "retrying" ? "text-warn" : "text-ink-2";
  return <span className={`chip !min-h-0 !px-2.5 !py-0.5 text-xs ${tone}`}>{SYNC_LABEL[status]}</span>;
}
