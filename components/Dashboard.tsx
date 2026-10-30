"use client";

import Link from "next/link";
import { computeActivity, dayKey, scoreHistory } from "@/lib/activity";
import { recommend, type FocusTopic } from "@/lib/recommend";
import { type NewsItem, type Question, type TopicMeta, type TopicStat } from "@/lib/types";
import loginVault from "@/lib/login-vault.json";
import { DomainIcon } from "./DomainIcon";
import { ProgressRing } from "./ProgressRing";
import { useProgress } from "./ProgressProvider";
import { ScoreChart } from "./ScoreChart";
import { SkillPath } from "./SkillPath";

const DAILY_GOAL = 10;

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
  if (!ready) return <DashboardSkeleton />;

  const titleOf = (t: { domain: string; topic: string }) =>
    topics.find((x) => x.domain === t.domain && x.topic === t.topic)?.title ?? t.topic;
  const rec = recommend(data, questions, topics);

  if (data.answers.length === 0) {
    return (
      <div className="space-y-12">
        <section className="hero-grid -mx-4 px-4 pt-2 pb-2 sm:mx-0 sm:px-0 sm:pt-6">
          <p className="eyebrow">
            {greeting()}, {NAME}
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-[2.125rem] sm:leading-tight">
            Let&apos;s find your gaps.
          </h1>
          <p className="mt-3 max-w-xl text-ink-2">
            One baseline assessment ({questions.length} interview-level questions) maps where you&apos;re strong and where
            you&apos;re guessing. After that, every practice round aims at your weakest topics.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/assess/" className="btn btn-primary">
              Start the assessment <Arrow />
            </Link>
            <Link href="/lessons/" className="btn btn-ghost btn-muted">
              Browse lessons
            </Link>
          </div>
        </section>

        <section aria-labelledby="path-h">
          <div className="section-head">
            <h2 id="path-h">Skill path</h2>
            <span className="text-xs text-ink-3">Scores appear after your first answers</span>
          </div>
          <SkillPath domains={rec.profile.domains} goal={{ href: "/assess/", eyebrow: "Start here", label: "Baseline assessment" }} />
        </section>

        <NewsList news={news} />
      </div>
    );
  }

  const activity = computeActivity(data.answers);
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
    <div className="space-y-12">
      {activity.daysSinceActive !== null && activity.daysSinceActive >= 2 && (
        <div className="flex items-center gap-3 rounded-lg border border-warn/40 bg-warn-bg px-4 py-3 text-sm text-warn" role="status">
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

      <section className="hero-grid -mx-4 grid gap-8 px-4 pt-2 sm:mx-0 sm:px-0 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="eyebrow">
            {greeting()}, {NAME}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.125rem] sm:leading-tight">
            {next ? (
              <>
                Next up: <span className="text-accent-text">{next.meta.title}</span>
              </>
            ) : (
              "You're in great shape"
            )}
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            {next && <span className={`tag mr-2 align-middle ${REASON[next.reason].style}`}>{REASON[next.reason].label}</span>}
            {rec.dueQuestionIds.length > 0
              ? `${rec.dueQuestionIds.length} review${rec.dueQuestionIds.length === 1 ? "" : "s"} due · `
              : ""}
            {covered} of {rec.profile.domains.flatMap((d) => d.topics).length} topics tried
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/practice/" className="btn btn-primary">
              Continue practice <Arrow />
            </Link>
            {next && (
              <Link href={`/lessons/${next.meta.domain}/${next.meta.topic}/`} className="btn btn-ghost btn-muted">
                Read the lesson
              </Link>
            )}
          </div>
          <p className="mt-3 text-sm text-ink-3">
            Low on energy?{" "}
            <Link href="/fun/" className="tap font-medium text-accent-text hover:underline">
              Try the fun corner
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-6 lg:border-l lg:border-line lg:pl-8">
          <ProgressRing value={mastery} size={96} stroke={8} label={`Overall mastery ${mastery}%`}>
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

      <section aria-labelledby="path-h">
        <div className="section-head">
          <h2 id="path-h">Skill path</h2>
          <span className="text-xs text-ink-3">Score · confidence from the evidence so far</span>
        </div>
        <SkillPath
          domains={rec.profile.domains}
          goal={
            next
              ? { href: `/practice/?topic=${next.meta.domain}/${next.meta.topic}`, eyebrow: "Next up", label: next.meta.title }
              : { href: "/practice/", eyebrow: "Next up", label: "Mixed practice" }
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-12">
          {rec.focus.length > 0 && (
            <section aria-labelledby="focus-h">
              <div className="section-head">
                <h2 id="focus-h">Focus list</h2>
                <span className="text-xs text-ink-3">Ranked by the recommendation engine</span>
              </div>
              <ul className="divide-y divide-line">
                {rec.focus.slice(0, 5).map((f) => (
                  <li key={`${f.meta.domain}/${f.meta.topic}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 max-sm:gap-x-2">
                    <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
                      <DomainIcon domain={f.meta.domain} size={32} />
                      <div className="min-w-0">
                        <p className="font-semibold">{f.meta.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                          <span className={`tag ${REASON[f.reason].style}`}>{REASON[f.reason].label}</span>
                          {f.stat && f.stat.attempts > 0 && (
                            <span>
                              {f.stat.score}% over {f.stat.attempts} answer{f.stat.attempts === 1 ? "" : "s"}
                            </span>
                          )}
                          {f.dueCount > 0 && <span>{f.dueCount} due</span>}
                        </p>
                      </div>
                    </div>
                    <Link href={`/lessons/${f.meta.domain}/${f.meta.topic}/`} className="btn btn-ghost max-sm:ml-11">
                      Lesson
                    </Link>
                    <Link href={`/practice/?topic=${f.meta.domain}/${f.meta.topic}`} className="btn btn-ghost">
                      Drill
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="chart-h">
            <div className="section-head">
              <h2 id="chart-h">Score per session</h2>
            </div>
            <p className="mt-2 mb-2 text-xs text-ink-3">Percentage correct in each finished assessment or practice round.</p>
            <ScoreChart points={history} />
          </section>
        </div>

        <div className="space-y-12">
          <TopicList title="Gaps" icon="▼" tone="text-bad" empty="No weak topics yet. Nice." items={gaps} titleOf={titleOf} />
          <TopicList
            title="Strengths"
            icon="▲"
            tone="text-good"
            empty="Strengths show up after 3+ answers at 80%+ in a topic."
            items={strengths}
            titleOf={titleOf}
          />
          <NewsList news={news} />
        </div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <span className="btn-arrow" aria-hidden>
      →
    </span>
  );
}

/** Shape-only placeholder while progress loads, so the page doesn't flash the first-visit state. */
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-12 motion-reduce:animate-none" aria-busy="true">
      <p className="sr-only" role="status">
        Loading your progress…
      </p>
      <div className="space-y-3 pt-6">
        <div className="h-3 w-40 rounded bg-surface-2" />
        <div className="h-8 w-80 max-w-full rounded bg-surface-2" />
        <div className="h-4 w-64 max-w-full rounded bg-surface-2" />
        <div className="h-11 w-48 rounded bg-surface-2" />
      </div>
      <div className="h-44 rounded-lg bg-surface-2/60" />
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
    <section>
      <div className="section-head mb-2">
        <h2>
          <span className={tone} aria-hidden>
            {icon}
          </span>{" "}
          {title}
        </h2>
      </div>
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
    </section>
  );
}

function NewsList({ news }: { news: NewsHeadline[] }) {
  if (news.length === 0) return null;
  return (
    <section aria-labelledby="news-h">
      <div className="section-head">
        <h2 id="news-h">In the news</h2>
        <Link href="/news/" className="tap text-sm font-medium text-accent-text hover:underline">
          All stories
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {news.slice(0, 3).map((n) => (
          <li key={n.slug}>
            <Link href={`/news/${n.slug}/`} className="group block py-3">
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                {n.severity === "critical" && (
                  <span className="tag bg-bad-bg text-bad">Critical</span>
                )}
                {n.updated ?? n.date}
              </p>
              <p className="mt-1 font-semibold leading-snug group-hover:text-accent-text">{n.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{n.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
