"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EMPTY_FILTER, filterHistory, groupByDate, historyItems, subjectsOf, type HistoryFilter } from "@/lib/journal/history";
import { formatSpan } from "@/lib/journal/format";
import type { SessionRecord } from "@/lib/journal/local";
import { SOURCE_KINDS, SOURCE_LABELS, type SourceKind } from "@/lib/journal/types";
import { useJournal } from "../JournalProvider";
import { StatusPill } from "../ui/StatusPill";
import { PlusIcon, SearchIcon } from "./icons";
import { SyncBadge, timeOf } from "./shared";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const select = "field !min-h-9 !rounded-lg !bg-surface-3 !px-2.5 text-[13px]";

/** The session list pane: title and New session, then search, filters and sessions grouped by recency. */
export function History({ records, selectedId, running }: { records: SessionRecord[]; selectedId: string | null; running: boolean }) {
  const { statuses } = useJournal();
  const all = useMemo(() => historyItems(records), [records]);
  const [filter, setFilter] = useState<HistoryFilter>(EMPTY_FILTER);
  const subjects = useMemo(() => subjectsOf(all), [all]);
  const shown = useMemo(() => filterHistory(all, filter), [all, filter]);
  const groups = useMemo(() => groupByDate(shown), [shown]);
  const discarded = all.filter((i) => i.derived.status === "discarded").length;
  const filtering = filter.subject !== "" || filter.source !== "" || filter.query.trim() !== "";
  const set = (patch: Partial<HistoryFilter>) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-4 pb-3 pt-4 sm:px-5 xl:px-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[1.375rem] font-[650] tracking-[-0.02em]">Journal</h2>
          <span className="meta tabular-nums">
            {all.length} {all.length === 1 ? "session" : "sessions"}
          </span>
        </div>
        <Link href={running ? "/journal/" : "/journal/?new=1"} className="btn btn-primary w-full gap-2">
          <PlusIcon />
          {running ? "Back to running session" : "New session"}
        </Link>
      </div>
      <section aria-label="History" className="flex min-h-0 flex-1 flex-col border-t border-line">
        {all.length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-ink-2 sm:px-5 xl:px-4">No past sessions yet.</p>
        ) : (
          <>
            <div className="space-y-2 px-4 py-3 sm:px-5 xl:px-4">
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  <SearchIcon />
                </span>
                <input type="search" aria-label="Search history" placeholder="Search subject, notes, topics" value={filter.query} onChange={(e) => set({ query: e.target.value })} className={`${select} !pl-9`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Filter by subject" value={filter.subject} onChange={(e) => set({ subject: e.target.value })} className={select}>
                  <option value="">All subjects</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select aria-label="Filter by source" value={filter.source} onChange={(e) => set({ source: e.target.value as SourceKind | "" })} className={select}>
                  <option value="">All sources</option>
                  {SOURCE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {SOURCE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-2">
                {discarded > 0 ? (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={filter.showDiscarded} onChange={(e) => set({ showDiscarded: e.target.checked })} />
                    Show discarded ({discarded})
                  </label>
                ) : (
                  <span />
                )}
                {filtering && (
                  <button type="button" onClick={() => setFilter((f) => ({ ...EMPTY_FILTER, showDiscarded: f.showDiscarded }))} className="font-semibold text-accent-text hover:underline">
                    Clear filters
                  </button>
                )}
              </div>
              <p role="status" className="meta">
                {shown.length} {shown.length === 1 ? "session" : "sessions"} shown
              </p>
            </div>
            <div className="min-h-0 flex-1 px-2 pb-4 sm:px-3 xl:overflow-y-auto">
              {groups.length === 0 ? (
                <p className="px-2 py-2 text-[15px] text-ink-2">Nothing matches.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.label} className="mt-3 first:mt-0">
                    <h3 className="eyebrow px-2 py-1">{g.label}</h3>
                    <ul className="space-y-0.5">
                      {g.items.map(({ record: r, derived: d }) => {
                        const selected = selectedId === r.session.id;
                        const gone = d.status === "discarded";
                        return (
                          <li key={r.session.id}>
                            <Link
                              href={`/journal/?s=${encodeURIComponent(r.session.id)}`}
                              aria-current={selected ? "true" : undefined}
                              className={`relative block rounded-xl border px-3 py-2.5 transition-colors ${selected ? "border-accent/35 bg-surface-3 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent" : "border-transparent hover:bg-surface-2"}`}
                            >
                              <span className="flex items-baseline justify-between gap-3">
                                <span className={`min-w-0 break-words text-[15px] font-semibold ${gone ? "text-ink-3 line-through" : ""}`}>{d.subject}</span>
                                <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{g.label === "Today" ? timeOf(d.startedAt) : shortDate(d.startedAt)}</span>
                              </span>
                              <span className="mt-0.5 line-clamp-1 block break-words text-[13px] text-ink-2">{d.objective || (d.topics.length > 0 ? d.topics.join(", ") : "No objective")}</span>
                              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-mono text-xs tabular-nums text-muted">{formatSpan(d.activeMs)}</span>
                                <span className="text-xs text-muted">{SOURCE_LABELS[d.source.kind]}</span>
                                {gone ? <StatusPill>Discarded</StatusPill> : <SyncBadge status={statuses[r.session.id] ?? "local"} />}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
