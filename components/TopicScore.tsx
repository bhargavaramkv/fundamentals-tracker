"use client";

import { buildProfile } from "@/lib/profile";
import type { Domain } from "@/lib/types";
import { useProgress } from "./ProgressProvider";

/** Small per-topic score badge for server-rendered lesson pages. */
export function TopicScore({ domain, topic }: { domain: Domain; topic: string }) {
  const { data, ready } = useProgress();
  if (!ready) return null;
  const answers = data.answers.filter((a) => a.domain === domain && a.topic === topic);
  if (answers.length === 0) return <span className="text-xs text-ink-3">not tested</span>;
  const stat = buildProfile(answers, [{ domain, topic }]).domains
    .find((d) => d.domain === domain)
    ?.topics.find((t) => t.topic === topic);
  if (!stat) return null;
  const tone = stat.score < 60 ? "text-bad" : stat.score >= 80 ? "text-good" : "text-ink-2";
  return (
    <span className={`text-xs tabular-nums ${tone}`}>
      {stat.score}% · {stat.correct}/{stat.attempts}
    </span>
  );
}
