"use client";

import Link from "next/link";
import { scoreHistory } from "@/lib/activity";
import { PATTERN_TOPICS } from "@/lib/coding";
import { codingSolvesByTopic, hasPracticalEvidence, LEVEL_LABEL, levelRank, topicProficiency, topicRevision, evidenceFor, type TopicProficiency } from "@/lib/proficiency";
import { recommend } from "@/lib/recommend";
import type { PlanContext } from "@/lib/today";
import { DOMAIN_LABELS, type Domain, type TopicMeta, type TopicStat } from "@/lib/types";
import { DomainIcon } from "./DomainIcon";
import { useProgress } from "./ProgressProvider";
import { ScoreChart } from "./ScoreChart";
import { useNow } from "./useNow";

/** A sensible order to work through. A suggestion only: every topic is open. */
export const PATH_ORDER: Domain[] = ["dsa", "oop", "databases", "web", "system-design"];

const keyOf = (t: { domain: string; topic: string }) => `${t.domain}/${t.topic}`;

export function levelTone(level: TopicProficiency["level"]): string {
  if (level === "mastered") return "bg-good-bg text-good";
  if (level === "proficient") return "text-good";
  if (level === "reading") return "bg-warn-bg text-warn";
  return "text-ink-2";
}

function TrackSummary({ p }: { p: TopicProficiency }) {
  const t = p.tracks;
  const parts = [
    t.reading.lessonReads + t.reading.resources > 0 ? "Read" : null,
    t.quizzes.answers > 0 ? `Quiz ${t.quizzes.score}%` : null,
    t.exercises.attempted > 0 ? `Exercises ${t.exercises.gotIt}/${t.exercises.total}` : null,
    hasPracticalEvidence(t) ? "Practical done" : null,
  ].filter(Boolean);
  return parts.length ? <span>{parts.join(" · ")}</span> : null;
}

