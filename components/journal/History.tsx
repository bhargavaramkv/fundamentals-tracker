"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EMPTY_FILTER, filterHistory, groupByDate, historyItems, subjectsOf, type HistoryFilter } from "@/lib/journal/history";
import { formatSpan } from "@/lib/journal/format";
import type { SessionRecord } from "@/lib/journal/local";
import { SOURCE_KINDS, SOURCE_LABELS, type SourceKind } from "@/lib/journal/types";
import { useJournal } from "../JournalProvider";
import { SyncBadge, dateOf } from "./shared";

export function History({ records }: { records: SessionRecord[] }) {
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
    <section aria-label="History">
      <h2 className="headline text-lg">History</h2>
      {all.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-2">No past sessions yet.</p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            <input type="search" aria-label="Search history" placeholder="Search subject, notes, topics" value={filter.query} onChange={(e) => set({ query: e.target.value })} className="field" />
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
              <select aria-label="Filter by subject" value={filter.subject} onChange={(e) => set({ subject: e.target.value })} className="field">
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select aria-label="Filter by source" value={filter.source} onChange={(e) => set({ source: e.target.value as SourceKind | "" })} className="field">
                <option value="">All sources</option>
                {SOURCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SOURCE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
              {discarded > 0 ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={filter.showDiscarded} onChange={(e) => set({ showDiscarded: e.target.checked })} />
                  Show discarded ({discarded})
                </label>
              ) : (
                <span />
              )}
              {filtering && (
                <button type="button" onClick={() => setFilter((f) => ({ ...EMPTY_FILTER, showDiscarded: f.showDiscarded }))} className="font-bold text-accent-text hover:underline">
                  Clear filters
                </button>
              )}
            </div>
            <p role="status" className="meta">
              {shown.length} {shown.length === 1 ? "session" : "sessions"}
            </p>
          </div>
          {groups.length === 0 ? (
            <p className="mt-2 text-[15px] text-ink-2">Nothing matches.</p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mt-4">
                <h3 className="eyebrow">{g.label}</h3>
                <ul className="mt-2 space-y-2">
                  {g.items.map(({ record: r, derived: d }) => (
                    <li key={r.session.id}>
                      <Link href={`/journal/?s=${encodeURIComponent(r.session.id)}`} className="card block px-4 py-3">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={`min-w-0 break-words font-bold ${d.status === "discarded" ? "text-ink-3 line-through" : ""}`}>{d.subject}</span>
                          <span className="meta shrink-0 tabular-nums">{formatSpan(d.activeMs)}</span>
                        </span>
                        <span className="meta mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>{dateOf(d.startedAt)}</span>
                          <span>{SOURCE_LABELS[d.source.kind]}</span>
                          <span>{d.status === "ended" ? "Ended" : "Discarded"}</span>
                          <SyncBadge status={statuses[r.session.id] ?? "local"} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </>
      )}
    </section>
  );
}
