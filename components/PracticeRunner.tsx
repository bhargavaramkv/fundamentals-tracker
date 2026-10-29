"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { buildPracticeSet, recommend } from "@/lib/recommend";
import { DOMAIN_LABELS, type Question, type TopicMeta } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { DomainIcon } from "./DomainIcon";
import { Quiz } from "./Quiz";

const SESSION_SIZE = 10;

export function PracticeRunner({ questions, topics }: { questions: Question[]; topics: TopicMeta[] }) {
  const { data, ready } = useProgress();
  const params = useSearchParams();
  const topicParam = params.get("topic");
  const warmup = params.get("mode") === "warmup";
  const [running, setRunning] = useState<Question[] | null>(null);
  const [round, setRound] = useState(0);

  if (!ready) return <p className="text-ink-2">Loading your progress…</p>;

  const focusTopic = topicParam ? topics.find((t) => `${t.domain}/${t.topic}` === topicParam) : undefined;

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
    if (focusTopic) {
      return questions
        .filter((q) => q.domain === focusTopic.domain && q.topic === focusTopic.topic)
        .sort((a, b) => a.difficulty - b.difficulty);
    }
    return buildPracticeSet(data, questions, topics, SESSION_SIZE);
  };

  const start = () => {
    setRound((r) => r + 1);
    setRunning(build());
  };

  if (running) {
    return (
      <Quiz
        key={round}
        questions={running}
        mode="practice"
        onExit={() => setRunning(null)}
        onRestart={focusTopic || warmup ? undefined : start}
      />
    );
  }

  const rec = recommend(data, questions, topics);
  const preview = build();

  return (
    <div className="space-y-8">
      <div className="hero-grid pt-2 sm:pt-6">
        <p className="eyebrow">{warmup ? "Low pressure" : focusTopic ? "Topic drill" : "Recommended session"}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.125rem]">
          {warmup ? "Warm-up" : focusTopic ? `Practice: ${focusTopic.title}` : "Adaptive practice"}
        </h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          {warmup
            ? "Five core-level questions you haven't answered correctly yet. No pressure: just get moving."
            : focusTopic
            ? `Every question for this topic, easiest first.`
            : `A ${SESSION_SIZE}-question round built from your data: questions due for spaced review first, then your weakest topics, then topics you haven't tried yet.`}
        </p>
        {(focusTopic || warmup) && (
          <Link href="/practice/" className="tap mt-2 inline-block text-sm text-accent-text hover:underline">
            ← Back to adaptive practice
          </Link>
        )}
      </div>

      {!focusTopic && !warmup && (
        <div className="grid grid-cols-3 divide-x divide-line border-y border-line">
          <Stat label="Reviews due" value={rec.dueQuestionIds.length} />
          <Stat label="Weak or shaky topics" value={rec.focus.filter((f) => f.reason === "weak" || f.reason === "shaky").length} />
          <Stat label="Untested topics" value={rec.focus.filter((f) => f.reason === "untested").length} />
        </div>
      )}

      {!warmup && !focusTopic && (
        <p className="text-sm text-ink-2">
          Low on energy?{" "}
          <Link href="/fun/" className="tap font-medium text-accent-text hover:underline">
            Try the fun corner
          </Link>{" "}
          or a{" "}
          <Link href="/practice/?mode=warmup" className="tap font-medium text-accent-text hover:underline">
            5-question warm-up
          </Link>
          .
        </p>
      )}

      <section>
        <div className="section-head mb-3">
          <h2>This round covers</h2>
        </div>
        <ul className="flex flex-wrap gap-2 text-xs">
          {[...new Set(preview.map((q) => `${q.domain}/${q.topic}`))].map((key) => {
            const t = topics.find((x) => `${x.domain}/${x.topic}` === key);
            const n = preview.filter((q) => `${q.domain}/${q.topic}` === key).length;
            return (
              <li key={key} className="chip chip-icon text-ink-2">
                {t && <DomainIcon domain={t.domain} size={22} />}
                {t?.title ?? key} <span className="text-ink-3">×{n}</span>
              </li>
            );
          })}
        </ul>
        {preview[0] && (
          <p className="mt-3 text-xs text-ink-3">Starts with {DOMAIN_LABELS[preview[0].domain]}.</p>
        )}
      </section>

      <button
        type="button"
        onClick={start}
        disabled={preview.length === 0}
        className="btn btn-primary"
      >
        Start round · {preview.length} questions <span className="btn-arrow" aria-hidden>→</span>
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-3 first:pl-0 sm:px-5">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </div>
  );
}
