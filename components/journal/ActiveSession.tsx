"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { deriveSession } from "@/lib/journal/events";
import { formatClock } from "@/lib/journal/format";
import type { SessionRecord } from "@/lib/journal/local";
import { SOURCE_LABELS } from "@/lib/journal/types";
import { useJournal } from "../JournalProvider";
import { PhotoButtons } from "./Photos";
import { useTick } from "./shared";
import { Timeline } from "./Timeline";

type Kind = "note" | "topic" | "difficulty" | "bookmark";
const KINDS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "note", label: "Note", hint: "Write a note. Enter adds it, Shift+Enter starts a new line." },
  { kind: "topic", label: "Topic", hint: "Name the topic you are on" },
  { kind: "difficulty", label: "Difficulty", hint: "What is hard or unclear?" },
  { kind: "bookmark", label: "Bookmark", hint: "Label this moment (optional)" },
];

/** The immersive view while a session runs: timer, one-handed controls, always-visible note box, newest-first timeline. */
export function ActiveSession({ record, onEnded }: { record: SessionRecord; onEnded: () => void }) {
  const { add, end } = useJournal();
  const { session } = record;
  const derived = deriveSession(session, useTick());
  const paused = derived.status === "paused";
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("note");
  const [ending, setEnding] = useState(false);
  const canAdd = kind === "bookmark" || text.trim() !== "";

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canAdd) return;
    const value = text.trim();
    const k = kind;
    // Clear now so typing during the save isn't wiped; put the text back if the save fails.
    setText("");
    setKind("note");
    const ok = await add(session.id, k === "bookmark" ? { kind: "bookmark", label: value, activeMs: deriveSession(session).activeMs } : { kind: k, text: value });
    if (!ok) {
      setText((t) => t || value);
      setKind(k);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="space-y-5 pb-28 sm:pb-0">
      <section className="card p-5 text-center sm:p-6" aria-label="Current session">
        <p className="eyebrow break-words">
          {derived.subject} · {SOURCE_LABELS[derived.source.kind]}
          {derived.source.title ? ` · ${derived.source.title}` : ""}
        </p>
        <p role="timer" aria-label="Active time" className="mt-3 font-mono text-6xl font-bold tabular-nums leading-none sm:text-8xl">
          {formatClock(derived.activeMs)}
        </p>
        <p className={`mt-2 text-sm font-bold ${paused ? "text-warn" : "text-good"}`}>{paused ? "Paused" : "Running"}</p>
        {derived.objective && <p className="mt-2 break-words text-[15px] text-ink-2">{derived.objective}</p>}
        {!ending && (
          <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 flex gap-3 border-t border-line bg-bg px-4 py-3 sm:static sm:z-auto sm:mt-5 sm:justify-center sm:border-0 sm:bg-transparent sm:p-0">
            <button type="button" onClick={() => void add(session.id, { kind: paused ? "resume" : "pause" })} className="btn btn-primary btn-lg flex-1 sm:flex-none">
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" onClick={() => setEnding(true)} className="btn btn-secondary btn-lg flex-1 sm:flex-none">
              End
            </button>
          </div>
        )}
      </section>

      {ending ? (
        <EndForm
          onCancel={() => setEnding(false)}
          onSubmit={async (r) => {
            if (await end(session.id, r)) onEnded();
          }}
        />
      ) : (
        <section className="card space-y-3 p-4 sm:p-5" aria-label="Capture">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of entry">
            {KINDS.map((k) => (
              <button key={k.kind} type="button" aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)} className={`chip ${kind === k.kind ? "!border-accent-text bg-accent-soft font-bold text-accent-text" : "hover:bg-surface-2"}`}>
                {k.label}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <textarea
              aria-label="Add to session"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={KINDS.find((k) => k.kind === kind)!.hint}
              className="field min-w-0 flex-1 resize-y"
            />
            <button type="submit" disabled={!canAdd} className="btn btn-secondary">
              Add
            </button>
          </form>
          <PhotoButtons sessionId={session.id} />
        </section>
      )}

      <Timeline derived={derived} sessionId={session.id} order="newest" editable />
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
