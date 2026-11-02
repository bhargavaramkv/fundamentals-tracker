import fs from "node:fs";
import path from "node:path";
import { buildFeed } from "./feed";
import { normalizeStory } from "./merge";
import type { RadarState, RadarStory, RunLog } from "./types";

/*
 * On-disk layout (the `radar-data` branch, checked out at content/radar for builds):
 *   stories/YYYY-MM.json   stories by publication month, newest first (full history, never pruned)
 *   state.json             last run, last success, per-source health
 *   feed.json              recent stories for the site to read at runtime (public, no secrets)
 *   runs/YYYY-MM.json      one log entry per pipeline run
 */

export const emptyState = (): RadarState => ({ version: 1, lastRunAt: null, lastSuccessAt: null, sources: {} });

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 1)}\n`);
  fs.renameSync(tmp, file);
}

export function readStories(dir: string): RadarStory[] {
  const storiesDir = path.join(dir, "stories");
  if (!fs.existsSync(storiesDir)) return [];
  return fs
    .readdirSync(storiesDir)
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .sort()
    .flatMap((f) => readJson<RadarStory[]>(path.join(storiesDir, f), []))
    .map(normalizeStory);
}

export function readState(dir: string): RadarState {
  return readJson(path.join(dir, "state.json"), emptyState());
}

export function readRuns(dir: string, limit = 30): RunLog[] {
  const runsDir = path.join(dir, "runs");
  if (!fs.existsSync(runsDir)) return [];
  return fs
    .readdirSync(runsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => readJson<RunLog[]>(path.join(runsDir, f), []))
    .slice(-limit);
}

export function writeStore(dir: string, stories: RadarStory[], state: RadarState, run: RunLog): void {
  const byMonth = new Map<string, RadarStory[]>();
  for (const s of stories) {
    const month = s.publishedAt.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), s]);
  }
  for (const [month, list] of byMonth) {
    list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
    writeJsonAtomic(path.join(dir, "stories", `${month}.json`), list);
  }
  writeJsonAtomic(path.join(dir, "state.json"), state);
  writeJsonAtomic(path.join(dir, "feed.json"), buildFeed(stories, state, new Date(run.finishedAt)));
  const runFile = path.join(dir, "runs", `${run.startedAt.slice(0, 7)}.json`);
  writeJsonAtomic(runFile, [...readJson<RunLog[]>(runFile, []), run]);
}
