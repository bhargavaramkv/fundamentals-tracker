"use client";

import Link from "next/link";
import { trackKeys } from "@/lib/curriculum";
import { deriveSession } from "@/lib/journal/events";
import { formatSpan } from "@/lib/journal/format";
import { dueReviews } from "@/lib/srs";
import { DomainIcon, domainColor } from "./DomainIcon";
import { CoachPanel } from "./CoachPanel";
import { useJournal } from "./JournalProvider";
import { PageShell } from "./PageShell";
import { useCourse, type CourseContext } from "./useCourse";
import { useLearnerProfile } from "./useLearnerProfile";

function greeting(now: number | null): string {
  if (now === null) return "Hello";
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function Today(ctx: CourseContext) {
  const { data, now, ready, done, next: pathNext, meta } = useCourse(ctx);
  const { ready: journalReady, records } = useJournal();
  const current = records.find((r) => ["active", "paused"].includes(deriveSession(r.session).status));
  const recent = records.filter((r) => deriveSession(r.session).status === "ended").slice(0, 3);
  const profile = useLearnerProfile();
  const pick = profile?.nextUp.find((n) => !done.has(n.topic) && meta(n.topic)) ?? null;
  const next = pick?.topic ?? pathNext;
  const nextMeta = next ? meta(next) : null;
  const track = next ? ctx.curriculum.tracks.find((t) => t.domain === next.split("/")[0]) : null;
  const keys = track ? trackKeys(track) : [];
  const doneInTrack = keys.filter((k) => done.has(k)).length;
  const started = data.answers.length + data.reads.length + data.activities.length > 0;
  const due = ready && now !== null ? dueReviews(data.reviews, now).length : 0;

  return (
    <PageShell right={<CoachPanel {...ctx} />}>
    <div className="max-w-2xl space-y-6 xl:max-w-none">
      <header>
        <h1 className="text-3xl sm:text-4xl">{started ? `${greeting(now)}!` : "Let's begin"}</h1>
        <p className="mt-1 text-[17px] text-ink-2">{started ? "Pick up where you left off." : "Short lessons, one idea at a time. Start from zero."}</p>
      </header>

      {journalReady && (
        <section className="card p-5 sm:p-6" aria-label="Journal">
          {current ? (
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">{deriveSession(current.session).status === "paused" ? "Paused session" : "Session running"}</p>
                <p className="headline mt-1 break-words text-xl">{current.session.subject}</p>
              </div>
              <Link href="/journal/" className="btn btn-primary btn-lg shrink-0">
                Resume
              </Link>
            </div>
          ) : (
            <Link href="/journal/" className="btn btn-primary btn-lg w-full">
              Start a session
            </Link>
          )}
          {recent.length > 0 && (
            <ul className="mt-4 space-y-1 text-[15px]">
              {recent.map((r) => (
                <li key={r.session.id}>
                  <Link href={`/journal/?s=${encodeURIComponent(r.session.id)}`} className="flex justify-between gap-3 hover:underline">
                    <span className="min-w-0 break-words">{r.session.subject}</span>
                    <span className="meta shrink-0">{formatSpan(deriveSession(r.session).activeMs)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {nextMeta && next && track ? (
        <Link href={`/learn/${next}/`} className="card block overflow-hidden" style={{ borderColor: domainColor(track.domain) }}>
          <div className="flex items-center gap-3 px-5 py-3 text-white sm:px-6" style={{ background: `color-mix(in oklab, ${domainColor(track.domain)} 62%, black)` }}>
            <DomainIcon domain={track.domain} size={32} />
            <span className="text-sm font-extrabold">{track.title}</span>
            <span className="ml-auto text-sm font-bold tabular-nums opacity-90">
              {doneInTrack}/{keys.length}
            </span>
          </div>
          <div className="p-5 sm:p-6">
            <p className="eyebrow">{pick ? "Picked for you" : started ? "Up next" : "Start here"}</p>
            <p className="headline mt-1 text-2xl sm:text-[1.7rem]">{nextMeta.title}</p>
            <p className="mt-1 text-[16px] text-ink-2">{nextMeta.summary}</p>
            {pick && <p className="mt-2 text-[15px] text-ink-2">{pick.why}</p>}
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${keys.length ? (doneInTrack / keys.length) * 100 : 0}%`, background: domainColor(track.domain) }} />
            </div>
            <span className="btn btn-primary btn-lg mt-5 w-full sm:w-auto">
              {started ? "Continue" : "Start"} <span aria-hidden>→</span>
            </span>
          </div>
        </Link>
      ) : (
        <div className="card p-6">
          <p className="headline text-xl">You have finished every lesson. 🎉</p>
          <p className="mt-1 text-[15px] text-ink-2">Keep it fresh with practice.</p>
        </div>
      )}

      <Link href="/practice/" className="card flex items-center gap-4 p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Review</p>
          <p className="headline mt-1 text-xl">{due > 0 ? `${due} ${due === 1 ? "review" : "reviews"} due` : "Mixed review"}</p>
          <p className="mt-1 text-[15px] text-ink-2">10 questions from what you&apos;ve learned, weakest first.</p>
        </div>
        <span className="btn btn-secondary btn-lg shrink-0">
          Start <span aria-hidden>→</span>
        </span>
      </Link>
    </div>
    </PageShell>
  );
}
