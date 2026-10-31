import Link from "next/link";
import type { CSSProperties } from "react";
import { DOMAIN_LABELS, type DomainStat } from "@/lib/types";
import { DomainIcon, domainColor } from "./DomainIcon";

const SHORT: Record<DomainStat["domain"], string> = {
  dsa: "DSA",
  oop: "OOP & design",
  databases: "Databases",
  "system-design": "System design",
  web: "Web & networking",
};

// Geometry for the sm+ trail: six evenly spaced stops whose dot centers alternate between two heights.
const HEIGHT = 176;
const HIGH = 40;
const LOW = 72;
const stopY = (i: number) => (i % 2 === 0 ? HIGH : LOW);

function trailPath(stops: number): string {
  const w = 600 / stops;
  const pts = Array.from({ length: stops }, (_, i) => [w * (i + 0.5), stopY(i)]);
  return pts
    .map(([x, y], i) => {
      if (i === 0) return `M${x} ${y}`;
      const [px, py] = pts[i - 1];
      const mx = (px + x) / 2;
      return `C${mx} ${py} ${mx} ${y} ${x} ${y}`;
    })
    .join(" ");
}

/**
 * The five domains as a connected trail ending at a goal marker: the engine's next recommended step.
 * Order is the content order, not an unlock sequence: every node is open, and each shows its own
 * measured score and confidence (or "not tried"). Horizontal on sm+, a vertical list on phones.
 */
export function SkillPath({ domains, goal }: { domains: DomainStat[]; goal: { href: string; eyebrow: string; label: string } }) {
  const stops = domains.length + 1;
  const path = trailPath(stops);
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 600 ${HEIGHT}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block"
        aria-hidden
      >
        {/* Decorative ridgeline rising toward the goal: the quest backdrop, drawn rather than a raster image. */}
        <defs>
          <linearGradient id="skill-ridge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--text-3)" stopOpacity={0.16} />
            <stop offset="1" stopColor="var(--text-3)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d="M0 176V120L70 96L120 110L190 70L250 92L330 52L390 78L460 30L520 54L560 12L600 34V176Z"
          fill="url(#skill-ridge)"
        />
        <path
          d="M0 176V150L90 128L160 142L250 112L320 132L410 100L480 118L560 82L600 96V176Z"
          fill="url(#skill-ridge)"
        />
        <path d={path} fill="none" stroke="var(--border)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <path
          d={path}
          pathLength={1}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeDasharray="1"
          vectorEffect="non-scaling-stroke"
          className="skill-line-progress"
        />
      </svg>
      <ol
        className="relative grid gap-1 before:absolute before:top-6 before:bottom-6 before:left-[1.4375rem] before:w-0.5 before:bg-line sm:h-44 sm:grid-cols-6 sm:gap-0 sm:before:hidden"
      >
        {domains.map((d, i) => {
          const tried = d.attempts > 0;
          const topicsTried = d.topics.filter((t) => t.attempts > 0).length;
          const style = { "--node": domainColor(d.domain), "--dot-top": `${stopY(i) - 24}px` } as CSSProperties;
          return (
            <li key={d.domain} className="relative" style={style}>
              <Link
                href={`/lessons/#${d.domain}`}
                className="skill-node flex items-center gap-3 rounded-lg py-1.5 sm:flex-col sm:gap-2 sm:pt-[var(--dot-top)] sm:text-center"
                aria-label={`${DOMAIN_LABELS[d.domain]}: ${tried ? `${d.score}%, ${d.confidence} confidence, ${d.attempts} answers` : "not tried yet"}`}
              >
                <span
                  className="skill-dot relative z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-bg"
                  style={{ borderColor: tried ? "var(--node)" : "var(--border)" }}
                >
                  <DomainIcon domain={d.domain} size={40} round />
                </span>
                <span className="min-w-0 sm:px-1">
                  <span className="block text-sm font-semibold leading-tight">{SHORT[d.domain]}</span>
                  <span className="mt-0.5 block font-mono text-xs text-ink-3">
                    {tried ? (
                      <>
                        <span className="font-semibold text-ink tabular-nums">{d.score}%</span> · {d.confidence} conf.
                      </>
                    ) : (
                      "not tried"
                    )}
                  </span>
                  <span className="block text-[11px] text-ink-3">
                    {d.attempts} answer{d.attempts === 1 ? "" : "s"} · {topicsTried}/{d.topics.length} topics
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
        <li className="relative" style={{ "--dot-top": `${stopY(domains.length) - 24}px` } as CSSProperties}>
          <Link
            href={goal.href}
            className="skill-node flex items-center gap-3 rounded-lg py-1.5 sm:flex-col sm:gap-2 sm:pt-[var(--dot-top)] sm:text-center"
            style={{ "--node": "var(--accent)" } as CSSProperties}
          >
            <span className="skill-dot relative z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-bg text-accent-text">
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
              </svg>
            </span>
            <span className="min-w-0 sm:px-1">
              <span className="eyebrow block">{goal.eyebrow}</span>
              <span className="block text-sm font-semibold leading-tight text-accent-text">{goal.label}</span>
            </span>
          </Link>
        </li>
      </ol>
    </div>
  );
}
