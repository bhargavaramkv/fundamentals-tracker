"use client";

import Link from "next/link";
import { describeSync, type SyncKind } from "@/lib/journal/status";
import { useJournal } from "../JournalProvider";

const TONE: Record<SyncKind, string> = {
  local: "border-warn/25 bg-warn/10 text-warn",
  synced: "border-line-2 bg-surface-2 text-ink-2",
  saving: "border-accent/30 bg-accent/10 text-accent-text",
  offline: "border-warn/25 bg-warn/10 text-warn",
  retrying: "border-warn/25 bg-warn/10 text-warn",
  error: "border-bad/30 bg-bad/10 text-bad",
  conflict: "border-bad/30 bg-bad/10 text-bad",
};

/** One status pill for the whole journal, with Sync now. */
export function SyncStatus() {
  const { persistent, hasToken, syncState, online, queue, syncNow } = useJournal();
  const summary = describeSync({ hasToken, online, state: syncState, queue });
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
      {!persistent && (
        <p role="alert" className="rounded-xl bg-warn-bg px-3 py-2 text-warn">
          This browser cannot keep data between visits. Sessions are lost when you refresh or close the tab.
        </p>
      )}
      <p data-sync={summary.kind} role={summary.kind === "conflict" ? "alert" : "status"} className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border px-3 py-1 text-[13px] ${TONE[summary.kind]}`}>
        <span className="flex min-w-0 items-center gap-2 break-words">
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${summary.kind === "saving" ? "animate-pulse" : ""}`} />
          <span>
            {summary.label}
            {summary.kind === "local" && (
              <>
                {" "}
                —{" "}
                <Link href="/settings/" className="font-semibold underline">
                  connect sync in Settings
                </Link>
              </>
            )}
          </span>
        </span>
        {hasToken && (
          <button type="button" onClick={syncNow} disabled={summary.kind === "saving"} className="font-semibold text-accent-text hover:underline disabled:opacity-50">
            Sync now
          </button>
        )}
      </p>
    </div>
  );
}
