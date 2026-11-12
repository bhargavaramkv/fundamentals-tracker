"use client";

import Link from "next/link";
import { trackKeys } from "@/lib/curriculum";
import { DomainIcon, domainColor } from "./DomainIcon";
import { ProgressRing } from "./ProgressRing";
import { useCourse, type CourseContext } from "./useCourse";

export function LearnHome(ctx: CourseContext) {
  const { done, next, meta, data } = useCourse(ctx);
  const nextMeta = next ? meta(next) : null;
  const started = data.answers.length + data.reads.length + data.activities.length > 0;
  const n = ctx.curriculum.tracks.length;

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl sm:text-4xl">Learn</h1>
        <p className="mt-1 text-[17px] text-ink-2">{n} tracks. Each one starts from zero. Follow the path, or jump anywhere: nothing is locked.</p>
      </header>

      {nextMeta && next && (
        <Link href={`/learn/${next}/`} className="card flex items-center gap-4 p-4 sm:p-5">
          <DomainIcon domain={nextMeta.domain} size={48} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{started ? "Continue" : "Start here"}</p>
            <p className="headline truncate text-lg">{nextMeta.title}</p>
          </div>
          <span className="btn btn-primary shrink-0">Go →</span>
        </Link>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {ctx.curriculum.tracks.map((t) => {
          const keys = trackKeys(t);
          const k = keys.filter((x) => done.has(x)).length;
          return (
            <li key={t.domain}>
              <Link href={`/learn/${t.domain}/`} className="card flex h-full flex-col p-5" style={{ borderBottomColor: domainColor(t.domain) }}>
                <div className="flex items-start justify-between gap-3">
                  <DomainIcon domain={t.domain} size={52} />
                  <ProgressRing value={keys.length ? k / keys.length : 0} size={44} stroke={5} color={domainColor(t.domain)}>
                    <span className="text-[11px]">
                      {k}/{keys.length}
                    </span>
                  </ProgressRing>
                </div>
                <h2 className="headline mt-4 text-lg">{t.title}</h2>
                <p className="mt-1 text-[15px] text-ink-2">{t.tagline}</p>
                <span className="sr-only">
                  {k} of {keys.length} lessons done
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