export function LearningPath({ ctx }: { ctx: PlanContext }) {
  const { data, ready } = useProgress();
  const now = useNow();
  const loaded = ready && now !== null;
  const solves = loaded ? codingSolvesByTopic(data, PATTERN_TOPICS) : new Map<string, string[]>();
  const proficiency = (t: TopicMeta) => (loaded ? topicProficiency(keyOf(t), data, ctx.workspaces[keyOf(t)], solves, now) : null);
  const hasAnswers = loaded && data.answers.length > 0;

  const inDomain = (domain: Domain) =>
    ctx.topics.filter((t) => t.domain === domain).sort((a, b) => (ctx.workspaces[keyOf(a)]?.order ?? 99) - (ctx.workspaces[keyOf(b)]?.order ?? 99));
  const started = (t: TopicMeta) => {
    const p = proficiency(t);
    return !!p && p.level !== "not-started";
  };
  // The first topic in the suggested order that hasn't been touched.
  const startHere = loaded ? PATH_ORDER.flatMap(inDomain).find((t) => !started(t)) : undefined;
  const startedCount = loaded ? ctx.topics.filter(started).length : 0;

  return (
    <div className="space-y-14">
      <header className="page-head">
        <h1>Learning Path</h1>
        <p>
          Computer science and software engineering, one topic at a time. Each topic has its sources, an explanation, practice
          questions, exercises, practical work and a check. Follow the order or jump in anywhere.
        </p>
        <p className="mt-3 text-[15px]">
          {hasAnswers ? "Want a fresh measure? " : "Not sure where to start? "}
          <Link href="/assess/" className="text-accent-text hover:underline">
            Take the baseline assessment
          </Link>
          .
        </p>
        {loaded && (
          <p className="meta mt-3">
            {startedCount} of {ctx.topics.length} topics started
            {startHere && (
              <>
                {" · "}
                <Link href={`/learn/${startHere.domain}/${startHere.topic}/`} className="font-medium text-accent-text hover:underline">
                  Start here: {startHere.title}
                </Link>
              </>
            )}
          </p>
        )}
      </header>

      {PATH_ORDER.map((domain) => (
        <section key={domain} id={domain} aria-labelledby={`h-${domain}`} className="scroll-mt-20">
          <div className="section-head">
            <h2 id={`h-${domain}`} className="flex items-center gap-2.5">
              <DomainIcon domain={domain} size={22} />
              {DOMAIN_LABELS[domain]}
            </h2>
            {loaded && (
              <span className="meta">
                {inDomain(domain).filter(started).length} of {inDomain(domain).length} started
              </span>
            )}
          </div>
          <ol className="divide-y divide-line">
            {inDomain(domain).map((t, i) => {
              const p = proficiency(t);
              const revision = loaded ? topicRevision(keyOf(t), evidenceFor(keyOf(t), data, solves), now) : null;
              const isStart = startHere ? keyOf(startHere) === keyOf(t) : false;
              const showLevel = p && p.level !== "not-started";
              return (
                <li key={t.topic} className="flex gap-4 py-5">
                  <span className="headline w-6 shrink-0 text-xl text-ink-3" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link href={`/learn/${t.domain}/${t.topic}/`} className="headline text-xl hover:text-accent-text">
                        {t.title}
                      </Link>
                      {isStart && <span className="tag bg-surface-2 font-semibold text-accent-text">Start here</span>}
                      {showLevel && <span className={`tag ${levelTone(p.level)}`}>{LEVEL_LABEL[p.level]}</span>}
                      {revision?.isDue && <span className="meta font-medium text-warn">Revision due</span>}
                    </div>
                    <p className="mt-1 max-w-[60ch] text-[15px] text-ink-2">{t.summary}</p>
                    {p && showLevel && (
                      <p className="meta mt-1.5">
                        <TrackSummary p={p} />
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {hasAnswers && <Overview ctx={ctx} />}

      <section aria-labelledby="levels-h">
        <div className="section-head">
          <h2 id="levels-h">How proficiency works</h2>
        </div>
        <dl className="mt-3 grid max-w-3xl gap-x-8 gap-y-3 text-[15px] sm:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="font-medium">Reading only</dt>
          <dd className="text-ink-2">You&apos;ve read about it. Reading alone never counts as more than this.</dd>
          <dt className="font-medium">Practising</dt>
          <dd className="text-ink-2">You&apos;ve started testing yourself.</dd>
          <dt className="font-medium">Developing</dt>
          <dd className="text-ink-2">At least 60% on recent quiz answers, from 3 or more answers.</dd>
          <dt className="font-medium">Proficient</dt>
          <dd className="text-ink-2">At least 75% on 3 or more different questions, an interview-level question right, and an exercise answered well.</dd>
          <dt className="font-medium">Mastered</dt>
          <dd className="text-ink-2">At least 85% with a hard question right, every exercise answered well, practical work done, and shown on more than one day.</dd>
        </dl>
        <p className="meta mt-3">Quiz scores weigh recent answers more, so a level can drop if you stop practising.</p>
      </section>
    </div>
  );
}

function Overview({ ctx }: { ctx: PlanContext }) {
  const { data } = useProgress();
  const now = useNow() as number;
  const rec = recommend(data, ctx.questions, ctx.topics, now);
  const history = scoreHistory(data.sessions);
  const solves = codingSolvesByTopic(data, PATTERN_TOPICS);
  const titleOf = (t: TopicStat) => ctx.topics.find((x) => keyOf(x) === keyOf(t))?.title ?? t.topic;
  const counted = ctx.topics.filter((t) => levelRank(topicProficiency(keyOf(t), data, ctx.workspaces[keyOf(t)], solves, now).level) >= levelRank("proficient")).length;
  return (
    <section aria-labelledby="overview-h" className="space-y-8">
      <div className="section-head">
        <h2 id="overview-h">Your progress</h2>
        <span className="meta">
          {counted} of {ctx.topics.length} topics proficient
        </span>
      </div>
      <div className="grid gap-10 sm:grid-cols-2">
        <TopicList title="Gaps" empty="No weak topics yet." items={rec.profile.weakTopics.slice(0, 6)} titleOf={titleOf} />
        <TopicList title="Strengths" empty="Strengths show up after 3 or more answers at 80% or better." items={rec.profile.strongTopics.slice(0, 6)} titleOf={titleOf} />
      </div>
      <div>
        <h3 className="font-medium">Score per session</h3>
        <p className="meta mb-3 mt-0.5">Percentage correct in each finished assessment or practice round.</p>
        <ScoreChart points={history} />
      </div>
    </section>
  );
}

function TopicList({ title, empty, items, titleOf }: { title: string; empty: string; items: TopicStat[]; titleOf: (t: TopicStat) => string }) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="meta mt-1">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {items.map((t) => (
            <li key={keyOf(t)} className="flex items-baseline justify-between gap-3 py-2 text-[15px]">
              <Link href={`/learn/${t.domain}/${t.topic}/`} className="min-w-0 truncate hover:text-accent-text">
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
