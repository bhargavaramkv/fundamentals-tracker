"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deriveSession } from "@/lib/journal/events";
import { formatClock, formatSpan } from "@/lib/journal/format";
import { SOURCE_LABELS } from "@/lib/journal/types";
import { weekActivity } from "@/lib/today";
import { useJournal } from "./JournalProvider";
import { useMentor } from "./MentorProvider";
import { DueList, NextUp, TodayMentor } from "./MentorSlot";
import { useConcepts } from "./mentor/useConcepts";
import { relativeDays, useNow } from "./useNow";
import { Button } from "./ui/Button";
import { Eyebrow } from "./ui/Eyebrow";
import { ArrowRightIcon, ClockIcon, PlayIcon } from "./ui/icons";
import { LevelBar, type LevelCounts } from "./ui/LevelBar";
import { PageHeader } from "./ui/PageHeader";
import { Panel } from "./ui/Panel";
import { Ring } from "./ui/Ring";
import { StatusPill } from "./ui/StatusPill";

const RECENT = 5;
const BAR_PX = 112;

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

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
  const { hasToken, loaded, pending, reviewsBySession } = useMentor();
  const concepts = useConcepts();
  const minute = useNow();
  const live = records.find((r) =>
    ["active", "paused"].includes(deriveSession(r.session).status),
  );
  const liveD = live ? deriveSession(live.session) : null;
  const tick = useTick(liveD?.status === "active");

  const recent = useMemo(
    () =>
      records
        .map((r) => ({ r, d: deriveSession(r.session) }))
        .filter((x) => x.d.status === "ended")
        .sort((a, b) => (b.d.endedAt ?? "").localeCompare(a.d.endedAt ?? ""))
        .slice(0, RECENT),
    [records],
  );
  const last = recent[0];
  const week = useMemo(
    () =>
      minute === null
        ? null
        : weekActivity(
            records.map((r) => r.session),
            minute,
          ),
    [records, minute],
  );
  const weekTotal = week?.reduce((n, d) => n + d.activeMs, 0) ?? 0;
  const max = week ? Math.max(...week.map((d) => d.activeMs), 1) : 1;
  const elapsed =
    live && tick !== null ? deriveSession(live.session, tick).activeMs : null;

  const counts: LevelCounts = {
    retained: 0,
    applied: 0,
    understood: 0,
    exposed: 0,
  };
  for (const c of concepts)
    if (c.result.level !== "none") counts[c.result.level]++;
  const conceptTotal =
    counts.retained + counts.applied + counts.understood + counts.exposed;

  const reviewPill = (sessionId: string) => {
    if (!hasToken || !loaded) return null;
    if (reviewsBySession.has(sessionId))
      return <StatusPill tone="good">Reviewed</StatusPill>;
    const p = pending.find((x) => x.request.sessionId === sessionId);
    if (!p) return null;
    return p.failures.length > 0 ? (
      <StatusPill tone="bad">Review failed</StatusPill>
    ) : (
      <StatusPill tone="warn">Review queued</StatusPill>
    );
  };

  const subtitle = liveD
    ? liveD.status === "paused"
      ? "A session is paused."
      : "A session is running."
    : "Time what you study and note what you learn.";
  const heroTitle =
    "mt-3 break-words text-[2rem] font-bold leading-tight tracking-[-0.03em] sm:text-[2.5rem]";

  return (
    <div>
      <PageHeader
        eyebrow={
          minute === null
            ? " "
            : new Date(minute).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
        }
        title="Today"
        subtitle={subtitle}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section
          aria-label="Session"
          className="order-1 min-w-0 xl:order-none xl:col-span-8 xl:col-start-1 xl:row-start-1"
        >
          {!ready ? (
            <div className="skeleton h-72 w-full" aria-hidden />
          ) : (
            <Panel
              variant="hero"
              className="flex h-full min-h-[18rem] flex-wrap items-center justify-between gap-x-8 gap-y-6 p-6 sm:p-9"
            >
              {liveD ? (
                <>
                  <div className="min-w-0 flex-1 basis-72">
                    <Eyebrow>Continue where you left off</Eyebrow>
                    <h2 className={heroTitle}>{liveD.subject}</h2>
                    {liveD.objective && (
                      <p className="mt-3 max-w-[52ch] break-words text-ink-2">
                        {liveD.objective}
                      </p>
                    )}
                    <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-muted">
                      <span>{SOURCE_LABELS[liveD.source.kind]}</span>
                      {liveD.topics.length > 0 && (
                        <span>
                          {liveD.topics.length}{" "}
                          {liveD.topics.length === 1 ? "topic" : "topics"}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <ClockIcon className="h-4 w-4" />
                        {formatSpan(liveD.activeMs)} active
                      </span>
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                      <Button href="/journal/" variant="primary" size="lg">
                        <PlayIcon className="h-4 w-4" />
                        {liveD.status === "paused" ? "Resume" : "Open session"}
                      </Button>
                    </div>
                  </div>
                  <Ring size={196}>
                    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                      Active time
                    </span>
                    <span
                      className="mono mt-1 text-[1.7rem] font-semibold"
                      aria-label="Active time"
                    >
                      {elapsed === null ? "0:00:00" : formatClock(elapsed)}
                    </span>
                  </Ring>
                </>
              ) : last ? (
                <>
                  <div className="min-w-0 flex-1 basis-72">
                    <Eyebrow>Last session</Eyebrow>
                    <h2 className={heroTitle}>{last.d.subject}</h2>
                    <p className="mt-3 text-ink-2">
                      Ended{" "}
                      {minute === null
                        ? dateOf(last.d.endedAt ?? last.d.startedAt)
                        : relativeDays(
                            last.d.endedAt ?? last.d.startedAt,
                            minute,
                          )}{" "}
                      · {formatSpan(last.d.activeMs)} active
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                      <Button href="/journal/" variant="primary" size="lg">
                        <PlayIcon className="h-4 w-4" />
                        Start session
                      </Button>
                      <Button
                        href={`/journal/?s=${encodeURIComponent(last.r.session.id)}`}
                        size="lg"
                      >
                        Open journal
                      </Button>
                    </div>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end text-right sm:flex">
                    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                      Active time
                    </span>
                    <span className="mono mt-1 text-[3.25rem] font-semibold leading-none tracking-tight">
                      {formatSpan(last.d.activeMs)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="min-w-0 flex-1 basis-72">
                  <Eyebrow>Ready when you are</Eyebrow>
                  <h2 className={heroTitle}>No sessions yet</h2>
                  <p className="mt-3 max-w-[48ch] text-ink-2">
                    Start a session to time what you study. Notes, reviews and
                    knowledge build up from there.
                  </p>
                  <div className="mt-7">
                    <Button href="/journal/" variant="primary" size="lg">
                      <PlayIcon className="h-4 w-4" />
                      Start session
                    </Button>
                  </div>
                </div>
              )}
            </Panel>
          )}
        </section>

        <section
          aria-label="This week"
          className="order-4 min-w-0 xl:order-none xl:col-span-4 xl:col-start-9 xl:row-start-1"
        >
          <Panel className="h-full p-6">
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">This week</h2>
              {week && weekTotal > 0 && (
                <span className="mono text-[13px] text-cyan">
                  {formatSpan(weekTotal)} active
                </span>
              )}
            </div>
            {!ready || week === null ? (
              <div className="skeleton h-36 w-full" aria-hidden />
            ) : weekTotal === 0 ? (
              <div className="empty-state">
                <strong>No time recorded this week</strong>
                <span className="text-[15px]">
                  Active minutes appear here once you run a session.
                </span>
              </div>
            ) : (
              <ul
                className="flex items-end gap-2"
                aria-label="Active time per day"
              >
                {week.map((d, i) => {
                  const label = new Date(d.dayStart).toLocaleDateString(
                    undefined,
                    { weekday: "short" },
                  );
                  const isToday = i === week.length - 1;
                  return (
                    <li
                      key={d.dayStart}
                      className="flex min-w-0 flex-1 flex-col items-center gap-2"
                      title={`${label}: ${formatSpan(d.activeMs)}`}
                    >
                      <span
                        className="flex w-full items-end justify-center"
                        style={{ height: BAR_PX }}
                      >
                        <span
                          className={`block w-full max-w-7 rounded-md ${d.activeMs > 0 ? "bg-gradient-to-t from-cyan/70 to-accent" : "bg-line-2"}`}
                          style={{
                            height:
                              d.activeMs > 0
                                ? Math.max(8, (d.activeMs / max) * BAR_PX)
                                : 3,
                          }}
                        />
                      </span>
                      <span
                        className={`text-xs ${isToday ? "font-semibold text-ink" : "text-muted"}`}
                      >
                        {label}
                      </span>
                      <span className="sr-only">{formatSpan(d.activeMs)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </section>

        <TodayMentor className="order-2 min-w-0 xl:order-none xl:col-span-8 xl:col-start-1 xl:row-start-2" />
        <NextUp
          live={
            liveD && {
              subject: liveD.subject,
              paused: liveD.status === "paused",
            }
          }
          className="order-3 min-w-0 xl:order-none xl:col-span-4 xl:col-start-9 xl:row-start-2"
        />

        <section
          aria-label="Recent learning activity"
          className="order-5 min-w-0 xl:order-none xl:col-span-7 xl:col-start-1 xl:row-start-3"
        >
          <Panel className="h-full p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <Link
                href="/journal/"
                className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-text hover:underline"
              >
                View journal <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            {!ready ? (
              <div className="space-y-2" aria-hidden>
                <div className="skeleton h-12 w-full" />
                <div className="skeleton h-12 w-full" />
              </div>
            ) : recent.length === 0 ? (
              <div className="empty-state">
                <strong>No finished sessions yet</strong>
                <span className="text-[15px]">
                  Sessions you end show up here.
                </span>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map(({ r, d }) => (
                  <li key={r.session.id}>
                    <Link
                      href={`/journal/?s=${encodeURIComponent(r.session.id)}`}
                      className="-mx-3 flex min-h-14 items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block break-words font-medium">
                          {d.subject}
                        </span>
                        <span className="block text-[13px] text-muted">
                          {dateOf(d.startedAt)} ·{" "}
                          <span className="mono">{formatSpan(d.activeMs)}</span>
                        </span>
                      </span>
                      <span className="shrink-0">
                        {reviewPill(r.session.id)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>

        <div className="order-6 flex min-w-0 flex-col gap-5 xl:order-none xl:col-span-5 xl:col-start-8 xl:row-start-3">
          <Panel as="section" className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Knowledge</h2>
              <Link
                href="/knowledge/"
                className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-text hover:underline"
              >
                {conceptTotal > 0 ? `${conceptTotal} concepts` : "Open"}{" "}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            {conceptTotal === 0 ? (
              <p className="text-[15px] text-ink-2">
                No concepts yet. They appear as reviews and sessions add
                evidence.
              </p>
            ) : (
              <LevelBar counts={counts} />
            )}
          </Panel>
          <DueList />
        </div>
      </div>
    </div>
  );
}
