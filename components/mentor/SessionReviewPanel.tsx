"use client";

import { useMemo, type ReactNode } from "react";
import { deriveSession } from "@/lib/journal/events";
import type { JournalSession } from "@/lib/journal/types";
import { discussPrompt, reviewNowPrompt } from "@/lib/mentor/prompts";
import { eventTexts } from "@/lib/review/validate";
import type { EvidenceRef, Finding, SessionReview } from "@/lib/review/types";
import { useJournal } from "../JournalProvider";
import { useMentor } from "../MentorProvider";
import { StatusPill } from "../ui/StatusPill";
import { useCopy } from "./useCopy";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const QUALITY: Record<SessionReview["explanationQuality"]["level"], string> = {
  clear: "Clear",
  partial: "Partly clear",
  unclear: "Unclear",
  "insufficient-evidence": "Not enough to judge",
};

type Texts = Map<string, string[]> | null;

const TONES = { good: "text-good", warn: "text-warn", bad: "text-bad", info: "text-accent-text", neutral: "text-ink-2" } as const;

/** One evidence reference: the quote is looked up in the session's own event, never invented. */
function Evidence({ r, texts }: { r: EvidenceRef; texts: Texts }) {
  const found = texts?.get(r.eventId);
  let body: string | null = null;
  let note = "";
  if (!found) note = "event not found";
  else if (r.quote !== undefined) {
    if (found.some((t) => t.includes(r.quote!))) body = r.quote;
    else note = "quote not found in the event";
  } else body = found[0] ?? null;
  return (
    <blockquote className="border-l-2 border-cyan/40 pl-3 text-[13px] leading-relaxed text-ink-3">
      {body ? <span className="break-words italic">&ldquo;{body}&rdquo;</span> : <span>{note || "event has no text"}</span>}
    </blockquote>
  );
}

