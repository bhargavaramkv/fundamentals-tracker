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
      <header className="page-head">
        <p className="eyebrow">Library</p>
        <h1>Knowledge</h1>
        <p>What you have studied, from your journal.</p>
      </header>

      <section aria-label="Topics studied">
        <div className="section-head">
          <h2>Topics you have studied</h2>
        </div>
        {!ready ? (
          <div className="space-y-2" aria-hidden>
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
          </div>
        ) : topics.length === 0 ? (
          <div className="empty-state">
            <strong>Nothing yet</strong>
            <span className="text-[15px]">Topics appear here after you record a journal session.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {topics.map((t) => (
              <li key={t.topic.toLowerCase()} className="card flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="min-w-0 break-words font-medium">{t.topic}</span>
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
        <Link href="/learn/" className="font-medium text-accent-text hover:underline">
          Browse the optional lessons
        </Link>
      </p>
      <p className="meta">Answers from the old quizzes are archived and not counted as knowledge.</p>
    </div>
  );
}
