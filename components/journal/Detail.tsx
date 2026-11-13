"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { deriveSession, type DerivedSession } from "@/lib/journal/events";
import { formatSpan } from "@/lib/journal/format";
import { SOURCE_KINDS, SOURCE_LABELS, type SourceKind } from "@/lib/journal/types";
import { useJournal } from "../JournalProvider";
import { StatusPill } from "../ui/StatusPill";
import { ArrowLeftIcon, PencilIcon } from "./icons";
import { PhotoButtons } from "./Photos";
import { SyncBadge, dateOf, timeOf } from "./shared";
import { Timeline } from "./Timeline";

/** Back to the list: only needed below xl, where the list is a separate screen (the browser back button works too). */
export function BackLink() {
  return (
    <Link href="/journal/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text hover:underline xl:hidden">
      <ArrowLeftIcon />
      Journal
    </Link>
  );
}

/** The selected session as a document: header, the end-of-session summary, then the timeline. */
export function Detail({ id }: { id: string }) {
  const { records, statuses, discard } = useJournal();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const record = records.find((r) => r.session.id === id);
  if (!record)
    return (
      <div>
        <BackLink />
        <p className="text-ink-2">Session not found.</p>
      </div>
    );

  const d = deriveSession(record.session);
  const status = statuses[id] ?? "local";
  const live = d.status !== "discarded";
  const state = { discarded: "Discarded", ended: "Ended", paused: "Paused", active: "Running" }[d.status];
  return (
    <article className="mx-auto max-w-[46rem]">
      <BackLink />
      <header>
        <p className="eyebrow text-cyan">
          {SOURCE_LABELS[d.source.kind]}
          {d.source.title ? ` · ${d.source.title}` : ""}
        </p>
        <h1 className="mt-1 break-words text-[2rem] font-[650] leading-tight tracking-[-0.02em] sm:text-[2.25rem]">{d.subject}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] text-ink-2">
          <span className="font-mono text-[13px] tabular-nums text-muted">
            {dateOf(d.startedAt)} · {timeOf(d.startedAt)}
          </span>
          <span>{formatSpan(d.activeMs)} active</span>
          {d.status === "discarded" ? <StatusPill>{state}</StatusPill> : <span>{state}</span>}
          <SyncBadge status={status} />
        </p>
        {d.objective && (
          <p className="mt-4 break-words text-[17px] leading-relaxed text-ink-2">
            <span className="eyebrow mr-1">Objective:</span> {d.objective}
          </p>
        )}
        {live && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text hover:underline">
                <PencilIcon />
                Edit details
              </button>
            )}
            {confirming ? (
              <>
                <button type="button" onClick={() => void discard(id).then((ok) => ok && setConfirming(false))} className="btn btn-secondary btn-danger !min-h-9">
                  Confirm discard
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost btn-muted !min-h-9">
                  Cancel
                </button>
                <span className="text-[13px] text-ink-3">The session stays in the log, marked as discarded.</span>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="text-sm font-semibold text-bad hover:underline">
                Discard session
              </button>
            )}
          </div>
        )}
      </header>
      {editing && <MetaForm id={id} d={d} onDone={() => setEditing(false)} />}
      <div className="mt-6 border-t border-line pt-4">
        <Reflections d={d} />
        <Timeline derived={d} sessionId={id} editable={live} />
      </div>
      {live && (
        <section aria-label="Photos" className="mt-4 border-t border-line pt-4">
          <p className="eyebrow mb-2">Add photos</p>
          <PhotoButtons sessionId={id} />
        </section>
      )}
    </article>
  );
}

/** The end-of-session answers: what was learned is the highlighted summary, the rest sits quietly beneath it. */
function Reflections({ d }: { d: DerivedSession }) {
  if (d.reflections.length === 0) return null;
  return (
    <div className="mb-6 space-y-3">
      {d.reflections.map((r) => (
        <section key={r.at} aria-label="Reflection" className="rounded-2xl border border-accent/25 bg-accent/10 p-5">
          {r.learned && (
            <>
              <h2 className="eyebrow text-cyan">What I learned</h2>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-[17px] leading-[1.65]">{r.learned}</p>
            </>
          )}
          {(r.difficult || r.unclear) && (
            <dl className={`space-y-2 text-[15px] text-ink-2 ${r.learned ? "mt-4 border-t border-line-2 pt-3" : ""}`}>
              {r.difficult && (
                <div>
                  <dt className="eyebrow text-warn">What was difficult</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words">{r.difficult}</dd>
                </div>
              )}
              {r.unclear && (
                <div>
                  <dt className="eyebrow">What is unclear</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words">{r.unclear}</dd>
                </div>
              )}
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}

function MetaForm({ id, d, onDone }: { id: string; d: DerivedSession; onDone: () => void }) {
  const { add } = useJournal();
  const [subject, setSubject] = useState(d.subject);
  const [source, setSource] = useState<SourceKind>(d.source.kind);
  const [objective, setObjective] = useState(d.objective ?? "");
  const [busy, setBusy] = useState(false);
  const changed = {
    ...(subject.trim() && subject.trim() !== d.subject ? { subject: subject.trim() } : {}),
    ...(source !== d.source.kind ? { source: { kind: source } } : {}),
    ...(objective.trim() !== (d.objective ?? "") ? { objective: objective.trim() } : {}),
  };
  const dirty = Object.keys(changed).length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return onDone();
    setBusy(true);
    if (await add(id, { kind: "meta", ...changed })) onDone();
    setBusy(false);
  };
  return (
    <form onSubmit={submit} aria-label="Edit details" className="mt-5 space-y-4 rounded-2xl border border-line-2 bg-surface-2/60 p-5">
      <h2 className="text-lg font-semibold">Edit details</h2>
      <label className="block text-sm">
        <span className="text-ink-2">Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="field mt-1" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-ink-2">Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value as SourceKind)} className="field mt-1">
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {SOURCE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-ink-2">Objective</span>
          <input value={objective} onChange={(e) => setObjective(e.target.value)} className="field mt-1" />
        </label>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={busy || !subject.trim()} className="btn btn-primary">
          Save details
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost btn-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}
