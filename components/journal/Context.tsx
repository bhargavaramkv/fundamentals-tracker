"use client";

import { useEffect, useState, type ReactNode } from "react";
import { deriveSession } from "@/lib/journal/events";
import { formatSpan } from "@/lib/journal/format";
import type { SessionRecord } from "@/lib/journal/local";
import type { ConflictInspection, EventBrief } from "@/lib/journal/sync";
import { SOURCE_LABELS } from "@/lib/journal/types";
import { useJournal } from "../JournalProvider";
import { SessionReviewPanel } from "../mentor/SessionReviewPanel";
import { TagIcon } from "./icons";
import { timeOf, useTick } from "./shared";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ value, unit, label }: { value: string | number; unit?: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/70 px-3 py-2.5">
      <p className="font-mono text-xl font-semibold tabular-nums leading-none">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>}
      </p>
      <p className="mt-1.5 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function TopicChips({ topics }: { topics: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {topics.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-0.5 text-[13px] font-medium text-cyan">
          <TagIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{t}</span>
        </li>
      ))}
    </ul>
  );
}

const stats = (d: ReturnType<typeof deriveSession>) => (
  <div className="grid grid-cols-3 gap-2">
    <Stat value={formatSpan(d.activeMs)} label="Active" />
    <Stat value={d.topics.length} label="Topics" />
    <Stat value={d.timeline.filter((t) => t.kind === "note").length} label="Notes" />
  </div>
);

/** Context for the selected session: stats, topics, conflict and the review. */
export function SessionContext({ record }: { record: SessionRecord }) {
  const { statuses } = useJournal();
  const [notice, setNotice] = useState<string | null>(null);
  const id = record.session.id;
  const d = deriveSession(record.session);
  const status = statuses[id] ?? "local";
  return (
    <div className="space-y-6">
      <Section title="Session">{stats(d)}</Section>
      {d.topics.length > 0 && (
        <Section title="Topics">
          <TopicChips topics={d.topics} />
        </Section>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-good-bg px-3 py-2 text-sm text-good">
          {notice}
        </p>
      )}
      {status === "conflict" && <ConflictPanel id={id} onRepaired={() => setNotice("Repaired. The previous GitHub copy was saved under journal/conflicts/ and nothing was lost.")} />}
      {d.unknownEvents > 0 && <p className="text-sm text-ink-2">{d.unknownEvents} events from a newer app version are kept but not shown.</p>}
      {d.status === "ended" && <SessionReviewPanel sessionId={id} />}
    </div>
  );
}

/** Context while a session runs: its objective, topics so far and live counts. */
export function ActiveContext({ record }: { record: SessionRecord }) {
  const d = deriveSession(record.session, useTick());
  return (
    <div className="space-y-6">
      <Section title="So far">{stats(d)}</Section>
      <Section title="Source">
        <p className="text-[15px] text-ink-2">
          {SOURCE_LABELS[d.source.kind]}
          {d.source.title ? ` · ${d.source.title}` : ""}
        </p>
      </Section>
      {d.topics.length > 0 && (
        <Section title="Topics so far">
          <TopicChips topics={d.topics} />
        </Section>
      )}
    </div>
  );
}

/** Context beside the new-session composer: what a session can capture. */
export function ComposeContext() {
  const items: [string, string][] = [
    ["Note", "What you read, watched or worked out, in your own words."],
    ["Topic", "Name the concept you are on, so it shows up in review."],
    ["Difficulty", "What is hard or unclear. These are what the review checks first."],
    ["Bookmark", "Mark a moment in a video or a page to return to."],
    ["Photo", "A whiteboard or page. Kept on this device."],
  ];
  return (
    <Section title="What a session captures">
      <dl className="space-y-3">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[14px] font-semibold">{k}</dt>
            <dd className="text-[13px] leading-relaxed text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

const SHOW_EVENTS = 8;
function EventList({ title, events }: { title: string; events: EventBrief[] }) {
  return (
    <div>
      <p className="font-semibold">
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
    <section aria-label="Needs attention" className="space-y-4 rounded-2xl border border-bad/40 bg-bad-bg p-4">
      <h2 className="text-lg font-semibold text-bad">Needs attention</h2>
      <p className="text-[15px]">{info?.reason ?? "Reading both copies…"}</p>
      <p className="text-sm text-ink-2">Your copy on this device is safe and complete. Nothing on GitHub is overwritten until a backup of it exists.</p>
      {info && (
        <div className="grid gap-4 text-sm">
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
