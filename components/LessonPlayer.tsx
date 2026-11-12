"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lesson, LessonStep, Question, QuickCheck, Reveal, StepThrough } from "@/lib/types";
import { domainColor } from "./DomainIcon";
import { PageShell } from "./PageShell";
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

  const color = domainColor(lesson.domain);
  const allChecks = Object.entries(picks);
  const totalChecks = allChecks.length;
  const rightChecks = allChecks.filter(([k, v]) => {
    const [si, ci] = k.split(":").map(Number);
    return steps[si]?.blocks.flatMap((b) => (b.kind === "check" ? [b.check] : []))[ci]?.answer === v;
  }).length;

  if (view === "done") {
    const recap = steps.find((s) => /^recap$/i.test(s.title));
    return (
      <section aria-label="Lesson complete" className="card relative space-y-6 overflow-hidden p-6 sm:p-8">
        {celebrate && <Confetti />}
        <div className="flex flex-col items-center gap-3 text-center">
          <span aria-hidden className="animate-pop flex h-20 w-20 items-center justify-center rounded-full text-4xl text-white" style={{ background: color, boxShadow: `0 6px 0 color-mix(in oklab, ${color} 70%, black)` }}>
            ★
          </span>
          <p className="eyebrow">Lesson complete</p>
          <h2 ref={heading} tabIndex={-1} className="headline text-2xl outline-none sm:text-3xl">
            {lesson.title}
          </h2>
          {totalChecks > 0 && (
            <p className="text-[15px] font-bold text-ink-2">
              Quick checks: {rightChecks} of {totalChecks} right
            </p>
          )}
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

  const outline = (
    <nav aria-label="Lesson outline" className="card p-4">
      <p className="eyebrow">In this lesson</p>
      <ol className="mt-3 space-y-0.5">
        {steps.map((s, i) => {
          const isDone = i < index;
          const current = i === index;
          const cls = `flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[14px] ${current ? "bg-accent-soft font-bold text-accent-text" : isDone ? "text-ink hover:bg-surface-2" : "text-ink-3"}`;
          const mark = (
            <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: isDone || current ? color : "var(--surface-2)" }}>
              {isDone ? "✓" : ""}
            </span>
          );
          return (
            <li key={i}>
              {isDone ? (
                <button type="button" onClick={() => go(i)} className={cls}>
                  {mark}
                  <span className="min-w-0">{s.title}</span>
                </button>
              ) : (
                <span aria-current={current ? "step" : undefined} className={cls}>
                  {mark}
                  <span className="min-w-0">{s.title}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );

  return (
    <PageShell right={outline}>
    <section aria-label="Lesson" className="space-y-5">
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`Step ${index + 1} of ${steps.length}`}
          className="h-3.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${Math.max(percent, 4)}%`, background: color }} />
        </div>
        <span className="meta font-bold tabular-nums">
          {index + 1} / {steps.length}
        </span>
      </div>

      <div key={index} className="card animate-step p-5 sm:p-8">
        <h2 ref={heading} tabIndex={-1} className="headline text-2xl outline-none">
          {step.title}
        </h2>
        <div className="mt-4">
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
    </PageShell>
  );
}

function StepBlocks({ step, index, picks, onPick }: { step: LessonStep; index: number; picks: Record<string, number>; onPick: (key: string, n: number) => void }) {
  let ci = -1;
  return (
    <div className="space-y-6">
      {step.blocks.map((b, i) => {
        if (b.kind === "html") return <div key={i} className="prose-lesson" dangerouslySetInnerHTML={{ __html: b.html }} />;
        if (b.kind === "steps") return <StepThroughCard key={i} data={b.steps} />;
        if (b.kind === "reveal") return <RevealCard key={i} data={b.reveal} />;
        ci++;
        const key = `${index}:${ci}`;
        return <CheckCard key={i} check={b.check} rot={rotation(Math.max(index, 0), ci, b.check.options.length)} picked={picks[key]} onPick={(n) => onPick(key, n)} />;
      })}
    </div>
  );
}

function StepThroughCard({ data }: { data: StepThrough }) {
  const [i, setI] = useState(0);
  const last = i === data.frames.length - 1;
  const frame = data.frames[i];
  return (
    <div role="group" aria-label={data.title} className="rounded-2xl border-2 border-line bg-surface-2 p-4">
      <p className="eyebrow">Watch it run</p>
      <p className="mt-1 text-[17px] font-bold">{data.title}</p>
      <pre key={i} aria-live="polite" className="animate-step mt-3 overflow-x-auto rounded-xl bg-surface p-3 font-mono text-[13px] leading-snug sm:text-sm">
        {frame.visual}
      </pre>
      <p key={`c${i}`} className="animate-step mt-3 text-[15px]" dangerouslySetInnerHTML={{ __html: frame.caption }} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setI(i - 1)} disabled={i === 0} className="btn btn-secondary disabled:opacity-50">
          Back
        </button>
        <span className="meta font-bold tabular-nums" aria-label={`Frame ${i + 1} of ${data.frames.length}`}>
          {i + 1} / {data.frames.length}
        </span>
        <button type="button" onClick={() => setI(last ? 0 : i + 1)} className="btn btn-secondary">
          {last ? "Replay" : "Next"}
        </button>
      </div>
    </div>
  );
}

function RevealCard({ data }: { data: Reveal }) {
  const [shown, setShown] = useState(false);
  return (
    <div role="group" aria-label="Predict, then reveal" className="rounded-2xl border-2 border-line bg-surface-2 p-4">
      <p className="eyebrow">Predict, then reveal</p>
      <p className="mt-1 text-[17px] font-bold">{data.prompt}</p>
      {shown ? (
        <div className="prose-lesson animate-step mt-3" dangerouslySetInnerHTML={{ __html: data.answer }} />
      ) : (
        <button type="button" onClick={() => setShown(true)} className="btn btn-secondary mt-3">
          Show answer
        </button>
      )}
    </div>
  );
}

function CheckCard({ check, rot, picked, onPick }: { check: QuickCheck; rot: number; picked: number | undefined; onPick: (n: number) => void }) {
  const n = check.options.length;
  const order = Array.from({ length: n }, (_, i) => (i + rot) % n);
  const answered = picked !== undefined;
  return (
    <div role="group" aria-label="Quick check" className="rounded-2xl border-2 border-accent bg-accent-soft p-4 sm:p-5">
      <p className="eyebrow text-accent-text">Your turn · press 1-{Math.min(n, 4)}</p>
      <p className="mt-1 text-[17px] font-bold">{check.prompt}</p>
      <ul className="mt-3 space-y-2">
        {order.map((opt, pos) => {
          const isPicked = picked === opt;
          const isRight = opt === check.answer;
          const tone = !answered ? "" : isRight ? "!border-good !bg-good-bg" : isPicked ? "!border-bad !bg-bad-bg" : "opacity-60";
          return (
            <li key={opt}>
              <button
                type="button"
                disabled={answered}
                onClick={() => onPick(opt)}
                className={`option ${tone}`}
              >
                <span className="option-key tabular-nums">{pos + 1}</span>
                <span className="min-w-0 flex-1">{check.options[opt]}</span>
                {answered && isRight && <span className="text-good">Correct</span>}
                {answered && isPicked && !isRight && <span className="text-bad">Not quite</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <p role="status" className={`mt-3 rounded-xl p-3 text-[15px] ${picked === check.answer ? "bg-good-bg" : "bg-bad-bg"}`}>
          <span className={`font-extrabold ${picked === check.answer ? "text-good" : "text-bad"}`}>{picked === check.answer ? "Right. " : "Not quite. "}</span>
          {check.explanation}
        </p>
      )}
    </div>
  );
}

/** A one-off burst of coloured pieces from the centre of the card. Only rendered when motion is allowed. */
function Confetti() {
  const colors = ["var(--d-dsa)", "var(--d-oop)", "var(--d-databases)", "var(--d-system-design)", "var(--d-web)", "var(--d-os)", "var(--accent)"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 36 }, (_, i) => {
        const angle = (i / 36) * Math.PI * 2;
        const dist = 120 + ((i * 37) % 90);
        const style = {
          background: colors[i % colors.length],
          "--dx": `${Math.cos(angle) * dist}px`,
          "--dy": `${Math.sin(angle) * dist + 60}px`,
          "--rot": `${(i * 47) % 360}deg`,
          animationDelay: `${(i % 6) * 20}ms`,
        } as React.CSSProperties;
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}
