"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { RADAR_CATEGORIES, RADAR_CATEGORY_LABELS, type Importance, type RadarCategory, type RadarListItem } from "@/lib/radar/types";
import { useRadarPrefs } from "./prefs";
import { CategoryTag, formatDateTime, formatDay, ImportanceTag } from "./ui";

export interface SourceProblem {
  name: string;
  error: string;
  failures: number;
}

interface Props {
  items: RadarListItem[];
  briefing: string[];
  briefingDate: string | null;
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  problems: SourceProblem[];
  sourceCount: number;
  /** Sources whose latest fetch succeeded (never-checked sources don't count). */
  healthyCount: number;
}

const PAGE = 40;
const STALE_HOURS = 30;
const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time" } as const;
type Range = keyof typeof RANGES | "custom";

// Minute-resolution clock for the freshness banner; null during the static render so the build and browser agree.
const subscribeClock = (cb: () => void) => {
  const t = setInterval(cb, 60_000);
  return () => clearInterval(t);
};
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;

function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, minuteNow, () => null);
}

function ago(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "less than an hour ago";
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export function RadarFeed({ items, briefing, briefingDate, lastSuccessAt, lastRunAt, problems, sourceCount, healthyCount }: Props) {
  const now = useNow();
  const { prefs, toggleBookmark } = useRadarPrefs();
  const [query, setQuery] = useState("");
  const [cats, setCats] = useState<Set<RadarCategory>>(new Set());
  const [range, setRange] = useState<Range>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minImportance, setMinImportance] = useState<Importance>("routine");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [showMinor, setShowMinor] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [sort, setSort] = useState<"newest" | "ranked">("newest");

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const brief = briefing.map((id) => byId.get(id)).filter((x): x is RadarListItem => Boolean(x));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = { routine: 0, notable: 1, high: 2 } as const;
    const cutoff = range !== "custom" && range !== "all" && now !== null ? now - Number(range) * 86_400_000 : null;
    return items.filter((i) => {
      if (cats.size && !cats.has(i.category)) return false;
      if (!showMinor && i.minor) return false;
      if (rank[i.importance] < rank[minImportance]) return false;
      if (unreadOnly && prefs.read[i.id]) return false;
      if (savedOnly && !prefs.bookmarks[i.id]) return false;
      if (cutoff !== null && Date.parse(i.publishedAt) < cutoff) return false;
      if (range === "custom") {
        const day = i.publishedAt.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
      }
      if (q && !`${i.title} ${i.summary} ${i.sourceName} ${RADAR_CATEGORY_LABELS[i.category]}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (sort === "ranked" ? b.score - a.score : 0) || b.publishedAt.localeCompare(a.publishedAt));
  }, [items, query, cats, range, from, to, minImportance, unreadOnly, savedOnly, showMinor, prefs, now, sort]);

  const stale = lastSuccessAt === null || (now !== null && now - Date.parse(lastSuccessAt) > STALE_HOURS * 3_600_000);
  const toggleCat = (c: RadarCategory) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <div className="space-y-10">
      <section aria-label="Feed status" className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-ink-3">
        {lastSuccessAt ? (
          <span className={stale && now !== null ? "text-warn" : undefined} role="status">
            <span aria-hidden>{stale && now !== null ? "▲" : "●"}</span> Last updated {formatDateTime(lastSuccessAt)}
            {now !== null && ` (${ago(now - Date.parse(lastSuccessAt))})`}
            {stale && now !== null && " · stale: the daily update hasn't succeeded since"}
          </span>
        ) : (
          <span className="text-warn" role="status">▲ No successful update yet</span>
        )}
        {lastRunAt && lastRunAt !== lastSuccessAt && <span className="text-bad">Last attempt {formatDateTime(lastRunAt)} failed</span>}
        <span>
          {healthyCount}/{sourceCount} sources healthy
        </span>
        {problems.length > 0 && (
          <details className="w-full">
            <summary className="cursor-pointer text-ink-2 hover:text-ink">{problems.length} source{problems.length === 1 ? "" : "s"} failing</summary>
            <ul className="mt-2 space-y-1">
              {problems.map((p) => (
                <li key={p.name}>
                  <span className="text-ink-2">{p.name}</span>: {p.error} ({p.failures} run{p.failures === 1 ? "" : "s"} in a row)
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {brief.length > 0 && (
        <section aria-labelledby="brief-h">
          <div className="section-head">
            <h2 id="brief-h">Daily briefing</h2>
            {briefingDate && <span className="font-mono text-xs text-ink-3">{formatDay(briefingDate)}</span>}
          </div>
          <ol className="mt-1 divide-y divide-line">
            {brief.map((i, n) => (
              <li key={i.id} className="flex gap-4 py-4">
                <span className="w-6 shrink-0 pt-0.5 font-mono text-sm text-ink-3">{String(n + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <CategoryTag category={i.category} short />
                    <ImportanceTag importance={i.importance} score={i.score} />
                  </div>
                  <Link href={`/radar/${i.id}/`} className="mt-1 block text-lg font-semibold leading-snug hover:text-accent-text">
                    {i.title}
                  </Link>
                  <p className="mt-1 text-sm text-ink-2">{i.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="feed-h">
        <div className="section-head">
          <h2 id="feed-h">All stories</h2>
          <span className="font-mono text-xs text-ink-3" role="status">
            {filtered.length} of {items.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="sr-only">Search stories</span>
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search headlines, summaries and sources" className="field text-sm" />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
            {RADAR_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cats.has(c)}
                onClick={() => { toggleCat(c); setLimit(PAGE); }}
                className={`chip chip-btn cursor-pointer ${cats.has(c) ? "border-accent bg-accent/10 text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                <CategoryTag category={c} short />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-3">Published</span>
              <select value={range} onChange={(e) => { setRange(e.target.value as Range); setLimit(PAGE); }} className="field h-10 w-auto pr-8">
                {Object.entries(RANGES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
                <option value="custom">Custom range</option>
              </select>
            </label>
            {range === "custom" && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-3">From</span>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field h-10 w-auto" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-3">To</span>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field h-10 w-auto" />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-3">Importance</span>
              <select value={minImportance} onChange={(e) => setMinImportance(e.target.value as Importance)} className="field h-10 w-auto pr-8">
                <option value="routine">All</option>
                <option value="notable">Notable and up</option>
                <option value="high">High only</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-3">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "ranked")} className="field h-10 w-auto pr-8">
                <option value="newest">Newest first</option>
                <option value="ranked">Highest ranked</option>
              </select>
            </label>
            {[
              ["Unread", unreadOnly, setUnreadOnly],
              ["Bookmarked", savedOnly, setSavedOnly],
              ["Include minor updates", showMinor, setShowMinor],
            ].map(([label, value, set]) => (
              <label key={label as string} className="tap flex cursor-pointer items-center gap-2 text-ink-2">
                <input type="checkbox" checked={value as boolean} onChange={(e) => (set as (v: boolean) => void)(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                {label as string}
              </label>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-8 text-sm text-ink-2">{items.length === 0 ? "No stories yet. The first scheduled update fills this feed." : "No stories match these filters."}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {filtered.slice(0, limit).map((i) => {
              const read = Boolean(prefs.read[i.id]);
              const saved = Boolean(prefs.bookmarks[i.id]);
              return (
                <li key={i.id} className="flex gap-3 py-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <CategoryTag category={i.category} short />
                      <ImportanceTag importance={i.importance} score={i.score} />
                      {!read && <span className="tag bg-accent/10 text-accent-text">New</span>}
                      {i.updatedAt && <span className="tag bg-surface-2 text-ink-2">Updated</span>}
                      {!i.analysed && <span className="text-xs text-ink-3">analysis pending</span>}
                    </div>
                    <Link href={`/radar/${i.id}/`} className={`mt-1.5 block font-semibold leading-snug hover:text-accent-text ${read ? "text-ink-2" : "text-ink"} sm:text-lg`}>
                      {i.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-2">{i.summary}</p>
                    <p className="mt-1.5 font-mono text-xs text-ink-3">
                      {formatDay(i.publishedAt)} · {i.sourceName}
                      {i.sourceCount > 1 && ` +${i.sourceCount - 1} more`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleBookmark(i.id)}
                    aria-pressed={saved}
                    aria-label={saved ? `Remove bookmark: ${i.title}` : `Bookmark: ${i.title}`}
                    className={`tap -mr-2 h-10 w-10 shrink-0 self-start rounded-md hover:bg-surface-2 ${saved ? "text-accent-text" : "text-ink-3"}`}
                  >
                    <BookmarkIcon filled={saved} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {filtered.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="btn btn-secondary mt-6">
            Show {Math.min(PAGE, filtered.length - limit)} more
          </button>
        )}
      </section>
    </div>
  );
}

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} className="mx-auto" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  );
}
