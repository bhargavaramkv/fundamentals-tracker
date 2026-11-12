"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { deriveSession, type DerivedSession, type TimelineItem } from "@/lib/journal/events";
import { formatClock, formatSpan } from "@/lib/journal/format";
import type { SessionRecord } from "@/lib/journal/local";
import { lastSource, recentSubjects } from "@/lib/journal/summary";
import type { RecordStatus } from "@/lib/journal/sync";
import { SOURCE_KINDS, SOURCE_LABELS, type SourceKind } from "@/lib/journal/types";
import { useJournal } from "./JournalProvider";
import { PageShell } from "./PageShell";

const SYNC_LABEL: Record<RecordStatus, string> = {
  local: "On this device",
  pending: "Waiting to sync",
  syncing: "Syncing",
  synced: "Synced",
  retrying: "Will retry",
  conflict: "Needs attention",
};
const KIND_LABEL: Record<TimelineItem["kind"], string> = {
  start: "Started",
  pause: "Paused",
  resume: "Resumed",
  topic: "Topic",
  note: "Note",
  difficulty: "Difficulty",
  bookmark: "Bookmark",
  end: "Ended",
};
const TEXT_KINDS = ["topic", "note", "difficulty"];
const isOpen = (r: SessionRecord) => ["active", "paused"].includes(deriveSession(r.session).status);
const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** Re-renders every second while mounted, for the live timer. */
function useTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">
      {message}
    </p>
  ) : null;
}

export function JournalView() {
  const id = useSearchParams().get("s");
  const { ready, records, error } = useJournal();
  const [queued, setQueued] = useState(false);

  if (id) return <Detail id={id} />;

  const current = records.find(isOpen);

  return (
    <PageShell right={<History records={records} />}>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl sm:text-4xl">Journal</h1>
          <p className="mt-1 text-[17px] text-ink-2">Record what you study, from any source.</p>
        </header>
        <SyncIndicator />
        <ErrorLine message={error} />
        {queued && (
          <p role="status" className="rounded-md bg-good-bg px-3 py-2 text-sm text-good">
            Review queued for tomorrow morning
          </p>
        )}
        {!ready ? (
          <p className="text-ink-2">Loading…</p>
        ) : current ? (
          <ActiveSession key={current.session.id} record={current} onEnded={() => setQueued(true)} />
        ) : (
          <StartForm records={records} onStart={() => setQueued(false)} />
        )}
      </div>
    </PageShell>
  );
}

function SyncIndicator() {
  const { persistent, hasToken, syncState, statuses, syncNow } = useJournal();
  const conflicts = Object.values(statuses).filter((s) => s === "conflict").length;
  return (
    <div className="space-y-2 text-sm">
      {!persistent && (
        <p role="alert" className="rounded-md bg-warn-bg px-3 py-2 text-warn">
          This browser cannot keep data between visits. Sessions are lost when you refresh or close the tab.
        </p>
      )}
      {!hasToken ? (
        <p className="rounded-md bg-warn-bg px-3 py-2 text-warn">
          Saved on this device only —{" "}
          <Link href="/settings/" className="font-bold underline">
            connect sync in Settings
          </Link>
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 text-ink-2">
          <span className={syncState.state === "error" ? "text-bad" : ""}>
            {syncState.state === "syncing"
              ? "Syncing…"
              : syncState.state === "error"
                ? `Sync problem: ${syncState.message}`
                : syncState.lastSyncedAt
                  ? `Synced at ${timeOf(syncState.lastSyncedAt)}`
                  : "Sync on"}
          </span>
          <button type="button" onClick={syncNow} className="font-bold text-accent-text hover:underline">
            Sync now
          </button>
        </p>
      )}
      {conflicts > 0 && (
        <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-bad">
          {conflicts} {conflicts === 1 ? "session needs" : "sessions need"} attention: the copy on GitHub could not be merged. Your local copy is safe.
        </p>
      )}
    </div>
  );
}

