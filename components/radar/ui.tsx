import { RADAR_CATEGORY_LABELS, type Importance, type RadarCategory } from "@/lib/radar/types";

/** Category colours reuse the validated domain palette, always paired with a text label. */
export const CATEGORY_COLOR: Record<RadarCategory, string> = {
  "ai-ml": "var(--accent-2)",
  developer: "var(--d-dsa)",
  cloud: "var(--d-databases)",
  security: "var(--bad)",
  hardware: "var(--d-system-design)",
  research: "var(--d-oop)",
};

export function CategoryTag({ category, short = false }: { category: RadarCategory; short?: boolean }) {
  const label = RADAR_CATEGORY_LABELS[category];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[category] }} aria-hidden />
      {short ? label.split(" & ")[0] : label}
    </span>
  );
}

const IMPORTANCE: Record<Importance, { label: string; bars: number; style: string }> = {
  high: { label: "High", bars: 3, style: "bg-bad-bg text-bad" },
  notable: { label: "Notable", bars: 2, style: "bg-warn-bg text-warn" },
  routine: { label: "Routine", bars: 1, style: "bg-surface-2 text-ink-2" },
};

export function ImportanceTag({ importance, score }: { importance: Importance; score?: number }) {
  const i = IMPORTANCE[importance];
  return (
    <span className={`tag ${i.style}`} title={score !== undefined ? `Score ${score}/100` : undefined}>
      <span aria-hidden className="font-mono tracking-[-0.15em]">
        {"▮".repeat(i.bars)}
        <span className="opacity-30">{"▮".repeat(3 - i.bars)}</span>
      </span>{" "}
      {i.label}
      {score !== undefined && <span className="sr-only">, score {score} of 100</span>}
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
