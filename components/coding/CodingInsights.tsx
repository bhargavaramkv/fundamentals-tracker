"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { activeProblems } from "@/lib/coding";
import { computeCodingStats, isCodingAnalysis, isLeetCodeStore, type CodingAnalysis, type LeetCodePullStatus, type LeetCodeSubmission } from "@/lib/leetcode-history";
import { readFile } from "@/lib/storage";
import { useAuth } from "../AuthGate";
import { CodingTracker } from "../CodingTracker";
import { useProgress } from "../ProgressProvider";
import { CodingInsightsView } from "./CodingInsightsView";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; submissions: LeetCodeSubmission[]; analysis: CodingAnalysis | null; status: LeetCodePullStatus | null };

async function loadInsights(token: string): Promise<Load> {
  try {
    const [store, analysis, status] = await Promise.all([
      readFile<unknown>(token, "leetcode/submissions.json"),
      readFile<unknown>(token, "mentor/coding.json"),
      readFile<LeetCodePullStatus>(token, "leetcode/status.json"),
    ]);
    return { kind: "ready", submissions: isLeetCodeStore(store) ? store.submissions : [], analysis: isCodingAnalysis(analysis) ? analysis : null, status };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : "Couldn't reach GitHub" };
  }
}

/** The Coding page. It reads the private data repo with the sync token,. */
export function CodingInsights() {
  const { syncToken } = useAuth();
  const { data } = useProgress();
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    if (!syncToken) return;
    let live = true;
    void loadInsights(syncToken).then((r) => {
      if (live) setLoad(r);
    });
    return () => {
      live = false;
    };
  }, [syncToken]);

  const stats = useMemo(() => (load.kind === "ready" ? computeCodingStats(load.submissions) : null), [load]);
  const logged = activeProblems(data).length;

  return (
    <div className="space-y-12">
      <header className="page-head">
        <p className="eyebrow">Coding</p>
        <h1>Your LeetCode review</h1>
        <p>Read from your LeetCode account every night and reviewed by Claude. There&apos;s nothing to log.</p>
      </header>

      {!syncToken ? (
        <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">
          Your LeetCode history is in your private data repo, so this page needs sync to read it. Turn it on in{" "}
          <Link href="/settings/" className="text-accent-text hover:underline">
            Settings
          </Link>
          .
        </p>
      ) : load.kind === "loading" ? (
        <p className="text-ink-2">Loading your LeetCode history…</p>
      ) : load.kind === "error" ? (
        <p className="text-bad">Couldn&apos;t load your LeetCode history: {load.message}</p>
      ) : (
        stats && <CodingInsightsView stats={stats} analysis={load.analysis} status={load.status} />
      )}

      {logged > 0 && (
        <details className="border-t border-line pt-6">
          <summary className="cursor-pointer text-sm text-ink-2">Problems you logged by hand ({logged})</summary>
          <div className="mt-6">
            <CodingTracker embedded />
          </div>
        </details>
      )}
    </div>
  );
}
