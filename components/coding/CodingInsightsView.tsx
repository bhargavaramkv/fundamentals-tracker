"use client";

import type { ReactNode } from "react";
import type { CodingAnalysis, CodingReview, CodingStats, FormWindow, LeetCodePullStatus } from "@/lib/leetcode-history";
import { Eyebrow } from "../ui/Eyebrow";
import { Panel } from "../ui/Panel";
import { StatusPill } from "../ui/StatusPill";
import { useNow } from "../useNow";

const SHORT: Record<string, string> = { "Wrong Answer": "wrong answer", "Runtime Error": "runtime error", "Time Limit Exceeded": "time limit", "Compile Error": "compile error", "Memory Limit Exceeded": "memory limit" };
const VERDICT = { struggling: "text-bad", improve: "text-warn", good: "text-good" } as const;
const VERDICT_LABEL = { struggling: "Struggling", improve: "Can improve", good: "Solid" } as const;
const TREND = {
  improving: { label: "Improving", tone: "good" },
  steady: { label: "Steady", tone: "neutral" },
  slipping: { label: "Slipping", tone: "bad" },
  unclear: { label: "Too early to tell", tone: "neutral" },
} as const;
const DAY = 86_400_000;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function ago(ms: number, now: number): string {
  const d = Math.floor((now - ms) / DAY);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 60 ? `${d} days ago` : `${Math.round(d / 30)} months ago`;
}

/** Claude's one-liner, or for reviews written before there was one, the opening sentence of the summary. */
function headlineOf(a: CodingAnalysis): string {
  if (a.headline) return a.headline;
  const first = a.summary.split(/(?<=[.!?])\s/)[0];
  return first.length > 200 ? `${first.slice(0, 197)}…` : first;
}

function ProblemLink({ slug, title }: { slug: string; title: string }) {
  return (
    <a href={`https://leetcode.com/problems/${slug}/`} target="_blank" rel="noreferrer" className="text-accent-text hover:underline">
      {title}
    </a>
  );
}

function Block({ id, title, aside, children, className = "" }: { id: string; title: string; aside?: string; children: ReactNode; className?: string }) {
  return (
    <Panel as="section" className={`p-5 sm:p-6 ${className}`}>
      <div aria-labelledby={id} role="group">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id={id} className="text-lg">
            {title}
          </h2>
          {aside && <span className="meta">{aside}</span>}
        </div>
        {children}
      </div>
    </Panel>
  );
}

function Fold({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <details className="group panel">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 px-5 py-4 font-medium sm:px-6">
        <span>{title}</span>
        <span className="meta">
          {aside} <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>›</span>
        </span>
      </summary>
      <div className="border-t border-line px-5 py-5 sm:px-6">{children}</div>
    </details>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="min-w-0 bg-surface/70 px-4 py-4">
      <div className="mono text-[1.75rem] font-semibold leading-none">{value}</div>
      <div className="mt-2 text-sm text-ink-2">{label}</div>
      {note && <div className="meta mt-0.5">{note}</div>}
    </div>
  );
}

/** "up from 4 of 10", so the direction is in words and not only in a colour. */
function versus(gain: number, before: string | undefined): string | undefined {
  if (before === undefined) return undefined;
  if (Math.abs(gain) < 0.05) return `same as the 10 before (${before})`;
  return `${gain > 0 ? "better" : "worse"} than the 10 before (${before})`;
}

function StatStrip({ stats, nowMs }: { stats: CodingStats; nowMs: number | null }) {
  const { last, previous } = stats.form;
  const outOf = (w: FormWindow) => `${w.firstTry} of ${w.problems}`;
  const rate = (w: FormWindow) => w.firstTry / Math.max(1, w.problems);
  const active30 = nowMs === null ? null : stats.activeDates.filter((d) => nowMs - Date.parse(d) < 30 * DAY).length;
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
      <Stat value={`${stats.solved}/${stats.problems}`} label="problems solved" note={stats.unsolved.length ? `${stats.unsolved.length} never passed` : "all passed"} />
      <Stat value={outOf(last)} label="first try, last 10" note={previous ? versus(rate(last) - rate(previous), outOf(previous)) : undefined} />
      <Stat
        value={last.avgTries === null ? "-" : last.avgTries.toFixed(1)}
        label="tries to solve, last 10"
        note={last.avgTries !== null && previous?.avgTries != null ? versus(previous.avgTries - last.avgTries, previous.avgTries.toFixed(1)) : undefined}
      />
      <Stat
        value={active30 === null ? "-" : `${active30} days`}
        label="coded in the last 30"
        note={stats.lastSubmittedAt !== null && nowMs !== null ? `last: ${ago(stats.lastSubmittedAt * 1000, nowMs)}` : undefined}
      />
    </div>
  );
}

