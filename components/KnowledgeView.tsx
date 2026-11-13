"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { filterConcepts, LEVEL_FILTERS, type ConceptRow, type LevelFilter } from "@/lib/mentor/concepts";
import type { KnowledgeLevel } from "@/lib/knowledge/types";
import { Eyebrow } from "./ui/Eyebrow";
import { LevelBar, type LevelCounts } from "./ui/LevelBar";
import { PageHeader } from "./ui/PageHeader";
import { Panel } from "./ui/Panel";
import { StatusPill } from "./ui/StatusPill";
import { useJournal } from "./JournalProvider";
import { useMentor } from "./MentorProvider";
import { useConcepts } from "./mentor/useConcepts";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const STEP_OF: Record<KnowledgeLevel, number> = { none: 0, exposed: 1, understood: 2, applied: 3, retained: 4 };
const LEVEL_COLOR = ["bg-[#3f5075]", "bg-accent", "bg-cyan", "bg-good"] as const;
const LEVEL_KEYS = ["exposed", "understood", "applied", "retained"] as const;
const OTHER = "Other";
const FILTER_LABEL: Record<LevelFilter, string> = {
  all: "All",
  exposed: "Exposed",
  understood: "Understood",
  applied: "Applied",
  retained: "Retained",
  reassess: "Needs reassessment",
  due: "Due for verification",
};
const STRENGTH_TONE = { weak: "neutral", moderate: "info", strong: "good" } as const;

/** Four segments, filled up to the level and coloured by it, so the level reads without the word. */
function Meter({ level }: { level: KnowledgeLevel }) {
  const n = STEP_OF[level];
  return (
    <span className="flex shrink-0 items-end gap-[3px]" role="img" aria-label={`Level: ${level}`}>
      {LEVEL_KEYS.map((k, i) => (
        <span key={k} className={`w-1.5 rounded-[2px] ${i < n ? LEVEL_COLOR[n - 1] : "bg-line-2"}`} style={{ height: 8 + i * 4 }} />
      ))}
    </span>
  );
}

function ConceptButton({ c, selected, onSelect }: { c: ConceptRow; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
        selected ? "border-accent/60 bg-surface-3" : "border-transparent hover:bg-surface-2"
      }`}
    >
      <Meter level={c.result.level} />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[15px] font-medium leading-snug">{c.label}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          <span className="capitalize">{c.result.level}</span>
          {c.result.needsReassessment && <span className="rounded-full bg-warn-bg px-2 py-0.5 font-medium text-warn">Reassess</span>}
          {c.result.dueForVerification && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-text">Due</span>}
        </span>
      </span>
    </button>
  );
}

function Detail({ c, onClose }: { c: ConceptRow; onClose: () => void }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{c.subject ?? "Concept"}</Eyebrow>
          <h2 className="mt-1 break-words text-xl">{c.label}</h2>
        </div>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-muted shrink-0" aria-label={`Close ${c.label}`}>
          Close
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Meter level={c.result.level} />
        <span className="text-sm capitalize text-ink-2">{c.result.level}</span>
        {c.result.needsReassessment && <StatusPill tone="warn">Reassess</StatusPill>}
        {c.result.dueForVerification && <StatusPill tone="info">Due</StatusPill>}
      </div>

      <section className="mt-5 space-y-1.5">
        <h3 className="eyebrow">Why this level</h3>
        <ul className="list-disc space-y-1 pl-5 text-[14px] text-ink-2">
          {c.result.reasons.map((r, i) => (
            <li key={i} className="break-words">
              {r}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 space-y-2">
        <h3 className="eyebrow">Evidence · {c.evidence.length}</h3>
        <ul className="divide-y divide-line">
          {c.evidence.map((e) => (
            <li key={e.id} className="py-2.5 text-[14px] first:pt-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{e.kind}</span>
                <StatusPill tone={STRENGTH_TONE[e.strength]}>{e.strength}</StatusPill>
                <span className="mono ml-auto text-xs text-ink-3">{dateOf(e.at)}</span>
              </div>
              <p className="mt-1 break-words text-ink-2">
                {e.signal}
                {e.historical && " · historical"}
              </p>
              <p className="meta break-all">{e.source.path}</p>
              {e.note && <p className="break-words text-ink-3">{e.note}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 space-y-2">
        <h3 className="eyebrow">Learning history</h3>
        {c.sessions.length === 0 ? (
          <p className="meta">No journal sessions on this device mention it.</p>
        ) : (
          <ul className="space-y-1">
            {c.sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/journal/?s=${encodeURIComponent(s.id)}`} className="text-[14px] text-accent-text hover:underline">
                  {s.subject} · {dateOf(s.at)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  );
}

