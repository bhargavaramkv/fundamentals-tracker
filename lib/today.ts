import { dueProblems, PATTERN_TOPICS } from "./coding";
import { codingSolvesByTopic, evidenceFor, nextStep, STEP_LABEL, STEP_MINUTES, STEP_TAB, topicProficiency, topicRevision, type TopicRevision } from "./proficiency";
import { recommend, type FocusTopic } from "./recommend";
import { applyAnswers, dueReviews } from "./srs";
import type { ProgressData, Question, TopicMeta, TopicWorkspace } from "./types";

export interface PlanContext {
  questions: Question[];
  topics: TopicMeta[];
  workspaces: Record<string, TopicWorkspace>;
}

export type PlanKind = "baseline" | "reviews" | "revise" | "learn" | "coding";

export interface PlanTask {
  id: string;
  kind: PlanKind;
  title: string;
  /** Why this is on the plan, taken from your own evidence. */
  why: string;
  href: string;
  minutes: number;
  done: boolean;
}

const MAX_TASKS = 4;
const DAY = 86_400_000;
const keyOf = (t: { domain: string; topic: string }) => `${t.domain}/${t.topic}`;
export const topicHref = (key: string, tab?: string) => `/learn/${key}/${tab ? `?tab=${tab}` : ""}`;

