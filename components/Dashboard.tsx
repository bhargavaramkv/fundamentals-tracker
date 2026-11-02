"use client";

import Link from "next/link";
import { useMemo } from "react";
import { computeActivity, dayKey, recentActivity, scoreHistory } from "@/lib/activity";
import { dueProblems, PATTERN_TOPICS } from "@/lib/coding";
import loginVault from "@/lib/login-vault.json";
import { codingSolvesByTopic, levelRank, topicProficiency } from "@/lib/proficiency";
import type { RadarFeed, RadarListItem } from "@/lib/radar/types";
import { recommend, type FocusTopic } from "@/lib/recommend";
import { allRevisions, buildTodayPlan, topicHref, type PlanContext, type PlanTask } from "@/lib/today";
import { DOMAINS, DOMAIN_LABELS, type TopicStat } from "@/lib/types";
import { DomainIcon } from "./DomainIcon";
import { ProgressRing } from "./ProgressRing";
import { useProgress } from "./ProgressProvider";
import { CategoryTag, ImportanceTag } from "./radar/ui";
import { useLiveRadar } from "./radar/live";
import { useRadarPrefs } from "./radar/prefs";
import { ScoreChart } from "./ScoreChart";
import { SkillPath } from "./SkillPath";
import { relativeDays, startOfLocalDay, untilDays, useNow } from "./useNow";

const DAILY_GOAL = 10;

const REASON: Record<FocusTopic["reason"], { label: string; style: string }> = {
  weak: { label: "Weak spot", style: "bg-bad-bg text-bad" },
  "reviews-due": { label: "Review due", style: "bg-warn-bg text-warn" },
  shaky: { label: "Missed once", style: "bg-warn-bg text-warn" },
  untested: { label: "Not tried yet", style: "bg-surface-2 text-ink-2" },
};

const KIND_LABEL: Record<PlanTask["kind"], string> = {
  baseline: "Baseline",
  reviews: "Review",
  revise: "Revision",
  learn: "Learn",
  coding: "Coding",
};

const NAME = loginVault.username.charAt(0).toUpperCase() + loginVault.username.slice(1);

type Data = ReturnType<typeof useProgress>["data"];
const keyOf = (t: { domain: string; topic: string }) => `${t.domain}/${t.topic}`;

