"use client";

import Link from "next/link";
import { GOAL_ANSWERS, streak, todayGoal, trackKeys } from "@/lib/curriculum";
import { dueReviews } from "@/lib/srs";
import { DomainIcon, domainColor } from "./DomainIcon";
import { Flame, ProgressRing } from "./ProgressRing";
import { useCourse, type CourseContext } from "./useCourse";

function greeting(now: number | null): string {
  if (now === null) return "Hello";
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function Today(ctx: CourseContext) {
  const { data, now, ready, done, next, meta } = useCourse(ctx);
  const nextMeta = next ? meta(next) : null;
  const track = next ? ctx.curriculum.tracks.find((t) => t.domain === next.split("/")[0]) : null;
  const keys = track ? trackKeys(track) : [];
  const doneInTrack = keys.filter((k) => done.has(k)).length;
  const started = data.answers.length + data.reads.length + data.activities.length > 0;

  const due = ready && now !== null ? dueReviews(data.reviews, now).length : 0;
  const days = ready && now !== null ? streak(data, now) : 0;
  const goal = ready && now !== null ? todayGoal(data, now) : null;
  const goalValue = goal ? (goal.met ? 1 : goal.answers / GOAL_ANSWERS) : 0;

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl sm:text-4xl">{started ? `${greeting(now)}!` : "Let's begin"}</h1>
        <p className="mt-1 text-[17px] text-ink-2">{started ? "Pick up where you left off." : "Short lessons, one idea at a time. Start from zero."}</p>
      </header>

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
            <p className="eyebrow">{started ? "Up next" : "Start here"}</p>
            <p className="headline mt-1 text-2xl sm:text-[1.7rem]">{nextMeta.title}</p>
            <p className="mt-1 text-[16px] text-ink-2">{nextMeta.summary}</p>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="card flex items-center gap-3 p-4">
          <ProgressRing value={goalValue} size={52} color={goal?.met ? "var(--good)" : "var(--accent)"}>
            {goal?.met ? "✓" : ""}
          </ProgressRing>
          <div className="min-w-0">
            <p className="font-extrabold">Daily goal</p>
            <p className="text-sm text-ink-2">{goal?.met ? "Done for today" : `1 lesson or ${GOAL_ANSWERS} answers (${goal?.answers ?? 0}/${GOAL_ANSWERS})`}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-surface-2">
            <Flame lit={days > 0} size={30} />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold tabular-nums">{days === 1 ? "1 day" : `${days} days`}</p>
            <p className="text-sm text-ink-2">{days > 0 ? "Streak. Keep it alive!" : "Learn today to start a streak"}</p>
          </div>
        </div>
      </div>

      {due > 0 && (
        <Link href="/practice/" className="card flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-extrabold">Review time</p>
            <p className="text-[15px] text-ink-2">
              {due} {due === 1 ? "question is" : "questions are"} due, so it sticks.
            </p>
          </div>
          <span className="btn btn-secondary">Practise →</span>
        </Link>
      )}

      <p className="meta">
        <Link href="/coding/" className="tap inline-flex items-center font-bold text-ink-2 hover:text-ink">
          Coding review →
        </Link>
      </p>
    </div>
  );
}
