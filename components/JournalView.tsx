"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SessionRecord } from "@/lib/journal/local";
import { lastSource, recentSubjects } from "@/lib/journal/summary";
import { SOURCE_KINDS, SOURCE_LABELS, type SourceKind } from "@/lib/journal/types";
import { ActiveSession } from "./journal/ActiveSession";
import { Detail } from "./journal/Detail";
import { History } from "./journal/History";
import { ErrorLine, isOpen } from "./journal/shared";
import { SyncStatus } from "./journal/SyncStatus";
import { useJournal } from "./JournalProvider";
import { PageShell } from "./PageShell";

export function JournalView() {
  const id = useSearchParams().get("s");
  const { ready, records, error } = useJournal();
  const [queued, setQueued] = useState(false);

  if (id) return <Detail id={id} />;

  const current = records.find(isOpen);

  // While a session runs the history rail is removed: nothing but the session and its status.
  return (
    <PageShell right={current ? undefined : <History records={records} />}>
      <div className="space-y-5">
        {!current && (
          <header>
            <h1 className="text-3xl sm:text-4xl">Journal</h1>
            <p className="mt-1 text-[17px] text-ink-2">Record what you study, from any source.</p>
          </header>
        )}
        <SyncStatus />
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
