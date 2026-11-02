import type { ReactNode } from "react";
import type { CodingAnalysis, CodingStats, LeetCodePullStatus } from "@/lib/leetcode-history";

const SHORT: Record<string, string> = { "Wrong Answer": "wrong answer", "Runtime Error": "runtime error", "Time Limit Exceeded": "time limit", "Compile Error": "compile error", "Memory Limit Exceeded": "memory limit" };
const VERDICT = { good: "text-good", improve: "text-warn", struggling: "text-bad" } as const;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id}>{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProblemLink({ slug, title }: { slug: string; title: string }) {
  return (
    <a href={`https://leetcode.com/problems/${slug}/`} target="_blank" rel="noreferrer" className="text-accent-text hover:underline">
      {title}
    </a>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-ink-2">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="py-2 pr-4">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CodingInsightsView({ stats, analysis, status }: { stats: CodingStats; analysis: CodingAnalysis | null; status: LeetCodePullStatus | null }) {
  const alert = status && !status.ok && (
    <p role="alert" className="text-bad">
      {status.reason === "signed-out" ? "LeetCode sign-in expired, so new work isn't arriving. Update the LEETCODE_SESSION and LEETCODE_CSRF secrets in your data repo." : `Last night's LeetCode pull failed: ${status.message}`}
    </p>
  );
  if (stats.total === 0) {
    return (
      <div className="space-y-4">
        {alert}
        <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">Your first LeetCode pull hasn&apos;t arrived yet. It runs every night around midnight India time.</p>
      </div>
    );
  }
  const tiles = [
    [String(stats.total), "submissions"],
    [String(stats.problems), "problems"],
    [pct(stats.accepted / stats.total), "accepted"],
    ...(stats.recent ? [[`${Math.round(stats.recent.runtimePercentile)}%`, `of solutions beaten on speed, last ${stats.recent.count} accepted`]] : []),
  ];
  return (
    <div className="space-y-12">
      {alert}

      <div className="flex flex-wrap gap-x-10 gap-y-4">
        {tiles.map(([value, label]) => (
          <div key={label}>
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-sm text-ink-2">{label}</div>
          </div>
        ))}
      </div>

      {analysis ? (
        <>
          <Section id="assessment-h" title="Claude's assessment">
            <p className="max-w-2xl whitespace-pre-line text-[17px] leading-relaxed">{analysis.summary}</p>
            <p className="meta mt-3">Reviewed {day(analysis.generatedAt)}</p>
          </Section>

          <Section id="focus-h" title="What to work on">
            <ol className="max-w-2xl space-y-4">
              {analysis.focus.map((f) => (
                <li key={f.title}>
                  <div className="font-medium">{f.title}</div>
                  <p className="text-ink-2">{f.why}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="next-h" title="Do next">
            <ul className="max-w-2xl space-y-3">
              {analysis.nextProblems.map((n) => (
                <li key={n.slug}>
                  <ProblemLink slug={n.slug} title={n.title} />
                  <p className="text-sm text-ink-2">{n.why}</p>
                </li>
              ))}
            </ul>
          </Section>

          {analysis.mistakes.length > 0 && (
            <Section id="mistakes-h" title="Mistakes you repeat">
              <ul className="max-w-2xl space-y-5">
                {analysis.mistakes.map((m) => (
                  <li key={m.pattern}>
                    <div className="font-medium">{m.pattern}</div>
                    <p className="text-ink-2">{m.detail}</p>
                    <p className="mt-1 text-sm">
                      <span className="font-medium">Before you submit:</span> {m.check}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      ) : (
        <p className="max-w-2xl text-ink-2">Claude reviews your code at the next nightly run, around 1:00 AM India time. Until then, these are your numbers.</p>
      )}

      <Section id="hardest-h" title="Where you struggled most">
        <Table
          head={["Problem", "Attempts", "Accepted on try", "Failures", "First submit to accept"]}
          rows={stats.hardest.map((h) => [
            <ProblemLink key={h.slug} slug={h.slug} title={h.title} />,
            h.attempts,
            h.acceptedOnTry ?? "Not yet",
            h.failures.map((f) => `${f.count} ${SHORT[f.status] ?? f.status}`).join(", "),
            h.minutesToAccept === null || h.acceptedOnTry === 1 ? "-" : `${h.minutesToAccept} min`,
          ])}
        />
        <p className="meta mt-3">LeetCode doesn&apos;t record time before your first submit, so that time isn&apos;t included.</p>
      </Section>

      {stats.topics.length > 0 && (
        <Section id="topics-h" title="By topic">
          <Table head={["Topic", "Problems", "Attempts per problem", "Failed submissions"]} rows={stats.topics.map((t) => [t.tag.replaceAll("-", " "), t.problems, t.attemptsPerProblem.toFixed(1), pct(t.failureRate)])} />
        </Section>
      )}

      <Section id="trend-h" title="Getting it right first time">
        <Table head={["Quarter", "New problems", "Accepted first try", "Average attempts"]} rows={stats.quarters.map((q) => [q.quarter, q.problems, `${q.firstTry} of ${q.problems}`, q.avgAttempts === null ? "-" : q.avgAttempts.toFixed(1)])} />
      </Section>

      {stats.nearMisses.length > 0 && (
        <Section id="near-h" title="Nearly right">
          <p className="mb-3 max-w-2xl text-sm text-ink-2">Wrong answers that passed at least 80% of tests. These usually mean a missed edge case, not a wrong approach.</p>
          <ul className="space-y-2 text-sm">
            {stats.nearMisses.map((n) => (
              <li key={`${n.slug}-${n.at}`}>
                <ProblemLink slug={n.slug} title={n.title} />: {n.passed} of {n.of}, failed on <code className="break-all">{n.failedOn}</code>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {stats.errors.length > 0 && (
        <Section id="errors-h" title="Most common errors">
          <ul className="space-y-2 text-sm">
            {stats.errors.map((e) => (
              <li key={e.message}>
                {e.count}x <code className="break-all">{e.message}</code>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {analysis && analysis.reviews.length > 0 && (
        <Section id="reviews-h" title="Problem by problem">
          <ul className="divide-y divide-line border-t border-line">
            {analysis.reviews.map((r) => (
              <li key={r.slug} className="py-3">
                <ProblemLink slug={r.slug} title={r.title} /> <span className={`text-sm ${VERDICT[r.verdict]}`}>{r.verdict}</span>
                <p className="mt-1 max-w-2xl text-sm text-ink-2">{r.note}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
