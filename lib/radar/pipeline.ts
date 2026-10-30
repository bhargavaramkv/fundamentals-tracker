import type { Analyzer } from "./analyze";
import { parseSource } from "./feeds";
import type { FetchText } from "./fetch";
import { mergeItems, rescore } from "./merge";
import { htmlToText, truncate } from "./text";
import type { FeedItem, RadarState, RadarStory, RunLog, SourceDef } from "./types";
import { validateAnalysis } from "./validate";

export interface PipelineOptions {
  now: Date;
  sources: SourceDef[];
  fetchText: FetchText;
  /** Omit to ingest and rank only; stories stay "pending" and say so in the UI. */
  analyze?: Analyzer;
  analysisSkippedReason?: string;
  lessonKeys: ReadonlySet<string>;
  maxAnalyses: number;
  /** Stories scoring below this are kept for history but not sent for analysis. */
  minScoreForAnalysis: number;
  lookbackDays: number;
  concurrency: number;
  log: (msg: string) => void;
}

const MAX_ATTEMPTS = 3;
const ARTICLE_MAX = 14_000;

function sourceUrl(s: SourceDef): string {
  return s.kind === "github-releases" ? `https://api.github.com/repos/${s.url}/releases?per_page=10` : s.url;
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
  }));
}

/** One full run: fetch every source, merge, rank, analyse the best new stories. Never throws for a single bad source. */
export async function runPipeline(stories: RadarStory[], state: RadarState, opts: PipelineOptions): Promise<{ stories: RadarStory[]; state: RadarState; run: RunLog }> {
  const { now, log } = opts;
  const nowIso = now.toISOString();
  const errors: string[] = [];
  const items: FeedItem[] = [];
  let sourcesOk = 0;

  await pool(opts.sources, opts.concurrency, async (source) => {
    const prev = state.sources[source.id];
    try {
      const body = await opts.fetchText(sourceUrl(source));
      const re = source.include ? new RegExp(source.include, "i") : null;
      const parsed = parseSource(body, source, now)
        .filter((it) => !re || re.test(`${it.title} ${it.excerpt}`))
        .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
        .slice(0, source.maxItems);
      items.push(...parsed);
      sourcesOk++;
      state.sources[source.id] = { lastAttemptAt: nowIso, lastOkAt: nowIso, lastError: null, consecutiveFailures: 0, lastItemCount: parsed.length };
      log(`ok    ${source.id}: ${parsed.length} items`);
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`${source.id}: ${msg}`);
      state.sources[source.id] = {
        lastAttemptAt: nowIso,
        lastOkAt: prev?.lastOkAt ?? null,
        lastError: msg,
        consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
        lastItemCount: 0,
      };
      log(`FAIL  ${source.id}: ${msg}`);
    }
  });

  const sourceMap = new Map(opts.sources.map((s) => [s.id, s]));
  const { stats } = mergeItems(stories, items, { now, lookbackDays: opts.lookbackDays, sources: sourceMap });

  // A held-back story that gained corroboration (and score) becomes eligible again.
  for (const s of stories) {
    if (s.status === "below-threshold" && !s.minor && s.score.total >= opts.minScoreForAnalysis) s.status = "pending";
  }
  // Pick what to analyse: pending, not minor, good enough, not given up on. Highest score first.
  const queue = stories
    .filter((s) => s.status === "pending" && !s.minor && s.score.total >= opts.minScoreForAnalysis && (s.attempts ?? 0) < MAX_ATTEMPTS)
    .sort((a, b) => b.score.total - a.score.total);
  for (const s of stories) {
    if (s.status === "pending" && !s.analysis && (s.minor || s.score.total < opts.minScoreForAnalysis)) s.status = "below-threshold";
  }

  let analysed = 0;
  let analysisFailed = 0;
  if (opts.analyze) {
    for (const story of queue.slice(0, opts.maxAnalyses)) {
      let article: string | null = null;
      try {
        const html = await opts.fetchText(story.canonicalUrl, "text/html, application/xhtml+xml;q=0.9, */*;q=0.5");
        const text = htmlToText(html);
        article = text.length > 200 ? truncate(text, ARTICLE_MAX) : null;
      } catch (err) {
        log(`note  article fetch failed for ${story.id}: ${(err as Error).message}`);
      }
      try {
        const { raw, model } = await opts.analyze(story, article);
        const { analysis, errors: problems } = validateAnalysis(raw, opts.lessonKeys);
        if (!analysis) throw new Error(`invalid analysis: ${problems.join("; ")}`);
        story.analysis = { ...analysis, model, generatedAt: new Date().toISOString(), basedOn: article ? [story.canonicalUrl] : [] };
        story.status = "analysed";
        delete story.statusNote;
        story.attempts = 0;
        rescore(story, now);
        analysed++;
        log(`ai    ${story.id}: ${story.score.total}`);
      } catch (err) {
        const msg = (err as Error).message;
        story.attempts = (story.attempts ?? 0) + 1;
        story.statusNote = `Analysis failed: ${truncate(msg, 200)}`;
        if (story.attempts >= MAX_ATTEMPTS) story.status = "failed";
        analysisFailed++;
        errors.push(`analysis ${story.id}: ${msg}`);
        log(`FAIL  analysis ${story.id}: ${msg}`);
      }
    }
  }

  state.lastRunAt = nowIso;
  const ok = sourcesOk > 0;
  if (ok) state.lastSuccessAt = nowIso;

  const run: RunLog = {
    startedAt: nowIso,
    finishedAt: new Date().toISOString(),
    ok,
    sourcesOk,
    sourcesFailed: opts.sources.length - sourcesOk,
    itemsFetched: items.length,
    newStories: stats.newStories,
    updatedStories: stats.updatedStories,
    corroborated: stats.corroborated,
    unchanged: stats.unchanged,
    analysed,
    analysisFailed,
    analysisSkipped: opts.analyze ? null : (opts.analysisSkippedReason ?? "no analyzer configured"),
    errors,
  };
  return { stories, state, run };
}