function StartForm({ records, onStart }: { records: SessionRecord[]; onStart: () => void }) {
  const { start } = useJournal();
  const suggestions = recentSubjects(records);
  const [subject, setSubject] = useState("");
  const [source, setSource] = useState<SourceKind>(() => lastSource(records));
  const [objective, setObjective] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setBusy(true);
    onStart();
    await start({ subject, source: { kind: source }, objective });
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
      <h2 className="headline text-xl">Start a session</h2>
      <label className="block text-sm">
        <span className="text-ink-2">Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. HLD" className="field mt-1" />
      </label>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Recent subjects">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => setSubject(s)} className="chip hover:bg-surface-2">
              {s}
            </button>
          ))}
        </div>
      )}
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
          <span className="text-ink-2">Objective (optional)</span>
          <input value={objective} onChange={(e) => setObjective(e.target.value)} className="field mt-1" />
        </label>
      </div>
      <button type="submit" disabled={busy || !subject.trim()} className="btn btn-primary btn-lg w-full sm:w-auto">
        Start
      </button>
    </form>
  );
}

function ActiveSession({ record, onEnded }: { record: SessionRecord; onEnded: () => void }) {
  const { add, end } = useJournal();
  const { session } = record;
  const derived = deriveSession(session, useTick());
  const paused = derived.status === "paused";
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"note" | "topic" | "difficulty">("note");
  const [label, setLabel] = useState("");
  const [ending, setEnding] = useState(false);

  const addItem = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    // Clear now so typing during the save isn't wiped; put the text back if the save fails.
    setText("");
    if (!(await add(session.id, { kind, text: value }))) setText((t) => t || value);
  };
  const bookmark = async () => {
    const value = label.trim();
    setLabel("");
    if (!(await add(session.id, { kind: "bookmark", label: value, activeMs: deriveSession(session).activeMs }))) setLabel((l) => l || value);
  };

  return (
    <div className="space-y-6">
      <section className="card p-5 text-center sm:p-6" aria-label="Current session">
        <p className="eyebrow break-words">
          {session.subject} · {SOURCE_LABELS[session.source.kind]}
        </p>
        <p role="timer" aria-label="Active time" className="mt-2 font-mono text-5xl font-bold tabular-nums sm:text-7xl">
          {formatClock(derived.activeMs)}
        </p>
        <p className="mt-1 text-sm text-ink-2">{paused ? "Paused" : "Running"}</p>
        {session.objective && <p className="mt-2 break-words text-[15px] text-ink-2">{session.objective}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => void add(session.id, { kind: paused ? "resume" : "pause" })} className="btn btn-primary btn-lg">
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={() => setEnding(true)} className="btn btn-secondary btn-lg">
            End
          </button>
        </div>
      </section>

      {ending ? (
        <EndForm
          onCancel={() => setEnding(false)}
          onSubmit={async (r) => {
            if (await end(session.id, r)) onEnded();
          }}
        />
      ) : (
        <section className="card space-y-3 p-5 sm:p-6">
          <form onSubmit={addItem} className="flex flex-col gap-2 sm:flex-row">
            <select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="field sm:max-w-36">
              <option value="note">Note</option>
              <option value="topic">Topic</option>
              <option value="difficulty">Difficulty</option>
            </select>
            <input aria-label="Add to session" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note, topic or difficulty" className="field min-w-0 flex-1" />
            <button type="submit" disabled={!text.trim()} className="btn btn-secondary">
              Add
            </button>
          </form>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input aria-label="Bookmark label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bookmark label (optional)" className="field min-w-0 flex-1" />
            <button type="button" onClick={() => void bookmark()} className="btn btn-secondary">
              Bookmark
            </button>
          </div>
        </section>
      )}

      <Timeline derived={derived} />
    </div>
  );
}

