"use client";

import { useState } from "react";
import { DOMAINS, DOMAIN_LABELS, type Domain, type Question } from "@/lib/types";
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

  if (running) {
    return <Quiz key={round} questions={running} mode="assessment" onExit={() => setRunning(null)} />;
  }

  const count = scope === "all" ? questions.length : questions.filter((q) => q.domain === scope).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assessment</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          A baseline across all five domains, in mixed difficulty. Domains are interleaved and difficulty ramps up, so even a
          partial run gives a useful signal. Use <em>End &amp; save</em> any time.
        </p>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Scope</legend>
        {(["all", ...DOMAINS] as Scope[]).map((s) => {
          const n = s === "all" ? questions.length : questions.filter((q) => q.domain === s).length;
          return (
            <label
              key={s}
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                scope === s ? "border-accent bg-surface" : "border-line bg-surface hover:border-ink-3"
              }`}
            >
              <span className="flex items-center gap-3">
                <input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)} className="accent-[var(--accent)]" />
                {s === "all" ? "Full assessment (all domains)" : DOMAIN_LABELS[s]}
              </span>
              <span className="tabular-nums text-ink-3">{n} q</span>
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
        className="tap rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink"
      >
        Start · {count} questions (~{Math.ceil(count * 0.75)} min)
      </button>
    </div>
  );
}
