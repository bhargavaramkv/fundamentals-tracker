"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { freshnessOf, workSince, type MentorLoad } from "@/lib/mentor/client";
import { PRIMARY_AFTER_NIGHTS } from "@/lib/mentor/types";
import { activeProgress } from "@/lib/progress";
import { computeRetention } from "@/lib/retention";
import { dueReviews } from "@/lib/srs";
import { useProgress } from "../ProgressProvider";
import { useNow } from "../useNow";
import { useGeneratedQuestions } from "../useQuestionPool";
import { StatusLine } from "./MentorPage";
import { useMentor } from "./useMentor";

/**
 * The home page. The rule-based Today stays until the nightly routine has proven itself on five nights in a row
 * (MentorStatus.primaryEligible), and comes back if the mentor goes quiet for more than three days. Once the mentor
 * leads, home is a quick glance: the full plan, roadmap and skills live on /mentor.
 */
export function Home({ fallback }: { fallback: ReactNode }) {
  const load = useMentor();
  if (load === null) return <p className="meta py-10">Loading your plan…</p>;

  if (load.kind === "ready" && load.status?.primaryEligible && freshnessOf(load.state, new Date(), load.status).kind !== "stale") {
    return <Glance load={load} />;
  }

  return (
    <>
      {load.kind === "ready" && (
        <p className="meta mb-8 border-l-2 border-line pl-4">
          {load.status?.primaryEligible
            ? "This plan is rule-based because your mentor hasn't reported in over 3 days. "
            : `Your mentor is on trial: ${load.status?.consecutiveNights ?? 0} of ${PRIMARY_AFTER_NIGHTS} nights in a row without errors. After that it replaces this page. `}
          <Link href="/mentor/" className="tap text-accent-text hover:underline">
            See what it thinks
          </Link>
          .
        </p>
      )}
      {fallback}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="meta">{label}</p>
    </div>
  );
}

function Glance({ load }: { load: Extract<MentorLoad, { kind: "ready" }> }) {
  const { state, status } = load;
  const { data } = useProgress();
  const now = useNow();
  const written = useGeneratedQuestions().filter((q) => q.forDate === state.forDate);
  if (now === null) return null;

  const active = activeProgress(data);
  const answered = new Set(active.answers.map((a) => a.questionId));
  const due = dueReviews(active.reviews, now).length;
  const unseen = written.filter((q) => !answered.has(q.id)).length;
  const r = computeRetention(active.answers, now);
  const memory = r.recall.rate !== null ? { value: `${r.recall.rate}%`, label: "Delayed recall" } : r.firstSight.rate !== null ? { value: `${r.firstSight.rate}%`, label: "Right first time" } : { value: "–", label: "Accuracy: too few answers" };
  const waiting = workSince(data, state.generatedAt);
  const changes = [...state.analysis.improved.map((x) => ({ x, good: true })), ...state.analysis.regressed.map((x) => ({ x, good: false }))].slice(0, 2);
  const p = state.plan.primary;

  return (
    <div className="max-w-2xl space-y-8">
      <header className="page-head">
        <p className="eyebrow">Today</p>
        <h1 className="mt-2">{p.title}</h1>
        <p className="line-clamp-3">{state.analysis.summary}</p>
        <StatusLine state={state} status={status} />
      </header>

      <div className="flex flex-wrap gap-3">
        <Link href="/practice/" className="btn btn-primary">
          Practise now <span className="btn-arrow" aria-hidden>→</span>
        </Link>
        <Link href="/mentor/" className="btn btn-secondary">
          Today&apos;s plan · {p.minutes} min
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 border-y border-line py-4">
        <Stat value={String(due)} label={due === 1 ? "Review due" : "Reviews due"} />
        <Stat value={String(unseen)} label={unseen === 1 ? "New question for you" : "New questions for you"} />
        <Stat value={memory.value} label={memory.label} />
      </div>

      {(changes.length > 0 || waiting.answers > 0) && (
        <ul className="space-y-1 text-[15px]">
          {changes.map((c) => (
            <li key={c.x}>
              <span className={`font-medium ${c.good ? "text-good" : "text-bad"}`}>{c.good ? "Improved:" : "Slipped:"}</span> {c.x}
            </li>
          ))}
          {waiting.answers > 0 && (
            <li className="text-ink-2">
              {waiting.answers} {waiting.answers === 1 ? "answer" : "answers"} since the last analysis, read tonight at 1:00 AM.
            </li>
          )}
        </ul>
      )}

      <Link href="/mentor/" className="tap inline-block text-accent-text hover:underline">
        Full plan, roadmap and skills →
      </Link>
    </div>
  );
}