function EndForm({ onSubmit, onCancel }: { onSubmit: (r: { learned: string; difficult: string; unclear: string }) => Promise<void>; onCancel: () => void }) {
  const [r, setR] = useState({ learned: "", difficult: "", unclear: "" });
  const [busy, setBusy] = useState(false);
  const fields = [
    ["learned", "What I learned"],
    ["difficult", "What was difficult"],
    ["unclear", "What is unclear"],
  ] as const;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await onSubmit(r);
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
      <h2 className="headline text-xl">End session</h2>
      {fields.map(([key, label]) => (
        <label key={key} className="block text-sm">
          <span className="text-ink-2">{label}</span>
          <textarea value={r[key]} onChange={(e) => setR({ ...r, [key]: e.target.value })} rows={3} className="field mt-1" />
        </label>
      ))}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary">
          Finish session
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-muted">
          Keep going
        </button>
      </div>
    </form>
  );
}

function Timeline({ derived }: { derived: DerivedSession }) {
  // An edit to empty text hides the item; the original stays in the log.
  const items = derived.timeline.filter((i) => !TEXT_KINDS.includes(i.kind) || i.text.trim() !== "");
  return (
    <section aria-label="Timeline">
      <h2 className="headline text-lg">Timeline</h2>
      <ol className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="rounded-lg border border-line px-4 py-2.5 text-[15px]">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-bold">{KIND_LABEL[i.kind]}</span>
              <span className="meta">{timeOf(i.at)}</span>
              {i.activeMs !== undefined && <span className="meta">at {formatClock(i.activeMs)}</span>}
            </p>
            {i.text && <p className="mt-0.5 whitespace-pre-wrap break-words text-ink-2">{i.text}</p>}
            {i.reflection && (
              <dl className="mt-1 space-y-1 text-ink-2">
                {(
                  [
                    ["learned", "Learned"],
                    ["difficult", "Difficult"],
                    ["unclear", "Unclear"],
                  ] as const
                ).map(([k, label]) =>
                  i.reflection?.[k] ? (
                    <div key={k}>
                      <dt className="inline font-bold">{label}: </dt>
                      <dd className="inline whitespace-pre-wrap break-words">{i.reflection[k]}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function History({ records }: { records: SessionRecord[] }) {
  const { statuses } = useJournal();
  const past = records.filter((r) => !isOpen(r));
  return (
    <section aria-label="History">
      <h2 className="headline text-lg">History</h2>
      {past.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-2">No past sessions yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {past.map((r) => {
            const d = deriveSession(r.session);
            const status = statuses[r.session.id] ?? "local";
            return (
              <li key={r.session.id}>
                <Link href={`/journal/?s=${encodeURIComponent(r.session.id)}`} className="card block px-4 py-3">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`min-w-0 break-words font-bold ${d.status === "discarded" ? "text-ink-3 line-through" : ""}`}>{r.session.subject}</span>
                    <span className="meta shrink-0 tabular-nums">{formatSpan(d.activeMs)}</span>
                  </span>
                  <span className="meta mt-0.5 flex flex-wrap gap-x-3">
                    <span>{dateOf(d.startedAt)}</span>
                    <span>{d.status === "ended" ? "Ended" : "Discarded"}</span>
                    <span className={status === "conflict" ? "font-bold text-bad" : ""}>{SYNC_LABEL[status]}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Detail({ id }: { id: string }) {
  const { ready, records, statuses, discard, error } = useJournal();
  const [confirming, setConfirming] = useState(false);
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
  const state = { discarded: "Discarded", ended: "Ended", paused: "Paused", active: "Running" }[d.status];
  return (
    <div className="space-y-6">
      {back}
      <header>
        <h1 className="break-words text-3xl sm:text-4xl">{session.subject}</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          {SOURCE_LABELS[session.source.kind]} · {dateOf(d.startedAt)} · {formatSpan(d.activeMs)} active · {state} · {SYNC_LABEL[statuses[id] ?? "local"]}
        </p>
        {session.objective && <p className="mt-2 break-words text-[15px]">Objective: {session.objective}</p>}
        {d.topics.length > 0 && <p className="mt-2 break-words text-[15px] text-ink-2">Topics: {d.topics.join(", ")}</p>}
      </header>
      <ErrorLine message={error} />
      {d.unknownEvents > 0 && <p className="text-sm text-ink-2">{d.unknownEvents} events from a newer app version are kept but not shown.</p>}
      <Timeline derived={d} />
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