function Findings({ title, items, texts, withQuestion, tone = "neutral" }: { title: string; items: (Finding & { question?: string })[]; texts: Texts; withQuestion?: boolean; tone?: keyof typeof TONES }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h4 className={`eyebrow ${TONES[tone]}`}>{title}</h4>
      <ul className="space-y-3">
        {items.map((f, i) => (
          <li key={i} className="space-y-1">
            <p className="break-words text-[15px] leading-snug">
              <span className="font-semibold">{f.concept}.</span> <span className="text-ink-2">{f.text}</span>
            </p>
            {withQuestion && f.question && <p className="break-words text-[14px] text-accent-text">Try: {f.question}</p>}
            {f.evidence.map((r, j) => (
              <Evidence key={j} r={r} texts={texts} />
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h4 className="eyebrow">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-2">
        {items.map((t, i) => (
          <li key={i} className="break-words">
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CopyButton({ text, label, primary }: { text: string; label: string; primary?: boolean }) {
  const { state, copy } = useCopy();
  return (
    <button type="button" className={`btn ${primary ? "btn-primary" : "btn-secondary"}`} onClick={() => void copy(text)}>
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </button>
  );
}

function Frame({ children, pill }: { children: ReactNode; pill?: ReactNode }) {
  return (
    <section aria-label="Mentor review" className="space-y-5 rounded-2xl border border-line-2 bg-surface/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow text-cyan">Mentor · Review</p>
        {pill}
      </div>
      {children}
    </section>
  );
}

export function SessionReviewPanel({ sessionId }: { sessionId: string }) {
  const { records } = useJournal();
  const { hasToken, loaded, error, reviewsBySession, pending } = useMentor();
  const session: JournalSession | undefined = records.find((r) => r.session.id === sessionId)?.session;
  const review = reviewsBySession.get(sessionId);
  const queued = pending.find((p) => p.request.sessionId === sessionId);
  const texts = useMemo(() => (session ? eventTexts(session, 0) : null), [session]);
  const topics = useMemo(() => (session ? deriveSession(session).topics : []), [session]);

  if (!hasToken) {
    return (
      <Frame>
        <p className="text-ink-2">Connect sync in Settings to see reviews.</p>
      </Frame>
    );
  }
  if (!loaded) {
    return (
      <Frame>
        <div className="skeleton h-16 w-full" aria-hidden />
      </Frame>
    );
  }

  if (!review) {
    return (
      <Frame pill={queued ? <StatusPill tone={queued.failures.length > 0 ? "warn" : "info"}>{queued.failures.length > 0 ? "Retrying" : "Queued"}</StatusPill> : <StatusPill>Not reviewed</StatusPill>}>
        {queued ? (
          <>
            <p className="text-ink-2">Review queued — the morning routine reviews it.</p>
            {queued.failures.length > 0 && (
              <p className="text-[14px] text-warn">
                {queued.failures.length} earlier attempt{queued.failures.length === 1 ? "" : "s"} failed. Last: {queued.failures[queued.failures.length - 1].error}
              </p>
            )}
            <CopyButton text={reviewNowPrompt(queued.request.id)} label="Review now" primary />
            <p className="meta">Copies a prompt to run in Claude Code, with both repos cloned side by side.</p>
          </>
        ) : (
          <p className="text-ink-2">{error ? "Reviews could not be loaded right now." : "No review for this session yet. One is requested when a session ends."}</p>
        )}
      </Frame>
    );
  }

  return (
    <Frame pill={queued ? <StatusPill tone="info">Newer queued</StatusPill> : <StatusPill tone="good">Reviewed</StatusPill>}>
      <div className="space-y-2 rounded-xl border border-accent/25 bg-accent/10 p-3.5">
        <p className="break-words text-[15px] leading-relaxed">{review.summary}</p>
        <p className="meta">
          {review.model} · {dateOf(review.createdAt)}
          {review.sessionChangedSinceRequest && <span className="text-warn"> · session changed after the request</span>}
          {review.insufficientEvidence && " · not enough evidence in this session"}
        </p>
        {queued && <p className="meta">A newer review is queued.</p>}
      </div>
      <Findings title="Understood" items={review.understood} texts={texts} tone="good" />
      <Findings title="Misunderstandings" items={review.misunderstandings} texts={texts} tone="bad" />
      <Findings title="Incomplete" items={review.incomplete} texts={texts} tone="warn" />
      <Findings title="Claims without evidence" items={review.unsupportedClaims} texts={texts} />
      <Findings title="Worth checking" items={review.missingConcepts} texts={texts} withQuestion tone="info" />
      <section className="space-y-2">
        <h4 className="eyebrow">Explanation quality</h4>
        <p className="text-[15px]">
          <span className="font-semibold">{QUALITY[review.explanationQuality.level]}.</span> <span className="break-words text-ink-2">{review.explanationQuality.note}</span>
        </p>
        {review.explanationQuality.evidence.map((r, j) => (
          <Evidence key={j} r={r} texts={texts} />
        ))}
      </section>
      <Findings title="Learning behaviour" items={review.learningBehaviour.observations} texts={texts} />
      <Bullets title="To improve" items={review.learningBehaviour.improvements} />
      <Bullets title="Next steps" items={review.nextSteps} />
      <section className="space-y-2">
        <h4 className="eyebrow text-cyan">Verification questions</h4>
        <ol className="list-decimal space-y-1.5 rounded-xl border border-line bg-surface-2/60 py-3 pl-8 pr-3 text-[15px] text-ink-2">
          {review.verificationQuestions.map((q, i) => (
            <li key={i} className="break-words">
              <span className="text-ink">{q.concept}:</span> {q.question}
            </li>
          ))}
        </ol>
      </section>
      <div className="flex flex-col gap-2">
        <CopyButton text={discussPrompt(review, { subject: session?.subject ?? "(session not on this device)", topics })} label="Discuss this review" />
        {queued && <CopyButton text={reviewNowPrompt(queued.request.id)} label="Review now" />}
      </div>
    </Frame>
  );
}
