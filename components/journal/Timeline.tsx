"use client";

import { useState, type FormEvent } from "react";
import { formatClock } from "@/lib/journal/format";
import type { DerivedSession, TimelineItem } from "@/lib/journal/events";
import { useJournal } from "../JournalProvider";
import { PhotoThumb } from "./Photos";
import { KIND_LABEL, timeOf } from "./shared";

const TEXT_KINDS = ["topic", "note", "difficulty"];
const EDITABLE = ["topic", "note", "difficulty", "bookmark"];

export function Timeline({ derived, sessionId, order, editable }: { derived: DerivedSession; sessionId: string; order: "newest" | "oldest"; editable: boolean }) {
  // An edit to empty text hides the item; the original stays in the log.
  const visible = derived.timeline.filter((i) => !TEXT_KINDS.includes(i.kind) || i.text.trim() !== "");
  const items = order === "newest" ? [...visible].reverse() : visible;
  return (
    <section aria-label="Timeline">
      <h2 className="headline text-lg">Timeline</h2>
      <ol className="mt-3 space-y-2">
        {items.map((i) => (
          <Row key={i.id} item={i} sessionId={sessionId} editable={editable && EDITABLE.includes(i.kind)} />
        ))}
      </ol>
    </section>
  );
}

function Row({ item: i, sessionId, editable }: { item: TimelineItem; sessionId: string; editable: boolean }) {
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

  return (
    <li className="rounded-lg border border-line px-4 py-2.5 text-[15px]">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-bold">{KIND_LABEL[i.kind]}</span>
        <span className="meta">{timeOf(i.at)}</span>
        {i.activeMs !== undefined && <span className="meta">at {formatClock(i.activeMs)}</span>}
        {i.edited && <span className="meta italic">edited</span>}
        {editable && !editing && (
          <button type="button" onClick={() => { setDraft(i.text); setEditing(true); }} aria-label={`Edit ${KIND_LABEL[i.kind].toLowerCase()}`} className="ml-auto text-sm font-bold text-accent-text hover:underline">
            Edit
          </button>
        )}
      </p>
      {editing ? (
        <form onSubmit={save} className="mt-2 space-y-2">
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
        i.text && <p className="mt-0.5 whitespace-pre-wrap break-words text-ink-2">{i.text}</p>
      )}
      {i.edited && !editing && (
        <>
          <button type="button" onClick={() => setShowOriginal((v) => !v)} aria-expanded={showOriginal} className="meta mt-1 font-bold underline">
            {showOriginal ? "Hide original" : "Show original"}
          </button>
          {showOriginal && <p aria-label="Original text" className="meta mt-1 whitespace-pre-wrap break-words border-l-2 border-line pl-3">{i.original || "(empty)"}</p>}
        </>
      )}
      {i.attachment && <PhotoThumb info={i.attachment} />}
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
  );
}
