import type { ReactNode } from "react";

/** A circular progress meter. `value` is 0..1; the label in the middle is optional. */
export function ProgressRing({ value, size = 56, stroke = 6, color = "var(--accent)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">{children}</span>}
    </span>
  );
}

/** A flame for the streak; grey until the streak is alive. */
export function Flame({ lit, size = 22 }: { lit: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2c.6 3.2 2.4 4.7 4 6.6 1.5 1.8 2.6 3.7 2.6 6.1A6.6 6.6 0 0 1 12 21.3a6.6 6.6 0 0 1-6.6-6.6c0-2.6 1.3-4.4 2.7-5.8.3 1.6 1.1 2.7 2.3 3.3C10 9 10.6 5.2 12 2z"
        fill={lit ? "#ff8a1f" : "var(--border)"}
      />
      <path d="M12 13.2c1.6 1.4 2.6 2.6 2.6 4.1a2.6 2.6 0 0 1-5.2 0c0-1.5 1-2.7 2.6-4.1z" fill={lit ? "#ffd43b" : "var(--surface-2)"} />
    </svg>
  );
}
