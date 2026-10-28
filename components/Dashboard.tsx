"use client";

import Link from "next/link";
import { computeActivity, scoreHistory } from "@/lib/activity";
import { recommend, type FocusTopic } from "@/lib/recommend";
import { DOMAIN_LABELS, type Confidence, type Question, type TopicMeta, type TopicStat } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { ScoreChart } from "./ScoreChart";

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  low: "bg-surface-2 text-ink-3",
  medium: "bg-warn-bg text-warn",
  high: "bg-good-bg text-good",
};

const REASON_LABEL: Record<FocusTopic["reason"], string> = {
  weak: "Weak",
  "reviews-due": "Reviews due",
  shaky: "Missed, needs more evidence",
  untested: "Not tested yet",
};

function relativeDay(days: number | null): string {
  if (days === null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function Dashboard({ questions, topics }: { questions: Question[]; topics: TopicMeta[] }) {
  const { data, ready } = useProgress();
  if (!ready) return <p className="text-ink-2">Loading your progress…</p>;

  const titleOf = (t: { domain: string; topic: string }) =>
    topics.find((x) => x.domain === t.domain && x.topic === t.topic)?.title ?? t.topic;

  if (data.answers.length === 0) {
    return (
      <div className="space-y-6">
        <section className="rounded-xl border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Find your gaps</h1>
          <p className="mt-2 max-w-2xl text-ink-2">
            Start with the baseline assessment: {questions.length} interview-level questions across DSA, OOP and design,
            databases, system design, and web/networking. The tracker builds your skill profile from it, then adapts practice
            and lessons to your weakest topics.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/assess/" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink">
              Take the assessment
            </Link>
            <Link href="/lessons/" className="rounded-lg border border-line px-5 py-2.5 text-sm">
              Browse lessons
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const activity = computeActivity(data.answers);
  const rec = recommend(data, questions, topics);
  const history = scoreHistory(data.sessions);
  const totalCorrect = data.answers.filter((a) => a.correct).length;
  const gaps = rec.profile.weakTopics.slice(0, 6);
  const strengths = rec.profile.strongTopics.slice(0, 6);

  return (
    <div className="space-y-6">
      {activity.daysSinceActive !== null && activity.daysSinceActive >= 2 && (
        <div className="rounded-xl border border-warn bg-warn-bg px-4 py-3 text-sm text-warn" role="status">
          ⚠ Last practice was {relativeDay(activity.daysSinceActive)}. A 10-question round takes about 8 minutes.{" "}
          <Link href="/practice/" className="font-medium underline">
            Start one
          </Link>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Streak" value={`${activity.streak} day${activity.streak === 1 ? "" : "s"}`} />
        <Tile label="Last active" value={relativeDay(activity.daysSinceActive)} />
        <Tile
          label="Answered"
          value={String(data.answers.length)}
          sub={`${Math.round((100 * totalCorrect) / data.answers.length)}% correct`}
        />
        <Tile label="Reviews due" value={String(rec.dueQuestionIds.length)} />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Next up</h2>
          <Link href="/practice/" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
            Start adaptive round
          </Link>
        </div>
        {rec.focus.length === 0 ? (
          <p className="text-sm text-ink-2">No weak spots detected. Take the full assessment again to raise your confidence levels.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rec.focus.slice(0, 5).map((f) => (
              <li key={`${f.meta.domain}/${f.meta.topic}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{f.meta.title}</p>
                  <p className="text-xs text-ink-3">
                    {DOMAIN_LABELS[f.meta.domain]} · {REASON_LABEL[f.reason]}
                    {f.stat && f.stat.attempts > 0 ? ` · ${f.stat.score}% over ${f.stat.attempts} answers` : ""}
                    {f.dueCount > 0 ? ` · ${f.dueCount} due` : ""}
                  </p>
                </div>
                <Link href={`/lessons/${f.meta.domain}/${f.meta.topic}/`} className="text-sm text-accent hover:underline">
                  Lesson
                </Link>
                <Link
                  href={`/practice/?topic=${f.meta.domain}/${f.meta.topic}`}
                  className="text-sm text-accent hover:underline"
                >
                  Drill
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-1 font-medium">Skill profile</h2>
        <p className="mb-4 text-xs text-ink-3">
          Recency-weighted accuracy (answers fade with a 21-day half-life; harder questions count more). Confidence reflects
          how much evidence there is.
        </p>
        <ul className="space-y-3">
          {rec.profile.domains.map((d) => (
            <li key={d.domain}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{DOMAIN_LABELS[d.domain]}</span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${CONFIDENCE_STYLE[d.confidence]}`}>
                    {d.confidence} confidence
                  </span>
                  <span className="w-10 text-right font-medium tabular-nums">{d.attempts > 0 ? `${d.score}%` : "–"}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2" aria-hidden>
                <div className="h-2 rounded-full bg-accent" style={{ width: `${d.attempts > 0 ? Math.max(2, d.score) : 0}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink-3">
                {d.attempts} answers · {d.topics.filter((t) => t.attempts > 0).length}/{d.topics.length} topics covered
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <TopicList title="Gaps" icon="▼" tone="text-bad" empty="No weak topics yet." items={gaps} titleOf={titleOf} />
        <TopicList
          title="Strengths"
          icon="▲"
          tone="text-good"
          empty="Strengths show up after 3+ answers at 80%+ in a topic."
          items={strengths}
          titleOf={titleOf}
        />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Score per session</h2>
        <p className="mb-2 text-xs text-ink-3">Percentage correct in each finished assessment or practice round.</p>
        <ScoreChart points={history} />
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

function TopicList({
  title,
  icon,
  tone,
  empty,
  items,
  titleOf,
}: {
  title: string;
  icon: string;
  tone: string;
  empty: string;
  items: TopicStat[];
  titleOf: (t: TopicStat) => string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 font-medium">
        <span className={tone} aria-hidden>
          {icon}
        </span>{" "}
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((t) => (
            <li key={`${t.domain}/${t.topic}`} className="flex items-center justify-between gap-3">
              <Link href={`/lessons/${t.domain}/${t.topic}/`} className="truncate hover:underline">
                {titleOf(t)}
              </Link>
              <span className="shrink-0 tabular-nums text-ink-2">
                {t.score}% · {t.correct}/{t.attempts}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
