/**
 * Tech Radar pipeline CLI (runs in the scheduled GitHub Action; see .github/workflows/radar.yml and docs/tech-radar.md).
 *
 *   npm run radar -- ingest  --data content/radar [--no-analyze] [--max-analyses 10] [--sources id,id] [--fixtures dir] [--now ISO] [--summary file]
 *   npm run radar -- pending --data content/radar [--limit 5]           # analysis queue + prompts, as JSON (manual/routine analysis)
 *   npm run radar -- apply   --data content/radar --file analyses.json  # validate and store [{ id, model, analysis }]
 *   npm run radar -- check   --data content/radar                       # validate every stored story
 *
 * ingest exits 0 when at least half the sources succeeded, 1 when more than half failed, 2 when none did.
 * Data is written in every case where something was fetched, so a partial run is never lost.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { createAnalyzer, systemPrompt, userPrompt, type Analyzer } from "../lib/radar/analyze";
import { createFetcher, HttpError, type FetchText } from "../lib/radar/fetch";
import { rescore } from "../lib/radar/merge";
import { runPipeline } from "../lib/radar/pipeline";
import { SOURCES } from "../lib/radar/sources";
import { readState, readStories, writeStore } from "../lib/radar/store";
import type { RunLog, TopicRef } from "../lib/radar/types";
import { validateAnalysis, validateStory } from "../lib/radar/validate";
import { DOMAINS } from "../lib/types";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const command = args[0];
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(`--${name}`);
const dataDir = path.resolve(arg("data") ?? path.join(root, "content/radar"));

function topics(): TopicRef[] {
  return DOMAINS.flatMap((domain) => {
    const dir = path.join(root, "content/lessons", domain);
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ domain, topic: f.replace(/\.md$/, ""), title: String(matter(fs.readFileSync(path.join(dir, f), "utf8")).data.title ?? f) }));
  });
}

function fixtureFetcher(dir: string): FetchText {
  return async (url) => {
    const source = SOURCES.find((s) => url === s.url || url.startsWith(`https://api.github.com/repos/${s.url}/`));
    const file = source && [".xml", ".json"].map((ext) => path.join(dir, `${source.id}${ext}`)).find((f) => fs.existsSync(f));
    if (!file) throw new HttpError("no fixture", 404);
    return fs.readFileSync(file, "utf8");
  };
}

function summarize(run: RunLog): string {
  const lines = [
    `### Tech Radar run ${run.startedAt}`,
    "",
    `| Sources ok | Sources failed | Items | New | Updated | Corroborated | Unchanged | Analysed | Analysis failed |`,
    `|---|---|---|---|---|---|---|---|---|`,
    `| ${run.sourcesOk} | ${run.sourcesFailed} | ${run.itemsFetched} | ${run.newStories} | ${run.updatedStories} | ${run.corroborated} | ${run.unchanged} | ${run.analysed} | ${run.analysisFailed} |`,
  ];
  if (run.analysisSkipped) lines.push("", `**Analysis skipped:** ${run.analysisSkipped}`);
  if (run.errors.length) lines.push("", "**Errors**", "", ...run.errors.map((e) => `- ${e}`));
  return `${lines.join("\n")}\n`;
}

async function ingest(): Promise<number> {
  const now = arg("now") ? new Date(arg("now") as string) : new Date();
  const only = arg("sources")?.split(",");
  const sources = only ? SOURCES.filter((s) => only.includes(s.id)) : SOURCES;
  const fixtures = arg("fixtures");
  const fetchText = fixtures
    ? fixtureFetcher(path.resolve(fixtures))
    : createFetcher({
        userAgent: "FundamentalsTechRadar/1.0 (+https://github.com/bhargavaramkv/fundamentals-tracker)",
        minIntervalMs: 1500,
        timeoutMs: 20_000,
        retries: 2,
        githubToken: process.env.GITHUB_TOKEN,
        maxBytes: 8_000_000,
      });

  const topicList = topics();
  let analyze: Analyzer | undefined;
  let analysisSkippedReason: string | undefined;
  if (flag("no-analyze")) analysisSkippedReason = "--no-analyze";
  else if (!process.env.ANTHROPIC_API_KEY) analysisSkippedReason = "ANTHROPIC_API_KEY is not set; stories are ranked but not analysed";
  else analyze = createAnalyzer({ apiKey: process.env.ANTHROPIC_API_KEY, topics: topicList });

  const stories = readStories(dataDir);
  const state = readState(dataDir);
  const result = await runPipeline(stories, state, {
    now,
    sources,
    fetchText,
    analyze,
    analysisSkippedReason,
    lessonKeys: new Set(topicList.map((t) => `${t.domain}/${t.topic}`)),
    maxAnalyses: Number(arg("max-analyses") ?? process.env.RADAR_MAX_ANALYSES ?? 10),
    minScoreForAnalysis: 40,
    lookbackDays: Number(arg("lookback") ?? 7),
    concurrency: 4,
    log: (m) => console.log(m),
  });

  if (result.run.sourcesOk > 0) writeStore(dataDir, result.stories, result.state, result.run);
  const summary = summarize(result.run);
  console.log(`\n${summary}`);
  const summaryFile = arg("summary");
  if (summaryFile) fs.appendFileSync(summaryFile, summary);

  // GitHub annotations make partial failures visible on the run page instead of buried in the log.
  for (const e of result.run.errors) console.log(`::warning title=Tech Radar::${e.replace(/\n/g, " ")}`);
  if (result.run.analysisSkipped) console.log(`::warning title=Tech Radar analysis skipped::${result.run.analysisSkipped}`);
  if (result.run.sourcesOk === 0) {
    console.log("::error title=Tech Radar::every source failed; nothing was written");
    return 2;
  }
  if (result.run.sourcesFailed > sources.length / 2) {
    console.log(`::error title=Tech Radar::${result.run.sourcesFailed} of ${sources.length} sources failed`);
    return 1;
  }
  return 0;
}

function pending(): number {
  const topicList = topics();
  const limit = Number(arg("limit") ?? 5);
  const queue = readStories(dataDir)
    .filter((s) => s.status === "pending" && !s.minor)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit);
  console.log(JSON.stringify({ system: systemPrompt(topicList), stories: queue.map((s) => ({ id: s.id, url: s.canonicalUrl, prompt: userPrompt(s, null) })) }, null, 1));
  return 0;
}

function apply(): number {
  const file = arg("file");
  if (!file) throw new Error("--file is required");
  const entries = JSON.parse(fs.readFileSync(file, "utf8")) as { id: string; model: string; analysis: unknown; basedOn?: string[] }[];
  const lessonKeys = new Set(topics().map((t) => `${t.domain}/${t.topic}`));
  const stories = readStories(dataDir);
  const now = new Date();
  let failed = 0;
  for (const e of entries) {
    const story = stories.find((s) => s.id === e.id);
    const { analysis, errors } = validateAnalysis(e.analysis, lessonKeys);
    if (!story || !analysis || typeof e.model !== "string") {
      console.error(`skip ${e.id}: ${!story ? "unknown story" : errors.join("; ") || "model missing"}`);
      failed++;
      continue;
    }
    story.analysis = { ...analysis, model: e.model, generatedAt: now.toISOString(), basedOn: e.basedOn ?? [] };
    story.status = "analysed";
    delete story.statusNote;
    rescore(story, now);
  }
  const run: RunLog = {
    startedAt: now.toISOString(), finishedAt: new Date().toISOString(), ok: failed === 0, sourcesOk: 0, sourcesFailed: 0, itemsFetched: 0,
    newStories: 0, updatedStories: 0, corroborated: 0, unchanged: 0, analysed: entries.length - failed, analysisFailed: failed,
    analysisSkipped: null, errors: [],
  };
  writeStore(dataDir, stories, readState(dataDir), run);
  console.log(`applied ${entries.length - failed}, rejected ${failed}`);
  return failed > 0 ? 1 : 0;
}

function check(): number {
  let bad = 0;
  for (const s of readStories(dataDir)) {
    const errors = validateStory(s);
    if (errors.length) {
      bad++;
      console.error(`${s.id}: ${errors.join("; ")}`);
    }
  }
  console.log(bad ? `${bad} invalid stories` : "all stories valid");
  return bad ? 1 : 0;
}

const commands: Record<string, () => number | Promise<number>> = { ingest, pending, apply, check };
const run = commands[command ?? ""];
if (!run) {
  console.error("usage: radar <ingest|pending|apply|check> --data <dir> [options]");
  process.exit(64);
}
Promise.resolve(run())
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    console.log(`::error title=Tech Radar::${(err as Error).message}`);
    process.exit(3);
  });
