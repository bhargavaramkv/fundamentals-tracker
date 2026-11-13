"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { deriveSession } from "@/lib/journal/events";
import { formatClock } from "@/lib/journal/format";
import type { SessionRecord } from "@/lib/journal/local";
import { SOURCE_LABELS } from "@/lib/journal/types";
import { useJournal } from "../JournalProvider";
import { Ring } from "../ui/Ring";
import { PauseIcon, PlayIcon, StopIcon } from "./icons";
import { PhotoButtons } from "./Photos";
import { timeOf, useTick } from "./shared";
import { Timeline } from "./Timeline";

type Kind = "note" | "topic" | "difficulty" | "bookmark";
const KINDS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "note", label: "Note", hint: "Write a note. Enter adds it, Shift+Enter starts a new line." },
  { kind: "topic", label: "Topic", hint: "Name the topic you are on" },
  { kind: "difficulty", label: "Difficulty", hint: "What is hard or unclear?" },
  { kind: "bookmark", label: "Bookmark", hint: "Label this moment (optional)" },
];

const GLOW = "[text-shadow:0_0_22px_rgba(34,211,238,0.45)]";

/**
 * The running session. One DOM, two layouts. Phone (below md): full-screen focus mode with a minimal top bar, a borderless
 * writing canvas (oldest first, kept scrolled to the newest) and the composer pinned to the bottom, covering the tab bar.
 * Desktop: the title, the ring with the timer and controls, the composer, then the timeline (newest first) as a document.
 */
export function ActiveSession({ record, onEnded }: { record: SessionRecord; onEnded: (sessionId: string) => void }) {
  const { add, end } = useJournal();
  const { session } = record;
  const derived = deriveSession(session, useTick());
  const paused = derived.status === "paused";
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("note");
  const [ending, setEnding] = useState(false);
  const canAdd = kind === "bookmark" || text.trim() !== "";
  const canvas = useRef<HTMLDivElement>(null);
  const count = derived.timeline.length;

  // Keep the phone canvas on the newest entry. On desktop the wrapper has no box of its own, so this does nothing.
  useEffect(() => {
    const el = canvas.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

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
  const toggle = () => void add(session.id, { kind: paused ? "resume" : "pause" });
  const source = `${SOURCE_LABELS[derived.source.kind]}${derived.source.title ? ` · ${derived.source.title}` : ""}`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg md:static md:z-auto md:gap-6 md:bg-transparent">
      <section aria-label="Current session" className="order-1 md:order-2">
        {/* Phone: a minimal top bar. */}
        <div className="flex items-center gap-2 border-b border-line-2 bg-bg-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:hidden">
          <span role="img" aria-label={paused ? "Timer paused" : "Timer running"} className={`h-2 w-2 shrink-0 rounded-full ${paused ? "bg-warn" : "bg-cyan shadow-[0_0_8px_rgba(34,211,238,0.8)]"}`} />
          <p role="timer" aria-label="Active time" className={`font-mono text-xl font-semibold tabular-nums ${paused ? "text-ink-2" : `text-ink ${GLOW}`}`}>
            {formatClock(derived.activeMs)}
          </p>
          <span className="flex-1" />
          {!ending && (
            <>
              <button type="button" onClick={toggle} className="btn btn-secondary !min-h-10 gap-1.5 !px-3.5">
                {paused ? <PlayIcon /> : <PauseIcon />}
                {paused ? "Resume" : "Pause"}
              </button>
              <button type="button" onClick={() => setEnding(true)} className="btn btn-secondary btn-danger !min-h-10 !px-3.5">
                End
              </button>
            </>
          )}
        </div>
        {/* Desktop: the ring is the focal point. */}
        <div className="panel hidden items-center gap-8 p-6 md:flex">
          <div className={paused ? "opacity-70 [&_.ring-sweep]:[animation-play-state:paused]" : ""}>
            <Ring size={184}>
              <p role="timer" aria-label="Active time" className={`font-mono text-[1.75rem] font-semibold tabular-nums leading-none ${paused ? "text-ink-2" : `text-ink ${GLOW}`}`}>
                {formatClock(derived.activeMs)}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Active time</p>
            </Ring>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`flex items-center gap-2 text-sm font-semibold ${paused ? "text-warn" : "text-good"}`}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
              {paused ? "Paused" : "Running"}
            </p>
            <p className="meta mt-1">
              Started {timeOf(derived.startedAt)} · {derived.timeline.filter((t) => t.kind === "note").length === 1 ? "1 note" : `${derived.timeline.filter((t) => t.kind === "note").length} notes`} so far
            </p>
            {!ending && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={toggle} className="btn btn-primary gap-2">
                  {paused ? <PlayIcon /> : <PauseIcon />}
                  {paused ? "Resume" : "Pause"}
                </button>
                <button type="button" onClick={() => setEnding(true)} className="btn btn-secondary btn-danger gap-2">
                  <StopIcon />
                  End
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div ref={canvas} className="order-2 min-h-0 flex-1 overflow-y-auto px-5 py-5 md:contents">
        <header className="md:order-1">
          <p className="eyebrow break-words text-cyan">{source}</p>
          <h1 className="mt-1 break-words text-[1.75rem] font-[650] leading-tight tracking-[-0.02em] md:text-[2rem]">{derived.subject}</h1>
          {derived.objective && <p className="mt-2 break-words text-[16px] leading-relaxed text-ink-2">{derived.objective}</p>}
        </header>
        <div className="mt-5 md:order-4 md:mt-0">
          <Timeline derived={derived} sessionId={session.id} editable newestFirstOnDesktop />
        </div>
      </div>

      {ending ? (
        <div className="order-3 max-md:max-h-[75dvh] max-md:overflow-y-auto max-md:border-t max-md:border-line-2 max-md:bg-bg-2 md:order-3">
          <EndForm
            onCancel={() => setEnding(false)}
            onSubmit={async (r) => {
              if (await end(session.id, r)) onEnded(session.id);
            }}
          />
        </div>
      ) : (
        <section aria-label="Capture" className="order-3 space-y-2 border-t border-line-2 bg-bg-2 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 md:rounded-2xl md:border md:bg-surface md:p-5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Kind of entry">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                aria-pressed={kind === k.kind}
                onClick={() => setKind(k.kind)}
                className={`chip !px-3 !py-1 ${kind === k.kind ? "!border-accent/50 bg-accent-soft font-semibold text-accent-text" : "text-ink-2 hover:bg-surface-2"}`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex items-start gap-2">
            <textarea
              aria-label="Add to session"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={KINDS.find((k) => k.kind === kind)!.hint}
              className="field min-w-0 flex-1 resize-none !bg-surface-3 max-md:!border-transparent"
            />
            <button type="submit" disabled={!canAdd} className="btn btn-secondary">
              Add
            </button>
          </form>
          <PhotoButtons sessionId={session.id} />
        </section>
      )}
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
    <form onSubmit={submit} className="space-y-4 p-5 md:panel md:p-6">
      <div>
        <p className="eyebrow text-cyan">Reflect</p>
        <h2 className="mt-1 text-xl font-semibold">End session</h2>
      </div>
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
