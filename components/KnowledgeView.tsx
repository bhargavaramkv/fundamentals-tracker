"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { filterConcepts, LEVEL_FILTERS, type ConceptRow, type LevelFilter } from "@/lib/mentor/concepts";
import type { KnowledgeLevel } from "@/lib/knowledge/types";
import { useJournal } from "./JournalProvider";
import { useMentor } from "./MentorProvider";
import { useConcepts } from "./mentor/useConcepts";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const STEPS = ["Exposed", "Understood", "Applied", "Retained"] as const;
const STEP_OF: Record<KnowledgeLevel, number> = { none: 0, exposed: 1, understood: 2, applied: 3, retained: 4 };
const FILTER_LABEL: Record<LevelFilter, string> = {
  all: "All",
  exposed: "Exposed",
  understood: "Understood",
  applied: "Applied",
  retained: "Retained",
  reassess: "Needs reassessment",
  due: "Due for verification",
};

function LevelSteps({ level }: { level: KnowledgeLevel }) {
  const n = STEP_OF[level];
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`Level: ${level}`}>
      {STEPS.map((s, i) => (
        <span key={s} className={`h-1.5 w-5 rounded-full ${i < n ? "bg-accent" : "bg-surface-2"}`} />
      ))}
    </span>
  );
}

function Row({ c }: { c: ConceptRow }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-14 w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block break-words font-medium">{c.label}</span>
          {c.subject && <span className="meta block break-words">{c.subject}</span>}
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          {c.result.needsReassessment && <span className="tag bg-warn-bg text-warn">Reassess</span>}
          {c.result.dueForVerification && <span className="tag bg-accent-soft text-accent-text">Due</span>}
          <span className="meta w-20 text-right capitalize">{c.result.level}</span>
          <LevelSteps level={c.result.level} />
        </span>
      </button>
      {open && (
        <div className="space-y-5 border-t border-line px-4 py-4">
          <section className="space-y-1.5">
            <h3 className="eyebrow">Why this level</h3>
            <ul className="list-disc space-y-1 pl-5 text-[14px] text-ink-2">
              {c.result.reasons.map((r, i) => (
                <li key={i} className="break-words">
                  {r}
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h3 className="eyebrow">Evidence</h3>
            <ul className="space-y-2.5">
              {c.evidence.map((e) => (
                <li key={e.id} className="text-[14px]">
                  <p className="break-words text-ink-2">
                    <span className="font-medium text-ink">{e.kind}</span> · {e.signal} · {e.strength} · {dateOf(e.at)}
                    {e.historical && " · historical"}
                  </p>
                  <p className="meta break-all">{e.source.path}</p>
                  {e.note && <p className="break-words text-ink-3">{e.note}</p>}
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
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
        </div>
      )}
    </li>
  );
}

export function KnowledgeView() {
  const { ready } = useJournal();
  const { loaded, hasToken, error } = useMentor();
  const concepts = useConcepts();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const subjects = useMemo(() => [...new Set(concepts.map((c) => c.subject).filter((s): s is string => !!s))].sort(), [concepts]);
  const shown = useMemo(() => filterConcepts(concepts, { query, subject, level }), [concepts, query, subject, level]);

  return (
    <div className="space-y-8">
      <header className="page-head">
        <p className="eyebrow">Library</p>
        <h1>Knowledge</h1>
        <p>What you can show you know, from your journal and its reviews.</p>
      </header>

      {!hasToken && loaded && <p className="meta">Connect sync in Settings to include reviews and stored evidence.</p>}
      {error && <p className="meta text-warn">{error}</p>}

      <section aria-label="Concepts" className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <input type="search" className="field min-w-0 flex-1 sm:max-w-xs" placeholder="Search concepts" aria-label="Search concepts" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="field w-auto" aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="all">All subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Level">
          {LEVEL_FILTERS.map((f) => (
            <button key={f} type="button" className="filter-btn" aria-pressed={level === f} onClick={() => setLevel(f)}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

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
          <ul className="space-y-2">
            {shown.map((c) => (
              <Row key={c.key} c={c} />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Levels" className="space-y-2 text-[14px] text-ink-2">
        <h2 className="eyebrow">How levels work</h2>
        <ul className="list-disc space-y-1 pl-5">
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

      <p className="text-[15px] text-ink-2">
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