/** Everything recorded before a moment, with question reviews rebuilt to match. */
export function progressBefore(data: ProgressData, at: string): ProgressData {
  const answers = data.answers.filter((a) => a.answeredAt < at);
  return {
    ...data,
    answers,
    sessions: data.sessions.filter((s) => s.finishedAt < at),
    reviews: applyAnswers({}, answers),
    reads: data.reads.filter((r) => r.openedAt < at),
    activities: data.activities.filter((a) => a.at < at),
    codingAttempts: data.codingAttempts.filter((a) => a.at < at),
  };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function focusWhy(f: FocusTopic): string {
  const stat = f.stat && f.stat.attempts > 0 ? `${f.stat.score}% over ${plural(f.stat.attempts, "answer")}` : null;
  switch (f.reason) {
    case "weak":
      return `Your weakest area right now: ${stat}.`;
    case "reviews-due":
      return `${plural(f.dueCount, "question")} from this topic due for review.`;
    case "shaky":
      return `You missed a question here recently (${stat}).`;
    case "untested":
      return "You haven't been tested on this yet.";
  }
}

/** Topics due for revision, most overdue first, from retrieval evidence only. */
export function revisionsDue(data: ProgressData, ctx: PlanContext, now: number): TopicRevision[] {
  return allRevisions(data, ctx, now)
    .filter((r) => r.isDue)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function allRevisions(data: ProgressData, ctx: PlanContext, now: number): TopicRevision[] {
  const solves = codingSolvesByTopic(data, PATTERN_TOPICS);
  return ctx.topics.flatMap((t) => {
    const r = topicRevision(keyOf(t), evidenceFor(keyOf(t), data, solves), now);
    return r ? [r] : [];
  });
}

/**
 * Today's plan. It's worked out from what was true at the start of the day, so it stays put while you work through it:
 * finishing a task marks it done rather than replacing it with another one. Today's own records only decide what's done.
 */
export function buildTodayPlan(data: ProgressData, ctx: PlanContext, now: number, startOfDay: string): PlanTask[] {
  const past = progressBefore(data, startOfDay);
  const today = {
    answers: data.answers.filter((a) => a.answeredAt >= startOfDay),
    reads: data.reads.filter((r) => r.openedAt >= startOfDay),
    activities: data.activities.filter((a) => a.at >= startOfDay),
    attempts: data.codingAttempts.filter((a) => a.at >= startOfDay),
    sessions: data.sessions.filter((s) => s.finishedAt >= startOfDay),
  };
  const titleOf = (key: string) => ctx.topics.find((t) => keyOf(t) === key)?.title ?? key;
  const retrievedToday = (key: string) =>
    today.answers.some((a) => keyOf(a) === key) || today.activities.some((a) => keyOf(a) === key && a.kind === "exercise");

  const brandNew = past.answers.length === 0 && past.activities.length === 0 && past.reads.length === 0 && past.codingAttempts.length === 0;
  if (brandNew) {
    const first = ctx.topics.find((t) => ctx.workspaces[keyOf(t)]?.order === 1) ?? ctx.topics[0];
    return [
      {
        id: "baseline",
        kind: "baseline",
        title: "Take the baseline assessment",
        why: "It shows where you're strong and where you're guessing, so later plans aim at the right topics.",
        href: "/assess/",
        minutes: Math.ceil(ctx.questions.length * 0.75),
        done: today.sessions.some((s) => s.mode === "assessment"),
      },
      ...(first
        ? [
            {
              id: `learn:${keyOf(first)}`,
              kind: "learn" as const,
              title: `Start ${first.title}`,
              why: "A good first topic if you'd rather begin by learning than by testing.",
              href: topicHref(keyOf(first)),
              minutes: STEP_MINUTES.read,
              done: today.reads.some((r) => keyOf(r) === keyOf(first)),
            },
          ]
        : []),
    ];
  }

  const tasks: PlanTask[] = [];
  const used = new Set<string>();
  const rec = recommend(past, ctx.questions, ctx.topics, now);
  const knownQuestions = new Set(ctx.questions.map((q) => q.id));

  // Questions you got wrong, coming back on schedule.
  const dueIds = dueReviews(past.reviews, now).map((r) => r.questionId).filter((id) => knownQuestions.has(id));
  if (dueIds.length > 0) {
    const answered = new Set(today.answers.map((a) => a.questionId));
    const needed = Math.min(dueIds.length, 5);
    tasks.push({
      id: "reviews",
      kind: "reviews",
      title: `Review ${plural(dueIds.length, "question")} you missed`,
      why: "Due for review today. Recalling an answer at this point is what makes it stick.",
      href: "/practice/",
      minutes: Math.max(2, Math.ceil(Math.min(dueIds.length, 10) * 0.75)),
      done: dueIds.filter((id) => answered.has(id)).length >= needed,
    });
  }

  // Topics you've practised, before they fade.
  const revisions = revisionsDue(past, ctx, now);
  for (const r of revisions.slice(0, dueIds.length > 0 ? 1 : 2)) {
    used.add(r.key);
    const days = Math.max(0, Math.floor((now - Date.parse(r.lastAt)) / DAY));
    tasks.push({
      id: `revise:${r.key}`,
      kind: "revise",
      title: `Revise ${titleOf(r.key)}`,
      why: days === 0 ? "Due for revision today." : `Last practised ${days === 1 ? "yesterday" : `${days} days ago`}, and now due for revision.`,
      href: topicHref(r.key, "practice"),
      minutes: 5,
      done: retrievedToday(r.key),
    });
  }

  // The engine's top focus topic, at the next step that would actually move it forward.
  const solves = codingSolvesByTopic(past, PATTERN_TOPICS);
  const focus = rec.focus.find((f) => !used.has(keyOf(f.meta)));
  if (focus) {
    const key = keyOf(focus.meta);
    used.add(key);
    const step = nextStep(topicProficiency(key, past, ctx.workspaces[key], solves, now).tracks);
    const done =
      step === "read"
        ? today.reads.some((r) => keyOf(r) === key) || today.activities.some((a) => keyOf(a) === key && a.kind === "resource")
        : step === "practical"
          ? today.activities.some((a) => keyOf(a) === key && a.kind === "practical")
          : step === "exercise"
            ? today.activities.some((a) => keyOf(a) === key && a.kind === "exercise")
            : today.answers.some((a) => keyOf(a) === key);
    tasks.push({
      id: `learn:${key}`,
      kind: "learn",
      title: `${focus.meta.title}: ${STEP_LABEL[step].toLowerCase()}`,
      why: focusWhy(focus),
      href: topicHref(key, STEP_TAB[step]),
      minutes: STEP_MINUTES[step],
      done,
    });
  }

  // A coding problem you should be able to solve again by now.
  const retry = dueProblems(past, now)[0];
  if (retry) {
    const outcome = retry.last?.outcome;
    tasks.push({
      id: `coding:${retry.problem.id}`,
      kind: "coding",
      title: `Retry ${retry.problem.title}`,
      why: outcome === "not-solved" ? "You didn't solve it last time." : outcome === "solved-with-help" ? "You needed help last time. Try it unaided." : "Check you can still solve it from scratch.",
      href: `/coding/?problem=${encodeURIComponent(retry.problem.id)}`,
      minutes: 25,
      done: today.attempts.some((a) => a.problemId === retry.problem.id),
    });
  }

  return tasks.slice(0, MAX_TASKS);
}