function greeting(now: number): string {
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function relativeDay(days: number | null): string {
  if (days === null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function Dashboard({ ctx, radar }: { ctx: PlanContext; radar: RadarFeed }) {
  const { data, ready } = useProgress();
  const now = useNow();
  if (!ready || now === null) return <DashboardSkeleton />;
  return <DashboardPage ctx={ctx} radar={radar} data={data} now={now} />;
}

function DashboardPage({ ctx, radar, data, now }: { ctx: PlanContext; radar: RadarFeed; data: Data; now: number }) {
  const { questions, topics } = ctx;
  const startOfDay = startOfLocalDay(now);
  const plan = useMemo(() => buildTodayPlan(data, ctx, now, startOfDay), [data, ctx, now, startOfDay]);
  const rec = recommend(data, questions, topics, now);
  const titleOfKey = (key: string) => topics.find((t) => keyOf(t) === key)?.title ?? key;

  // Reading, exercises or coding count as having started, even before a first quiz answer.
  const started = data.answers.length > 0 || data.reads.length > 0 || data.activities.length > 0 || data.codingAttempts.length > 0;
  if (!started) {
    return (
      <div className="space-y-12">
        <section className="hero-grid -mx-4 px-4 pt-2 pb-2 sm:mx-0 sm:px-0 sm:pt-6">
          <p className="eyebrow">
            {greeting(now)}, {NAME}
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl sm:text-[2.125rem]">Let&apos;s find your gaps.</h1>
          <p className="mt-3 max-w-xl text-ink-2">
            One baseline assessment ({questions.length} interview-level questions) maps where you&apos;re strong and where
            you&apos;re guessing. After that, every practice round aims at your weakest topics.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/assess/" className="btn btn-primary">
              Start the assessment <Arrow />
            </Link>
            <Link href="/learn/" className="btn btn-ghost btn-muted">
              Browse the learning path
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

        <RadarList build={radar} />
      </div>
    );
  }

  const activity = computeActivity(data.answers, new Date(now));
  const history = scoreHistory(data.sessions);
  // Overall mastery: domain scores weighted by how much evidence each has.
  const tried = rec.profile.domains.filter((d) => d.attempts > 0);
  const evidence = tried.reduce((n, d) => n + d.attempts, 0);
  const mastery = evidence ? Math.round(tried.reduce((n, d) => n + d.score * d.attempts, 0) / evidence) : 0;
  const today = dayKey(new Date(now));
  const answeredToday = data.answers.filter((a) => dayKey(new Date(a.answeredAt)) === today).length;
  const allTopics = rec.profile.domains.flatMap((d) => d.topics);
  const covered = allTopics.filter((t) => t.attempts > 0).length;
  const gaps = rec.profile.weakTopics.slice(0, 6);
  const strengths = rec.profile.strongTopics.slice(0, 6);
  const next = rec.focus[0];
  const nextKey = next ? keyOf(next.meta) : null;

  return (
    <div className="space-y-12">
      {activity.daysSinceActive !== null && activity.daysSinceActive >= 2 && (
        <div className="flex items-center gap-3 rounded-lg border border-warn/40 bg-warn-bg px-4 py-3 text-sm text-warn" role="status">
          <span aria-hidden className="text-lg">
            ⏰
          </span>
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
            {greeting(now)}, {NAME}
          </p>
          <h1 className="mt-2 text-3xl sm:text-[2.125rem]">
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
            {rec.dueQuestionIds.length > 0 ? `${rec.dueQuestionIds.length} review${rec.dueQuestionIds.length === 1 ? "" : "s"} due · ` : ""}
            {covered} of {allTopics.length} topics tried
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/practice/" className="btn btn-primary">
              Continue practice <Arrow />
            </Link>
            {nextKey && (
              <Link href={topicHref(nextKey)} className="btn btn-ghost btn-muted">
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
                <div className="h-1.5 rounded-full bg-good" style={{ width: `${Math.min(100, (100 * answeredToday) / DAILY_GOAL)}%` }} />
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
          goal={nextKey && next ? { href: topicHref(nextKey, "practice"), eyebrow: "Next up", label: next.meta.title } : { href: "/practice/", eyebrow: "Next up", label: "Mixed practice" }}
        />
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0 space-y-12">
          <PlanList plan={plan} />

          {rec.focus.length > 0 && (
            <section aria-labelledby="focus-h">
              <div className="section-head">
                <h2 id="focus-h">Focus list</h2>
                <span className="text-xs text-ink-3">Ranked by the recommendation engine</span>
              </div>
              <ul className="divide-y divide-line">
                {rec.focus.slice(0, 5).map((f) => (
                  <li key={keyOf(f.meta)} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 max-sm:gap-x-2">
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
                    <Link href={topicHref(keyOf(f.meta))} className="btn btn-ghost max-sm:ml-11">
                      Lesson
                    </Link>
                    <Link href={topicHref(keyOf(f.meta), "practice")} className="btn btn-ghost">
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

        <div className="min-w-0 space-y-12">
          <TopicList title="Gaps" icon="▼" tone="text-bad" empty="No weak topics yet. Nice." items={gaps} titleOf={(t) => titleOfKey(keyOf(t))} />
          <TopicList title="Strengths" icon="▲" tone="text-good" empty="Strengths show up after 3+ answers at 80%+ in a topic." items={strengths} titleOf={(t) => titleOfKey(keyOf(t))} />
          <Revisions ctx={ctx} data={data} now={now} titleOf={titleOfKey} />
          <Proficient ctx={ctx} data={data} now={now} />
          <Recent data={data} now={now} titleOf={titleOfKey} />
          <RadarList build={radar} />
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

/** The daily plan: stable through the day, so finishing a task ticks it off instead of replacing it. */
function PlanList({ plan }: { plan: PlanTask[] }) {
  const open = plan.filter((t) => !t.done);
  const minutes = open.reduce((n, t) => n + t.minutes, 0);
  const nextId = open[0]?.id;
  return (
    <section aria-labelledby="plan-h">
      <div className="section-head">
        <h2 id="plan-h">Today&apos;s plan</h2>
        <span className="text-xs text-ink-3">
          {plan.length === 0 ? "Nothing due" : open.length === 0 ? "All done" : `${open.length} to do · about ${minutes} min`}
        </span>
      </div>
      {plan.length > 0 ? (
        <ol className="divide-y divide-line">
          {plan.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                  <span className="tag bg-surface-2 text-ink-2">{KIND_LABEL[t.kind]}</span>
                  <span>about {t.minutes} min</span>
                  {t.done && <span className="font-medium text-good">✓ Done</span>}
                </p>
                <Link href={t.href} className={`mt-0.5 block font-semibold hover:text-accent-text ${t.done ? "text-ink-2" : ""}`}>
                  {t.title}
                </Link>
                <p className="mt-0.5 text-sm text-ink-2">{t.why}</p>
              </div>
              {t.id === nextId && (
                <Link href={t.href} className="btn btn-primary">
                  Start <Arrow />
                </Link>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="pt-3 text-sm text-ink-2">Your reviews are up to date.</p>
      )}
    </section>
  );
}

function Revisions({ ctx, data, now, titleOf }: { ctx: PlanContext; data: Data; now: number; titleOf: (k: string) => string }) {
  const revisions = allRevisions(data, ctx, now).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const retries = dueProblems(data, now);
  const shown = revisions.slice(0, 5);
  return (
    <section aria-labelledby="rev-h">
      <div className="section-head mb-2">
        <h2 id="rev-h">Revision</h2>
        <Link href="/coding/" className="tap text-sm font-medium text-accent-text hover:underline">
          Coding
        </Link>
      </div>
      {shown.length === 0 && retries.length === 0 ? (
        <p className="text-sm text-ink-3">Topics appear here once you&apos;ve tested yourself on them. Reading alone doesn&apos;t schedule a revision.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {shown.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3">
              <Link href={topicHref(r.key, "practice")} className="tap min-w-0 truncate hover:underline">
                {titleOf(r.key)}
              </Link>
              <span className={`shrink-0 tabular-nums ${r.isDue ? "font-medium text-warn" : "text-ink-2"}`}>
                {r.isDue ? (r.overdueDays > 0 ? `${r.overdueDays}d overdue` : "due") : untilDays(r.dueAt, now)}
              </span>
            </li>
          ))}
          {retries.slice(0, 3).map((s) => (
            <li key={s.problem.id} className="flex items-center justify-between gap-3">
              <Link href={`/coding/?problem=${encodeURIComponent(s.problem.id)}`} className="tap min-w-0 truncate hover:underline">
                {s.problem.title}
              </Link>
              <span className="shrink-0 font-medium text-warn">retry</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Proficient({ ctx, data, now }: { ctx: PlanContext; data: Data; now: number }) {
  const solves = codingSolvesByTopic(data, PATTERN_TOPICS);
  const rows = DOMAINS.map((domain) => {
    const topics = ctx.topics.filter((t) => t.domain === domain);
    const proficient = topics.filter((t) => levelRank(topicProficiency(keyOf(t), data, ctx.workspaces[keyOf(t)], solves, now).level) >= levelRank("proficient")).length;
    return { domain, proficient, total: topics.length };
  });
  return (
    <section aria-labelledby="proficient-h">
      <div className="section-head mb-2">
        <h2 id="proficient-h">Proficient topics</h2>
        <Link href="/learn/" className="tap text-sm font-medium text-accent-text hover:underline">
          Path
        </Link>
      </div>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.domain} className="flex items-center justify-between gap-3">
            <Link href={`/learn/#${r.domain}`} className="tap flex min-w-0 items-center gap-2 hover:underline">
              <DomainIcon domain={r.domain} size={22} />
              <span className="truncate">{DOMAIN_LABELS[r.domain]}</span>
            </Link>
            <span className="shrink-0 tabular-nums text-ink-2">
              {r.proficient} of {r.total}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Recent({ data, now, titleOf }: { data: Data; now: number; titleOf: (k: string) => string }) {
  const rows = recentActivity(data, titleOf, 6);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="recent-h">
      <div className="section-head mb-2">
        <h2 id="recent-h">Recent activity</h2>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.id}>
            {r.href ? (
              <Link href={r.href} className="hover:underline">
                {r.title}
              </Link>
            ) : (
              r.title
            )}
            <span className="block text-xs text-ink-3">
              {r.kind}
              {r.detail && `, ${r.detail}`} · {relativeDays(r.at, now)}
            </span>
          </li>
        ))}
      </ul>
    </section>
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

function TopicList({ title, icon, tone, empty, items, titleOf }: { title: string; icon: string; tone: string; empty: string; items: TopicStat[]; titleOf: (t: TopicStat) => string }) {
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
            <li key={keyOf(t)} className="flex items-center justify-between gap-3">
              <Link href={topicHref(keyOf(t))} className="tap flex min-w-0 items-center gap-2 hover:underline">
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

/** Unread, newest day first and then by rank, one per source, so this doesn't show the same three stories all week. */
function pickStories(items: RadarListItem[], read: Record<string, string>, anchor: number): RadarListItem[] {
  const DAY = 86_400_000;
  const age = (i: RadarListItem) => Math.floor(Math.max(0, anchor - Date.parse(i.firstSeenAt)) / DAY);
  const recent = items.filter((i) => !i.minor && age(i) < 3 && !read[i.id]).sort((a, b) => age(a) - age(b) || b.score - a.score);
  const seen = new Set<string>();
  const out: RadarListItem[] = [];
  for (const i of recent) {
    if (seen.has(i.sourceName)) continue;
    seen.add(i.sourceName);
    out.push(i);
    if (out.length === 3) break;
  }
  return out;
}

function RadarList({ build }: { build: RadarFeed }) {
  const { feed } = useLiveRadar(build);
  const { prefs } = useRadarPrefs();
  const built = useMemo(() => new Set(build.items.map((i) => i.id)), [build.items]);
  const stories = pickStories(feed.items, prefs.read, feed.lastSuccessAt ? Date.parse(feed.lastSuccessAt) : 0);
  if (stories.length === 0) return null;
  return (
    <section aria-labelledby="radar-h">
      <div className="section-head">
        <h2 id="radar-h">On the radar</h2>
        <Link href="/radar/" className="tap text-sm font-medium text-accent-text hover:underline">
          All stories
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {stories.map((n) => (
          <li key={n.id} className="group py-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <CategoryTag category={n.category} short />
              <ImportanceTag importance={n.importance} score={n.score} />
            </p>
            {/* A story newer than this deploy has no page of its own yet, so it links to the source. */}
            {built.has(n.id) ? (
              <Link href={`/radar/${n.id}/`} className="mt-1 block font-semibold leading-snug hover:text-accent-text">
                {n.title}
              </Link>
            ) : (
              <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold leading-snug hover:text-accent-text">
                {n.title} <span aria-hidden>↗</span>
              </a>
            )}
            <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{n.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
