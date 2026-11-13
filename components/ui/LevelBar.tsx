const LEVELS = [
  { key: "retained", label: "Retained", color: "bg-good" },
  { key: "applied", label: "Applied", color: "bg-cyan" },
  { key: "understood", label: "Understood", color: "bg-accent" },
  { key: "exposed", label: "Exposed", color: "bg-[#3f5075]" },
] as const;

export type LevelCounts = Record<(typeof LEVELS)[number]["key"], number>;

/** Stacked bar of concepts per knowledge level (Exposed / Understood / Applied / Retained) plus a legend. */
export function LevelBar({ counts }: { counts: LevelCounts }) {
  const total = LEVELS.reduce((n, l) => n + counts[l.key], 0);
  return (
    <div>
      <div className="mb-4 flex h-2.5 gap-[3px]" role="img" aria-label={LEVELS.map((l) => `${counts[l.key]} ${l.label}`).join(", ")}>
        {total === 0 ? (
          <i className="block flex-1 rounded-[3px] bg-line-2" />
        ) : (
          LEVELS.filter((l) => counts[l.key] > 0).map((l) => <i key={l.key} className={`block rounded-[3px] ${l.color}`} style={{ flex: counts[l.key] }} />)
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
        {LEVELS.map((l) => (
          <div key={l.key} className="flex items-center gap-2 text-ink-2">
            <i aria-hidden className={`h-2 w-2 shrink-0 rounded-[3px] ${l.color}`} />
            <dt>{l.label}</dt>
            <dd className="mono ml-auto text-ink">{counts[l.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
