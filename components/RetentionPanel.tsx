"use client";

import { computeRetention, GUESS_MS, MIN_FOR_RATE, RECALL_GAP_DAYS, TREND_WINDOW_DAYS, type Tally } from "@/lib/retention";
import type { ProgressData } from "@/lib/types";
import { useNow } from "./useNow";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function Stat({ label, t, hint }: { label: string; t: Tally; hint: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5">
        {t.rate !== null ? (
          <span className="text-2xl font-bold tabular-nums">{t.rate}%</span>
        ) : (
          <span className="text-sm text-ink-2">{t.attempts === 0 ? "No data yet" : `${t.attempts} of ${MIN_FOR_RATE} needed`}</span>
        )}
        <span className="block text-xs text-ink-3">{t.rate !== null ? `${t.correct} of ${t.attempts} · ${hint}` : hint}</span>
      </dd>
    </div>
  );
}

/** Whether learning is sticking: delayed recall and first-sight accuracy, from answers alone. */
export function RetentionPanel({ data, titleOf }: { data: ProgressData; titleOf: (key: string) => string }) {
  const now = useNow();
  if (now === null || data.answers.length === 0) return null;
  const r = computeRetention(data.answers, now);
  const weakest = r.byTopic.filter((t) => t.recall.rate !== null).sort((a, b) => (a.recall.rate ?? 0) - (b.recall.rate ?? 0))[0];
  const trend = r.firstSightTrend;
  return (
    <section aria-labelledby="retention-h">
      <div className="section-head">
        <h2 id="retention-h">Retention</h2>
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <Stat label="Delayed recall" t={r.recall} hint={`right ${RECALL_GAP_DAYS}+ days later`} />
        <Stat label="First sight" t={r.firstSight} hint="right on a new question" />
      </dl>
      <div className="mt-3 space-y-1 text-sm text-ink-2">
        {r.firstRecallAt && <p>Recall is measured when a question you answered comes back {RECALL_GAP_DAYS}+ days later. The first chance is {shortDate(r.firstRecallAt)}.</p>}
        {trend && (
          <p>
            New questions, last {TREND_WINDOW_DAYS} days: {trend.recent}% against {trend.before}% before{" "}
            {trend.recent > trend.before ? "(improving)" : trend.recent < trend.before ? "(slipping)" : "(steady)"}.
          </p>
        )}
        {weakest && weakest.recall.rate !== null && weakest.recall.rate < 70 && (
          <p>
            Fading most: {titleOf(weakest.key)}, {weakest.recall.rate}% on recall.
          </p>
        )}
        {r.guesses > 0 && (
          <p className="text-xs text-ink-3">
            {r.guesses} {r.guesses === 1 ? "answer" : "answers"} under {GUESS_MS / 1000}s left out as likely guesses.
          </p>
        )}
      </div>
    </section>
  );
}
