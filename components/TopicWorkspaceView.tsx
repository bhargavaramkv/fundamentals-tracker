"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PATTERN_TOPICS, CODING_PATTERNS } from "@/lib/coding";
import { codingSolvesByTopic, CODING_SOLVES_FOR_PRACTICAL, hasPracticalEvidence, LEVEL_LABEL, latestRatings, topicProficiency, topicRevision, evidenceFor, type TopicProficiency } from "@/lib/proficiency";
import { isVerificationStale, SOURCE_LABEL, TIER_LABEL, type Resource } from "@/lib/resources";
import { DOMAIN_LABELS, type Exercise, type ExerciseRating, type Lesson, type LearningActivity, type PracticalTask, type Question, type TopicWorkspace } from "@/lib/types";
import { LessonPlayer } from "./LessonPlayer";
import { LessonReadTracker } from "./LessonReadTracker";
import { useProgress } from "./ProgressProvider";
import { relativeDays, untilDays, useNow } from "./useNow";

/** Where this lesson sits in the course, worked out at build time. */
export interface LessonNav {
  trackTitle: string;
  stageTitle: string;
  /** 1-based position within the stage. */
  position: number;
  count: number;
  next: { href: string; title: string } | null;
}

interface Props {
  lesson: Lesson;
  workspace: TopicWorkspace;
  questions: Question[];
  resources: Resource[];
  prerequisites: { key: string; title: string }[];
  nav: LessonNav | null;
}

export function levelTone(level: TopicProficiency["level"]): string {
  if (level === "mastered") return "bg-good-bg text-good";
  if (level === "proficient") return "text-good";
  if (level === "reading") return "bg-warn-bg text-warn";
  return "text-ink-2";
}

export function TopicWorkspaceView({ lesson, workspace, questions, resources, prerequisites, nav }: Props) {
  const requested = useSearchParams().get("tab");
  const { data, ready } = useProgress();
  const now = useNow();
  const key = `${lesson.domain}/${lesson.topic}`;
  const primary = resources.filter((r) => r.tier < 3);
  const extra = resources.filter((r) => r.tier === 3);

  const loaded = ready && now !== null;
  const solves = codingSolvesByTopic(data, PATTERN_TOPICS);
  const proficiency = loaded ? topicProficiency(key, data, workspace, solves, now) : null;
  const revision = loaded ? topicRevision(key, evidenceFor(key, data, solves), now) : null;

  return (
    <article className="space-y-8">
      <header>
        <nav aria-label="Breadcrumb" className="meta">
          <Link href="/learn/" className="tap hover:text-ink">
            Learn
          </Link>
          <span aria-hidden> › </span>
          <Link href={`/learn/${lesson.domain}/`} className="tap hover:text-ink">
            {nav?.trackTitle ?? DOMAIN_LABELS[lesson.domain]}
          </Link>
          {nav && (
            <>
              <span aria-hidden> › </span>
              <span>{nav.stageTitle}</span>
            </>
          )}
        </nav>
        <div className="page-head mt-3">
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
        </div>
        <p className="meta mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {nav && (
            <span>
              Lesson {nav.position} of {nav.count} in {nav.stageTitle}
            </span>
          )}
          {lesson.minutes && <span>About {lesson.minutes} min</span>}
          {proficiency && <span className={`tag ${levelTone(proficiency.level)}`}>{LEVEL_LABEL[proficiency.level]}</span>}
        </p>
        {prerequisites.length > 0 && (
          <p className="meta mt-2">
            Helps to know first:{" "}
            {prerequisites.map((p, i) => (
              <span key={p.key}>
                {i > 0 && ", "}
                <Link href={`/learn/${p.key}/`} className="text-accent-text hover:underline">
                  {p.title}
                </Link>
              </span>
            ))}
          </p>
        )}
      </header>

      <LessonReadTracker domain={lesson.domain} topic={lesson.topic} />
      <LessonPlayer
        lesson={lesson}
        questions={questions}
        start={requested === "practice" || requested === "check" ? "checkpoint" : "steps"}
        next={nav?.next ?? null}
        pathHref={`/learn/${lesson.domain}/`}
      />

      <div className="space-y-3">
        <Section title="Exercises and practical work" open={requested === "exercises"}>
          <ExercisesTab lesson={lesson} workspace={workspace} topicKey={key} codingSolves={proficiency?.tracks.practical.codingSolves ?? 0} />
        </Section>
        <Section title="Sources" open={false}>
          <div className="space-y-8">
            <div>
              <p className="meta">Links checked against the live page</p>
              <ResourceList lesson={lesson} resources={primary} />
            </div>
            {extra.length > 0 && (
              <div>
                <p className="meta">Supplementary: blogs and videos, useful views, not references</p>
                <ResourceList lesson={lesson} resources={extra} />
              </div>
            )}
            <p className="ai-note">
              <strong>AI-generated.</strong> The lesson is written and revised with Claude as a short summary. It isn&apos;t checked
              line by line against the sources above, so where they disagree, trust the sources.
            </p>
          </div>
        </Section>
        {proficiency && now !== null && (
          <Section title="Your evidence" open={false}>
            <Evidence p={proficiency} revisionDueAt={revision?.dueAt ?? null} revisionIsDue={revision?.isDue ?? false} now={now} />
          </Section>
        )}
      </div>
    </article>
  );
}

