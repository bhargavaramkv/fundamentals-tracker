"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { buildPracticeSet, recommend } from "@/lib/recommend";
import type { Question, TopicMeta } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { Quiz } from "./Quiz";

const SESSION_SIZE = 10;

/**
 * Mixed rounds across topics: the daily review from Today, and the low-pressure warm-up. Practising one topic lives in
 * its workspace, and the old topic links are forwarded there.
 */
export function PracticeRunner({ questions, topics }: { questions: Question[]; topics: TopicMeta[] }) {
  const { data, ready } = useProgress();
  const params = useSearchParams();
  const router = useRouter();
  const topicParam = params.get("topic");
  const warmup = params.get("mode") === "warmup";
  const [running, setRunning] = useState<Question[] | null>(null);
  const [round, setRound] = useState(0);
  const forwardTo = topicParam && topics.some((t) => `${t.domain}/${t.topic}` === topicParam) ? `/learn/${topicParam}/?tab=practice` : null;

  useEffect(() => {
    if (forwardTo) router.replace(forwardTo);
  }, [forwardTo, router]);

  if (!ready || forwardTo) return <p className="text-ink-2">Loading your progress…</p>;

  const build = (): Question[] => {
    if (warmup) {
      // Easy wins: core-level questions you haven't got right yet, never-seen first.
      const correct = new Set(data.answers.filter((a) => a.correct).map((a) => a.questionId));
      const seen = new Set(data.answers.map((a) => a.questionId));
      return questions
        .filter((q) => q.difficulty === 1 && !correct.has(q.id))
        .sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)) || a.id.localeCompare(b.id))
        .slice(0, 5);
    }
    return buildPracticeSet(data, questions, topics, SESSION_SIZE);
  };

  const start = () => {
    setRound((r) => r + 1);
    setRunning(build());
  };

  if (running) {
    return <Quiz key={round} questions={running} mode="practice" onExit={() => setRunning(null)} onRestart={warmup ? undefined : start} />;
  }

  const rec = recommend(data, questions, topics);
  const preview = build();
  const covers = [...new Set(preview.map((q) => `${q.domain}/${q.topic}`))].map((key) => ({
    key,
    title: topics.find((x) => `${x.domain}/${x.topic}` === key)?.title ?? key,
    n: preview.filter((q) => `${q.domain}/${q.topic}` === key).length,
  }));

  return (
    <div className="max-w-3xl space-y-9">
      <header className="page-head">
        <nav aria-label="Breadcrumb" className="meta mb-3">
          <Link href="/" className="tap hover:text-ink">
            Today
          </Link>
        </nav>
        <h1>{warmup ? "Warm-up" : "Mixed review"}</h1>
        <p>
          {warmup
            ? "Five core-level questions you haven't answered correctly yet. No pressure: just get moving."
            : `${SESSION_SIZE} questions chosen from your history: reviews that are due first, then your weakest topics, then topics you haven't tried.`}
        </p>
      </header>

      {!warmup && (
        <p className="text-[15px] text-ink-2">
          {rec.dueQuestionIds.length} {rec.dueQuestionIds.length === 1 ? "review" : "reviews"} due, {rec.focus.filter((f) => f.reason === "weak" || f.reason === "shaky").length} weak or shaky topics,{" "}
          {rec.focus.filter((f) => f.reason === "untested").length} untested. Low on energy?{" "}
          <Link href="/practice/?mode=warmup" className="text-accent-text hover:underline">
            Try the warm-up
          </Link>{" "}
          or the{" "}
          <Link href="/fun/" className="text-accent-text hover:underline">
            fun corner
          </Link>
          .
        </p>
      )}

      <section aria-labelledby="covers-h">
        <div className="section-head">
          <h2 id="covers-h">This round covers</h2>
        </div>
        {covers.length === 0 ? (
          <p className="pt-3 text-[15px] text-ink-2">Nothing to show: you&apos;ve already answered every core question correctly.</p>
        ) : (
          <ul className="divide-y divide-line">
            {covers.map((c) => (
              <li key={c.key} className="flex items-baseline justify-between gap-3 py-2.5 text-[15px]">
                <Link href={`/learn/${c.key}/`} className="hover:text-accent-text">
                  {c.title}
                </Link>
                <span className="meta shrink-0">
                  {c.n} question{c.n === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" onClick={start} disabled={preview.length === 0} className="btn btn-primary">
        Start · {preview.length} questions <span className="btn-arrow" aria-hidden>→</span>
      </button>
    </div>
  );
}