/** One tile per recent problem, the number of tries inside it, so green/amber/red is never the only signal. */
function Lately({ items }: { items: CodingStats["lately"] }) {
  const tone = (t: number | null) => (t === null ? "bg-bad-bg text-bad" : t === 1 ? "bg-good-bg text-good" : t <= 3 ? "bg-warn-bg text-warn" : "bg-bad-bg text-bad");
  return (
    <div>
      <ul className="grid grid-cols-6 gap-2 sm:grid-cols-12">
        {items.map((p) => {
          const label = p.acceptedOnTry === null ? `${p.title}: not solved after ${p.attempts} attempts` : `${p.title}: solved on try ${p.acceptedOnTry}`;
          return (
            <li key={p.slug}>
              <a
                href={`https://leetcode.com/problems/${p.slug}/`}
                target="_blank"
                rel="noreferrer"
                title={label}
                aria-label={label}
                className={`mono flex h-11 items-center justify-center rounded-lg text-base font-semibold ${tone(p.acceptedOnTry)}`}
              >
                {p.acceptedOnTry ?? "×"}
              </a>
            </li>
          );
        })}
      </ul>
      <p className="meta mt-3">Tries it took to pass, oldest to newest. × means not solved yet.</p>
    </div>
  );
}

function Topics({ topics }: { topics: CodingStats["topics"] }) {
  const rows = topics.filter((t) => t.problems >= 3).slice(0, 6);
  if (rows.length === 0) return null;
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((t) => (
          <li key={t.tag}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="capitalize">{t.tag.replaceAll("-", " ")}</span>
              <span className="mono text-xs text-ink-3">
                {pct(t.failureRate)} failed · {t.problems} problems
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-surface-3" aria-hidden>
              <div className={`h-2 rounded-full ${t.failureRate >= 0.5 ? "bg-bad" : "bg-warn"}`} style={{ width: pct(t.failureRate) }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="meta mt-3">Share of submissions that failed. Only topics with 3 or more problems.</p>
    </div>
  );
}

function Habits({ items }: { items: CodingReview["mistakes"] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((m) => (
        <li key={m.pattern} className="rounded-xl border border-warn/25 border-l-[3px] border-l-warn bg-warn-bg/40 p-4">
          <div className="font-medium">{m.pattern}</div>
          <p className="mt-2 text-[15px]">
            <span className="text-ink-2">Before you submit: </span>
            {m.check}
          </p>
          <details className="mt-2">
            <summary className="meta cursor-pointer">What happened</summary>
            <p className="mt-2 text-sm text-ink-2">{m.detail}</p>
            <p className="mt-2 flex flex-wrap gap-x-3 text-sm">
              {m.problems.map((p) => (
                <ProblemLink key={p} slug={p} title={p.replaceAll("-", " ")} />
              ))}
            </p>
          </details>
        </li>
      ))}
    </ul>
  );
}

function Reviews({ items }: { items: CodingReview["reviews"] }) {
  const order = { struggling: 0, improve: 1, good: 2 };
  const sorted = [...items].sort((a, b) => order[a.verdict] - order[b.verdict]);
  return (
    <ul className="grid gap-x-10 md:grid-cols-2">
      {sorted.map((r) => (
        <li key={r.slug} className="border-t border-line py-3">
          <div className="flex items-baseline justify-between gap-3">
            <ProblemLink slug={r.slug} title={r.title} />
            <span className={`text-xs font-medium ${VERDICT[r.verdict]}`}>{VERDICT_LABEL[r.verdict]}</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">{r.note}</p>
        </li>
      ))}
    </ul>
  );
}

function Hardest({ rows }: { rows: CodingStats["hardest"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-ink-2">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">Problem</th>
            <th scope="col" className="py-2 pr-4 font-medium">Passed on try</th>
            <th scope="col" className="py-2 font-medium">What failed before it passed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {rows.map((h) => (
            <tr key={h.slug}>
              <td className="py-2 pr-4">
                <ProblemLink slug={h.slug} title={h.title} />
              </td>
              <td className="mono py-2 pr-4">{h.acceptedOnTry ?? "not yet"}</td>
              <td className="py-2 text-ink-2">
                {h.failures.map((f) => `${f.count} ${SHORT[f.status] ?? f.status}`).join(", ")}
                {h.later > 0 && ` · then ${h.later} more submissions after it passed`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Numbered action cards: a big mono index, then the action. */
function ActionCards({ items }: { items: { key: string; title: ReactNode; why: string }[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      {items.map((n, i) => (
        <li key={n.key} className="flex gap-4 rounded-xl border border-line bg-surface-2/60 p-4">
          <span className="mono text-2xl font-semibold leading-none text-cyan" aria-hidden>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <div className="font-medium">{n.title}</div>
            <p className="mt-1 text-sm text-ink-2">{n.why}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CodingInsightsView({ stats, analysis, status }: { stats: CodingStats; analysis: CodingAnalysis | null; status: LeetCodePullStatus | null }) {
  const nowMs = useNow();
  const alert = status && !status.ok && (
    <p role="alert" className="text-bad">
      {status.reason === "signed-out" ? "LeetCode sign-in expired, so new work isn't arriving. Update the LEETCODE_SESSION and LEETCODE_CSRF secrets in your data repo." : `Last night's LeetCode pull failed: ${status.message}`}
    </p>
  );
  if (stats.total === 0) {
    return (
      <div className="space-y-4">
        {alert}
        <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">Your first LeetCode pull hasn&apos;t arrived yet. It runs every evening, around 7:30 PM and 11:30 PM India time.</p>
      </div>
    );
  }
  const trend = analysis?.trend ? TREND[analysis.trend.direction] : null;
  const struggling = analysis?.reviews.filter((r) => r.verdict !== "good").length ?? 0;
  const hasTopics = stats.topics.some((t) => t.problems >= 3);

  return (
    <div className="space-y-6">
      {alert}

      <Panel variant="hero" className="p-5 sm:p-8">
        {analysis ? (
          <div className="max-w-4xl">
            <Eyebrow>Claude&apos;s read · {day(analysis.generatedAt)}</Eyebrow>
            <p className="mt-3 text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">{headlineOf(analysis)}</p>
            {trend && analysis.trend && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-2">
                <StatusPill tone={trend.tone}>{trend.label}</StatusPill>
                <span className="min-w-0">{analysis.trend.note}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="max-w-2xl text-ink-2">Claude reviews your code at the next daily run, around 7:00 AM India time. Until then, these are your numbers.</p>
        )}
        <div className="mt-7">
          <StatStrip stats={stats} nowMs={nowMs} />
        </div>
      </Panel>

      <Block id="lately-h" title="Last 12 problems" aside="most recent on the right">
        <Lately items={stats.lately} />
      </Block>

      {(hasTopics || stats.unsolved.length > 0) && (
        <Block id="pattern-h" title="Pattern map" aside="where the failures cluster">
          <div className={`grid gap-8 ${hasTopics && stats.unsolved.length > 0 ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12" : ""}`}>
            {hasTopics && (
              <div>
                <h3 className="eyebrow mb-3">Weakest topics</h3>
                <Topics topics={stats.topics} />
              </div>
            )}
            {stats.unsolved.length > 0 && (
              <div>
                <h3 className="eyebrow mb-3">Never passed</h3>
                <ul className="space-y-2 text-sm">
                  {stats.unsolved.slice(0, 6).map((u) => (
                    <li key={u.slug} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0">
                      <ProblemLink slug={u.slug} title={u.title} />
                      <span className="mono text-xs text-ink-3">
                        {u.attempts} {u.attempts === 1 ? "try" : "tries"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Block>
      )}

      {analysis && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Block id="next-h" title="Do next">
              <ActionCards items={analysis.nextProblems.map((n) => ({ key: n.slug, title: <ProblemLink slug={n.slug} title={n.title} />, why: n.why }))} />
            </Block>
            <Block id="focus-h" title="Work on">
              <ActionCards items={analysis.focus.map((f) => ({ key: f.title, title: f.title, why: f.why }))} />
            </Block>
          </div>

          {analysis.mistakes.length > 0 && (
            <Block id="mistakes-h" title="Habits to break" aside="check these before every submit">
              <Habits items={analysis.mistakes} />
            </Block>
          )}
        </>
      )}

      <div className="space-y-3">
        {analysis && analysis.reviews.length > 0 && (
          <Fold title="Problem by problem" aside={`${analysis.reviews.length} reviewed · ${struggling} need work`}>
            <Reviews items={analysis.reviews} />
          </Fold>
        )}
        {stats.hardest.length > 0 && (
          <Fold title="Hardest problems" aside={`${stats.hardest.length}`}>
            <Hardest rows={stats.hardest} />
            <p className="meta mt-3">Counted up to the first pass. LeetCode doesn&apos;t record time before your first submit.</p>
          </Fold>
        )}
        {(stats.nearMisses.length > 0 || stats.errors.length > 0) && (
          <Fold title="Edge cases and errors" aside="what the test cases caught">
            <div className="grid gap-8 md:grid-cols-2">
              {stats.nearMisses.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-ink-2">Wrong answers that passed at least 80% of tests, so a missed edge case.</p>
                  <ul className="space-y-1.5 text-sm">
                    {stats.nearMisses.map((n) => (
                      <li key={`${n.slug}-${n.at}`}>
                        <ProblemLink slug={n.slug} title={n.title} />: {n.passed} of {n.of}, failed on <code className="break-all">{n.failedOn}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {stats.errors.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-ink-2">Most common error messages.</p>
                  <ul className="space-y-1.5 text-sm">
                    {stats.errors.map((e) => (
                      <li key={e.message}>
                        {e.count}x <code className="break-all">{e.message}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Fold>
        )}
        {analysis && (
          <Fold title="Claude's full reasoning">
            <p className="max-w-3xl whitespace-pre-line leading-relaxed">{analysis.summary}</p>
          </Fold>
        )}
      </div>
    </div>
  );
}
