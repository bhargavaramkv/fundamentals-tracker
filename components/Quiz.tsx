"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isQuickMiss, READ_LOCK_MS } from "@/lib/answer-pace";
import { summarizeSession } from "@/lib/progress";
import { GUESS_MS } from "@/lib/retention";
import { DOMAIN_LABELS, type AnswerLog, type Question, type SessionMode, type SessionRecord } from "@/lib/types";
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
  /** Where the result screen's main button goes, when not back to Today. */
  onBack?: () => void;
  backLabel?: string;
}

export function Quiz({ questions, mode, onExit, onRestart, onBack, backLabel }: QuizProps) {
  const { commitSession } = useProgress();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => new Date().toISOString());
  const [index, setIndex] = useState(0);
  // One log per question index. Practice locks the first pick and shows feedback; an assessment measures unaided
  // performance, so it hides correctness until the end and lets you go back and change an answer.
  const [logs, setLogs] = useState<(AnswerLog | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const shownAt = useRef(0);
  // Assessment: time already spent on each question during earlier visits.
  const priorMs = useRef<number[]>(questions.map(() => 0));
  const blind = mode === "assessment";

  const question = questions[index];
  const log = logs[index] ?? null;
  const answers = useMemo(() => logs.filter((l): l is AnswerLog => l !== null), [logs]);
  const order = useMemo(
    () => (question ? seededOrder(question.options.length, `${sessionId}:${question.id}`) : []),
    [question, sessionId],
  );
  const picked = log ? order.indexOf(log.selected) : null;
  const revealed = !blind && picked !== null;

  useEffect(() => {
    shownAt.current = performance.now();
  }, [index]);

  // Practice: a new question is read-only for READ_LOCK_MS. State holds the index whose lock has ended.
  const [readIndex, setReadIndex] = useState(-1);
  const locked = !blind && readIndex !== index;
  const lockBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (blind) return;
    const t = setTimeout(() => setReadIndex(index), READ_LOCK_MS);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lockBar.current?.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: READ_LOCK_MS, easing: "linear" });
    }
    return () => clearTimeout(t);
  }, [blind, index]);

  const choose = useCallback(
    (displayIdx: number) => {
      if (!question || saving || locked || (!blind && log)) return;
      const unsure = displayIdx < 0;
      const selected = unsure ? -1 : order[displayIdx];
      const at = index;
      setLogs((prev) => {
        const nextLogs = [...prev];
        nextLogs[at] = {
          id: prev[at]?.id ?? crypto.randomUUID(),
          sessionId,
          mode,
          questionId: question.id,
          domain: question.domain,
          topic: question.topic,
          difficulty: question.difficulty,
          correct: !unsure && selected === question.answer,
          selected,
          selectedText: unsure ? "I don't know" : question.options[selected],
          ...(unsure ? { unsure: true } : {}),
          // Time to the (final) decision, across visits.
          timeMs: Math.round(priorMs.current[at] + performance.now() - shownAt.current),
          answeredAt: new Date().toISOString(),
        };
        return nextLogs;
      });
    },
    [blind, index, locked, log, mode, order, question, saving, sessionId],
  );

  const finish = useCallback(
    async (logged: AnswerLog[]) => {
      if (saving) return;
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
    [commitSession, mode, onExit, saving, sessionId, startedAt],
  );

  const go = useCallback(
    (to: number) => {
      priorMs.current[index] += performance.now() - shownAt.current;
      setIndex(to);
    },
    [index],
  );

  const next = useCallback(() => {
    if (picked === null || saving) return;
    if (index + 1 >= questions.length) {
      void finish(answers);
      return;
    }
    go(index + 1);
  }, [answers, finish, go, index, picked, questions.length, saving]);

  const previous = useCallback(() => {
    if (blind && index > 0 && !saving) go(index - 1);
  }, [blind, go, index, saving]);

  // Answers are only stored when the round ends, so warn before leaving would throw them away.
  const unsaved = answers.length > 0 && !result;
  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    // In-app links: capture runs before Next's router sees the click, so cancelling here keeps the round.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a || a.getAttribute("target") === "_blank" || e.defaultPrevented) return;
      if (!window.confirm("Leave this round? Answers so far haven't been saved. Use “End & save” to keep them.")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [unsaved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result || saving) return;
      const n = Number(e.key);
      if (e.key === "0") choose(-1);
      else if (n >= 1 && n <= order.length) choose(n - 1);
      else if (e.key === "Enter") next();
      else if (e.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, next, order.length, previous, result, saving]);

  if (result) {
    return <QuizResult session={result} answers={answers} questions={questions} mode={mode} onRestart={onRestart} onBack={onBack} backLabel={backLabel} />;
  }
  if (!question) return <p className="text-ink-2">No questions to show.</p>;

  const correctDisplayIdx = order.indexOf(question.answer);
  const last = log;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-4 text-sm text-ink-2">
        <span>
          Question <span className="font-semibold text-ink">{index + 1}</span> of {questions.length}
        </span>
        <button
          type="button"
          onClick={() => void finish(answers)}
          disabled={saving}
          className="btn btn-ghost btn-muted -mr-2"
        >
          {answers.length > 0 ? "End & save" : "Exit"}
        </button>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div
          className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${Math.max((100 * index) / questions.length, 4)}%`, background: "var(--good)" }}
        />
      </div>

      <article className="pt-3">
        <p className="meta mb-3">
          {DOMAIN_LABELS[question.domain]} · {question.topic.replace(/-/g, " ")} · {DIFFICULTY_LABEL[question.difficulty]}
        </p>
        <h2 className="headline text-2xl sm:text-[1.75rem]">{question.prompt}</h2>
        {question.code && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface p-3 font-mono text-sm">{question.code}</pre>
        )}

        {!blind && (
          <div className="mt-5 h-0.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div ref={lockBar} className={`h-full origin-left bg-ink-3 transition-opacity ${locked ? "" : "opacity-0"}`} />
          </div>
        )}
        <ol className={`${blind ? "mt-5" : "mt-3"} space-y-2 transition-opacity ${locked ? "opacity-70" : ""}`}>
          {order.map((optIdx, displayIdx) => {
            const isPicked = picked === displayIdx;
            const isCorrect = displayIdx === correctDisplayIdx;
            let tone = "";
            let badge = "";
            if (blind && isPicked) {
              tone = "!border-accent !bg-accent-soft";
              badge = "!border-accent bg-accent text-accent-ink";
            } else if (revealed) {
              if (isCorrect) {
                tone = "!border-good !bg-good-bg";
                badge = "!border-good bg-good text-surface";
              } else if (isPicked) {
                tone = "!border-bad !bg-bad-bg";
                badge = "!border-bad bg-bad text-surface";
              } else tone = "opacity-55";
            }
            return (
              <li key={`${question.id}-${optIdx}`}>
                <button
                  type="button"
                  onClick={() => choose(displayIdx)}
                  disabled={revealed || locked}
                  aria-pressed={blind ? isPicked : undefined}
                  className={`option min-h-12 flex-wrap gap-y-1 ${tone}`}
                >
                  <span
                    className={`option-key shrink-0 ${badge}`}
                    aria-hidden
                  >
                    {String.fromCharCode(65 + displayIdx)}
                  </span>
                  <span className="min-w-0 flex-1 basis-0">{question.options[optIdx]}</span>
                  {/* On phones the verdict drops under the option text instead of squeezing it. */}
                  {blind && isPicked && <span className="w-full text-sm font-medium text-accent-text sm:w-auto">● Selected</span>}
                  {revealed && isCorrect && (
                    <span className="w-full text-sm font-medium text-good sm:w-auto">✓ Correct</span>
                  )}
                  {revealed && isPicked && !isCorrect && (
                    <span className="w-full text-sm font-medium text-bad sm:w-auto">✗ Your answer</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() => choose(-1)}
          disabled={revealed || locked}
          aria-pressed={blind ? last?.unsure === true : undefined}
          className={`mt-3 min-h-12 w-full rounded-2xl border-2 border-dashed px-4 py-3 text-left text-[15px] transition-colors disabled:cursor-default ${
            blind && last?.unsure ? "border-accent bg-accent-soft" : revealed ? "border-line opacity-55" : "border-line text-ink-2 hover:border-ink-3 hover:bg-surface-2"
          }`}
        >
          {revealed && last?.unsure ? "● You said: I don't know" : "I don't know this yet"}
          {!revealed && <span className="meta ml-2">Better than guessing: you&apos;ll see the answer and it comes back for review.</span>}
        </button>

        {revealed && last && (
          <div
            role="status"
            className={`mt-5 rounded-2xl border-2 p-4 text-[15px] leading-relaxed ${last.correct ? "border-good bg-good-bg/50" : "border-bad bg-bad-bg/50"}`}
          >
            <p className={`mb-1 font-medium ${last.correct ? "text-good" : "text-bad"}`}>
              {last.unsure ? "Honest answer, now learn it" : last.correct ? "Correct" : "Not quite"} · {(last.timeMs / 1000).toFixed(1)}s
            </p>
            {last.unsure && (
              <p className="mb-1 text-ink">
                The answer is <span className="font-medium">{question.options[question.answer]}</span>. Read why below, then open the topic.
                This question returns for review.
              </p>
            )}
            {last.timeMs < GUESS_MS && !last.unsure && (
              <p className="mb-1 font-medium text-ink">
                Under {GUESS_MS / 1000} seconds, so this counts as a likely guess and is left out of your retention numbers. Read every option before you pick.
              </p>
            )}
            {!last.unsure && isQuickMiss(last.timeMs, last.correct) && (
              <p className="mb-1 font-medium text-ink">That was quick. Next time, read every option before choosing.</p>
            )}
            <p className="text-ink-2">{question.explanation}</p>
            <p className="meta mt-1">AI-generated explanation. The topic&apos;s sources are the authority.</p>
            <Link
              href={`/learn/${question.domain}/${question.topic}/`}
              className="-mx-1 mt-1 inline-flex min-h-11 items-center px-1 text-accent-text hover:underline"
              target="_blank"
            >
              Open this topic ↗
            </Link>
          </div>
        )}
      </article>

      {/* Sticky on phones so Next is always within reach without scrolling past the explanation. */}
      <div className="sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-line bg-bg px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="flex items-center justify-between gap-3">
          {blind ? (
            <button type="button" onClick={previous} disabled={index === 0 || saving} className="btn btn-secondary btn-lg">
              <span aria-hidden>←</span> Previous
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={next}
            disabled={picked === null || saving}
            className={`btn btn-primary btn-lg ${blind ? "max-sm:flex-1" : "btn-block"}`}
          >
            {saving ? "Saving…" : index + 1 >= questions.length ? "Finish" : "Next"}
            {!saving && <span className="btn-arrow" aria-hidden>→</span>}
          </button>
        </div>
      </div>
      {blind && (
        <p className="meta">
          {answers.length} of {questions.length} answered. Results and explanations come at the end; you can go back and
          change an answer until then.
        </p>
      )}
      <p className="meta hidden text-right sm:block">
        Keys: 1–{order.length} to answer, 0 for I don&apos;t know, Enter for next{blind ? ", ← for previous" : ""}
      </p>
    </div>
  );
}

function QuizResult({
  session,
  answers,
  questions,
  mode,
  onRestart,
  onBack,
  backLabel,
}: {
  session: SessionRecord;
  answers: AnswerLog[];
  questions: Question[];
  mode: SessionMode;
  onRestart?: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const wrong = answers.filter((a) => !a.correct);
  const pct = Math.round((100 * session.correct) / Math.max(1, session.total));
  const domains = Object.entries(session.domainScores);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="page-head">
        <p className="eyebrow">{mode === "assessment" ? "Assessment" : "Practice"} complete</p>
        <h1 className="mt-2">
          {session.correct} of {session.total} correct
        </h1>
        <p>
          {pct}%.{" "}
          {pct >= 80 ? "Excellent work." : pct >= 60 ? "A solid round." : pct >= 40 ? "Good practice." : "Lots to learn here, which is the point."}
          {mode === "assessment" && ` This is a snapshot from ${session.total} questions that shows where to aim next, not a verdict on your ability.`}
        </p>
      </header>

      {domains.length > 1 && (
        <ul className="divide-y divide-line border-y border-line">
          {domains.map(([d, s]) => (
            <li key={d} className="flex items-baseline justify-between gap-3 py-2.5 text-[15px]">
              <span className="text-ink-2">{DOMAIN_LABELS[d as keyof typeof DOMAIN_LABELS]}</span>
              <span className="font-medium tabular-nums">{s}%</span>
            </li>
          ))}
        </ul>
      )}

      {wrong.length > 0 && (
        <section aria-labelledby="wrong-h">
          <div className="section-head">
            <h2 id="wrong-h">Scheduled for review</h2>
          </div>
          <p className="mt-3 text-[15px] text-ink-2">These come back in about 4 hours, then at growing intervals.</p>
          <ul className="mt-2 divide-y divide-line text-[15px]">
            {wrong.map((a) => {
              const q = byId.get(a.questionId);
              if (!q) return null;
              return (
                <li key={a.id} className="py-3">
                  <p>{q.prompt}</p>
                  <p className="mt-1 text-ink-2">
                    Answer: <span className="text-ink">{q.options[q.answer]}</span>
                  </p>
                  {a.unsure && <p className="mt-1 text-ink-2">{q.explanation}</p>}
                  <p className="meta mt-1">
                    <Link href={`/learn/${q.domain}/${q.topic}/`} className="text-accent-text hover:underline">
                      Open this topic
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="btn btn-primary">
            {backLabel ?? "Back"}
          </button>
        ) : (
          <Link href="/" className="btn btn-primary">
            Back to Today <span className="btn-arrow" aria-hidden>→</span>
          </Link>
        )}
        {onRestart && (
          <button type="button" onClick={onRestart} className="btn btn-secondary">
            Another round
          </button>
        )}
      </div>
    </div>
  );
}
