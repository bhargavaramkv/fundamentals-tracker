import type { ReactNode } from "react";

const TONES = {
  good: "border-good/25 bg-good/10 text-good",
  warn: "border-warn/25 bg-warn/10 text-warn",
  bad: "border-bad/30 bg-bad/10 text-bad",
  info: "border-accent/30 bg-accent/10 text-accent-text",
  neutral: "border-line-2 bg-[rgba(120,170,255,0.07)] text-ink-2",
} as const;

/** A status as text plus colour (never colour alone): synced, queued, failed, due ... */
export function StatusPill({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium ${TONES[tone]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
