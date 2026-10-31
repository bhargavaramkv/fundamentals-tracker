import { MIXED_SOURCES } from "./sources";
import { classifyCategory, importanceOf, isMinor, scoreStory } from "./rank";
import { canonicalUrl, contentHash, eventKeys, sha, slugify, titleSimilarity } from "./text";
import type { FeedItem, RadarStory, SourceDef, StorySource } from "./types";

export interface MergeStats {
  newStories: number;
  updatedStories: number;
  corroborated: number;
  unchanged: number;
  skippedOld: number;
  skippedInvalid: number;
}

export interface MergeOptions {
  now: Date;
  /** Items published longer ago than this are ignored unless they update a known story (prevents backfill floods). */
  lookbackDays: number;
  sources: ReadonlyMap<string, SourceDef>;
}

const DAY = 86_400_000;
const CLUSTER_WINDOW = 3 * DAY;
const SAME_STORY = 0.6;

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");

function storySource(item: FeedItem, url: string, src: SourceDef): StorySource {
  return { sourceId: src.id, sourceName: src.name, title: item.title, url, publishedAt: item.publishedAt, credibility: src.credibility };
}

/** Recomputes score and importance in place (call after any change to sources, text or analysis). */
export function rescore(story: RadarStory, now: Date): void {
  story.score = scoreStory(
    {
      title: story.title,
      excerpt: story.excerpt,
      category: story.category,
      sources: story.sources,
      publishedAt: story.publishedAt,
      minor: story.minor,
      isKev: story.sources.some((s) => s.sourceId === "cisa-kev"),
      analysis: story.analysis,
    },
    // Freshness is judged at discovery, so a story's rank doesn't decay every time the store is rewritten.
    new Date(Math.min(now.getTime(), Date.parse(story.firstSeenAt))),
  );
  story.importance = importanceOf(story.score.total);
}

/**
 * Folds freshly fetched items into the stored stories:
 * - same canonical URL, same content: unchanged (only `lastSeenAt` moves);
 * - same canonical URL, edited content: a revision is recorded and the story is queued for re-analysis;
 * - different URL but the same event (shared CVE/GHSA id, or a near-identical title within 3 days): added as a
 *   corroborating source rather than a second story;
 * - otherwise a new story, keeping the source's original publication date.
 * Mutates and returns `stories`; the set of touched story ids drives rescoring and persistence.
 */
export function mergeItems(stories: RadarStory[], items: FeedItem[], opts: MergeOptions): { stories: RadarStory[]; touched: Set<string>; stats: MergeStats } {
  const { now } = opts;
  const nowIso = now.toISOString();
  const stats: MergeStats = { newStories: 0, updatedStories: 0, corroborated: 0, unchanged: 0, skippedOld: 0, skippedInvalid: 0 };
  const touched = new Set<string>();
  const byUrl = new Map<string, RadarStory>();
  const byKey = new Map<string, RadarStory>();
  const recent: RadarStory[] = [];

  const index = (s: RadarStory) => {
    for (const src of s.sources) byUrl.set(src.url, s);
    if (now.getTime() - Date.parse(s.publishedAt) < 30 * DAY) {
      recent.push(s);
      for (const k of eventKeys(`${s.title} ${s.excerpt}`)) if (!byKey.has(k)) byKey.set(k, s);
    }
  };
  stories.forEach(index);

  // Oldest first, so the earliest report of an event becomes the primary source.
  const ordered = [...items].sort((a, b) => (a.publishedAt ?? nowIso).localeCompare(b.publishedAt ?? nowIso));

  for (const item of ordered) {
    const src = opts.sources.get(item.sourceId);
    const url = canonicalUrl(item.url);
    if (!src || !url || !url.startsWith("https://")) {
      stats.skippedInvalid++;
      continue;
    }
    const hash = contentHash(item.title, item.excerpt);
    const known = byUrl.get(url);

    if (known) {
      known.lastSeenAt = nowIso;
      const entry = known.sources.find((x) => x.url === url);
      if (known.canonicalUrl === url && hash !== known.contentHash) {
        const reason = titleSimilarity(item.title, known.title) < 0.95 ? `Title changed from "${known.title}"` : "Source text edited";
        known.revisions.push({ at: nowIso, reason, contentHash: hash });
        known.contentHash = hash;
        known.title = item.title;
        known.excerpt = item.excerpt;
        known.updatedAt = item.updatedAt && item.updatedAt > (known.updatedAt ?? "") ? item.updatedAt : nowIso;
        if (entry) entry.title = item.title;
        if (known.status === "analysed" || known.status === "failed") {
          known.status = "pending";
          known.statusNote = "Source updated; re-analysis pending";
          known.attempts = 0;
        }
        stats.updatedStories++;
        touched.add(known.id);
      } else {
        stats.unchanged++;
      }
      continue;
    }

    const published = item.publishedAt ?? nowIso;
    if (now.getTime() - Date.parse(published) > opts.lookbackDays * DAY) {
      stats.skippedOld++;
      continue;
    }

    const keys = eventKeys(`${item.title} ${item.excerpt}`);
    const cluster =
      keys.map((k) => byKey.get(k)).find((s): s is RadarStory => Boolean(s)) ??
      recent.find((s) => Math.abs(Date.parse(s.publishedAt) - Date.parse(published)) <= CLUSTER_WINDOW && titleSimilarity(s.title, item.title) >= SAME_STORY);

    if (cluster) {
      if (!cluster.sources.some((x) => hostOf(x.url) === hostOf(url))) {
        cluster.sources.push(storySource(item, url, src));
        stats.corroborated++;
        touched.add(cluster.id);
      } else {
        stats.unchanged++;
      }
      cluster.lastSeenAt = nowIso;
      byUrl.set(url, cluster);
      continue;
    }

    const story: RadarStory = {
      id: `${published.slice(0, 10)}-${slugify(item.title, 50)}-${sha(url).slice(0, 6)}`,
      title: item.title,
      canonicalUrl: url,
      category: MIXED_SOURCES.has(src.id) ? classifyCategory(item.title, item.excerpt, src.category) : src.category,
      publishedAt: published,
      dateEstimated: item.publishedAt === null,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      updatedAt: null,
      revisions: [],
      contentHash: hash,
      excerpt: item.excerpt,
      sources: [storySource(item, url, src)],
      minor: isMinor(item.title),
      score: { total: 0, parts: [] },
      importance: "routine",
      status: "pending",
    };
    stories.push(story);
    index(story);
    stats.newStories++;
    touched.add(story.id);
  }

  for (const s of stories) if (touched.has(s.id)) rescore(s, now);
  return { stories, touched, stats };
}
