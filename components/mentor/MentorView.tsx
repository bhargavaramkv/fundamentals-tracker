"use client";

import Link from "next/link";
import { useJournal } from "../JournalProvider";
import { useMentor } from "../MentorProvider";
import type { WeeklyCite, WeeklyFinding, WeeklyReport } from "@/lib/review/weekly";
import { Markdown } from "./Markdown";

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
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h4 className="eyebrow">{title}</h4>
      <ul className="space-y-2">
        {items.map((f, i) => (
          <li key={i} className="break-words text-[15px]">
            <span className="font-semibold">{f.concept}.</span> <span className="text-ink-2">{f.text}</span>
            <Cites cites={f.evidence} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Report({ r }: { r: WeeklyReport }) {
  const limited = r.sufficiency === "activity-only";
  const a = r.activity;
  return (
    <article className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="headline text-xl">{r.week}</h3>
        <span className={`tag ${limited ? "bg-warn-bg text-warn" : "bg-accent-soft text-accent-text"}`}>{limited ? "Limited data: activity summary only" : "Coaching"}</span>
      </div>
      <p className="meta">
        {r.model} · {dateOf(r.createdAt)} · {a.sessions} {a.sessions === 1 ? "session" : "sessions"} ({a.endedSessions} ended) · {a.activeMinutes} active min · {a.reviews}{" "}
        {a.reviews === 1 ? "review" : "reviews"}
      </p>
      {a.topics.length > 0 && <p className="break-words text-[15px] text-ink-2">Topics: {a.topics.join(", ")}</p>}
      {r.priorities.length > 0 && (
        <section className="space-y-2">
          <h4 className="eyebrow">Priorities</h4>
          <ul className="list-disc space-y-1 pl-5 text-[15px]">
            {r.priorities.map((p, i) => (
              <li key={i} className="break-words">
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}
      <FindingList title="Improved" items={r.improved} />
      <FindingList title="Weak" items={r.weak} />
      <FindingList title="Repeated misunderstandings" items={r.repeatedMisunderstandings} />
      <FindingList title="Revisit" items={r.revisit} />
      <FindingList title="Learn next" items={r.learnNext} />
      {r.previousRecommendations.length > 0 && (
        <section className="space-y-2">
          <h4 className="eyebrow">Last week&apos;s recommendations</h4>
          <ul className="space-y-1.5">
            {r.previousRecommendations.map((p, i) => (
              <li key={i} className="break-words text-[15px] text-ink-2">
                {p.text} <span className="meta">· followed: {p.followed}</span>
                <Cites cites={p.evidence} />
              </li>
            ))}
          </ul>
        </section>
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
      <header className="page-head">
        <p className="eyebrow">Mentor</p>
        <h1>Reviews and reports</h1>
        <p>
          What the mentor noticed in your sessions.{" "}
          <Link href="/knowledge/" className="font-medium text-accent-text hover:underline">
            See Knowledge
          </Link>
        </p>
      </header>

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
            <div className="section-head">
              <h2>Weekly reports</h2>
            </div>
            {weekly.length === 0 ? (
              <div className="empty-state">
                <strong>No weekly report yet</strong>
                <span className="text-[15px]">One is written after a week with recorded sessions.</span>
              </div>
            ) : (
              weekly.map((r, i) =>
                i === 0 ? (
                  <div key={r.week} className="card p-5">
                    <Report r={r} />
                  </div>
                ) : (
                  <details key={r.week} className="card group p-5">
                    <summary className="cursor-pointer font-medium">
                      {r.week} <span className="meta">· {r.sufficiency === "activity-only" ? "limited data" : "coaching"}</span>
                    </summary>
                    <div className="mt-4">
                      <Report r={r} />
                    </div>
                  </details>
                ),
              )
            )}
          </section>

          <section aria-label="Recent session reviews" className="space-y-3">
            <div className="section-head">
              <h2>Recent session reviews</h2>
            </div>
            {reviews.length === 0 ? (
              <div className="empty-state">
                <strong>No reviews yet</strong>
                <span className="text-[15px]">Ending a session queues one.</span>
              </div>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {reviews.slice(0, 20).map((r) => (
                  <li key={r.id}>
                    <Link href={`/journal/?s=${encodeURIComponent(r.sessionId)}`} className="-mx-3 block rounded-lg px-3 py-3 transition-colors hover:bg-surface-2">
                      <span className="meta">
                        {subjectOf(r.sessionId) ?? "Session"} · {dateOf(r.createdAt)}
                      </span>
                      <span className="line-clamp-2 block break-words text-[15px]">{r.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Earlier Mentor" className="space-y-3">
            <div className="section-head">
              <h2>Earlier Mentor (V1, archived)</h2>
            </div>
            <p className="meta">Historical, from the V1 quiz Mentor; not counted as evidence. Read-only.</p>
            {archive.length === 0 ? (
              <p className="text-[15px] text-ink-2">No archived reports found.</p>
            ) : (
              <div className="space-y-2">
                {archiveReadme && (
                  <details className="card p-4">
                    <summary className="cursor-pointer font-medium">About this archive</summary>
                    <div className="mt-3">
                      <Markdown source={archiveReadme} />
                    </div>
                  </details>
                )}
                {archive.map((a) => (
                  <details key={a.name} className="card p-4">
                    <summary className="cursor-pointer font-medium">{a.name}</summary>
                    <div className="mt-3">
                      <Markdown source={a.text} />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
