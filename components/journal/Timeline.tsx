"use client";

import { useState, type FormEvent } from "react";
import { formatClock } from "@/lib/journal/format";
import type { DerivedSession, TimelineItem } from "@/lib/journal/events";
import { useJournal } from "../JournalProvider";
import { AlertIcon, BookmarkIcon, TagIcon } from "./icons";
import { PhotoThumb } from "./Photos";
import { KIND_LABEL, gutterOf, timeOf } from "./shared";

const TEXT_KINDS = ["topic", "note", "difficulty"];
const EDITABLE = ["topic", "note", "difficulty", "bookmark"];

/**
 * The session as a document: a mono time gutter on the left, notes as prose, topics as chips, difficulties as amber callouts.
 * `newestFirstOnDesktop` keeps the DOM oldest-first (the phone writing canvas) and flips the visual order from md up.
 */
export function Timeline({ derived, sessionId, editable, newestFirstOnDesktop = false }: { derived: DerivedSession; sessionId: string; editable: boolean; newestFirstOnDesktop?: boolean }) {
  // An edit to empty text hides the item; the original stays in the log.
  const visible = derived.timeline.filter((i) => !TEXT_KINDS.includes(i.kind) || i.text.trim() !== "");
  return (
    <section aria-label="Timeline">
      <h2 className="eyebrow max-md:sr-only md:mb-1">Timeline</h2>
      {visible.length === 0 && <p className="py-3 text-[15px] text-ink-3">Nothing yet. Notes, topics and photos appear here as you add them.</p>}
      <ol className={`flex flex-col ${newestFirstOnDesktop ? "md:flex-col-reverse" : ""}`}>
        {visible.map((i) => (
          <Row key={i.id} item={i} startedAt={derived.startedAt} sessionId={sessionId} editable={editable && EDITABLE.includes(i.kind)} />
        ))}
      </ol>
    </section>
  );
}

const SYSTEM_KINDS = ["start", "pause", "resume", "end"];

function Row({ item: i, startedAt, sessionId, editable }: { item: TimelineItem; startedAt: string; sessionId: string; editable: boolean }) {
  const { add } = useJournal();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(i.text);
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const required = i.kind !== "bookmark";

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (required && !text) return;
    if (text === i.text) return setEditing(false);
    setBusy(true);
    if (await add(sessionId, { kind: "edit", target: i.id, text })) setEditing(false);
    setBusy(false);
  };

  const gutter = (
    <span title={timeOf(i.at)} className="pt-[5px] text-right font-mono text-xs tabular-nums text-dim">
      {gutterOf(startedAt, i.at)}
    </span>
  );

  if (SYSTEM_KINDS.includes(i.kind)) {
    return (
      <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 py-1.5">
        {gutter}
        <p className="flex items-center gap-2 text-[13px] text-dim">
          <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
          {KIND_LABEL[i.kind]}
          <span className="font-mono text-xs">{timeOf(i.at)}</span>
        </p>
      </li>
    );
  }

  const edit = editable && !editing && (
    <button
      type="button"
      onClick={() => {
        setDraft(i.text);
        setEditing(true);
      }}
      aria-label={`Edit ${KIND_LABEL[i.kind].toLowerCase()}`}
      className="shrink-0 self-start rounded-md px-1.5 py-0.5 text-xs font-semibold text-accent-text opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100"
    >
      Edit
    </button>
  );

  let body;
  if (i.kind === "topic") {
    body = (
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan">Topic</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-0.5 text-[14px] font-medium text-cyan">
          <TagIcon className="h-3.5 w-3.5" />
          <span className="break-words">{i.text}</span>
        </span>
      </p>
    );
  } else if (i.kind === "difficulty") {
    body = (
      <div className="rounded-xl border border-warn/25 border-l-[3px] border-l-warn bg-warn/10 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn">
          <AlertIcon className="h-3.5 w-3.5" />
          Difficulty
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[16px] leading-[1.6]">{i.text}</p>
      </div>
    );
  } else if (i.kind === "bookmark") {
    body = (
      <p className="flex flex-wrap items-center gap-2 text-[15px]">
        <BookmarkIcon className="h-4 w-4 shrink-0 text-accent-text" />
        <span className={`break-words ${i.text ? "font-medium" : "text-ink-3"}`}>{i.text || "Bookmark"}</span>
        {i.activeMs !== undefined && <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-xs tabular-nums text-ink-2">at {formatClock(i.activeMs)}</span>}
      </p>
    );
  } else if (i.kind === "attach") {
    body = (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Photo</p>
        {i.attachment && <PhotoThumb info={i.attachment} />}
      </div>
    );
  } else {
    body = <p className="whitespace-pre-wrap break-words text-[16.5px] leading-[1.65]">{i.text}</p>;
  }

  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 py-3">
      {gutter}
      <div className="min-w-0">
        {editing ? (
          <form onSubmit={save} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Editing {KIND_LABEL[i.kind].toLowerCase()}</p>
            <textarea aria-label="Edit text" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus className="field" />
            <div className="flex gap-2">
              <button type="submit" disabled={busy || (required && !draft.trim())} className="btn btn-primary">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-muted">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">{body}</div>
            {edit}
          </div>
        )}
        {i.edited && !editing && (
          <div className="mt-1.5">
            <span className="meta italic">edited</span>
            <button type="button" onClick={() => setShowOriginal((v) => !v)} aria-expanded={showOriginal} className="meta ml-3 font-semibold underline">
              {showOriginal ? "Hide original" : "Show original"}
            </button>
            {showOriginal && (
              <p aria-label="Original text" className="meta mt-1 whitespace-pre-wrap break-words border-l-2 border-line-2 pl-3">
                {i.original || "(empty)"}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
