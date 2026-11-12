"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { deriveSession, type DerivedSession } from "@/lib/journal/events";
import { formatSpan } from "@/lib/journal/format";
import type { ConflictInspection, EventBrief } from "@/lib/journal/sync";
import { SOURCE_KINDS, SOURCE_LABELS, type SourceKind } from "@/lib/journal/types";
import { useJournal } from "../JournalProvider";
import { SessionReviewPanel } from "../mentor/SessionReviewPanel";
import { PhotoButtons } from "./Photos";
import { ErrorLine, SyncBadge, dateOf, timeOf } from "./shared";
import { Timeline } from "./Timeline";

export function Detail({ id }: { id: string }) {
  const { ready, records, statuses, discard, error } = useJournal();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const record = records.find((r) => r.session.id === id);
  const back = (
    <Link href="/journal/" className="text-sm font-bold text-accent-text hover:underline">
      ← Journal
    </Link>
  );
  if (!ready) return <p className="text-ink-2">Loading…</p>;
  if (!record)
    return (
      <div className="space-y-3">
        {back}
        <p className="text-ink-2">Session not found.</p>
      </div>
    );

  const { session } = record;
  const d = deriveSession(session);
  const status = statuses[id] ?? "local";
  const state = { discarded: "Discarded", ended: "Ended", paused: "Paused", active: "Running" }[d.status];
  return (
    <div className="space-y-6">
      {back}
      <header>
        <h1 className="break-words text-3xl sm:text-4xl">{d.subject}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-2">
          <span>
            {SOURCE_LABELS[d.source.kind]}
            {d.source.title ? ` (${d.source.title})` : ""} · {dateOf(d.startedAt)} · {formatSpan(d.activeMs)} active · {state}
          </span>
          <SyncBadge status={status} />
        </p>
        {d.objective && <p className="mt-2 break-words text-[15px]">Objective: {d.objective}</p>}
        {d.topics.length > 0 && <p className="mt-2 break-words text-[15px] text-ink-2">Topics: {d.topics.join(", ")}</p>}
        {d.status !== "discarded" && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm font-bold text-accent-text hover:underline">
            Edit details
          </button>
        )}
      </header>
      {editing && <MetaForm id={id} d={d} onDone={() => setEditing(false)} />}
      <ErrorLine message={error} />
      {notice && (
        <p role="status" className="rounded-md bg-good-bg px-3 py-2 text-sm text-good">
          {notice}
        </p>
      )}
      {status === "conflict" && <ConflictPanel id={id} onRepaired={() => setNotice("Repaired. The previous GitHub copy was saved under journal/conflicts/ and nothing was lost.")} />}
      {d.unknownEvents > 0 && <p className="text-sm text-ink-2">{d.unknownEvents} events from a newer app version are kept but not shown.</p>}
      {d.status !== "discarded" && (
        <section aria-label="Photos" className="space-y-1">
          <PhotoButtons sessionId={id} />
        </section>
      )}
      <Timeline derived={d} sessionId={id} order="oldest" editable={d.status !== "discarded"} />
      {d.status === "ended" && <SessionReviewPanel sessionId={id} />}
      {d.status !== "discarded" && (
        <div className="flex flex-wrap items-center gap-3">
          {confirming ? (
            <>
              <button type="button" onClick={() => void discard(id).then((ok) => ok && setConfirming(false))} className="btn btn-secondary btn-danger">
                Confirm discard
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost btn-muted">
                Cancel
              </button>
              <span className="text-sm text-ink-2">The session stays in the log, marked as discarded.</span>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-secondary btn-danger">
              Discard session
            </button>
          )}
        </div>
      )}
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
    <form onSubmit={submit} aria-label="Edit details" className="card space-y-4 p-5">
      <h2 className="headline text-lg">Edit details</h2>
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

const SHOW_EVENTS = 8;
function EventList({ title, events }: { title: string; events: EventBrief[] }) {
  return (
    <div>
      <p className="font-bold">
        {title} ({events.length})
      </p>
      {events.length > 0 && (
        <ul className="meta mt-1 space-y-0.5">
          {events.slice(0, SHOW_EVENTS).map((e) => (
            <li key={e.id}>
              {e.kind} at {timeOf(e.at)}
            </li>
          ))}
          {events.length > SHOW_EVENTS && <li>and {events.length - SHOW_EVENTS} more</li>}
        </ul>
      )}
    </div>
  );
}

function ConflictPanel({ id, onRepaired }: { id: string; onRepaired: () => void }) {
  const { inspectConflict, retryConflict, resolveConflict } = useJournal();
  const [info, setInfo] = useState<ConflictInspection | null>(null);
  const [busy, setBusy] = useState<"retry" | "repair" | null>(null);

  const load = async () => setInfo(await inspectConflict(id));
  // Load once per session; the provider functions change identity on every update and must not retrigger reads.
  useEffect(() => {
    let live = true;
    void inspectConflict(id).then((r) => live && setInfo(r));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const retry = async () => {
    setBusy("retry");
    await retryConflict(id);
    await load();
    setBusy(null);
  };
  const repair = async () => {
    setBusy("repair");
    if (await resolveConflict(id)) onRepaired();
    else await load();
    setBusy(null);
  };

  return (
    <section aria-label="Needs attention" className="space-y-4 rounded-lg border border-bad bg-bad-bg p-4 sm:p-5">
      <h2 className="headline text-lg text-bad">Needs attention</h2>
      <p className="text-[15px]">{info?.reason ?? "Reading both copies…"}</p>
      <p className="text-sm text-ink-2">Your copy on this device is safe and complete. Nothing on GitHub is overwritten until a backup of it exists.</p>
      {info && (
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <h3 className="eyebrow">This device</h3>
            <p className="mt-1">{info.local.events} events</p>
            {info.local.lastEvent && (
              <p className="meta">
                Last: {info.local.lastEvent.kind} at {timeOf(info.local.lastEvent.at)}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="eyebrow">GitHub</h3>
            {info.remote.state === "missing" && <p className="mt-1">No file there yet.</p>}
            {info.remote.state === "unreadable" && (
              <>
                <p className="mt-1">The file is unreadable, so it cannot be merged.</p>
                <pre className="meta mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-surface-2 p-2">{info.remote.text.slice(0, 4000)}</pre>
              </>
            )}
            {info.remote.state === "readable" && (
              <div className="mt-1 space-y-2">
                <p>
                  {info.remote.events} events{info.remote.rejected > 0 ? `, ${info.remote.rejected} invalid` : ""}
                </p>
                <EventList title="Only on this device" events={info.remote.onlyLocal} />
                <EventList title="Only on GitHub" events={info.remote.onlyRemote} />
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void retry()} disabled={busy !== null} className="btn btn-secondary">
          Retry sync
        </button>
        <button type="button" onClick={() => void repair()} disabled={busy !== null || !info} className="btn btn-primary">
          Keep both and repair
        </button>
      </div>
      <p className="meta">Repair saves the current GitHub file to journal/conflicts first, then writes this device&apos;s events together with every readable event from GitHub.</p>
    </section>
  );
}
