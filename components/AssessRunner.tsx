"use client";

import { useState } from "react";
import { useProgress } from "./ProgressProvider";
import { DOMAINS, DOMAIN_LABELS, type Domain, type Question, type SessionRecord } from "@/lib/types";
import { DomainIcon } from "./DomainIcon";
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
    <div className="space-y-8">
      <div className="hero-grid pt-2 sm:pt-6">
        <p className="eyebrow">Baseline</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.125rem]">Assessment</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          A baseline across all five domains, in mixed difficulty. Domains are interleaved and difficulty ramps up, so even a
          partial run gives a useful signal. Use <em>End &amp; save</em> any time.
        </p>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="eyebrow mb-3">Choose a scope</legend>
        {(["all", ...DOMAINS] as Scope[]).map((s) => {
          const n = s === "all" ? questions.length : questions.filter((q) => q.domain === s).length;
          return (
            <label
              key={s}
              className={`flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-surface px-4 py-3 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                scope === s ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-line hover:border-ink-3"
              }`}
            >
              <span className="flex items-center gap-3">
                <input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)} className="sr-only" />
                {s === "all" ? (
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-accent text-accent-text"
                    aria-hidden
                  >
                    ★
                  </span>
                ) : (
                  <DomainIcon domain={s} size={36} />
                )}
                <span className="font-semibold">{s === "all" ? "Full assessment" : DOMAIN_LABELS[s]}</span>
              </span>
              <span className="font-mono tabular-nums text-ink-3">{n} q</span>
            </label>
          );
        })}
      </fieldset>

      <button
        type="button"
        onClick={() => {
          setRound((r) => r + 1);
          setRunning(orderForAssessment(scope === "all" ? questions : questions.filter((q) => q.domain === scope)));
        }}
        className="btn btn-primary"
      >
        Start · {count} questions (~{Math.ceil(count * 0.75)} min) <span className="btn-arrow" aria-hidden>→</span>
      </button>

      {ready && <PastAttempts sessions={data.sessions.filter((x) => x.mode === "assessment")} />}
    </div>
  );
}

function PastAttempts({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length === 0) return null;
  const recent = [...sessions].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, 5);
  return (
    <section aria-labelledby="past-h" className="pt-4">
      <div className="section-head">
        <h2 id="past-h">Previous attempts</h2>
      </div>
      <ul className="divide-y divide-line text-sm">
        {recent.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="text-ink-2">
              {new Date(x.finishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="font-mono tabular-nums">
              <span className="font-semibold">{Math.round((100 * x.correct) / Math.max(1, x.total))}%</span>
              <span className="text-ink-3">
                {" "}
                · {x.correct}/{x.total} correct
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
