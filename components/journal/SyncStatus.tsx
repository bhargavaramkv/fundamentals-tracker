"use client";

import Link from "next/link";
import { describeSync, type SyncKind } from "@/lib/journal/status";
import { useJournal } from "../JournalProvider";

const TONE: Record<SyncKind, string> = {
  local: "bg-warn-bg text-warn",
  synced: "bg-surface-2 text-ink-2",
  saving: "bg-surface-2 text-ink-2",
  offline: "bg-warn-bg text-warn",
  retrying: "bg-warn-bg text-warn",
  error: "bg-bad-bg text-bad",
  conflict: "bg-bad-bg text-bad",
};

/** One status line for the whole journal, with Sync now. Compact so it also fits above an active session. */
export function SyncStatus() {
  const { persistent, hasToken, syncState, online, queue, syncNow } = useJournal();
  const summary = describeSync({ hasToken, online, state: syncState, queue });
  return (
    <div className="space-y-2 text-sm">
      {!persistent && (
        <p role="alert" className="rounded-md bg-warn-bg px-3 py-2 text-warn">
          This browser cannot keep data between visits. Sessions are lost when you refresh or close the tab.
        </p>
      )}
      <p data-sync={summary.kind} role={summary.kind === "conflict" ? "alert" : "status"} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2 ${TONE[summary.kind]}`}>
        <span className="min-w-0 break-words">
          {summary.label}
          {summary.kind === "local" && (
            <>
              {" "}
              —{" "}
              <Link href="/settings/" className="font-bold underline">
                connect sync in Settings
              </Link>
            </>
          )}
        </span>
        {hasToken && (
          <button type="button" onClick={syncNow} disabled={summary.kind === "saving"} className="font-bold text-accent-text hover:underline disabled:opacity-50">
            Sync now
          </button>
        )}
      </p>
    </div>
  );
}
