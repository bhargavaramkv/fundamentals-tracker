import { useId, type ReactNode } from "react";

/**
 * SVG ring. With `value` (0..1) it shows progress; without, an ambient sweep for "something is active" (no goal implied).
 * The centre takes children. The glow belongs to active rings only.
 */
export function Ring({ value, size = 208, stroke = 10, children }: { value?: number; size?: number; stroke?: number; children?: ReactNode }) {
  const id = useId();
  const r = 50 - stroke / 2;
  const c = 2 * Math.PI * r;
  const sweep = value === undefined;
  const arc = sweep ? c * 0.22 : c * Math.min(1, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#3b9bff" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(120,170,255,0.11)" strokeWidth={stroke} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          className={sweep ? "ring-sweep" : undefined}
          style={{ filter: "drop-shadow(0 0 3px rgba(34,211,238,0.7))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
