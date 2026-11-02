import { RADAR_CATEGORY_LABELS, type Importance, type RadarCategory } from "@/lib/radar/types";

/** The category as a quiet text label; news is told apart by words, not a palette. */
export function CategoryTag({ category }: { category: RadarCategory; short?: boolean }) {
  return <span className="text-xs font-semibold tracking-wide text-accent-text">{RADAR_CATEGORY_LABELS[category]}</span>;
}

const IMPORTANCE: Record<Importance, { label: string; style: string } | null> = {
  high: { label: "High importance", style: "text-bad" },
  notable: { label: "Notable", style: "text-ink-2" },
  routine: null,
};

/** Routine stories carry no label, so a label means something when it appears. */
export function ImportanceTag({ importance, score }: { importance: Importance; score?: number }) {
  const i = IMPORTANCE[importance];
  if (!i) return null;
  return (
    <span className={`text-xs font-medium ${i.style}`} title={score !== undefined ? `Score ${score}/100` : undefined}>
      {i.label}
    </span>
  );
}

/** Dates are shown in IST, the owner's timezone, and computed the same way at build time and in the browser. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  });
}
