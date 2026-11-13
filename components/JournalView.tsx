"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { lastSource, recentSubjects } from "@/lib/journal/summary";
import type { SessionRecord } from "@/lib/journal/local";
import { SOURCE_KINDS, SOURCE_LABELS, type SourceKind } from "@/lib/journal/types";
import { ActiveSession } from "./journal/ActiveSession";
import { ActiveContext, ComposeContext, SessionContext } from "./journal/Context";
import { BackLink, Detail } from "./journal/Detail";
import { History } from "./journal/History";
import { ErrorLine, isOpen } from "./journal/shared";
import { SyncStatus } from "./journal/SyncStatus";
import { useJournal } from "./JournalProvider";
import { Eyebrow } from "./ui/Eyebrow";

/**
 * The Journal workspace. From xl up it is three panes: session list, the session as a document, and its context.
 * Below xl the panes are screens: the list, then a session (document with its context beneath). Routes are unchanged:
 * `/journal/` (the running session, or the composer), `/journal/?s=<id>` (a session), `/journal/?new=1` (the composer on small screens).
 */
export function JournalView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("s");
  const wantNew = params.get("new") !== null;
  const { ready, records, error } = useJournal();
  const [queued, setQueued] = useState(false);

  if (!ready) return <p className="text-ink-2">Loading…</p>;

  const current = records.find(isOpen);
  const mode = id ? "detail" : current ? "active" : "compose";
  const selected = id ? records.find((r) => r.session.id === id) : undefined;
  // On small screens the list is the home of /journal/ unless the composer was asked for (or there is nothing to list).
  const listHome = mode === "compose" && !wantNew && records.length > 0;

  const listCls = mode === "active" ? "hidden" : listHome ? "flex" : "hidden xl:flex";
  const centreCls = listHome ? "hidden xl:block" : "block";
  const contextCls = listHome ? "hidden xl:block" : mode === "active" ? "hidden md:block" : "block";
  const cols = mode === "active" ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : "xl:grid-cols-[17rem_minmax(0,1fr)_18rem]";

  return (
    <div>
      {mode === "compose" && <h1 className="sr-only">Journal</h1>}
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${mode === "active" ? "max-md:hidden" : ""}`}>
        <Eyebrow>Journal</Eyebrow>
        <SyncStatus />
      </div>
      <div className={`xl:-mx-8 xl:grid xl:h-[calc(100dvh-13rem)] xl:min-h-[34rem] xl:overflow-hidden xl:rounded-2xl xl:border xl:border-line xl:bg-surface/60 xl:shadow-[inset_0_1px_0_rgba(170,210,255,0.07)] ${cols}`}>
        {mode !== "active" && (
          <aside aria-label="Sessions" className={`${listCls} min-h-0 min-w-0 flex-col xl:border-r xl:border-line xl:bg-bg-2/60`}>
            <History records={records} selectedId={id} running={!!current} />
          </aside>
        )}
        <div className={`${centreCls} min-w-0 xl:min-h-0 xl:overflow-y-auto`}>
          <div className="py-2 xl:px-8 xl:py-7">
            <ErrorLine message={error} />
            {queued && (
              <p role="status" className="mb-4 rounded-xl bg-good-bg px-3 py-2 text-sm text-good">
                Review queued for tomorrow morning
              </p>
            )}
            {mode === "active" && current ? (
              <ActiveSession
                key={current.session.id}
                record={current}
                onEnded={(sid) => {
                  setQueued(true);
                  router.replace(`/journal/?s=${encodeURIComponent(sid)}`);
                }}
              />
            ) : mode === "detail" ? (
              <Detail id={id!} />
            ) : (
              <Composer records={records} onStart={() => setQueued(false)} showBack={wantNew} />
            )}
          </div>
        </div>
        <aside aria-label="Session context" className={`${contextCls} min-w-0 border-t border-line pt-6 xl:min-h-0 xl:overflow-y-auto xl:border-l xl:border-t-0 xl:bg-bg-2/60 xl:p-5`}>
          {mode === "active" && current ? <ActiveContext record={current} /> : mode === "detail" ? selected ? <SessionContext record={selected} /> : null : <ComposeContext />}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-ink-2">{label}</span>
      {children}
    </label>
  );
}

/** The compact composer in the centre pane: subject, source and objective. */
function Composer({ records, onStart, showBack }: { records: SessionRecord[]; onStart: () => void; showBack: boolean }) {
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
    <div className="mx-auto max-w-[34rem]">
      {showBack && <BackLink />}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Eyebrow>New session</Eyebrow>
          <h2 className="mt-1 text-[1.75rem] font-[650] leading-tight tracking-[-0.02em]">Start a session</h2>
          <p className="mt-1 text-[15px] text-ink-2">Record what you study, from any source. The timer starts when you do.</p>
        </div>
        <Field label="Subject">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. HLD" className="field mt-1" />
        </Field>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Recent subjects">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => setSubject(s)} className="chip hover:bg-surface-2">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Field label="Source">
            <select value={source} onChange={(e) => setSource(e.target.value as SourceKind)} className="field mt-1">
              {SOURCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SOURCE_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Objective (optional)">
            <input value={objective} onChange={(e) => setObjective(e.target.value)} className="field mt-1" />
          </Field>
        </div>
        <button type="submit" disabled={busy || !subject.trim()} className="btn btn-primary btn-lg w-full sm:w-auto">
          Start
        </button>
      </form>
    </div>
  );
}
