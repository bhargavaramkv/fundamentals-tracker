import "server-only";
import path from "node:path";
import { readRuns, readState, readStories } from "./store";
import type { RadarListItem, RadarState, RadarStory, RunLog } from "./types";
import { validateStory } from "./validate";

// Build-time only. The deploy workflow checks the radar-data branch out here; locally it may be absent.
const DIR = path.join(process.cwd(), "content", "radar");

let cache: RadarStory[] | null = null;

/** Every stored story, newest first. Invalid records are skipped (and reported) rather than breaking the build. */
export function getRadarStories(): RadarStory[] {
  if (cache) return cache;
  const out: RadarStory[] = [];
  for (const s of readStories(DIR)) {
    const errors = validateStory(s);
    if (errors.length) console.warn(`[radar] skipping ${String(s?.id)}: ${errors.join("; ")}`);
    else out.push(s);
  }
  cache = out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.score.total - a.score.total);
  return cache;
}

export function getRadarStory(id: string): RadarStory | null {
  return getRadarStories().find((s) => s.id === id) ?? null;
}

export function getRadarState(): RadarState {
  return readState(DIR);
}

export function getRadarRuns(limit = 7): RunLog[] {
  return readRuns(DIR, limit);
}

export function toListItem(s: RadarStory): RadarListItem {
  return {
    id: s.id,
    title: s.analysis?.headline ?? s.title,
    summary: s.analysis?.summary ?? s.excerpt.slice(0, 280),
    category: s.category,
    publishedAt: s.publishedAt,
    firstSeenAt: s.firstSeenAt,
    updatedAt: s.updatedAt,
    importance: s.importance,
    score: s.score.total,
    minor: s.minor,
    analysed: Boolean(s.analysis),
    sourceName: s.sources[0].sourceName,
    sourceCount: new Set(s.sources.map((x) => new URL(x.url).hostname)).size,
    related: s.analysis?.relatedTopics ?? [],
  };
}

/** Months (YYYY-MM) that have stories, newest first. */
export function getRadarMonths(): string[] {
  return [...new Set(getRadarStories().map((s) => s.publishedAt.slice(0, 7)))].sort().reverse();
}

/** Monday (UTC) of the ISO week containing the date, as YYYY-MM-DD. */
export function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
