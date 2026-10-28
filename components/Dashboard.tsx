"use client";

import Link from "next/link";
import { computeActivity, dayKey, scoreHistory } from "@/lib/activity";
import { recommend, type FocusTopic } from "@/lib/recommend";
import { DOMAIN_LABELS, type Confidence, type NewsItem, type Question, type TopicMeta, type TopicStat } from "@/lib/types";
import loginVault from "@/lib/login-vault.json";
import { DomainIcon, domainColor } from "./DomainIcon";
import { ProgressRing } from "./ProgressRing";
import { useProgress } from "./ProgressProvider";
import { ScoreChart } from "./ScoreChart";

const DAILY_GOAL = 10;

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  low: "bg-surface-2 text-ink-3",
  medium: "bg-warn-bg text-warn",
  high: "bg-good-bg text-good",
};

const REASON: Record<FocusTopic["reason"], { label: string; style: string }> = {
  weak: { label: "Weak spot", style: "bg-bad-bg text-bad" },
  "reviews-due": { label: "Review due", style: "bg-warn-bg text-warn" },
  shaky: { label: "Missed once", style: "bg-warn-bg text-warn" },
  untested: { label: "Not tried yet", style: "bg-surface-2 text-ink-2" },
};

const NAME = loginVault.username.charAt(0).toUpperCase() + loginVault.username.slice(1);

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function relativeDay(days: number | null): string {
  if (days === null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export type NewsHeadline = Pick<NewsItem, "slug" | "title" | "date" | "updated" | "severity" | "summary">;

export function Dashboard({
  questions,
  topics,
  news,
}: {
  questions: Question[];
  topics: TopicMeta[];
  news: NewsHeadline[];
}) {
  const { data, ready } = useProgress();
  if (!ready) return <p className="text-ink-2">Loading your progress…</p>;

  const titleOf = (t: { domain: string; topic: string }) =>
    topics.find((x) => x.domain === t.domain && x.topic === t.topic)?.title ?? t.topic;

  if (data.answers.length === 0) {
    return (
      <div className="space-y-6">
        <section className="card relative overflow-hidden p-6 sm:p-10">
          <p className="text-sm font-medium text-accent">
            {greeting()}, {NAME}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Let&apos;s find your gaps.</h1>
          <p className="mt-3 max-w-xl text-ink-2">
            One baseline assessment ({questions.length} interview-level questions) maps where you&apos;re strong and where
            you&apos;re guessing. After that, every practice round aims at your weakest topics.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(Object.keys(DOMAIN_LABELS) as (keyof typeof DOMAIN_LABELS)[]).map((d) => (
              <span key={d} className="chip chip-icon">
                <DomainIcon domain={d} size={26} />
                {DOMAIN_LABELS[d]}
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/assess/" className="btn btn-primary">
              Start the assessment →
            </Link>
            <Link href="/lessons/" className="btn btn-secondary">
              Browse lessons
            </Link>
          </div>
        </section>
        <NewsCard news={news} />
      </div>
    );
  }

  const activity = computeActivity(data.answers);
  const rec = recommend(data, questions, topics);
  const history = scoreHistory(data.sessions);
  // Overall mastery: domain scores weighted by how much evidence each has.
  const tried = rec.profile.domains.filter((d) => d.attempts > 0);
  const evidence = tried.reduce((n, d) => n + d.attempts, 0);
  const mastery = evidence ? Math.round(tried.reduce((n, d) => n + d.score * d.attempts, 0) / evidence) : 0;
  const today = dayKey(new Date());
  const answeredToday = data.answers.filter((a) => dayKey(new Date(a.answeredAt)) === today).length;
  const covered = rec.profile.domains.flatMap((d) => d.topics).filter((t) => t.attempts > 0).length;
  const gaps = rec.profile.weakTopics.slice(0, 6);
  const strengths = rec.profile.strongTopics.slice(0, 6);
  const next = rec.focus[0];

  return (
    <div className="space-y-6">
      {activity.daysSinceActive !== null && activity.daysSinceActive >= 2 && (
        <div className="flex items-center gap-3 rounded-2xl border border-warn/40 bg-warn-bg px-4 py-3 text-sm text-warn" role="status">
          <span aria-hidden className="text-lg">⏰</span>
          <span>
            Last practice was {relativeDay(activity.daysSinceActive)}. No energy for a full round? Read a{" "}
            <Link href="/fun/" className="font-semibold underline">
              2-minute bug story
            </Link>{" "}
            or do a{" "}
            <Link href="/practice/?mode=warmup" className="font-semibold underline">
              5-question warm-up
            </Link>
            .
          </span>
        </div>
      )}

      <section className="card grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:p-7">
        <div className="min-w-0">
          <p className="text-sm font-medium text-accent">
            {greeting()}, {NAME}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {next ? (
              <>
                Next up: <span className="text-accent">{next.meta.title}</span>
              </>
            ) : (
              "You're in great shape"
            )}
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            {rec.dueQuestionIds.length > 0
              ? `${rec.dueQuestionIds.length} review${rec.dueQuestionIds.length === 1 ? "" : "s"} due · `
              : ""}
            {covered} of {rec.profile.domains.flatMap((d) => d.topics).length} topics tried
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/practice/" className="btn btn-primary">
              Continue practice →
            </Link>
            {next && (
              <Link
                href={`/lessons/${next.meta.domain}/${next.meta.topic}/`}
                className="btn btn-secondary"
              >
                Read the lesson
              </Link>
            )}
          </div>
          <p className="mt-3 text-sm text-ink-3">
            Low on energy?{" "}
            <Link href="/fun/" className="tap font-medium text-accent hover:underline">
              Try the fun corner
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-5 sm:gap-6">
          <ProgressRing value={mastery} size={104} stroke={10} label={`Overall mastery ${mastery}%`}>
            <span>
              <span className="block text-2xl font-bold tabular-nums">{mastery}%</span>
              <span className="block text-[11px] text-ink-3">mastery</span>
            </span>
          </ProgressRing>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-2xl font-bold tabular-nums">
                <span aria-hidden>🔥</span> {activity.streak}
              </p>
              <p className="text-xs text-ink-3">day streak</p>
            </div>
            <div className="w-28">
              <p className="text-xs text-ink-3">
                Today: <span className="font-semibold text-ink">{Math.min(answeredToday, DAILY_GOAL)}</span>/{DAILY_GOAL}
              </p>
              <div className="mt-1 h-1.5 rounded-full bg-surface-2" aria-hidden>
                <div
                  className="h-1.5 rounded-full bg-good"
                  style={{ width: `${Math.min(100, (100 * answeredToday) / DAILY_GOAL)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <NewsCard news={news} />

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight">Skill profile</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rec.profile.domains.map((d) => {
            const tried = d.topics.filter((t) => t.attempts > 0).length;
            return (
              <li key={d.domain} className="card flex items-center gap-4 p-4">
                <ProgressRing
                  value={d.attempts > 0 ? d.score : 0}
                  size={60}
                  stroke={7}
                  color={domainColor(d.domain)}
                  label={`${DOMAIN_LABELS[d.domain]} ${d.attempts > 0 ? `${d.score}%` : "not tried"}`}
                >
                  <span className="text-sm font-bold tabular-nums">{d.attempts > 0 ? `${d.score}%` : "–"}</span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <DomainIcon domain={d.domain} size={24} />
                    <p className="font-semibold leading-tight">{DOMAIN_LABELS[d.domain]}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-3">
                    {d.attempts} answer{d.attempts === 1 ? "" : "s"} · {tried}/{d.topics.length} topics
                  </p>
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_STYLE[d.confidence]}`}>
                    {d.confidence} confidence
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {rec.focus.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold tracking-tight">Focus list</h2>
          <ul className="mt-2 divide-y divide-line">
            {rec.focus.slice(0, 5).map((f) => (
              <li key={`${f.meta.domain}/${f.meta.topic}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 max-sm:gap-x-2">
                <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
                  <DomainIcon domain={f.meta.domain} size={34} />
                  <div className="min-w-0">
                    <p className="font-semibold">{f.meta.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${REASON[f.reason].style}`}>{REASON[f.reason].label}</span>
                      {f.stat && f.stat.attempts > 0 && (
                        <span>
                          {f.stat.score}% over {f.stat.attempts} answer{f.stat.attempts === 1 ? "" : "s"}
                        </span>
                      )}
                      {f.dueCount > 0 && <span>{f.dueCount} due</span>}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/lessons/${f.meta.domain}/${f.meta.topic}/`}
                  className="btn btn-ghost max-sm:ml-11"
                >
                  Lesson
                </Link>
                <Link
                  href={`/practice/?topic=${f.meta.domain}/${f.meta.topic}`}
                  className="btn btn-ghost"
                >
                  Drill
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <TopicList title="Gaps" icon="▼" tone="text-bad" empty="No weak topics yet. Nice." items={gaps} titleOf={titleOf} />
        <TopicList
          title="Strengths"
          icon="▲"
          tone="text-good"
          empty="Strengths show up after 3+ answers at 80%+ in a topic."
          items={strengths}
          titleOf={titleOf}
        />
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold tracking-tight">Score per session</h2>
        <p className="mb-2 text-xs text-ink-3">Percentage correct in each finished assessment or practice round.</p>
        <ScoreChart points={history} />
      </section>
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
    <div className="card p-5">
      <h2 className="mb-3 text-lg font-bold tracking-tight">
        <span className={tone} aria-hidden>
          {icon}
        </span>{" "}
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((t) => (
            <li key={`${t.domain}/${t.topic}`} className="flex items-center justify-between gap-3">
              <Link href={`/lessons/${t.domain}/${t.topic}/`} className="tap flex min-w-0 items-center gap-2 justify-start hover:underline">
                <DomainIcon domain={t.domain} size={22} />
                <span className="truncate">{titleOf(t)}</span>
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

function NewsCard({ news }: { news: NewsHeadline[] }) {
  if (news.length === 0) return null;
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">In the news</h2>
        <Link href="/news/" className="tap text-sm font-medium text-accent hover:underline">
          All stories
        </Link>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {news.slice(0, 3).map((n) => (
          <li key={n.slug}>
            <Link href={`/news/${n.slug}/`} className="block py-3 hover:opacity-80">
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                {n.severity === "critical" && (
                  <span className="rounded-full bg-bad-bg px-2 py-0.5 font-semibold text-bad">Critical</span>
                )}
                {n.updated ?? n.date}
              </p>
              <p className="mt-1 font-semibold leading-snug">{n.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{n.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
