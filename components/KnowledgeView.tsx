"use client";

import Link from "next/link";
import { useMemo } from "react";
import { topicSummary } from "@/lib/journal/summary";
import { useJournal } from "./JournalProvider";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function KnowledgeView() {
  const { ready, records } = useJournal();
  const topics = useMemo(() => topicSummary(records), [records]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl sm:text-4xl">Knowledge</h1>
        <p className="mt-1 text-[17px] text-ink-2">What you have studied, from your journal.</p>
      </header>

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
      <p className="meta">Answers from the old quizzes are archived and not counted as knowledge.</p>
    </div>
  );
}
