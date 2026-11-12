"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deriveSession } from "@/lib/journal/events";
import { formatClock, formatSpan } from "@/lib/journal/format";
import { weekActivity } from "@/lib/today";
import { useJournal } from "./JournalProvider";
import { TodayMentor } from "./MentorSlot";
import { useNow } from "./useNow";

const RECENT = 5;
const BAR_PX = 96;

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Ticks every second while `on`, so a running session's clock moves. Null before the first client render. */
function useTick(on: boolean): number | null {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setT(Date.now());
    tick();
    if (!on) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [on]);
  return t;
}

export function Today() {
  const { ready, records } = useJournal();
  const minute = useNow();
  const live = records.find((r) => ["active", "paused"].includes(deriveSession(r.session).status));
  const liveStatus = live ? deriveSession(live.session).status : null;
  const tick = useTick(liveStatus === "active");

  const recent = useMemo(
    () =>
      records
        .map((r) => ({ r, d: deriveSession(r.session) }))
        .filter((x) => x.d.status === "ended")
        .sort((a, b) => (b.d.endedAt ?? "").localeCompare(a.d.endedAt ?? ""))
        .slice(0, RECENT),
    [records],
  );
  const week = useMemo(() => (minute === null ? null : weekActivity(records.map((r) => r.session), minute)), [records, minute]);
  const weekTotal = week?.reduce((n, d) => n + d.activeMs, 0) ?? 0;
  const max = week ? Math.max(...week.map((d) => d.activeMs), 1) : 1;
  const elapsed = live && tick !== null ? deriveSession(live.session, tick).activeMs : null;

  return (
    <div className="space-y-10">
      <header className="page-head">
        <p className="eyebrow">{minute === null ? "\u00a0" : new Date(minute).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>Today</h1>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="min-w-0 space-y-10">
          <section aria-label="Session">
            {!ready ? (
              <div className="skeleton h-32 w-full" aria-hidden />
            ) : live ? (
              <div className="card flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:p-6">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{liveStatus === "paused" ? "Paused session" : "Session running"}</p>
                  <p className="headline mt-1.5 break-words text-2xl">{deriveSession(live.session).subject}</p>
                  <p className="mono mt-2 text-3xl text-accent-text" aria-label="Active time">
                    {elapsed === null ? "0:00:00" : formatClock(elapsed)}
                  </p>
                </div>
                <Link href="/journal/" className="btn btn-primary btn-lg w-full shrink-0 sm:w-auto">
                  {liveStatus === "paused" ? "Resume" : "Open session"}
                </Link>
              </div>
            ) : (
              <div className="card flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:p-6">
                <div className="min-w-0 flex-1">
                  <p className="headline text-xl">Ready when you are</p>
                  <p className="mt-1 text-ink-2">Time what you study and note what you learn.</p>
                </div>
                <Link href="/journal/" className="btn btn-primary btn-lg w-full shrink-0 sm:w-auto">
                  Start a session
                </Link>
              </div>
            )}
          </section>

          <section aria-label="Recent learning activity">
            <div className="section-head">
              <h2>Recent activity</h2>
            </div>
            {!ready ? (
              <div className="space-y-2" aria-hidden>
                <div className="skeleton h-12 w-full" />
                <div className="skeleton h-12 w-full" />
              </div>
            ) : recent.length === 0 ? (
              <div className="empty-state">
                <strong>No finished sessions yet</strong>
                <span className="text-[15px]">Sessions you end show up here.</span>
              </div>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {recent.map(({ r, d }) => (
                  <li key={r.session.id}>
                    <Link href={`/journal/?s=${encodeURIComponent(r.session.id)}`} className="-mx-3 flex min-h-12 items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2">
                      <span className="min-w-0 break-words font-medium">{deriveSession(r.session).subject}</span>
                      <span className="meta flex shrink-0 items-center gap-3">
                        {dateOf(d.startedAt)}
                        <span className="mono w-14 text-right text-ink-2">{formatSpan(d.activeMs)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <TodayMentor />
        </div>

        <section aria-label="This week" className="min-w-0">
          <div className="section-head">
            <h2>This week</h2>
            {week && weekTotal > 0 && <span className="meta mono">{formatSpan(weekTotal)} active</span>}
          </div>
          {!ready || week === null ? (
            <div className="skeleton h-36 w-full" aria-hidden />
          ) : weekTotal === 0 ? (
            <div className="empty-state">
              <strong>No time recorded this week</strong>
              <span className="text-[15px]">Active minutes appear here once you run a session.</span>
            </div>
          ) : (
            <ul className="card flex items-end gap-2 p-4" aria-label="Active time per day">
              {week.map((d, i) => {
                const label = new Date(d.dayStart).toLocaleDateString(undefined, { weekday: "short" });
                return (
                  <li key={d.dayStart} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={`${label}: ${formatSpan(d.activeMs)}`}>
                    <span className="flex w-full items-end" style={{ height: BAR_PX }}>
                      <span
                        className="day-bar"
                        data-on={d.activeMs > 0}
                        style={{ height: d.activeMs > 0 ? Math.max(6, (d.activeMs / max) * BAR_PX) : 3, animationDelay: `${i * 40}ms` }}
                      />
                    </span>
                    <span className={`meta ${i === week.length - 1 ? "font-semibold text-ink" : ""}`}>{label}</span>
                    <span className="sr-only">{formatSpan(d.activeMs)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
