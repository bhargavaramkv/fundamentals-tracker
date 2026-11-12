"use client";

import Link from "next/link";
import { useState } from "react";
import { useProgress } from "./ProgressProvider";
import { DOMAINS, DOMAIN_LABELS, type Domain, type Question, type SessionRecord } from "@/lib/types";
import { Quiz } from "./Quiz";

type Scope = "all" | Domain;

/** Interleave domains and ramp difficulty so a partial run still samples everything. */
function orderForAssessment(questions: Question[]): Question[] {
  const sorted = [...questions].sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
  const byDomain = DOMAINS.map((d) => sorted.filter((q) => q.domain === d));
  const out: Question[] = [];
  for (let i = 0; byDomain.some((list) => i < list.length); i++) {
    for (const list of byDomain) if (list[i]) out.push(list[i]);
  }
  return out;
}

/** The baseline across every domain. A check on one topic lives in that topic's workspace. */
export function AssessRunner({ questions }: { questions: Question[] }) {
  const [scope, setScope] = useState<Scope>("all");
  const [running, setRunning] = useState<Question[] | null>(null);
  const [round, setRound] = useState(0);
  const { data, ready } = useProgress();

  if (running) {
    return <Quiz key={round} questions={running} mode="assessment" onExit={() => setRunning(null)} />;
  }

  const count = scope === "all" ? questions.length : questions.filter((q) => q.domain === scope).length;

  return (
    <div className="mx-auto max-w-3xl space-y-9">
      <header className="page-head">
        <nav aria-label="Breadcrumb" className="meta mb-3">
          <Link href="/learn/" className="tap hover:text-ink">
            Learning Path
          </Link>
        </nav>
        <p className="eyebrow mt-1">Assessment</p>
        <h1>Baseline assessment</h1>
        <p>
          A broad measure across all five domains, with no feedback until the end. Domains are interleaved and difficulty ramps up, so even a partial run is useful. Use End &amp; save at any time.
        </p>
      </header>

      <fieldset>
        <legend className="section-head mb-1 w-full text-[13px] font-semibold uppercase tracking-[0.06em]">Scope</legend>
        <div className="divide-y divide-line">
          {(["all", ...DOMAINS] as Scope[]).map((s) => {
            const n = s === "all" ? questions.length : questions.filter((q) => q.domain === s).length;
            return (
              <label key={s} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2.5 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
                <span className="flex items-center gap-3">
                  <input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className={scope === s ? "font-medium" : ""}>{s === "all" ? "Everything" : DOMAIN_LABELS[s]}</span>
                </span>
                <span className="meta tabular-nums">{n} questions</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={() => {
          setRound((r) => r + 1);
          setRunning(orderForAssessment(scope === "all" ? questions : questions.filter((q) => q.domain === scope)));
        }}
        className="btn btn-primary"
      >
        Start · {count} questions, about {Math.ceil(count * 0.75)} min <span className="btn-arrow" aria-hidden>→</span>
      </button>

      {ready && <PastAttempts sessions={data.sessions.filter((x) => x.mode === "assessment")} />}
    </div>
  );
}

function PastAttempts({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length === 0) return null;
  const recent = [...sessions].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, 5);
  return (
    <section aria-labelledby="past-h">
      <div className="section-head">
        <h2 id="past-h">Previous attempts</h2>
      </div>
      <ul className="divide-y divide-line text-[15px]">
        {recent.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="text-ink-2">{new Date(x.finishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
            <span className="tabular-nums">
              <span className="font-medium">{Math.round((100 * x.correct) / Math.max(1, x.total))}%</span>
              <span className="text-ink-3">
                {" "}
                · {x.correct} of {x.total} correct
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
