"use client";

import { useEffect, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/activity";

const H = 220;
const PAD = { top: 16, right: 40, bottom: 28, left: 36 };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Single-series line of session scores over time, with a hover tooltip and a table view. */
export function ScoreChart({ points }: { points: HistoryPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  // Draw in real pixels (not a scaled viewBox) so axis text stays legible on phones.
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable, points.length]);

  if (points.length === 0) {
    return <p className="text-sm text-ink-3">Finish a session to start your score history.</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  // Even spacing by session keeps dense practice days readable; dates live on the axis and tooltip.
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (score: number) => PAD.top + innerH - (score / 100) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const hp = hover === null ? null : points[hover];

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setAsTable((v) => !v)} className="btn btn-ghost btn-muted -mr-2 !min-h-9 !px-2 !text-xs">
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr>
                <th className="py-1 font-normal">Date</th>
                <th className="py-1 font-normal">Mode</th>
                <th className="py-1 text-right font-normal">Questions</th>
                <th className="py-1 text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.at} className="border-t border-line">
                  <td className="py-1.5">{new Date(p.at).toLocaleString()}</td>
                  <td className="py-1.5 capitalize text-ink-2">{p.mode}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.total}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.score}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" ref={boxRef}>
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="block"
            role="img"
            aria-label={`Session score history, ${points.length} sessions, latest ${last.score}%`}
            onMouseLeave={() => setHover(null)}
          >
            {[0, 50, 100].map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)">
                  {t}
                </text>
              </g>
            ))}
            {labelIdx.map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-3)">
                {formatDate(points[i].at)}
              </text>
            ))}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--text-3)" strokeWidth={1} />
            )}
            <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <circle
                key={p.at}
                cx={x(i)}
                cy={y(p.score)}
                r={hover === i || i === points.length - 1 ? 5 : 4}
                fill="var(--series-1)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
            <text x={x(points.length - 1) + 8} y={y(last.score)} dy="0.32em" fontSize={12} fill="var(--text)">
              {last.score}%
            </text>
            {/* Wide invisible hit targets, one per session. */}
            {points.map((p, i) => {
              const half = points.length === 1 ? innerW / 2 : innerW / (points.length - 1) / 2;
              return (
                <rect
                  key={`hit-${p.at}`}
                  x={x(i) - half}
                  y={PAD.top}
                  width={half * 2}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onTouchStart={() => setHover(i)}
                />
              );
            })}
          </svg>
          {hp && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm"
              style={{
                left: `${(x(hover) / W) * 100}%`,
                transform: hover > points.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              }}
            >
              <p className="font-medium text-ink">{hp.score}%</p>
              <p className="text-ink-2">
                {new Date(hp.at).toLocaleString()} · {hp.mode} · {hp.total} q
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
