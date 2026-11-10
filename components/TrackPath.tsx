"use client";

import Link from "next/link";
import { currentTopic, trackKeys } from "@/lib/curriculum";
import type { Domain } from "@/lib/types";
import { useCourse, type CourseContext } from "./useCourse";

export function TrackPath({ domain, ...ctx }: CourseContext & { domain: Domain }) {
  const { done, meta, data } = useCourse(ctx);
  const track = ctx.curriculum.tracks.find((t) => t.domain === domain);
  if (!track) return null;
  const keys = trackKeys(track);
  const current = currentTopic(track, done);
  const n = keys.filter((k) => done.has(k)).length;
  const touched = data.answers.some((a) => a.domain === domain) || data.reads.some((r) => r.domain === domain);

  return (
    <div className="max-w-2xl space-y-10">
      <header>
        <Link href="/learn/" className="meta tap hover:text-ink">
          ← All tracks
        </Link>
        <div className="page-head mt-3">
          <h1>{track.title}</h1>
          <p>{track.tagline}</p>
        </div>
        <p className="meta mt-2">
          {n} of {keys.length} lessons done
        </p>
      </header>

      {track.stages.map((stage) => (
        <section key={stage.id} aria-label={stage.title}>
          <h2 className="headline text-xl">{stage.title}</h2>
          <p className="text-[15px] text-ink-2">{stage.summary}</p>
          <ol className="mt-5 space-y-3 border-l border-line pl-5">
            {stage.topics.map((topic) => {
              const key = `${domain}/${topic}`;
              const m = meta(key);
              const isDone = done.has(key);
              const isCurrent = key === current;
              return (
                <li key={key} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[31px] top-4 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                      isDone ? "border-accent bg-accent text-accent-ink" : isCurrent ? "border-accent bg-surface" : "border-line bg-surface"
                    }`}
                  >
                    {isDone ? "✓" : ""}
                  </span>
                  <Link
                    href={`/learn/${key}/`}
                    className={`block rounded-xl border p-4 hover:border-accent ${isCurrent ? "border-accent bg-surface" : "border-line bg-surface"} ${isDone || isCurrent ? "" : "opacity-80"}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className={`font-medium ${isCurrent ? "text-lg" : ""}`}>
                        {m?.title ?? topic}
                        {isDone && <span className="sr-only"> (done)</span>}
                      </span>
                      {m?.minutes && <span className="meta">About {m.minutes} min</span>}
                    </div>
                    {m && <p className="mt-1 text-[15px] text-ink-2">{m.summary}</p>}
                    {isCurrent && <span className="btn btn-primary mt-3">{touched ? "Continue" : "Start"}</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
