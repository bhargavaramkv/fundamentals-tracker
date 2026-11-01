import { SOURCES } from "./sources";
import { truncate } from "./text";
import type { RadarFeed, RadarListItem, RadarState, RadarStory, SourceProblem } from "./types";
import { whyItMatters } from "./why";

const DAY = 86_400_000;
/** The live feed holds this much history; older stories stay on the pages built into the site. */
const FEED_DAYS = 14;
const FEED_MAX = 300;

/** Feed text without the boilerplate some sources append to every entry. */
export function displayExcerpt(s: Pick<RadarStory, "excerpt">): string {
  return s.excerpt.split(/\s*Required action:/)[0].trim();
}

export function toListItem(s: RadarStory): RadarListItem {
  const why = whyItMatters(s);
  return {
    id: s.id,
    title: s.analysis?.headline ?? s.title,
    summary: s.analysis?.summary ?? truncate(displayExcerpt(s), 280),
    category: s.category,
    publishedAt: s.publishedAt,
    dateEstimated: s.dateEstimated,
    firstSeenAt: s.firstSeenAt,
    updatedAt: s.updatedAt,
    importance: s.importance,
    score: s.score.total,
    minor: s.minor || Boolean(s.offTopic),
    analysed: Boolean(s.analysis),
    url: s.canonicalUrl,
    sourceName: s.sources[0].sourceName,
    sourceCount: new Set(s.sources.map((x) => new URL(x.url).hostname)).size,
    related: s.analysis?.relatedTopics ?? [],
    why: why?.text ?? null,
    whyKind: why?.kind ?? null,
  };
}

/** Stories that belong in lists: duplicates are folded into their cluster's leader. */
export const listable = (s: RadarStory) => !s.duplicateOf;

/**
 * The briefing: the strongest recent stories, limited per source and per category so one publisher or topic can't fill
 * it. Looks back from the latest run, widening only when the last run found little.
 */
export function selectBriefing(stories: RadarStory[], lastSuccessAt: string | null, limit = 5): string[] {
  const anchor = lastSuccessAt ? Date.parse(lastSuccessAt) : Math.max(0, ...stories.map((s) => Date.parse(s.firstSeenAt)));
  const eligible = stories.filter((s) => listable(s) && !s.minor && !s.offTopic);
  for (const days of [2, 4, 7]) {
    const pool = eligible
      .filter((s) => Date.parse(s.firstSeenAt) >= anchor - days * DAY)
      .sort((a, b) => Number(Boolean(b.analysis)) - Number(Boolean(a.analysis)) || b.score.total - a.score.total);
    const picked: RadarStory[] = [];
    const perSource = new Map<string, number>();
    const perCategory = new Map<string, number>();
    for (const s of pool) {
      if (picked.length >= limit) break;
      const src = s.sources[0].sourceId;
      if ((perSource.get(src) ?? 0) >= 1 || (perCategory.get(s.category) ?? 0) >= 2) continue;
      picked.push(s);
      perSource.set(src, (perSource.get(src) ?? 0) + 1);
      perCategory.set(s.category, (perCategory.get(s.category) ?? 0) + 1);
    }
    if (picked.length >= Math.min(limit, 3) || days === 7) return picked.map((s) => s.id);
  }
  return [];
}

export function sourceProblems(state: RadarState): SourceProblem[] {
  return SOURCES.flatMap((s) => {
    const h = state.sources[s.id];
    return h && h.consecutiveFailures > 0 ? [{ name: s.name, error: h.lastError ?? "unknown error", failures: h.consecutiveFailures }] : [];
  });
}

/** The public, secret-free document the site reads at runtime (feed.json on the radar-data branch). */
export function buildFeed(stories: RadarStory[], state: RadarState, now: Date): RadarFeed {
  const from = now.getTime() - FEED_DAYS * DAY;
  const items = stories
    .filter((s) => listable(s) && Date.parse(s.publishedAt) >= from)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, FEED_MAX)
    .map(toListItem);
  return {
    version: 1,
    generatedAt: now.toISOString(),
    lastSuccessAt: state.lastSuccessAt,
    lastRunAt: state.lastRunAt,
    // Only sources that have been tried: one added since the last run isn't unhealthy, just not checked yet.
    sourceCount: SOURCES.filter((s) => state.sources[s.id]).length,
    healthyCount: SOURCES.filter((s) => state.sources[s.id]?.consecutiveFailures === 0).length,
    problems: sourceProblems(state),
    briefing: selectBriefing(stories, state.lastSuccessAt),
    items,
  };
}
