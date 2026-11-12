"use client";

import Link from "next/link";
import { useMemo } from "react";
import { topicSummary } from "@/lib/journal/summary";
import { useJournal } from "./JournalProvider";
import { useLearnerProfile } from "./useLearnerProfile";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function KnowledgeView() {
  const { ready, records } = useJournal();
  const profile = useLearnerProfile();
  const topics = useMemo(() => topicSummary(records), [records]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl sm:text-4xl">Knowledge</h1>
        <p className="mt-1 text-[17px] text-ink-2">What your journal and your profile show so far.</p>
      </header>

      <section aria-label="Learner profile" className="card p-5 sm:p-6">
        <h2 className="headline text-xl">Learner profile</h2>
        {profile ? (
          <div className="mt-2 space-y-3 text-[15px]">
            <p>{profile.headline}</p>
            {profile.strengths.length > 0 && <p className="text-ink-2">Strengths: {profile.strengths.join(", ")}</p>}
            {profile.struggles.length > 0 && (
              <div>
                <p className="font-bold">Struggles</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-2">
                  {profile.struggles.map((s) => (
                    <li key={s.topic}>{s.misconception}</li>
                  ))}
                </ul>
              </div>
            )}
            {profile.interests.length > 0 && <p className="text-ink-2">Interests: {profile.interests.join(", ")}</p>}
            <p className="meta">Updated {dateOf(profile.updatedAt)}</p>
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-ink-2">No profile yet. It appears here once sync is on and the daily review has written one.</p>
        )}
      </section>

      <section aria-label="Topics studied">
        <h2 className="headline text-xl">Topics you have studied</h2>
        {!ready ? (
          <p className="mt-2 text-ink-2">Loading…</p>
        ) : topics.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-2">Nothing yet. Topics appear here after you record a journal session.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {topics.map((t) => (
              <li key={t.topic.toLowerCase()} className="card flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="min-w-0 break-words font-bold">{t.topic}</span>
                <span className="meta shrink-0">
                  {t.sessions} {t.sessions === 1 ? "session" : "sessions"} · last {dateOf(t.lastStudied)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[15px] text-ink-2">
        Looking for practice material?{" "}
        <Link href="/learn/" className="font-bold text-accent-text hover:underline">
          Browse the optional lessons
        </Link>
      </p>
    </div>
  );
}
