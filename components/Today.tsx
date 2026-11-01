"use client";

import Link from "next/link";
import { useMemo } from "react";
import { computeActivity, recentActivity } from "@/lib/activity";
import { PATTERN_TOPICS, dueProblems } from "@/lib/coding";
import loginVault from "@/lib/login-vault.json";
import { codingSolvesByTopic, levelRank, topicProficiency } from "@/lib/proficiency";
import type { RadarFeed, RadarListItem } from "@/lib/radar/types";
import { allRevisions, buildTodayPlan, topicHref, type PlanContext, type PlanTask } from "@/lib/today";
import { DOMAINS, DOMAIN_LABELS } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { useLiveRadar } from "./radar/live";
import { useRadarPrefs } from "./radar/prefs";
import { StoryRow } from "./radar/RadarFeed";
import { formatDateTime } from "./radar/ui";
import { relativeDays, startOfLocalDay, untilDays, useNow } from "./useNow";

const NAME = loginVault.username.charAt(0).toUpperCase() + loginVault.username.slice(1);

function greeting(now: number): string {
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const KIND_LABEL: Record<PlanTask["kind"], string> = {
  baseline: "Baseline",
  reviews: "Review",
  revise: "Revision",
  learn: "Learn",
  coding: "Coding",
};

export function Today({ ctx, radar }: { ctx: PlanContext; radar: RadarFeed }) {
  const { data, ready } = useProgress();
  const now = useNow();
  if (!ready || now === null) return <TodaySkeleton />;
  return <TodayPage ctx={ctx} radar={radar} now={now} data={data} />;
}

function TodayPage({ ctx, radar, now, data }: { ctx: PlanContext; radar: RadarFeed; now: number; data: ReturnType<typeof useProgress>["data"] }) {
  const titleOf = (key: string) => ctx.topics.find((t) => `${t.domain}/${t.topic}` === key)?.title ?? key;
  const startOfDay = startOfLocalDay(now);
  const plan = useMemo(() => buildTodayPlan(data, ctx, now, startOfDay), [data, ctx, now, startOfDay]);
  const activity = computeActivity(data.answers, new Date(now));
  const open = plan.filter((t) => !t.done);
  const minutes = open.reduce((n, t) => n + t.minutes, 0);
  const nextId = open[0]?.id;

  return (
    <div className="space-y-14">
      <header className="page-head">
        <p className="eyebrow">{new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="mt-2">
          {greeting(now)}, {NAME}
        </h1>
        <p>
          {plan.length === 0
            ? "Nothing is due today. Pick anything from the Learning Path, or take a look at what's new."
            : open.length === 0
              ? "That's today's plan done."
              : `${open.length} ${open.length === 1 ? "thing" : "things"} today, about ${minutes} minutes.`}
        </p>
      </header>

      {activity.daysSinceActive !== null && activity.daysSinceActive >= 2 && (
        <p className="border-l-2 border-warn pl-4 text-[15px] text-ink-2" role="status">
          It&apos;s been {activity.daysSinceActive} days. No energy for the full plan? Read a{" "}
          <Link href="/fun/" className="text-accent-text hover:underline">
            2-minute bug story
          </Link>{" "}
          or do a{" "}
          <Link href="/practice/?mode=warmup" className="text-accent-text hover:underline">
            5-question warm-up
          </Link>
          .
        </p>
      )}

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0 space-y-14">
          <section aria-labelledby="plan-h">
            <div className="section-head">
              <h2 id="plan-h">Today&apos;s plan</h2>
            </div>
            {plan.length > 0 ? (
              <ol className="divide-y divide-line">
                {plan.map((t, i) => (
                  <PlanRow key={t.id} task={t} n={i + 1} next={t.id === nextId} />
                ))}
              </ol>
            ) : (
              <p className="py-4 text-ink-2">Your reviews are up to date.</p>
            )}
            <p className="meta mt-3">
              Low on energy?{" "}
              <Link href="/fun/" className="tap text-accent-text hover:underline">
                Fun corner
              </Link>{" "}
              or a{" "}
              <Link href="/practice/?mode=warmup" className="tap text-accent-text hover:underline">
                warm-up
              </Link>
              .
            </p>
          </section>

          <RadarPicks build={radar} />
        </div>

        <div className="min-w-0 space-y-12">
          <Revisions ctx={ctx} data={data} now={now} titleOf={titleOf} />
          <Progress ctx={ctx} data={data} now={now} streak={activity.streak} />
          <Recent data={data} now={now} titleOf={titleOf} />
        </div>
      </div>
    </div>
  );
}

function PlanRow({ task: t, n, next }: { task: PlanTask; n: number; next: boolean }) {
  return (
    <li className="flex gap-4 py-5">
      <span className={`headline w-6 shrink-0 text-2xl ${t.done ? "text-ink-3" : "text-ink"}`} aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="meta">
          {KIND_LABEL[t.kind]} · about {t.minutes} min
          {t.done && <span className="ml-2 font-medium text-good">✓ Done</span>}
        </p>
        <Link href={t.href} className={`headline mt-0.5 block text-xl hover:text-accent-text ${t.done ? "text-ink-2" : ""}`}>
          {t.title}
        </Link>
        <p className="mt-1 text-[15px] text-ink-2">{t.why}</p>
        {next && (
          <Link href={t.href} className="btn btn-primary mt-3">
            Start <span className="btn-arrow" aria-hidden>→</span>
          </Link>
        )}
      </div>
    </li>
  );
}

function Revisions({ ctx, data, now, titleOf }: { ctx: PlanContext; data: ReturnType<typeof useProgress>["data"]; now: number; titleOf: (k: string) => string }) {
  const revisions = allRevisions(data, ctx, now).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const retries = dueProblems(data, now);
  const shown = revisions.slice(0, 5);
  return (
    <section aria-labelledby="rev-h">
      <div className="section-head">
        <h2 id="rev-h">Revision</h2>
      </div>
      {shown.length === 0 && retries.length === 0 ? (
        <p className="pt-3 text-[15px] text-ink-2">Topics appear here once you&apos;ve tested yourself on them. Reading alone doesn&apos;t schedule a revision.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((r) => (
            <li key={r.key} className="flex items-baseline justify-between gap-3 py-2.5">
              <Link href={topicHref(r.key, "practice")} className="min-w-0 truncate text-[15px] hover:text-accent-text">
                {titleOf(r.key)}
              </Link>
              <span className={`meta shrink-0 ${r.isDue ? "font-medium text-warn" : ""}`}>
                {r.isDue ? (r.overdueDays > 0 ? `${r.overdueDays}d overdue` : "due") : untilDays(r.dueAt, now)}
              </span>
            </li>
          ))}
          {retries.slice(0, 3).map((s) => (
            <li key={s.problem.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <Link href={`/coding/?problem=${encodeURIComponent(s.problem.id)}`} className="min-w-0 truncate text-[15px] hover:text-accent-text">
                {s.problem.title}
              </Link>
              <span className="meta shrink-0 font-medium text-warn">retry</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Progress({ ctx, data, now, streak }: { ctx: PlanContext; data: ReturnType<typeof useProgress>["data"]; now: number; streak: number }) {
  const solves = codingSolvesByTopic(data, PATTERN_TOPICS);
  const rows = DOMAINS.map((domain) => {
    const topics = ctx.topics.filter((t) => t.domain === domain);
    const proficient = topics.filter((t) => {
      const key = `${t.domain}/${t.topic}`;
      return levelRank(topicProficiency(key, data, ctx.workspaces[key], solves, now).level) >= levelRank("proficient");
    }).length;
    return { domain, proficient, total: topics.length };
  });
  return (
    <section aria-labelledby="progress-h">
      <div className="section-head">
        <h2 id="progress-h">Proficient topics</h2>
        <Link href="/learn/" className="tap meta text-accent-text hover:underline">
          Path
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.domain} className="flex items-baseline justify-between gap-3 py-2.5 text-[15px]">
            <Link href={`/learn/#${r.domain}`} className="min-w-0 truncate hover:text-accent-text">
              {DOMAIN_LABELS[r.domain]}
            </Link>
            <span className="shrink-0 tabular-nums text-ink-2">
              {r.proficient} of {r.total}
            </span>
          </li>
        ))}
      </ul>
      {streak > 1 && <p className="meta mt-2">{streak}-day practice streak.</p>}
    </section>
  );
}

function Recent({ data, now, titleOf }: { data: ReturnType<typeof useProgress>["data"]; now: number; titleOf: (k: string) => string }) {
  const rows = recentActivity(data, titleOf, 6);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="recent-h">
      <div className="section-head">
        <h2 id="recent-h">Recent activity</h2>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="py-2.5">
            <p className="text-[15px]">
              {r.href ? (
                <Link href={r.href} className="hover:text-accent-text">
                  {r.title}
                </Link>
              ) : (
                r.title
              )}
            </p>
            <p className="meta">
              {r.kind}
              {r.detail && `, ${r.detail}`} · {relativeDays(r.at, now)}
            </p>
          </li>
        ))}
      </ul>
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

function RadarPicks({ build }: { build: RadarFeed }) {
  const { feed } = useLiveRadar(build);
  const { prefs } = useRadarPrefs();
  const built = useMemo(() => new Set(build.items.map((i) => i.id)), [build.items]);
  const anchor = feed.lastSuccessAt ? Date.parse(feed.lastSuccessAt) : 0;
  const stories = pickStories(feed.items, prefs.read, anchor);
  if (stories.length === 0) return null;
  return (
    <section aria-labelledby="radar-h">
      <div className="section-head">
        <h2 id="radar-h">From the Tech Radar</h2>
        <Link href="/radar/" className="tap meta text-accent-text hover:underline">
          All stories
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {stories.map((i) => (
          <li key={i.id} className="py-5">
            <StoryRow item={i} built={built.has(i.id)} />
          </li>
        ))}
      </ul>
      {feed.lastSuccessAt && <p className="meta mt-2">Updated {formatDateTime(feed.lastSuccessAt)}.</p>}
    </section>
  );
}

/** Shape-only placeholder while progress loads, so the page doesn't flash the first-visit state. */
function TodaySkeleton() {
  return (
    <div className="animate-pulse space-y-10 motion-reduce:animate-none" aria-busy="true">
      <p className="sr-only" role="status">
        Loading your plan…
      </p>
      <div className="space-y-3">
        <div className="h-3 w-40 rounded bg-surface-2" />
        <div className="h-11 w-96 max-w-full rounded bg-surface-2" />
        <div className="h-4 w-64 max-w-full rounded bg-surface-2" />
      </div>
      <div className="h-56 max-w-2xl rounded bg-surface-2" />
    </div>
  );
}
