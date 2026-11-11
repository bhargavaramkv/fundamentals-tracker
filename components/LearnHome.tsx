"use client";

import Link from "next/link";
import { trackKeys } from "@/lib/curriculum";
import { domainColor } from "./DomainIcon";
import { useCourse, type CourseContext } from "./useCourse";

export function LearnHome(ctx: CourseContext) {
  const { done, next, meta, data } = useCourse(ctx);
  const nextMeta = next ? meta(next) : null;
  const started = data.answers.length + data.reads.length + data.activities.length > 0;

  return (
    <div className="max-w-3xl space-y-10">
      <header className="page-head">
        <p className="eyebrow">Learn</p>
        <h1 className="mt-2">Five tracks, one step at a time</h1>
        <p>Each track starts from zero. Follow the path, or jump anywhere: nothing is locked.</p>
      </header>

      {nextMeta && next && (
        <Link href={`/learn/${next}/`} className="card block p-5 sm:p-6 hover:border-accent">
          <p className="eyebrow">{started ? "Continue" : "Start here"}</p>
          <p className="headline mt-1 text-xl">{nextMeta.title}</p>
          <p className="mt-1 text-[15px] text-ink-2">{nextMeta.summary}</p>
          <span className="btn btn-primary mt-4">
            {started ? "Continue" : "Start"}: {nextMeta.title} <span aria-hidden>→</span>
          </span>
        </Link>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {ctx.curriculum.tracks.map((t) => {
          const keys = trackKeys(t);
          const n = keys.filter((k) => done.has(k)).length;
          const pct = keys.length ? Math.round((n / keys.length) * 100) : 0;
          return (
            <li key={t.domain}>
              <Link href={`/learn/${t.domain}/`} className="card block h-full p-5 hover:border-accent">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: domainColor(t.domain) }} />
                  <h2 className="headline text-lg">{t.title}</h2>
                </div>
                <p className="mt-2 text-[15px] text-ink-2">{t.tagline}</p>
                <div
                  role="progressbar"
                  aria-label={`${t.title} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2"
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <p className="meta mt-2">
                  {n} of {keys.length} lessons done
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
