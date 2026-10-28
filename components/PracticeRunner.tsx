"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { buildPracticeSet, recommend } from "@/lib/recommend";
import { DOMAIN_LABELS, type Question, type TopicMeta } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { Quiz } from "./Quiz";

const SESSION_SIZE = 10;

export function PracticeRunner({ questions, topics }: { questions: Question[]; topics: TopicMeta[] }) {
  const { data, ready } = useProgress();
  const params = useSearchParams();
  const topicParam = params.get("topic");
  const [running, setRunning] = useState<Question[] | null>(null);
  const [round, setRound] = useState(0);

  if (!ready) return <p className="font-mono text-xs tracking-widest text-accent uppercase">Loading mission data…</p>;

  const focusTopic = topicParam ? topics.find((t) => `${t.domain}/${t.topic}` === topicParam) : undefined;

  const build = (): Question[] => {
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
        onRestart={focusTopic ? undefined : start}
      />
    );
  }

  const rec = recommend(data, questions, topics);
  const preview = build();

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-accent">{focusTopic ? "TARGETED DRILL" : "DANGER ROOM"}</p>
        <h1 className="font-comic text-5xl text-white">{focusTopic ? focusTopic.title : "Training round"}</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          {focusTopic
            ? `Every question on this topic, easiest first.`
            : `A ${SESSION_SIZE}-question simulation built from your data: missed targets due for re-engagement first, then your vulnerabilities, then sectors you haven't scanned yet.`}
        </p>
        {focusTopic && (
          <Link href="/practice/" className="mt-2 inline-block text-sm text-accent hover:underline">
            ← Back to training round
          </Link>
        )}
      </div>

      {!focusTopic && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Reviews due" value={rec.dueQuestionIds.length} />
          <Stat label="Vulnerable topics" value={rec.focus.filter((f) => f.reason === "weak" || f.reason === "shaky").length} />
          <Stat label="Unscanned topics" value={rec.focus.filter((f) => f.reason === "untested").length} />
        </div>
      )}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-comic text-2xl text-white">Mission briefing</h2>
        <ul className="flex flex-wrap gap-2 text-xs">
          {[...new Set(preview.map((q) => `${q.domain}/${q.topic}`))].map((key) => {
            const t = topics.find((x) => `${x.domain}/${x.topic}` === key);
            const n = preview.filter((q) => `${q.domain}/${q.topic}` === key).length;
            return (
              <li key={key} className="rounded border border-line bg-accent/10 px-2.5 py-1 font-bold tracking-wider text-accent uppercase">
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
        className="rounded bg-accent px-6 py-2.5 font-comic text-xl text-accent-ink transition hover:bg-white hover:shadow-neon disabled:opacity-40"
      >
        Engage · {preview.length} questions
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-glow">
      <p className="font-mono text-[10px] tracking-[0.15em] text-ink-3 uppercase">{label}</p>
      <p className="font-comic text-3xl text-white tabular-nums">{value}</p>
    </div>
  );
}
