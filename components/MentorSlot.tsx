"use client";

import Link from "next/link";
import { Eyebrow } from "./ui/Eyebrow";
import { Panel } from "./ui/Panel";
import { ArrowRightIcon, SparklesIcon } from "./ui/icons";
import { StatusPill } from "./ui/StatusPill";
import { Stepper, type Step } from "./ui/Stepper";
import { useMentor } from "./MentorProvider";
import { useConcepts } from "./mentor/useConcepts";
import { useNow } from "./useNow";

const DUE_SHOWN = 4;
const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const linkCls = "inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-text hover:underline";

/** The mentor insight panel: the latest review, queued/failed reviews and the latest weekly report. Nothing fake. */
export function TodayMentor({ className = "" }: { className?: string }) {
  const { hasToken, loaded, pending, reviews, weekly } = useMentor();
  const review = reviews[0];
  const report = weekly[0];
  const failed = pending.filter((p) => p.failures.length > 0).length;

  if (!loaded) return <div className={`skeleton h-56 w-full ${className}`} aria-hidden />;

  const empty = !hasToken ? (
    <p className="mt-3 text-ink-2">
      Connect sync in Settings to see reviews.{" "}
      <Link href="/settings/" className="font-medium text-accent-text hover:underline">
        Open Settings
      </Link>
    </p>
  ) : !review && !report && pending.length === 0 ? (
    <p className="mt-3 text-ink-2">No reviews yet. They appear after you end a session.</p>
  ) : null;

  return (
    <Panel as="div" className={`overflow-hidden p-6 sm:p-8 ${className}`}>
      <section aria-label="Mentor" className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow className="inline-flex items-center gap-2">
            <SparklesIcon className="h-4 w-4" />
            Mentor insight
          </Eyebrow>
          {hasToken && pending.length - failed > 0 && <StatusPill tone="warn">{pending.length - failed} queued</StatusPill>}
          {failed > 0 && <StatusPill tone="bad">{failed} failed</StatusPill>}
        </div>

        {empty}

        {review && (
          <div className="mt-4 max-w-[62ch]">
            <p className="text-xs text-muted">Latest review · {dateOf(review.createdAt)}</p>
            <h2 className="mt-2 line-clamp-4 break-words text-[1.4rem] font-semibold leading-snug tracking-[-0.01em] sm:text-[1.6rem]">{review.summary}</h2>
            {review.nextSteps[0] && (
              <p className="mt-4 break-words text-[15px] text-ink-2">
                <span className="mr-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan">Next</span>
                {review.nextSteps[0]}
              </p>
            )}
            {review.verificationQuestions[0] && <p className="mt-3 break-words text-[14px] italic text-muted">Check yourself: {review.verificationQuestions[0].question}</p>}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-6">
          {review && (
            <Link href={`/journal/?s=${encodeURIComponent(review.sessionId)}`} className={linkCls}>
              Read the review <ArrowRightIcon className="h-4 w-4" />
            </Link>
          )}
          {report && (
            <>
              <span className="text-[13px] text-muted">
                Weekly report · {report.week}
                {report.sufficiency === "activity-only" ? " · activity only" : ""}
              </span>
              <Link href="/mentor/" className={linkCls}>
                Open the report <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </section>
    </Panel>
  );
}

/** "Next up": only steps that follow from real state. */
export function NextUp({ live, className = "" }: { live: { subject: string; paused: boolean } | null; className?: string }) {
  const { hasToken, loaded, pending, weekly } = useMentor();
  const concepts = useConcepts();
  const now = useNow();
  const due = concepts.filter((c) => c.result.dueForVerification);
  const steps: Step[] = [];
  if (live) steps.push({ title: "Finish the running session", detail: `${live.subject} · ${live.paused ? "paused" : "running"}`, state: "now" });
  if (hasToken && loaded && pending.length > 0) {
    const retries = pending.filter((p) => p.failures.length > 0).length;
    steps.push({
      title: `${pending.length} ${pending.length === 1 ? "review" : "reviews"} queued for 06:15`,
      detail: retries > 0 ? `Written by the morning run · ${retries} ${retries === 1 ? "is a retry" : "are retries"}` : "Written by the morning run",
    });
  }
  if (hasToken && now !== null) {
    const d = new Date(now);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((8 - d.getDay()) % 7 || 7));
    steps.push({
      title: "Weekly coaching on Monday",
      detail: `${next.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}${weekly[0] ? ` · last: ${weekly[0].week}` : ""}`,
    });
  }
  if (due.length > 0) steps.push({ title: `${due.length} ${due.length === 1 ? "concept" : "concepts"} due for verification`, detail: due[0].label, state: "due" });

  return (
    <Panel as="section" className={`p-6 sm:p-7 ${className}`}>
      <h2 className="mb-5 text-lg font-semibold">Next up</h2>
      {steps.length === 0 ? <p className="text-[15px] text-ink-2">Nothing waiting. Start a session to get going.</p> : <Stepper steps={steps} />}
    </Panel>
  );
}

/** Concepts due for a verification check. Renders nothing when there are none. */
export function DueList({ className = "" }: { className?: string }) {
  const concepts = useConcepts();
  const due = concepts.filter((c) => c.result.dueForVerification);
  if (due.length === 0) return null;
  return (
    <Panel as="section" className={`p-6 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Due for verification</h2>
        <Link href="/knowledge/" className={linkCls}>
          Knowledge <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {due.slice(0, DUE_SHOWN).map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 break-words text-[15px] font-medium">
              {c.label}
              {c.subject && <span className="block text-[13px] font-normal text-muted">{c.subject}</span>}
            </span>
            <StatusPill tone="warn">{c.result.needsReassessment ? "Reassess" : "Due"}</StatusPill>
          </li>
        ))}
      </ul>
      {due.length > DUE_SHOWN && <p className="mt-2 text-[13px] text-muted">+{due.length - DUE_SHOWN} more</p>}
    </Panel>
  );
}