function Section({ title, open, children }: { title: string; open: boolean; children: ReactNode }) {
  return (
    <details open={open || undefined} className="rounded-xl border border-line bg-surface">
      <summary className="tap cursor-pointer px-5 py-3 font-medium">{title}</summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}

function Evidence({ p, revisionDueAt, revisionIsDue, now }: { p: TopicProficiency; revisionDueAt: string | null; revisionIsDue: boolean; now: number }) {
  const t = p.tracks;
  return (
    <section aria-label="Your evidence for this topic">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="meta">Proficiency</span>
        <span className={`tag text-sm ${levelTone(p.level)}`}>{LEVEL_LABEL[p.level]}</span>
        {revisionDueAt && (
          <span className={`meta ${revisionIsDue ? "font-medium text-warn" : ""}`}>
            {revisionIsDue ? "Revision due" : `Next revision ${untilDays(revisionDueAt, now)}`}
          </span>
        )}
      </p>
      <dl className="tracks mt-4">
        <Track label="Reading" value={t.reading.lessonReads + t.reading.resources > 0 ? `${t.reading.resources} source${t.reading.resources === 1 ? "" : "s"}, ${t.reading.lessonReads} read${t.reading.lessonReads === 1 ? "" : "s"}` : "Not yet"} last={t.reading.lastAt} now={now} />
        <Track label="Quizzes" value={t.quizzes.answers > 0 ? `${t.quizzes.score}% over ${t.quizzes.answers}` : "Not yet"} last={t.quizzes.lastAt} now={now} />
        <Track label="Exercises" value={`${t.exercises.gotIt} of ${t.exercises.total} answered well`} last={t.exercises.lastAt} now={now} />
        <Track label="Practical" value={hasPracticalEvidence(t) ? "Done" : t.practical.codingSolves > 0 ? `${t.practical.codingSolves} of ${CODING_SOLVES_FOR_PRACTICAL} coding solves` : "Not yet"} last={t.practical.lastAt} now={now} />
      </dl>
      {p.needs.length > 0 && (
        <div className="mt-4 text-[15px]">
          <p className="text-ink-2">To reach the next level:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
            {p.needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Track({ label, value, last, now }: { label: string; value: string; last: string | null; now: number }) {
  return (
    <div>
      <dt className="meta">{label}</dt>
      <dd className="text-[15px] font-medium leading-snug">{value}</dd>
      {last && <dd className="meta">{relativeDays(last, now)}</dd>}
    </div>
  );
}

function ResourceList({ lesson, resources }: { lesson: Lesson; resources: Resource[] }) {
  const { data, commitActivity } = useProgress();
  const now = useNow();
  const readAt = new Map(data.activities.filter((a) => a.kind === "resource").map((a) => [a.refId, a.at]));

  const mark = (r: Resource) => {
    const activity: LearningActivity = { id: crypto.randomUUID(), domain: lesson.domain, topic: lesson.topic, kind: "resource", refId: r.id, at: new Date().toISOString() };
    void commitActivity(activity);
  };

  return (
    <ul className="divide-y divide-line">
      {resources.map((r) => (
        <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-4">
          <div className="min-w-0 max-w-[60ch] flex-1 basis-72">
            <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-accent-text hover:underline">
              {r.title} <span aria-hidden>↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="mt-0.5 text-[15px] text-ink-2">{r.note}</p>
            <p className="meta mt-1">
              {r.publisher} · {SOURCE_LABEL[r.source]} · {TIER_LABEL[r.tier]} · checked {r.verifiedAt}
              {now !== null && isVerificationStale(r.verifiedAt, now) && <span className="text-warn"> · due for a re-check</span>}
            </p>
          </div>
          {readAt.has(r.id) ? (
            <span className="meta shrink-0 py-2 font-medium text-good">✓ Read</span>
          ) : (
            <button type="button" onClick={() => mark(r)} className="btn btn-ghost btn-muted -mr-3 shrink-0">
              Mark as read
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ExercisesTab({ lesson, workspace, topicKey, codingSolves }: { lesson: Lesson; workspace: TopicWorkspace; topicKey: string; codingSolves: number }) {
  const { data } = useProgress();
  const ratings = latestRatings(data.activities);
  const patterns = CODING_PATTERNS.filter((p) => p.topic === topicKey);
  return (
    <div className="max-w-3xl space-y-12">
      <section aria-labelledby="ex-h">
        <div className="section-head">
          <h2 id="ex-h">Exercises</h2>
          <span className="meta">Write your answer first, then compare</span>
        </div>
        <ol className="divide-y divide-line">
          {workspace.exercises.map((e, i) => (
            <ExerciseCard key={e.id} exercise={e} n={i + 1} lesson={lesson} rating={ratings.get(e.id)?.rating} />
          ))}
        </ol>
      </section>
      <section aria-labelledby="lab-h">
        <div className="section-head">
          <h2 id="lab-h">Practical work</h2>
          <span className="meta">Done outside this app</span>
        </div>
        <ul className="divide-y divide-line">
          {workspace.practical.map((p) => (
            <PracticalCard key={p.id} task={p} lesson={lesson} />
          ))}
        </ul>
        {patterns.length > 0 && (
          <p className="mt-4 text-[15px] text-ink-2">
            Coding problems count too: solving {CODING_SOLVES_FOR_PRACTICAL} problems tagged {patterns.map((p) => p.label).join(" or ")} without help also counts as practical work
            {codingSolves > 0 ? ` (${codingSolves} so far)` : ""}.{" "}
            <Link href="/coding/" className="text-accent-text hover:underline">
              Log problems in Coding
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}

const RATINGS: { id: ExerciseRating; label: string }[] = [
  { id: "got-it", label: "Got it" },
  { id: "partial", label: "Partly" },
  { id: "missed", label: "Missed it" },
];

function ExerciseCard({ exercise, n, lesson, rating }: { exercise: Exercise; n: number; lesson: Lesson; rating?: ExerciseRating }) {
  const { commitActivity } = useProgress();
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState("");

  const rate = (value: ExerciseRating) => {
    void commitActivity({ id: crypto.randomUUID(), domain: lesson.domain, topic: lesson.topic, kind: "exercise", refId: exercise.id, rating: value, at: new Date().toISOString() });
    setRevealed(false);
    setDraft("");
  };

  return (
    <li className="py-6">
      <p className="meta">
        Exercise {n} · about {exercise.minutes} min
        {rating && <span className="ml-2 font-medium text-ink-2">Last result: {RATINGS.find((r) => r.id === rating)?.label}</span>}
      </p>
      <p className="mt-1 text-[17px] leading-relaxed">{exercise.prompt}</p>
      <label className="mt-3 block">
        <span className="sr-only">Your answer (not saved)</span>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Your answer. It's only for you and isn't saved." className="field text-[15px]" />
      </label>
      {revealed ? (
        <div className="mt-4 space-y-3">
          <div className="ai-note">
            <strong>Model answer, AI-generated.</strong> <span className="text-ink">{exercise.answer}</span>
          </div>
          <div role="group" aria-label="How did your answer compare?" className="flex flex-wrap items-center gap-2">
            <span className="meta mr-1">How did you do?</span>
            {RATINGS.map((r) => (
              <button key={r.id} type="button" onClick={() => rate(r.id)} className="btn btn-secondary">
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setRevealed(true)} className="btn btn-secondary mt-3">
          {rating ? "Try again: show the answer" : "Show the model answer"}
        </button>
      )}
    </li>
  );
}

function PracticalCard({ task, lesson }: { task: PracticalTask; lesson: Lesson }) {
  const { data, commitActivity } = useProgress();
  const [note, setNote] = useState("");
  const done = data.activities.filter((a): a is Extract<LearningActivity, { kind: "practical" }> => a.kind === "practical" && a.refId === task.id).sort((a, b) => b.at.localeCompare(a.at))[0];

  const complete = () => {
    void commitActivity({ id: crypto.randomUUID(), domain: lesson.domain, topic: lesson.topic, kind: "practical", refId: task.id, ...(note.trim() ? { note: note.trim() } : {}), at: new Date().toISOString() });
    setNote("");
  };

  return (
    <li className="py-6">
      <p className="meta">About {task.minutes} min</p>
      <h3 className="headline mt-0.5 text-xl">{task.title}</h3>
      <p className="mt-1.5 text-[17px] leading-relaxed text-ink-2">{task.task}</p>
      <p className="mt-2 text-[15px]">
        <span className="font-medium">You&apos;re done when: </span>
        <span className="text-ink-2">{task.done}</span>
      </p>
      {done ? (
        <p className="mt-3 text-[15px]">
          <span className="font-medium text-good">✓ Completed {done.at.slice(0, 10)}</span>
          {done.note && <span className="text-ink-2">. Your notes: {done.note}</span>}
        </p>
      ) : (
        <div className="mt-3">
          <label className="block text-[15px]">
            <span className="text-ink-2">What did you find? (saved with your progress)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="field mt-1 text-[15px]" />
          </label>
          <button type="button" onClick={complete} className="btn btn-secondary mt-2">
            Mark as done
          </button>
        </div>
      )}
    </li>
  );
}
