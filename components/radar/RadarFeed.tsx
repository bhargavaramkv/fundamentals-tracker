"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { RADAR_CATEGORIES, RADAR_CATEGORY_LABELS, type Importance, type RadarCategory, type RadarFeed as Feed, type RadarListItem } from "@/lib/radar/types";
import { useLiveRadar, type LiveStatus } from "./live";
import { useRadarPrefs } from "./prefs";
import { formatDateTime, formatDay, ImportanceTag, CategoryTag } from "./ui";

const PAGE = 40;
/** Four runs a day: past this, at least two runs in a row have not succeeded. */
const STALE_HOURS = 14;
const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time" } as const;
type Range = keyof typeof RANGES | "custom";

// Minute-resolution clock for the freshness line; null during the static render so the build and browser agree.
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

export function RadarFeed({ build }: { build: Feed }) {
  const now = useNow();
  const { feed, status, refresh } = useLiveRadar(build);
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

  const items = feed.items;
  // Stories newer than this build have no page of their own yet, so they link straight to the original.
  const built = useMemo(() => new Set(build.items.map((i) => i.id)), [build.items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const brief = feed.briefing.map((id) => byId.get(id)).filter((x): x is RadarListItem => Boolean(x));
  const briefIds = useMemo(() => new Set(feed.briefing), [feed.briefing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = { routine: 0, notable: 1, high: 2 } as const;
    const cutoff = range !== "custom" && range !== "all" && now !== null ? now - Number(range) * 86_400_000 : null;
    return items
      .filter((i) => {
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
      })
      .sort((a, b) => (sort === "ranked" ? b.score - a.score : 0) || b.publishedAt.localeCompare(a.publishedAt));
  }, [items, query, cats, range, from, to, minImportance, unreadOnly, savedOnly, showMinor, prefs, now, sort]);

  // The briefing already leads the page; don't repeat its stories straight underneath it.
  const filtering = query !== "" || cats.size > 0 || unreadOnly || savedOnly || minImportance !== "routine" || sort !== "newest";
  const list = filtering ? filtered : filtered.filter((i) => !briefIds.has(i.id));

  const toggleCat = (c: RadarCategory) => {
    setLimit(PAGE);
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="space-y-12">
      <FeedStatus feed={feed} now={now} status={status} onRefresh={refresh} />

      {brief.length > 0 && (
        <section aria-labelledby="brief-h">
          <div className="section-head">
            <h2 id="brief-h">Briefing</h2>
            {feed.lastSuccessAt && <span className="meta">{formatDay(feed.lastSuccessAt)}</span>}
          </div>
          <ol className="divide-y divide-line">
            {brief.map((i) => (
              <li key={i.id} className="py-6 first:pt-4">
                <StoryRow item={i} built={built.has(i.id)} lead />
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="feed-h">
        <div className="section-head">
          <h2 id="feed-h">All stories</h2>
          <span className="meta" role="status">
            {list.length} {list.length === 1 ? "story" : "stories"}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="sr-only">Search stories</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Search headlines, summaries and sources"
              className="field text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-x-1 gap-y-1" role="group" aria-label="Filter by category">
            {RADAR_CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={cats.has(c)} onClick={() => toggleCat(c)} className="filter-btn">
                {RADAR_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <details className="group text-sm">
            <summary className="tap cursor-pointer text-ink-2 hover:text-ink">More filters</summary>
            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
              <label className="flex flex-col gap-1">
                <span className="meta">Published</span>
                <select
                  value={range}
                  onChange={(e) => {
                    setRange(e.target.value as Range);
                    setLimit(PAGE);
                  }}
                  className="field h-10 w-auto pr-8"
                >
                  {Object.entries(RANGES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                  <option value="custom">Custom range</option>
                </select>
              </label>
              {range === "custom" && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="meta">From</span>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field h-10 w-auto" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="meta">To</span>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field h-10 w-auto" />
                  </label>
                </>
              )}
              <label className="flex flex-col gap-1">
                <span className="meta">Importance</span>
                <select value={minImportance} onChange={(e) => setMinImportance(e.target.value as Importance)} className="field h-10 w-auto pr-8">
                  <option value="routine">All</option>
                  <option value="notable">Notable and up</option>
                  <option value="high">High only</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="meta">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "ranked")} className="field h-10 w-auto pr-8">
                  <option value="newest">Newest first</option>
                  <option value="ranked">Highest ranked</option>
                </select>
              </label>
              {(
                [
                  ["Unread", unreadOnly, setUnreadOnly],
                  ["Bookmarked", savedOnly, setSavedOnly],
                  ["Include minor and off-topic", showMinor, setShowMinor],
                ] as const
              ).map(([label, value, set]) => (
                <label key={label} className="tap flex cursor-pointer items-center gap-2 text-ink-2">
                  <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                  {label}
                </label>
              ))}
            </div>
          </details>
        </div>

        {list.length === 0 ? (
          <p className="mt-8 text-sm text-ink-2">
            {items.length === 0 ? "No stories yet. The next scheduled update fills this feed." : "No stories match these filters."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {list.slice(0, limit).map((i) => {
              const saved = Boolean(prefs.bookmarks[i.id]);
              return (
                <li key={i.id} className="flex gap-3 py-5">
                  <div className="min-w-0 flex-1">
                    <StoryRow item={i} built={built.has(i.id)} read={Boolean(prefs.read[i.id])} />
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
        {list.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="btn btn-secondary mt-6">
            Show {Math.min(PAGE, list.length - limit)} more
          </button>
        )}
      </section>
    </div>
  );
}

function FeedStatus({ feed, now, status, onRefresh }: { feed: Feed; now: number | null; status: LiveStatus; onRefresh: () => void }) {
  const { lastSuccessAt, lastRunAt, problems, sourceCount, healthyCount } = feed;
  const stale = lastSuccessAt === null || (now !== null && now - Date.parse(lastSuccessAt) > STALE_HOURS * 3_600_000);
  return (
    <section aria-label="Feed status" className="meta flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-line py-2.5">
      {lastSuccessAt ? (
        <span className={stale && now !== null ? "text-warn" : undefined} role="status">
          {stale && now !== null && <strong className="font-semibold">Stale. </strong>}
          Updated {formatDateTime(lastSuccessAt)}
          {now !== null && ` (${ago(now - Date.parse(lastSuccessAt))})`}
          {stale && now !== null && ". Recent updates haven't succeeded, so newer stories may be missing."}
        </span>
      ) : (
        <span className="text-warn" role="status">
          No successful update yet.
        </span>
      )}
      {lastRunAt && lastRunAt !== lastSuccessAt && <span className="text-bad">Last attempt {formatDateTime(lastRunAt)} failed.</span>}
      {status === "unavailable" && <span role="status">Couldn&apos;t reach the live feed, so this is the copy from the last deploy.</span>}
      <span>
        {healthyCount} of {sourceCount} sources healthy
      </span>
      <button type="button" onClick={onRefresh} disabled={status === "checking"} className="tap text-accent-text hover:underline disabled:opacity-50">
        {status === "checking" ? "Checking…" : "Check now"}
      </button>
      {problems.length > 0 && (
        <details className="w-full">
          <summary className="tap cursor-pointer text-ink-2 hover:text-ink">
            {problems.length} source{problems.length === 1 ? "" : "s"} failing
          </summary>
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
  );
}

/** One story: category, headline, summary, why it matters, source, date and the original link. */
export function StoryRow({ item: i, built, read = false, lead = false }: { item: RadarListItem; built: boolean; read?: boolean; lead?: boolean }) {
  const titleClass = `headline mt-1 block ${lead ? "text-2xl" : "text-xl"} ${read ? "text-ink-2" : "text-ink"} hover:text-accent-text`;
  return (
    <article>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <CategoryTag category={i.category} />
        <ImportanceTag importance={i.importance} score={i.score} />
        {i.updatedAt && <span className="meta">Updated</span>}
      </p>
      {built ? (
        <Link href={`/radar/${i.id}/`} className={titleClass}>
          {i.title}
        </Link>
      ) : (
        <a href={i.url} target="_blank" rel="noreferrer" className={titleClass}>
          {i.title} <span aria-hidden>↗</span>
        </a>
      )}
      {i.summary && <p className="mt-1.5 line-clamp-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{i.summary}</p>}
      {i.why && (
        <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed">
          <span className="font-semibold">Why it matters: </span>
          <span className="text-ink-2">{i.why}</span>
          <span className="meta ml-1.5">{i.whyKind === "ai" ? "AI-generated" : "Automatic note"}</span>
        </p>
      )}
      <p className="meta mt-2">
        {i.dateEstimated ? `Found ${formatDay(i.firstSeenAt)}` : formatDay(i.publishedAt)} · {i.sourceName}
        {i.sourceCount > 1 && ` and ${i.sourceCount - 1} more`} ·{" "}
        <a href={i.url} target="_blank" rel="noreferrer" className="text-accent-text hover:underline">
          Original article <span aria-hidden>↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </article>
  );
}

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} className="mx-auto" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  );
}
