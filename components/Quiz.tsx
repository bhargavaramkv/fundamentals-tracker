"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { summarizeSession } from "@/lib/progress";
import { DOMAIN_LABELS, type AnswerLog, type Question, type SessionMode, type SessionRecord } from "@/lib/types";
import { DomainIcon, domainColor } from "./DomainIcon";
import { ProgressRing } from "./ProgressRing";
import { useProgress } from "./ProgressProvider";

/** Deterministic shuffle so option order is stable within a session but varies across sessions. */
function seededOrder(length: number, seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const j = ((h ^ (h >>> 16)) >>> 0) % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const DIFFICULTY_LABEL = { 1: "Core", 2: "Interview", 3: "Deep" } as const;

interface QuizProps {
  questions: Question[];
  mode: SessionMode;
  onExit?: () => void;
  /** Starts a fresh round from the result screen. */
  onRestart?: () => void;
}

export function Quiz({ questions, mode, onExit, onRestart }: QuizProps) {
  const { commitSession } = useProgress();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => new Date().toISOString());
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerLog[]>([]);
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const shownAt = useRef(0);

  const question = questions[index];
  const order = useMemo(
    () => (question ? seededOrder(question.options.length, `${sessionId}:${question.id}`) : []),
    [question, sessionId],
  );

  useEffect(() => {
    shownAt.current = performance.now();
  }, [index]);

  const choose = useCallback(
    (displayIdx: number) => {
      if (!question || picked !== null) return;
      const selected = order[displayIdx];
      setPicked(displayIdx);
      setAnswers((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sessionId,
          mode,
          questionId: question.id,
          domain: question.domain,
          topic: question.topic,
          difficulty: question.difficulty,
          correct: selected === question.answer,
          selected,
          timeMs: Math.round(performance.now() - shownAt.current),
          answeredAt: new Date().toISOString(),
        },
      ]);
    },
    [mode, order, picked, question, sessionId],
  );

  const finish = useCallback(
    async (logged: AnswerLog[]) => {
      if (logged.length === 0) {
        onExit?.();
        return;
      }
      setSaving(true);
      const session = summarizeSession(sessionId, mode, startedAt, logged);
      await commitSession(session, logged);
      setSaving(false);
      setResult(session);
    },
    [commitSession, mode, onExit, sessionId, startedAt],
  );

  const next = useCallback(() => {
    if (picked === null) return;
    if (index + 1 >= questions.length) {
      void finish(answers);
      return;
    }
    setPicked(null);
    setIndex((i) => i + 1);
  }, [answers, finish, index, picked, questions.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result || saving) return;
      const n = Number(e.key);
      if (n >= 1 && n <= order.length) choose(n - 1);
      else if (e.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, next, order.length, result, saving]);

  if (result) {
    return <QuizResult session={result} answers={answers} questions={questions} mode={mode} onRestart={onRestart} />;
  }
  if (!question) return <p className="text-ink-2">No questions to show.</p>;

  const correctDisplayIdx = order.indexOf(question.answer);
  const last = answers[answers.length - 1];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 text-sm text-ink-2">
        <span>
          Question <span className="font-semibold text-ink">{index + 1}</span> of {questions.length}
        </span>
        <button
          type="button"
          onClick={() => void finish(answers)}
          disabled={saving}
          className="-mr-2 min-h-11 rounded-md px-3 text-ink-3 hover:text-ink disabled:opacity-50"
        >
          {answers.length > 0 ? "End & save" : "Exit"}
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(100 * index) / questions.length}%`, background: domainColor(question.domain) }}
        />
      </div>

      <article className="card p-5 sm:p-7" style={{ borderTop: `4px solid ${domainColor(question.domain)}` }}>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-2">
          <span className="inline-flex items-center gap-2 font-medium text-ink">
            <DomainIcon domain={question.domain} size={28} />
            {DOMAIN_LABELS[question.domain]}
          </span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1">{question.topic.replace(/-/g, " ")}</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1">
            {"●".repeat(question.difficulty)}
            <span className="text-ink-3">{"○".repeat(3 - question.difficulty)}</span> {DIFFICULTY_LABEL[question.difficulty]}
          </span>
        </div>
        <h2 className="text-lg font-semibold leading-snug sm:text-xl">{question.prompt}</h2>
        {question.code && (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-sm">{question.code}</pre>
        )}

        <ol className="mt-5 space-y-2">
          {order.map((optIdx, displayIdx) => {
            const isPicked = picked === displayIdx;
            const isCorrect = displayIdx === correctDisplayIdx;
            let tone = "border-line bg-bg hover:-translate-y-px hover:border-accent hover:shadow-[var(--shadow)]";
            let badge = "bg-surface-2 text-ink-2";
            if (picked !== null) {
              if (isCorrect) {
                tone = "border-good bg-good-bg animate-pop";
                badge = "bg-good text-white";
              } else if (isPicked) {
                tone = "border-bad bg-bad-bg animate-pop";
                badge = "bg-bad text-white";
              } else tone = "border-line opacity-55";
            }
            return (
              <li key={`${question.id}-${optIdx}`}>
                <button
                  type="button"
                  onClick={() => choose(displayIdx)}
                  disabled={picked !== null}
                  className={`flex min-h-12 w-full flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border-2 px-4 py-3 text-left text-[15px] transition-all ${tone}`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}
                    aria-hidden
                  >
                    {String.fromCharCode(65 + displayIdx)}
                  </span>
                  <span className="min-w-0 flex-1 basis-0">{question.options[optIdx]}</span>
                  {/* On phones the verdict drops under the option text instead of squeezing it. */}
                  {picked !== null && isCorrect && (
                    <span className="w-full text-sm font-medium text-good sm:w-auto">✓ Correct</span>
                  )}
                  {picked !== null && isPicked && !isCorrect && (
                    <span className="w-full text-sm font-medium text-bad sm:w-auto">✗ Your answer</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        {picked !== null && last && (
          <div className={`mt-5 rounded-xl border-l-4 p-4 text-sm leading-relaxed ${last.correct ? "border-good bg-good-bg/50" : "border-bad bg-bad-bg/50"}`}>
            <p className={`mb-1 font-medium ${last.correct ? "text-good" : "text-bad"}`}>
              {last.correct ? "Correct" : "Not quite"} · {(last.timeMs / 1000).toFixed(1)}s
            </p>
            <p className="text-ink-2">{question.explanation}</p>
            <Link
              href={`/lessons/${question.domain}/${question.topic}/`}
              className="-mx-1 mt-1 inline-flex min-h-11 items-center px-1 text-accent hover:underline"
              target="_blank"
            >
              Read the lesson ↗
            </Link>
          </div>
        )}
      </article>

      {/* Sticky on phones so Next is always within reach without scrolling past the explanation. */}
      <div className="sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={next}
            disabled={picked === null || saving}
            className="btn-primary min-h-12 w-full rounded-xl px-6 text-base font-semibold disabled:opacity-40 disabled:shadow-none sm:min-h-0 sm:w-auto sm:py-2.5 sm:text-sm"
          >
            {saving ? "Saving…" : index + 1 >= questions.length ? "Finish" : "Next"}
          </button>
        </div>
      </div>
      <p className="hidden text-right text-xs text-ink-3 sm:block">Keys: 1–{order.length} to answer, Enter for next</p>
    </div>
  );
}

function QuizResult({
  session,
  answers,
  questions,
  mode,
  onRestart,
}: {
  session: SessionRecord;
  answers: AnswerLog[];
  questions: Question[];
  mode: SessionMode;
  onRestart?: () => void;
}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const wrong = answers.filter((a) => !a.correct);
  const pct = Math.round((100 * session.correct) / Math.max(1, session.total));

  return (
    <div className="space-y-6">
      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-6">
          <ProgressRing value={pct} size={120} stroke={12} color={pct >= 70 ? "var(--good)" : pct >= 40 ? "var(--warn)" : "var(--bad)"} label={`Score ${pct}%`}>
            <span className="text-3xl font-bold tabular-nums">{pct}%</span>
          </ProgressRing>
          <div>
            <p className="text-sm font-medium text-accent">{mode === "assessment" ? "Assessment" : "Practice"} complete</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {pct >= 80 ? "Excellent work" : pct >= 60 ? "Solid round" : pct >= 40 ? "Good practice" : "Lots to learn here, which is the point"}
            </p>
            <p className="text-sm text-ink-2">
              {session.correct} of {session.total} correct
            </p>
          </div>
        </div>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {Object.entries(session.domainScores).map(([d, s]) => (
            <li key={d} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <DomainIcon domain={d as keyof typeof DOMAIN_LABELS} size={26} />
              <span className="flex-1 text-ink-2">{DOMAIN_LABELS[d as keyof typeof DOMAIN_LABELS]}</span>
              <span className="font-semibold tabular-nums">{s}%</span>
            </li>
          ))}
        </ul>
      </section>

      {wrong.length > 0 && (
        <section className="card p-6">
          <h3 className="text-lg font-bold tracking-tight">Scheduled for review</h3>
          <p className="mb-3 text-sm text-ink-2">These come back in your practice queue in about 4 hours, then at growing intervals.</p>
          <ul className="space-y-2 text-sm">
            {wrong.map((a) => {
              const q = byId.get(a.questionId);
              if (!q) return null;
              return (
                <li key={a.id} className="rounded-md bg-surface-2 px-3 py-2">
                  <p>{q.prompt}</p>
                  <p className="mt-1 text-ink-2">
                    Answer: <span className="text-ink">{q.options[q.answer]}</span> ·{" "}
                    <Link href={`/lessons/${q.domain}/${q.topic}/`} className="text-accent hover:underline">
                      lesson
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/" className="tap btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
          See updated profile
        </Link>
        {onRestart ? (
          <button type="button" onClick={onRestart} className="tap rounded-lg border border-line px-5 py-2.5 text-sm">
            Another adaptive round
          </button>
        ) : (
          <Link href="/practice/" className="tap rounded-lg border border-line px-5 py-2.5 text-sm">
            Practice weak spots
          </Link>
        )}
      </div>
    </div>
  );
}
