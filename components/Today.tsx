"use client";

import Link from "next/link";
import { GOAL_ANSWERS, streak, todayGoal, trackKeys } from "@/lib/curriculum";
import { dueReviews } from "@/lib/srs";
import { useMentor } from "./mentor/useMentor";
import { useCourse, type CourseContext } from "./useCourse";

export function Today(ctx: CourseContext) {
  const { data, now, ready, done, next, meta } = useCourse(ctx);
  const mentor = useMentor();
  const nextMeta = next ? meta(next) : null;
  const track = next ? ctx.curriculum.tracks.find((t) => t.domain === next.split("/")[0]) : null;
  const keys = track ? trackKeys(track) : [];
  const doneInTrack = keys.filter((k) => done.has(k)).length;
  const started = data.answers.length + data.reads.length + data.activities.length > 0;

  const due = ready && now !== null ? dueReviews(data.reviews, now).length : 0;
  const days = ready && now !== null ? streak(data, now) : 0;
  const goal = ready && now !== null ? todayGoal(data, now) : null;

  return (
    <div className="max-w-2xl space-y-6">
      <header className="page-head">
        <p className="eyebrow">Today</p>
        <h1 className="mt-2">{started ? "Welcome back" : "Let's begin"}</h1>
      </header>

      {nextMeta && next && track ? (
        <Link href={`/learn/${next}/`} className="card block p-5 hover:border-accent sm:p-6">
          <p className="eyebrow">{started ? "Continue" : "Start here"}</p>
          <p className="headline mt-1 text-2xl">{nextMeta.title}</p>
          <p className="mt-1 text-[15px] text-ink-2">{nextMeta.summary}</p>
          <p className="meta mt-3">
            {track.title}: {doneInTrack} of {keys.length} lessons done
          </p>
          <span className="btn btn-primary btn-lg mt-4">
            {started ? "Continue" : "Start"} <span aria-hidden>→</span>
          </span>
        </Link>
      ) : (
        <div className="card p-5 sm:p-6">
          <p className="headline text-xl">You have finished every lesson.</p>
          <p className="mt-1 text-[15px] text-ink-2">Keep it fresh with practice.</p>
        </div>
      )}

      {due > 0 && (
        <Link href="/practice/" className="card flex items-center justify-between gap-4 p-5 hover:border-accent">
          <div>
            <p className="font-medium">Review</p>
            <p className="text-[15px] text-ink-2">
              {due} {due === 1 ? "question is" : "questions are"} due
            </p>
          </div>
          <span className="btn btn-secondary">Practise →</span>
        </Link>
      )}

      <p className="text-[15px] text-ink-2">
        <span className="font-medium text-ink">{days === 1 ? "1 day" : `${days} days`}</span> streak
        {goal && (
          <>
            {" · "}
            {goal.met ? (
              <span className="text-good">Today&apos;s goal met</span>
            ) : (
              <>
                Today&apos;s goal: read 1 lesson or answer {GOAL_ANSWERS} questions ({goal.answers} of {GOAL_ANSWERS} so far)
              </>
            )}
          </>
        )}
      </p>

      {mentor?.kind === "ready" && (
        <p className="meta">
          Your mentor left a note.{" "}
          <Link href="/mentor/" className="tap text-accent-text hover:underline">
            Read it
          </Link>
        </p>
      )}
    </div>
  );
}
