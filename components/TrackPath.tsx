"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { currentTopic, trackKeys } from "@/lib/curriculum";
import type { Domain } from "@/lib/types";
import { DomainIcon, domainColor } from "./DomainIcon";
import { PageShell } from "./PageShell";
import { useCourse, type CourseContext } from "./useCourse";

/** Horizontal offsets (px) that make the path wind gently left and right. */
const WAVE = [0, 52, 76, 52, 0, -52, -76, -52];

export function TrackPath({ domain, ...ctx }: CourseContext & { domain: Domain }) {
  const { done, meta, data } = useCourse(ctx);
  const track = ctx.curriculum.tracks.find((t) => t.domain === domain);
  if (!track) return null;
  const keys = trackKeys(track);
  const current = currentTopic(track, done);
  const n = keys.filter((k) => done.has(k)).length;
  const touched = data.answers.some((a) => a.domain === domain) || data.reads.some((r) => r.domain === domain);
  const color = domainColor(domain);
  let position = 0;

  const rail = (
    <div className="card p-5">
      <p className="eyebrow">Units</p>
      <ol className="mt-3 space-y-3">
        {track.stages.map((stage, si) => {
          const sk = stage.topics.map((t) => `${domain}/${t}`);
          const sd = sk.filter((k) => done.has(k)).length;
          return (
            <li key={stage.id}>
              <div className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="min-w-0 font-bold">
                  {si + 1}. {stage.title}
                </span>
                <span className="meta shrink-0 tabular-nums">
                  {sd}/{sk.length}
                </span>
              </div>
              <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${sk.length ? (sd / sk.length) * 100 : 0}%`, background: color }} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );

  return (
    <PageShell right={rail}>
    <div className="mx-auto max-w-xl space-y-10">
      <header>
        <Link href="/learn/" className="meta tap font-bold hover:text-ink">
          ← All tracks
        </Link>
        <div className="mt-4 flex items-center gap-4">
          <DomainIcon domain={domain} size={60} />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl">{track.title}</h1>
            <p className="text-[15px] text-ink-2">{track.tagline}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={`${track.title} progress`}
            aria-valuemin={0}
            aria-valuemax={keys.length}
            aria-valuenow={n}
            className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${keys.length ? (n / keys.length) * 100 : 0}%`, background: color }} />
          </div>
          <span className="meta font-bold tabular-nums">
            {n}/{keys.length}
          </span>
        </div>
      </header>

      {track.stages.map((stage, si) => (
        <section key={stage.id} aria-label={stage.title}>
          <div className="rounded-2xl px-5 py-4 text-left text-white" style={{ background: `color-mix(in oklab, ${color} 62%, black)`, boxShadow: `0 4px 0 color-mix(in oklab, ${color} 40%, black)` }}>
            <p className="text-xs font-extrabold uppercase tracking-wider opacity-90">Unit {si + 1}</p>
            <h2 className="headline text-xl">{stage.title}</h2>
            <p className="text-[15px] opacity-95">{stage.summary}</p>
          </div>
          <ol className="mt-8 flex flex-col items-center gap-7">
            {stage.topics.map((topic) => {
              const key = `${domain}/${topic}`;
              const m = meta(key);
              const isDone = done.has(key);
              const isCurrent = key === current;
              const offset = WAVE[position++ % WAVE.length];
              const nodeStyle = { "--node": color, background: isDone || isCurrent ? color : `color-mix(in oklab, ${color} 18%, var(--surface-2))`, boxShadow: `0 6px 0 ${isDone || isCurrent ? `color-mix(in oklab, ${color} 70%, black)` : `color-mix(in oklab, ${color} 30%, var(--border))`}` } as CSSProperties;
              return (
                <li key={key} className="flex w-40 flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
                  {isCurrent && (
                    <span className="mb-2 rounded-xl border-2 border-line bg-surface px-3 py-1 text-xs font-extrabold uppercase tracking-wide" style={{ color }}>
                      {touched ? "Continue" : "Start"}
                    </span>
                  )}
                  <Link
                    href={`/learn/${key}/`}
                    aria-label={`${m?.title ?? topic}${isDone ? " (done)" : isCurrent ? " (up next)" : ""}`}
                    className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-full transition-transform hover:-translate-y-0.5 active:translate-y-1 ${isCurrent ? "animate-halo" : ""}`}
                    style={nodeStyle}
                  >
                    <NodeGlyph state={isDone ? "done" : isCurrent ? "current" : "upcoming"} color={color} />
                  </Link>
                  <span className={`mt-3 text-center text-[15px] font-bold leading-snug ${isDone || isCurrent ? "text-ink" : "text-ink-2"}`}>{m?.title ?? topic}</span>
                  {m?.minutes && <span className="meta">{m.minutes} min</span>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
    </PageShell>
  );
}

function NodeGlyph({ state, color }: { state: "done" | "current" | "upcoming"; color: string }) {
  if (state === "done")
    return (
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    );
  if (state === "current")
    return (
      <svg viewBox="0 0 24 24" width="30" height="30" fill="white" aria-hidden>
        <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.7l-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H18" />
      <path d="M9 7h6M9 10h4" />
    </svg>
  );
}
