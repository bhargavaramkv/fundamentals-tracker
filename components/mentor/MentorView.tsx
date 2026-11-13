"use client";

import Link from "next/link";
import { useJournal } from "../JournalProvider";
import { useMentor } from "../MentorProvider";
import type { WeeklyCite, WeeklyFinding, WeeklyReport } from "@/lib/review/weekly";
import { Markdown } from "./Markdown";
import { Eyebrow } from "../ui/Eyebrow";
import { PageHeader } from "../ui/PageHeader";
import { Panel } from "../ui/Panel";
import { StatusPill } from "../ui/StatusPill";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Cites({ cites }: { cites: WeeklyCite[] }) {
  const ids = [...new Set(cites.map((c) => c.sessionId))];
  if (ids.length === 0) return null;
  return (
    <span className="meta">
      {" "}
      {ids.map((id, i) => (
        <Link key={id} href={`/journal/?s=${encodeURIComponent(id)}`} className="text-accent-text hover:underline">
          session {i + 1}
          {i < ids.length - 1 ? ", " : ""}
        </Link>
      ))}
    </span>
  );
}

function FindingList({ title, items }: { title: string; items: WeeklyFinding[] }) {
  return (
    <section className="min-w-0 space-y-3">
      <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan">
        {title}
        <span className="mono text-muted">{items.length}</span>
      </h4>
      <ul className="space-y-3">
        {items.map((f, i) => (
          <li key={i} className="break-words border-l border-line-2 pl-3 text-[15px]">
            <span className="font-semibold">{f.concept}.</span> <span className="text-ink-2">{f.text}</span>
            <Cites cites={f.evidence} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const FOLLOWED = {
  yes: { tone: "good", label: "Followed" },
  no: { tone: "bad", label: "Not followed" },
  unclear: { tone: "neutral", label: "Unclear" },
} as const;

function Report({ r }: { r: WeeklyReport }) {
  const limited = r.sufficiency === "activity-only";
  const a = r.activity;
  const groups = [
    { title: "Improved", items: r.improved },
    { title: "Weak", items: r.weak },
    { title: "Repeated misunderstandings", items: r.repeatedMisunderstandings },
    { title: "Revisit", items: r.revisit },
    { title: "Learn next", items: r.learnNext },
  ].filter((g) => g.items.length > 0);
  return (
    <article className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-semibold">{r.week}</h3>
        <StatusPill tone={limited ? "warn" : "info"}>{limited ? "Activity only" : "Coaching"}</StatusPill>
      </div>
      <p className="text-[13px] text-muted">
        {r.model} · {dateOf(r.createdAt)} · {a.sessions} {a.sessions === 1 ? "session" : "sessions"} ({a.endedSessions} ended) · {a.activeMinutes} active min · {a.reviews}{" "}
        {a.reviews === 1 ? "review" : "reviews"}
      </p>
      {limited && <p className="text-[14px] text-ink-2">Not enough history for coaching yet: this week is an activity summary only.</p>}
      {a.topics.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Topics">
          {a.topics.map((t) => (
            <li key={t} className="rounded-full border border-line-2 px-2.5 py-0.5 text-xs text-ink-2">
              {t}
            </li>
          ))}
        </ul>
      )}
      {r.priorities.length > 0 && (
        <Panel variant="hero" className="p-6 sm:p-8">
          <Eyebrow>Priorities</Eyebrow>
          <ol className="mt-4 space-y-4">
            {r.priorities.map((p, i) => (
              <li key={i} className="flex gap-4">
                <span className="mono mt-1 text-sm text-cyan">{String(i + 1).padStart(2, "0")}</span>
                <p className="break-words text-[1.25rem] font-semibold leading-snug tracking-[-0.01em] sm:text-[1.5rem]">{p}</p>
              </li>
            ))}
          </ol>
        </Panel>
      )}
      {groups.length > 0 && (
        <Panel className="p-6">
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {groups.map((g) => (
              <FindingList key={g.title} title={g.title} items={g.items} />
            ))}
          </div>
        </Panel>
      )}
      {r.previousRecommendations.length > 0 && (
        <Panel className="p-6">
          <Eyebrow>Last week&apos;s recommendations</Eyebrow>
          <ul className="mt-4 divide-y divide-line">
            {r.previousRecommendations.map((p, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0 break-words text-[15px] text-ink-2">
                  {p.text}
                  <Cites cites={p.evidence} />
                </span>
                <span className="shrink-0">
                  <StatusPill tone={FOLLOWED[p.followed].tone}>{FOLLOWED[p.followed].label}</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </article>
  );
}

export function MentorView() {
  const { hasToken, loaded, error, weekly, reviews, archive, archiveReadme, invalid } = useMentor();
  const { records } = useJournal();
  const subjectOf = (id: string) => records.find((r) => r.session.id === id)?.session.subject;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Mentor"
        title="Reviews and reports"
        subtitle={
          <>
            What the mentor noticed in your sessions.{" "}
            <Link href="/knowledge/" className="font-medium text-accent-text hover:underline">
              See Knowledge
            </Link>
          </>
        }
        horizon
      />

      {error && <p className="meta text-warn">{error}</p>}
      {invalid > 0 && <p className="meta">{invalid} {invalid === 1 ? "file" : "files"} could not be read and {invalid === 1 ? "was" : "were"} skipped.</p>}

      {!hasToken ? (
        <div className="empty-state">
          <strong>Connect sync in Settings to see reviews</strong>
          <span className="text-[15px]">Reviews and reports are stored in your private data repo.</span>
        </div>
      ) : !loaded ? (
        <div className="skeleton h-32 w-full" aria-hidden />
      ) : (
        <>
          <section aria-label="Weekly reports" className="space-y-4">
            <h2 className="text-lg font-semibold">Weekly reports</h2>
            {weekly.length === 0 ? (
              <div className="empty-state">
                <strong>No weekly report yet</strong>
                <span className="text-[15px]">One is written after a week with recorded sessions.</span>
              </div>
            ) : (
              weekly.map((r, i) =>
                i === 0 ? (
                  <Report key={r.week} r={r} />
                ) : (
                  <details key={r.week} className="panel group p-5">
                    <summary className="cursor-pointer font-medium">
                      {r.week} <span className="text-[13px] text-muted">· {r.sufficiency === "activity-only" ? "activity only" : "coaching"}</span>
                    </summary>
                    <div className="mt-4">
                      <Report r={r} />
                    </div>
                  </details>
                ),
              )
            )}
          </section>

          <section aria-label="Recent session reviews" className="space-y-4">
            <h2 className="text-lg font-semibold">Recent session reviews</h2>
            {reviews.length === 0 ? (
              <div className="empty-state">
                <strong>No reviews yet</strong>
                <span className="text-[15px]">Ending a session queues one.</span>
              </div>
            ) : (
              <ol className="relative">
                {reviews.slice(0, 20).map((r, i, all) => (
                  <li key={r.id} className="relative pl-8">
                    {i < all.length - 1 && <span aria-hidden className="absolute bottom-0 left-[7px] top-4 w-px bg-line-2" />}
                    <span aria-hidden className="absolute left-0 top-[1.15rem] h-[15px] w-[15px] rounded-full border-[1.5px] border-accent bg-surface" />
                    <Link href={`/journal/?s=${encodeURIComponent(r.sessionId)}`} className="mb-3 block rounded-xl px-4 py-3 transition-colors hover:bg-surface-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-line-2 px-2.5 py-0.5 text-xs text-cyan">{subjectOf(r.sessionId) ?? "Session"}</span>
                        <span className="text-[13px] text-muted">{dateOf(r.createdAt)}</span>
                      </span>
                      <span className="mt-1.5 line-clamp-2 block break-words text-[15px]">{r.summary}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-label="Earlier Mentor">
            <details className="panel p-5">
              <summary className="cursor-pointer font-medium">
                Earlier Mentor (V1, archived){" "}
                <span className="text-[13px] font-normal text-muted">
                  · {archive.length} {archive.length === 1 ? "report" : "reports"}
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                <p className="text-[13px] text-muted">Historical, from the V1 quiz Mentor; not counted as evidence. Read-only.</p>
                {archive.length === 0 ? (
                  <p className="text-[15px] text-ink-2">No archived reports found.</p>
                ) : (
                  <div className="space-y-2">
                    {archiveReadme && (
                      <details className="rounded-xl border border-line p-4">
                        <summary className="cursor-pointer font-medium">About this archive</summary>
                        <div className="mt-3">
                          <Markdown source={archiveReadme} />
                        </div>
                      </details>
                    )}
                    {archive.map((a) => (
                      <details key={a.name} className="rounded-xl border border-line p-4">
                        <summary className="cursor-pointer font-medium">{a.name}</summary>
                        <div className="mt-3">
                          <Markdown source={a.text} />
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
