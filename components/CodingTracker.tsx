"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  activeProblems,
  CODING_PATTERNS,
  DIFFICULTY_LABEL,
  difficultyStats,
  OUTCOME_LABEL,
  parseProblemInput,
  patternLabel,
  patternStats,
  problemStatus,
  type ProblemStatus,
} from "@/lib/coding";
import { importRecords, isLeetCodeFeed, planImport, type LeetCodeFeed } from "@/lib/leetcode";
import type { CodingAttempt, CodingDifficulty, CodingOutcome, CodingProblem } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { relativeDays, untilDays, useNow } from "./useNow";

const OUTCOMES = Object.keys(OUTCOME_LABEL) as CodingOutcome[];
const DIFFICULTIES = Object.keys(DIFFICULTY_LABEL) as CodingDifficulty[];
type StatusFilter = "all" | "due" | "struggling" | "solved";

const OUTCOME_TONE: Record<CodingOutcome, string> = { solved: "text-good", "solved-with-help": "text-warn", "not-solved": "text-bad" };

export function CodingTracker() {
  const { data, ready } = useProgress();
  const now = useNow();
  const params = useSearchParams();
  const focusId = params.get("problem");
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<CodingDifficulty | "all">("all");
  const [pattern, setPattern] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const statuses = useMemo(
    () => (now === null ? [] : activeProblems(data).map((p) => problemStatus(data, p, now)).sort((a, b) => (b.last?.at ?? b.problem.createdAt).localeCompare(a.last?.at ?? a.problem.createdAt))),
    [data, now],
  );
  const loaded = ready && now !== null;
  const weak = useMemo(() => patternStats(data), [data]);
  const byDifficulty = useMemo(() => difficultyStats(data), [data]);

  const filtered = statuses.filter((s) => {
    if (difficulty !== "all" && s.problem.difficulty !== difficulty) return false;
    if (pattern !== "all" && !s.problem.patterns.includes(pattern)) return false;
    if (status === "due" && !s.isDue) return false;
    if (status === "struggling" && (!s.last || s.last.outcome === "solved")) return false;
    if (status === "solved" && s.last?.outcome !== "solved") return false;
    const q = query.trim().toLowerCase();
    if (q && !`${s.problem.title} ${s.problem.number ?? ""} ${s.problem.notes}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const due = statuses.filter((s) => s.isDue);

  return (
    <div className="space-y-12">
      <header className="page-head">
        <h1>Coding</h1>
        <p>Your LeetCode history: what you solved, what you needed help with, and which patterns to work on next.</p>
      </header>

      <AddProblem />
      <LeetCodeImport />

      {!loaded ? (
        <p className="text-ink-2">Loading your history…</p>
      ) : statuses.length === 0 ? (
        <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">
          Nothing logged yet. Add a problem after you attempt it, and record honestly whether you needed help. That&apos;s what makes the weak areas and retry dates worth trusting.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-16">
          <section aria-labelledby="history-h" className="min-w-0">
            <div className="section-head">
              <h2 id="history-h">History</h2>
              <span className="meta" role="status">
                {filtered.length} of {statuses.length}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="min-w-48 flex-1">
                <span className="sr-only">Search problems and notes</span>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search problems and notes" className="field text-sm" />
              </label>
              <label>
                <span className="sr-only">Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="field w-auto pr-8 text-sm">
                  <option value="all">Any status</option>
                  <option value="due">Due to retry</option>
                  <option value="struggling">Needed help or unsolved</option>
                  <option value="solved">Solved unaided</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Difficulty</span>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as CodingDifficulty | "all")} className="field w-auto pr-8 text-sm">
                  <option value="all">Any difficulty</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABEL[d]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Pattern</span>
                <select value={pattern} onChange={(e) => setPattern(e.target.value)} className="field w-auto pr-8 text-sm">
                  <option value="all">Any pattern</option>
                  {CODING_PATTERNS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {filtered.length === 0 ? (
              <p className="mt-6 text-sm text-ink-2">No problems match these filters.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {filtered.map((s) => (
                  <ProblemRow key={s.problem.id} status={s} now={now} defaultOpen={s.problem.id === focusId} />
                ))}
              </ul>
            )}
          </section>

          <aside className="min-w-0 space-y-12">
            {due.length > 0 && (
              <section aria-labelledby="due-h">
                <div className="section-head">
                  <h2 id="due-h">Due to retry</h2>
                </div>
                <ul className="divide-y divide-line">
                  {due.slice(0, 6).map((s) => (
                    <li key={s.problem.id} className="flex items-baseline justify-between gap-3 py-2.5 text-[15px]">
                      <Link href={`/coding/?problem=${encodeURIComponent(s.problem.id)}`} scroll={false} className="min-w-0 truncate hover:text-accent-text">
                        {s.problem.title}
                      </Link>
                      <span className="meta shrink-0">{s.overdueDays > 0 ? `${s.overdueDays}d overdue` : "today"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="weak-h">
              <div className="section-head">
                <h2 id="weak-h">Weak areas</h2>
              </div>
              <p className="meta mt-2">Judged from your latest attempt at each problem. Patterns need 2 or more problems for a verdict.</p>
              {weak.length === 0 ? (
                <p className="mt-2 text-[15px] text-ink-2">Tag problems with a pattern to see this.</p>
              ) : (
                <ul className="mt-1 divide-y divide-line">
                  {weak.map((w) => (
                    <li key={w.id} className="py-2.5 text-[15px]">
                      <p className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">{w.label}</span>
                        <span className={`meta shrink-0 font-medium ${w.verdict === "weak" ? "text-bad" : w.verdict === "strong" ? "text-good" : ""}`}>
                          {w.verdict === "weak" ? "Weak" : w.verdict === "strong" ? "Strong" : w.verdict === "ok" ? "Mixed" : "Too few to say"}
                        </span>
                      </p>
                      <p className="meta">
                        {w.unaided} of {w.unaided + w.struggling} unaided
                        {w.medianMinutes !== null && ` · typically ${w.medianMinutes} min`}
                        {w.verdict === "weak" && w.topic && (
                          <>
                            {" · "}
                            <Link href={`/learn/${w.topic}/`} className="text-accent-text hover:underline">
                              Study this
                            </Link>
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="diff-h">
              <div className="section-head">
                <h2 id="diff-h">By difficulty</h2>
              </div>
              <ul className="divide-y divide-line">
                {byDifficulty.map((d) => (
                  <li key={d.difficulty} className="flex justify-between gap-3 py-2.5 text-[15px]">
                    <span>{DIFFICULTY_LABEL[d.difficulty]}</span>
                    <span className="tabular-nums text-ink-2">
                      {d.unaided} of {d.problems} unaided
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}

      <p className="meta max-w-2xl">
        Recent solves sync from your public LeetCode profile twice a day. LeetCode has no public API and reading your full history would need your account&apos;s session cookie, so older problems and the hint/no-hint outcome are logged by hand.
      </p>
    </div>
  );
}

const FEED_URL = process.env.NEXT_PUBLIC_LEETCODE_FEED_URL ?? "https://raw.githubusercontent.com/bhargavaramkv/fundamentals-tracker/leetcode-data/leetcode.json";

/** Recent accepted solves from the leetcode-data branch, offered for import. Hidden until a sync has produced something new. */
function LeetCodeImport() {
  const { data, ready, saveCodingProblem, commitCodingAttempt } = useProgress();
  const [feed, setFeed] = useState<LeetCodeFeed | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch(FEED_URL, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw: unknown) => {
        if (live && isLeetCodeFeed(raw)) setFeed(raw);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const pending = useMemo(() => (feed && ready ? planImport(data, feed) : []), [feed, data, ready]);
  if (done !== null && pending.length === 0) {
    return <p className="meta">Imported {done} from LeetCode. They&apos;re marked &ldquo;solved with help&rdquo; and come back in 7 days. Log another attempt as unaided to correct one.</p>;
  }
  if (pending.length === 0) return null;

  const run = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    let n = 0;
    for (const item of pending) {
      const { problem, attempt } = importRecords(item, data.codingProblems.find((p) => p.id === `lc-${item.slug}`), now);
      await saveCodingProblem(problem);
      await commitCodingAttempt(attempt);
      n++;
    }
    setDone(n);
    setBusy(false);
  };

  return (
    <section aria-label="Import from LeetCode" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-3">
      <p className="min-w-0 flex-1 text-sm text-ink-2">
        <strong className="text-ink">{pending.length} new {pending.length === 1 ? "solve" : "solves"}</strong> on your LeetCode profile: {pending.slice(0, 3).map((i) => i.title).join(", ")}
        {pending.length > 3 ? `, +${pending.length - 3} more` : ""}.
      </p>
      <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
        {busy ? "Importing…" : "Import"}
      </button>
    </section>
  );
}

function AddProblem() {
  const { data, saveCodingProblem, commitCodingAttempt } = useProgress();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [difficulty, setDifficulty] = useState<CodingDifficulty>("medium");
  const [patterns, setPatterns] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<CodingOutcome>("solved");
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseProblemInput(input);
    if (!parsed) {
      setError("Enter a problem name, or a link that looks like leetcode.com/problems/two-sum.");
      return;
    }
    setError(null);
    const at = new Date().toISOString();
    const existing = data.codingProblems.find((p) => p.id === parsed.id);
    // Adding a problem you already have logs another attempt, and brings it back if it was removed.
    const problem: CodingProblem = {
      id: parsed.id,
      title: existing?.title ?? parsed.title,
      url: parsed.url ?? existing?.url,
      number: parsed.number ?? existing?.number,
      difficulty,
      patterns: [...new Set([...(existing?.patterns ?? []), ...patterns])],
      notes: existing?.notes ?? "",
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    };
    const minutesNumber = Number(minutes);
    const attempt: CodingAttempt = {
      id: crypto.randomUUID(),
      problemId: parsed.id,
      at,
      outcome,
      ...(minutes && minutesNumber > 0 ? { minutes: minutesNumber } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    await saveCodingProblem(problem);
    await commitCodingAttempt(attempt);
    setSaved(existing && !existing.deletedAt ? `Logged another attempt at ${problem.title}.` : `Added ${problem.title}.`);
    setInput("");
    setPatterns([]);
    setMinutes("");
    setNotes("");
    setOutcome("solved");
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
          Log a problem
        </button>
        {saved && (
          <p className="meta text-good" role="status">
            {saved}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="card max-w-3xl space-y-5 p-5 sm:p-6" aria-label="Log a problem">
      <div>
        <label className="block">
          <span className="text-[15px] font-medium">Problem</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://leetcode.com/problems/two-sum/ or 1. Two Sum"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "problem-error" : undefined}
            className="field mt-1 text-[15px]"
            autoFocus
          />
        </label>
        {error && (
          <p id="problem-error" role="alert" className="mt-1 text-sm text-bad">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-5">
        <fieldset>
          <legend className="text-[15px] font-medium">Difficulty</legend>
          <div className="mt-1 flex gap-1">
            {DIFFICULTIES.map((d) => (
              <button key={d} type="button" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)} className="filter-btn">
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[15px] font-medium">How did it go?</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {OUTCOMES.map((o) => (
              <button key={o} type="button" aria-pressed={outcome === o} onClick={() => setOutcome(o)} className="filter-btn">
                {OUTCOME_LABEL[o]}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          <span className="text-[15px] font-medium">Minutes</span>
          <input type="number" min={1} max={600} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="field mt-1 block w-24 text-[15px]" />
        </label>
      </div>

      <fieldset>
        <legend className="text-[15px] font-medium">Patterns</legend>
        <div className="mt-1 flex flex-wrap gap-1">
          {CODING_PATTERNS.map((p) => {
            const on = patterns.includes(p.id);
            return (
              <button key={p.id} type="button" aria-pressed={on} onClick={() => setPatterns((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))} className="filter-btn">
                {p.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-[15px] font-medium">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="The key idea, or where you got stuck" className="field mt-1 text-[15px]" />
      </label>

      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary">
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Close
        </button>
        {saved && (
          <p className="meta self-center text-good" role="status">
            {saved}
          </p>
        )}
      </div>
    </form>
  );
}

function ProblemRow({ status: s, now, defaultOpen }: { status: ProblemStatus; now: number; defaultOpen: boolean }) {
  const { saveCodingProblem, commitCodingAttempt } = useProgress();
  const p = s.problem;
  const [outcome, setOutcome] = useState<CodingOutcome>("solved");
  const [minutes, setMinutes] = useState("");
  const [attemptNotes, setAttemptNotes] = useState("");
  const [notes, setNotes] = useState(p.notes);
  const row = useRef<HTMLLIElement>(null);

  // Arriving from a link to this problem (Today's plan, the retry list) brings it into view.
  useEffect(() => {
    if (defaultOpen) row.current?.scrollIntoView({ block: "nearest" });
  }, [defaultOpen]);

  const logAttempt = () => {
    const minutesNumber = Number(minutes);
    void commitCodingAttempt({
      id: crypto.randomUUID(),
      problemId: p.id,
      at: new Date().toISOString(),
      outcome,
      ...(minutes && minutesNumber > 0 ? { minutes: minutesNumber } : {}),
      ...(attemptNotes.trim() ? { notes: attemptNotes.trim() } : {}),
    });
    setMinutes("");
    setAttemptNotes("");
  };

  const remove = () => {
    if (!window.confirm(`Remove ${p.title} from your history? Adding it again brings its attempts back.`)) return;
    const at = new Date().toISOString();
    void saveCodingProblem({ ...p, deletedAt: at, updatedAt: at });
  };

  return (
    <li ref={row} className="scroll-mt-20">
      <details open={defaultOpen || undefined} className="group py-4">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="headline text-xl group-hover:text-accent-text">
              {p.number ? `${p.number}. ` : ""}
              {p.title}
            </span>
            {s.last && <span className={`meta font-medium ${OUTCOME_TONE[s.last.outcome]}`}>{OUTCOME_LABEL[s.last.outcome]}</span>}
          </p>
          <p className="meta mt-0.5">
            {DIFFICULTY_LABEL[p.difficulty]}
            {p.patterns.length > 0 && ` · ${p.patterns.map(patternLabel).join(", ")}`} · {s.attempts.length} attempt{s.attempts.length === 1 ? "" : "s"}
            {s.last && ` · last ${relativeDays(s.last.at, now)}`}
            {s.dueAt ? (s.isDue ? <span className="font-medium text-warn"> · retry due</span> : ` · retry ${untilDays(s.dueAt, now)}`) : s.last ? " · settled" : ""}
          </p>
        </summary>

        <div className="mt-4 space-y-5 border-l border-line pl-4">
          {p.url && (
            <a href={p.url} target="_blank" rel="noreferrer" className="text-[15px] text-accent-text hover:underline">
              Open on LeetCode <span aria-hidden>↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}

          {s.attempts.length > 0 && (
            <div>
              <h3 className="text-[15px] font-medium">Attempts</h3>
              <ol className="mt-1 space-y-1.5 text-[15px]">
                {[...s.attempts].reverse().map((a) => (
                  <li key={a.id}>
                    <span className={`font-medium ${OUTCOME_TONE[a.outcome]}`}>{OUTCOME_LABEL[a.outcome]}</span>
                    <span className="meta">
                      {" "}
                      · {a.at.slice(0, 10)}
                      {a.minutes ? ` · ${a.minutes} min` : ""}
                    </span>
                    {a.notes && <p className="text-ink-2">{a.notes}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <h3 className="text-[15px] font-medium">Log another attempt</h3>
            <div role="group" aria-label="Outcome" className="mt-1 flex flex-wrap gap-1">
              {OUTCOMES.map((o) => (
                <button key={o} type="button" aria-pressed={outcome === o} onClick={() => setOutcome(o)} className="filter-btn">
                  {OUTCOME_LABEL[o]}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label>
                <span className="sr-only">Minutes</span>
                <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Min" className="field w-20 text-[15px]" />
              </label>
              <label className="min-w-48 flex-1">
                <span className="sr-only">Notes on this attempt</span>
                <input value={attemptNotes} onChange={(e) => setAttemptNotes(e.target.value)} placeholder="Notes on this attempt" className="field text-[15px]" />
              </label>
              <button type="button" onClick={logAttempt} className="btn btn-secondary">
                Log attempt
              </button>
            </div>
          </div>

          <label className="block">
            <span className="text-[15px] font-medium">Notes on this problem</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="field mt-1 text-[15px]" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={notes === p.notes} onClick={() => void saveCodingProblem({ ...p, notes, updatedAt: new Date().toISOString() })} className="btn btn-secondary">
              Save notes
            </button>
            <button type="button" onClick={remove} className="btn btn-secondary btn-danger">
              Remove
            </button>
          </div>
        </div>
      </details>
    </li>
  );
}
