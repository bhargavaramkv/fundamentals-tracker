"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lesson, LessonStep, Question, QuickCheck } from "@/lib/types";
import { Quiz } from "./Quiz";

type View = "steps" | "checkpoint" | "done";

interface Props {
  lesson: Lesson;
  questions: Question[];
  /** Where to open: the steps, or straight at the checkpoint (from ?tab=practice / check). */
  start: "steps" | "checkpoint";
  next: { href: string; title: string } | null;
  pathHref: string;
}

const stepKey = (l: Lesson) => `lesson-step:${l.domain}/${l.topic}`;

function savedStep(l: Lesson, max: number): number {
  try {
    const n = Number(sessionStorage.getItem(stepKey(l)));
    return Number.isInteger(n) && n >= 0 && n < max ? n : 0;
  } catch {
    return 0;
  }
}

/** Options shown in a rotated order, so the right answer isn't always first. Stable per check. */
const rotation = (step: number, check: number, n: number) => (step * 3 + check) % n;

export function LessonPlayer({ lesson, questions: bank, start, next, pathHref }: Props) {
  const questions = useMemo(() => bank.filter((q) => q.domain === lesson.domain && q.topic === lesson.topic), [bank, lesson.domain, lesson.topic]);
  const steps = lesson.steps;
  const [view, setView] = useState<View>(start === "checkpoint" && bank.length > 0 ? "checkpoint" : "steps");
  const [index, setIndex] = useState(0);
  // Picked option (index into the check's own options) per `${step}:${check}`.
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [celebrate, setCelebrate] = useState(false);
  const [round, setRound] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    // Restoring the saved position is a sync with browser storage, which is what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(savedStep(lesson, steps.length));
  }, [lesson, steps.length]);

  const step: LessonStep | undefined = steps[index];
  const checks = useMemo(() => (step ? step.blocks.flatMap((b) => (b.kind === "check" ? [b.check] : [])) : []), [step]);
  const unanswered = checks.findIndex((_, i) => picks[`${index}:${i}`] === undefined);
  const canContinue = unanswered === -1;
  const isLast = index === steps.length - 1;

  const go = useCallback(
    (to: number) => {
      moved.current = true;
      setIndex(to);
      try {
        sessionStorage.setItem(stepKey(lesson), String(to));
      } catch {
        // storage unavailable: position just isn't remembered
      }
    },
    [lesson],
  );

  const finish = useCallback(() => {
    setCelebrate(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    try {
      sessionStorage.removeItem(stepKey(lesson));
    } catch {
      // ignore
    }
    setView("done");
  }, [lesson]);

  const advance = useCallback(() => {
    if (!canContinue) return;
    if (!isLast) go(index + 1);
    else if (questions.length > 0) setView("checkpoint");
    else finish();
  }, [canContinue, finish, go, index, isLast, questions.length]);

  useEffect(() => {
    if (!moved.current) return;
    // A new step starts at the top of the page, not wherever the last one was scrolled to.
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [index, view]);

  // Enter = Continue; 1-4 answer the first open quick check.
  useEffect(() => {
    if (view !== "steps") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "Enter") {
        // A focused button or link handles Enter itself.
        if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return;
        e.preventDefault();
        advance();
      } else if (/^[1-4]$/.test(e.key) && unanswered !== -1) {
        const check = checks[unanswered];
        const n = Number(e.key) - 1;
        if (n < check.options.length) setPicks((p) => ({ ...p, [`${index}:${unanswered}`]: (n + rotation(index, unanswered, check.options.length)) % check.options.length }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, advance, unanswered, checks, index]);

  if (view === "checkpoint") {
    const ordered = [...questions].sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
    return <Quiz key={round} questions={ordered} mode="practice" onExit={finish} onBack={finish} backLabel="Finish lesson" onRestart={() => setRound((r) => r + 1)} />;
  }

  if (view === "done") {
    const recap = steps.find((s) => /^recap$/i.test(s.title));
    return (
      <section aria-label="Lesson complete" className="card space-y-6 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <span aria-hidden className={`flex h-12 w-12 items-center justify-center rounded-full bg-accent text-2xl text-accent-ink ${celebrate ? "animate-pop" : ""}`}>
            ✓
          </span>
          <div>
            <p className="eyebrow">Lesson complete</p>
            <h2 ref={heading} tabIndex={-1} className="headline text-2xl outline-none">
              {lesson.title}
            </h2>
          </div>
        </div>
        {recap && (
          <div>
            <p className="meta mb-2">What you learned</p>
            <StepBlocks step={recap} index={-1} picks={{}} onPick={() => {}} />
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {next && (
            <Link href={next.href} className="btn btn-primary btn-lg">
              Next lesson: {next.title} <span aria-hidden>→</span>
            </Link>
          )}
          <Link href={pathHref} className={`btn btn-lg ${next ? "btn-secondary" : "btn-primary"}`}>
            Back to path
          </Link>
        </div>
      </section>
    );
  }

  if (!step) return null;
  const percent = Math.round((index / steps.length) * 100);

  return (
    <section aria-label="Lesson" className="space-y-5">
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`Step ${index + 1} of ${steps.length}`}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <span className="meta tabular-nums">
          {index + 1} / {steps.length}
        </span>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 sm:p-8">
        <h2 ref={heading} tabIndex={-1} className="headline text-2xl outline-none">
          {step.title}
        </h2>
        <div key={index} className="mt-4">
          <StepBlocks step={step} index={index} picks={picks} onPick={(key, n) => setPicks((p) => ({ ...p, [key]: n }))} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="btn btn-ghost disabled:invisible">
          ← Back
        </button>
        <button type="button" onClick={advance} disabled={!canContinue} className="btn btn-primary btn-lg disabled:opacity-50">
          {!isLast ? "Continue" : questions.length > 0 ? "Go to the checkpoint" : "Finish lesson"} <span aria-hidden>→</span>
        </button>
      </div>
      {!canContinue && <p className="meta text-right">Answer the question to continue.</p>}
    </section>
  );
}

function StepBlocks({ step, index, picks, onPick }: { step: LessonStep; index: number; picks: Record<string, number>; onPick: (key: string, n: number) => void }) {
  let ci = -1;
  return (
    <div className="space-y-6">
      {step.blocks.map((b, i) => {
        if (b.kind === "html") return <div key={i} className="prose-lesson" dangerouslySetInnerHTML={{ __html: b.html }} />;
        ci++;
        const key = `${index}:${ci}`;
        return <CheckCard key={i} check={b.check} rot={rotation(Math.max(index, 0), ci, b.check.options.length)} picked={picks[key]} onPick={(n) => onPick(key, n)} />;
      })}
    </div>
  );
}

function CheckCard({ check, rot, picked, onPick }: { check: QuickCheck; rot: number; picked: number | undefined; onPick: (n: number) => void }) {
  const n = check.options.length;
  const order = Array.from({ length: n }, (_, i) => (i + rot) % n);
  const answered = picked !== undefined;
  return (
    <div role="group" aria-label="Quick check" className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="meta">Quick check · press 1-{Math.min(n, 4)}</p>
      <p className="mt-1 font-medium">{check.prompt}</p>
      <ul className="mt-3 space-y-2">
        {order.map((opt, pos) => {
          const isPicked = picked === opt;
          const isRight = opt === check.answer;
          const tone = !answered ? "border-line bg-surface hover:border-accent" : isRight ? "border-good bg-good-bg" : isPicked ? "border-bad bg-bad-bg" : "border-line bg-surface opacity-70";
          return (
            <li key={opt}>
              <button
                type="button"
                disabled={answered}
                onClick={() => onPick(opt)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-[15px] ${tone}`}
              >
                <span className="meta tabular-nums">{pos + 1}</span>
                <span className="min-w-0 flex-1">{check.options[opt]}</span>
                {answered && isRight && <span className="text-good">Correct</span>}
                {answered && isPicked && !isRight && <span className="text-bad">Not quite</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <p role="status" className="mt-3 text-[15px] text-ink-2">
          <span className={`font-medium ${picked === check.answer ? "text-good" : "text-bad"}`}>{picked === check.answer ? "Right. " : "Not quite. "}</span>
          {check.explanation}
        </p>
      )}
    </div>
  );
}