function SubjectBar({ rows }: { rows: ConceptRow[] }) {
  return (
    <span className="flex h-2 flex-1 gap-[2px] overflow-hidden rounded-full" aria-hidden>
      {LEVEL_KEYS.map((k, i) => {
        const n = rows.filter((r) => r.result.level === k).length;
        return n > 0 ? <i key={k} className={`block ${LEVEL_COLOR[i]}`} style={{ flex: n }} /> : null;
      })}
    </span>
  );
}

export function KnowledgeView() {
  const { ready } = useJournal();
  const { loaded, hasToken, error } = useMentor();
  const concepts = useConcepts();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const subjects = useMemo(() => [...new Set(concepts.map((c) => c.subject).filter((s): s is string => !!s))].sort(), [concepts]);
  const shown = useMemo(() => filterConcepts(concepts, { query, subject, level }), [concepts, query, subject, level]);

  const counts = useMemo<LevelCounts>(() => {
    const n: LevelCounts = { exposed: 0, understood: 0, applied: 0, retained: 0 };
    for (const c of concepts) if (c.result.level !== "none") n[c.result.level]++;
    return n;
  }, [concepts]);
  const reassess = concepts.filter((c) => c.result.needsReassessment).length;
  const due = concepts.filter((c) => c.result.dueForVerification).length;

  const bySubject = useMemo(() => {
    const m = new Map<string, ConceptRow[]>();
    for (const c of concepts) m.set(c.subject ?? OTHER, [...(m.get(c.subject ?? OTHER) ?? []), c]);
    return [...m].sort((a, b) => (a[0] === OTHER ? 1 : b[0] === OTHER ? -1 : b[1].length - a[1].length || a[0].localeCompare(b[0])));
  }, [concepts]);

  const groups = useMemo(() => {
    const m = new Map<string, ConceptRow[]>();
    for (const c of shown) m.set(c.subject ?? OTHER, [...(m.get(c.subject ?? OTHER) ?? []), c]);
    return [...m].sort((a, b) => (a[0] === OTHER ? 1 : b[0] === OTHER ? -1 : a[0].localeCompare(b[0])));
  }, [shown]);

  const selected = shown.find((c) => c.key === selectedKey) ?? null;
  const toggleLevel = (f: LevelFilter) => setLevel(level === f ? "all" : f);

  return (
    <div>
      <PageHeader eyebrow="Library" title="Knowledge" subtitle="What you can show you know, from your journal and its reviews." horizon />

      {!hasToken && loaded && <p className="meta mb-4">Connect sync in Settings to include reviews and stored evidence.</p>}
      {error && <p className="meta mb-4 text-warn">{error}</p>}

      {ready && concepts.length > 0 && (
        <Panel variant="hero" className="mb-8 p-5 sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1.1fr)] lg:gap-10">
            <section aria-label="Level distribution">
              <Eyebrow>Where you stand</Eyebrow>
              <p className="mono mt-2 text-4xl font-semibold tracking-tight">
                {concepts.length}
                <span className="ml-2 text-base font-normal text-ink-2">{concepts.length === 1 ? "concept" : "concepts"}</span>
              </p>
              <div className="mt-5">
                <LevelBar counts={counts} />
              </div>
            </section>

            <section aria-label="Needs attention">
              <Eyebrow>Needs attention</Eyebrow>
              <div className="mt-3 space-y-3">
                <button
                  type="button"
                  aria-pressed={level === "reassess"}
                  disabled={reassess === 0}
                  onClick={() => toggleLevel("reassess")}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-warn/25 bg-warn-bg px-4 py-3 text-left transition-colors enabled:hover:border-warn/60 disabled:opacity-50 aria-pressed:border-warn"
                >
                  <span className="text-sm text-warn">To reassess</span>
                  <span className="mono text-2xl font-semibold text-warn">{reassess}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={level === "due"}
                  disabled={due === 0}
                  onClick={() => toggleLevel("due")}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-left transition-colors enabled:hover:border-accent/70 disabled:opacity-50 aria-pressed:border-accent"
                >
                  <span className="text-sm text-accent-text">Due to verify</span>
                  <span className="mono text-2xl font-semibold text-accent-text">{due}</span>
                </button>
                {reassess === 0 && due === 0 && <p className="meta">Nothing needs attention right now.</p>}
              </div>
            </section>

            <section aria-label="Mastery by subject">
              <Eyebrow>By subject</Eyebrow>
              <ul className="mt-3 space-y-1">
                {bySubject.map(([name, rows]) => {
                  const active = subject === name;
                  const solid = rows.filter((r) => r.result.level === "applied" || r.result.level === "retained").length;
                  return (
                    <li key={name}>
                      <button
                        type="button"
                        aria-pressed={active}
                        disabled={name === OTHER}
                        onClick={() => setSubject(active ? "all" : name)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors enabled:hover:bg-surface-2 ${active ? "bg-surface-3" : ""}`}
                      >
                        <span className="w-24 shrink-0 truncate text-ink-2 sm:w-28">{name}</span>
                        <SubjectBar rows={rows} />
                        <span className="mono w-10 shrink-0 text-right text-xs text-ink-3" title="applied or retained, of all concepts">
                          {solid}/{rows.length}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="meta mt-2 px-2">Applied or retained, out of all concepts. Select a subject to filter.</p>
            </section>
          </div>
        </Panel>
      )}

      <section aria-label="Concepts" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input type="search" className="field w-full sm:w-64" placeholder="Search concepts" aria-label="Search concepts" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="field w-auto" aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="all">All subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Level">
            {LEVEL_FILTERS.map((f) => (
              <button key={f} type="button" className="filter-btn" aria-pressed={level === f} onClick={() => setLevel(f)}>
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <details className="group rounded-xl border border-line bg-surface/60 px-4 py-3 text-[14px] text-ink-2">
          <summary className="cursor-pointer list-none font-medium text-ink">
            How levels work <span className="ml-1 inline-block text-ink-3 transition-transform group-open:rotate-90" aria-hidden>›</span>
          </summary>
          <section aria-label="Levels" className="mt-3 space-y-2">
            <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <li>
                <strong className="text-ink">Exposed:</strong> you met the concept.
              </li>
              <li>
                <strong className="text-ink">Understood:</strong> you explained it in your own words, confirmed by a review.
              </li>
              <li>
                <strong className="text-ink">Applied:</strong> you used it in practice.
              </li>
              <li>
                <strong className="text-ink">Retained:</strong> you showed it again after at least a week.
              </li>
            </ul>
            <p>Multiple-choice answers are weak evidence: they never reach Understood on their own. Later contradicting evidence flags a concept for reassessment instead of lowering it.</p>
          </section>
        </details>

        {!ready ? (
          <div className="space-y-2" aria-hidden>
            <div className="skeleton h-14 w-full" />
            <div className="skeleton h-14 w-full" />
          </div>
        ) : concepts.length === 0 ? (
          <div className="empty-state">
            <strong>Nothing yet</strong>
            <span className="text-[15px]">Concepts appear after you record a journal session.</span>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <strong>No concepts match</strong>
            <span className="text-[15px]">Try a different search or filter.</span>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="min-w-0 space-y-4">
              {groups.map(([name, rows]) => (
                <Panel key={name} className="p-4 sm:p-5">
                  <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                    <h2 className="text-base">{name}</h2>
                    <span className="mono text-xs text-ink-3">{rows.length}</span>
                  </div>
                  <ul className="grid gap-x-3 gap-y-0.5 sm:grid-cols-2 2xl:grid-cols-3">
                    {rows.map((c) => (
                      <li key={c.key}>
                        <ConceptButton c={c} selected={selected?.key === c.key} onSelect={() => setSelectedKey(selected?.key === c.key ? null : c.key)} />
                      </li>
                    ))}
                  </ul>
                  {selected && rows.some((c) => c.key === selected.key) && (
                    <div className="mt-4 lg:hidden">
                      <Detail c={selected} onClose={() => setSelectedKey(null)} />
                    </div>
                  )}
                </Panel>
              ))}
            </div>
            <aside aria-label="Concept detail" className="hidden min-w-0 lg:sticky lg:top-8 lg:block lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto">
              {selected ? (
                <Detail c={selected} onClose={() => setSelectedKey(null)} />
              ) : (
                <Panel className="p-6">
                  <Eyebrow>Detail</Eyebrow>
                  <p className="mt-2 text-ink-2">Select a concept to see why it has its level, the evidence behind it, and where you studied it.</p>
                </Panel>
              )}
            </aside>
          </div>
        )}
      </section>

      <p className="mt-10 text-[15px] text-ink-2">
        <Link href="/mentor/" className="font-medium text-accent-text hover:underline">
          Weekly reports and past reviews
        </Link>
        {" · "}
        <Link href="/learn/" className="font-medium text-accent-text hover:underline">
          Optional lessons
        </Link>
      </p>
    </div>
  );
}
