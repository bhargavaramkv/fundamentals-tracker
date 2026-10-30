import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { AnalysisRefused, ANALYSIS_MODEL, createAnalyzer } from "@/lib/radar/analyze";
import { FeedParseError, parseFeed, parseGithubReleases, parseKev } from "@/lib/radar/feeds";
import { createFetcher, HttpError, type FetchText } from "@/lib/radar/fetch";
import { mergeItems } from "@/lib/radar/merge";
import { runPipeline, type PipelineOptions } from "@/lib/radar/pipeline";
import { isMinor, scoreStory } from "@/lib/radar/rank";
import { sourceById, SOURCES } from "@/lib/radar/sources";
import { emptyState, readRuns, readState, readStories, writeStore } from "@/lib/radar/store";
import { canonicalUrl, contentHash, eventKeys, htmlToText, titleSimilarity } from "@/lib/radar/text";
import type { FeedItem, RadarStory, SourceDef } from "@/lib/radar/types";
import { validateAnalysis, validateStory } from "@/lib/radar/validate";

const FIX = path.resolve(import.meta.dirname, "fixtures", "radar");
const NOW = new Date("2026-10-30T01:30:00Z");
const fixture = (name: string) => fs.readFileSync(path.join(FIX, name), "utf8");
const src = (id: string) => sourceById(id) as SourceDef;
const sourceMap = new Map(SOURCES.map((s) => [s.id, s]));

function fixtureFetch(overrides: Record<string, string> = {}): FetchText {
  return async (url) => {
    const s = SOURCES.find((x) => url === x.url || url.startsWith(`https://api.github.com/repos/${x.url}/`));
    if (s && overrides[s.id] !== undefined) return overrides[s.id];
    const file = s && [".xml", ".json"].map((e) => path.join(FIX, s.id + e)).find((f) => fs.existsSync(f));
    if (!file) throw new HttpError("HTTP 404", 404);
    return fs.readFileSync(file, "utf8");
  };
}

const FIXTURE_SOURCES = ["openai", "go-blog", "gh-typescript", "cisa-kev", "bleepingcomputer", "cloudflare"].map(src);

const goodAnalysis = {
  headline: "Model Z ships with a 2M-token context window",
  summary: "A fixture vendor released Model Z with tool calling and a larger context window.",
  whatHappened: "The vendor announced Model Z, which supports tool calling and a 2M-token context window.",
  technicalExplanation: "A larger context window means attention must cover more tokens, which raises memory and latency costs.",
  whyItMatters: "Longer contexts change how much retrieval engineering an application needs.",
  industryImpact: "Competitors are likely to respond with similar context sizes.",
  fundamentals: [{ concept: "Context windows", explanation: "The number of tokens a model can attend to at once, bounded by memory and attention cost." }],
  applications: ["Whole-repository code review"],
  learn: ["How KV caches work"],
  relatedTopics: ["system-design/caching", "made-up/topic"],
  sourceFacts: ["Model Z supports tool calling."],
  companyClaims: [],
  technicalSignificance: 4,
  practicalRelevance: 3,
  significanceRationale: "A larger context window is a meaningful capability step.",
  limitations: "Only the feed excerpt was available.",
};

function options(over: Partial<PipelineOptions> = {}): PipelineOptions {
  return {
    now: NOW,
    sources: FIXTURE_SOURCES,
    fetchText: fixtureFetch(),
    lessonKeys: new Set(["system-design/caching", "web/security"]),
    maxAnalyses: 10,
    minScoreForAnalysis: 40,
    lookbackDays: 7,
    concurrency: 2,
    log: () => {},
    ...over,
  };
}

describe("text normalisation", () => {
  it("canonicalises URLs for deduplication", () => {
    expect(canonicalUrl("http://www.Example.com/a/?utm_source=x&b=2&a=1#frag")).toBe("https://example.com/a?a=1&b=2");
    expect(canonicalUrl("https://example.com/")).toBe("https://example.com/");
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalUrl("not a url")).toBeNull();
  });

  it("strips HTML and decodes entities", () => {
    expect(htmlToText("<p>a &amp; b</p><script>x()</script><p>c&#39;d</p>")).toBe("a & b\nc'd");
  });

  it("finds CVE and GHSA identifiers", () => {
    expect(eventKeys("fix for cve-2026-12345 and GHSA-abcd-2345-6789")).toEqual(["CVE-2026-12345"]);
    expect(eventKeys("GHSA-4x5v-mpq3-cr7g")).toEqual(["GHSA-4X5V-MPQ3-CR7G"]);
  });

  it("scores title similarity on significant words", () => {
    expect(titleSimilarity("Go 1.30 is released", "The Go 1.30 release is out")).toBeGreaterThan(0.3);
    expect(titleSimilarity("Kubernetes 2.0 released", "Rust compiler speeds up builds")).toBe(0);
  });
});

describe("feed parsing", () => {
  it("parses RSS, keeps original dates, drops items without links", () => {
    const items = parseFeed(fixture("openai.xml"), src("openai"), NOW);
    expect(items.map((i) => i.title)).toEqual([
      "Fixture: Introducing Model Z with a 2M-token context window",
      "Fixture: Weekly digest of community projects",
      "Fixture: very old post",
    ]);
    expect(items[0].publishedAt).toBe("2026-10-28T17:00:00.000Z");
    expect(items[0].excerpt).toBe("Model Z supports tool calling & a 2M-token context.");
  });

  it("parses Atom", () => {
    const [item] = parseFeed(fixture("go-blog.xml"), src("go-blog"), NOW);
    expect(item).toMatchObject({ url: "https://go.dev/blog/fixture-go1.30", publishedAt: "2026-10-29T08:00:00.000Z" });
  });

  it("rejects malformed and non-feed documents with a clear error", () => {
    expect(() => parseFeed(fixture("cloudflare.xml"), src("cloudflare"), NOW)).toThrow(FeedParseError);
    expect(() => parseFeed("<html><body>hi</body></html>", src("openai"), NOW)).toThrow(/not an RSS/);
  });

  it("ignores future and implausible dates", () => {
    const xml = `<rss><channel><item><title>T</title><link>https://a.example/x</link><pubDate>2099-01-01</pubDate></item></channel></rss>`;
    expect(parseFeed(xml, src("openai"), NOW)[0].publishedAt).toBeNull();
  });

  it("skips GitHub drafts and pre-releases", () => {
    const items = parseGithubReleases(JSON.parse(fixture("gh-typescript.json")), src("gh-typescript"), NOW);
    expect(items.map((i) => i.title)).toEqual(["TypeScript 7.1", "TypeScript 7.0.3"]);
    expect(() => parseGithubReleases({ message: "rate limited" }, src("gh-typescript"), NOW)).toThrow(FeedParseError);
  });

  it("reads CISA KEV entries and drops malformed ones", () => {
    const items = parseKev(JSON.parse(fixture("cisa-kev.json")), src("cisa-kev"), NOW);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://nvd.nist.gov/vuln/detail/CVE-2026-99999");
  });
});

describe("ranking", () => {
  it("flags patch releases and digests as minor", () => {
    expect(isMinor("TypeScript 7.0.3")).toBe(true);
    expect(isMinor("Weekly digest of community projects")).toBe(true);
    expect(isMinor("TypeScript 7.1")).toBe(false);
    expect(isMinor("Node.js 24.1.2 security release for CVE-2026-1")).toBe(false);
  });

  it("explains every point of the score", () => {
    const score = scoreStory(
      {
        title: "Introducing Model Z for LLM inference",
        excerpt: "",
        category: "ai-ml",
        sources: [{ sourceId: "openai", sourceName: "OpenAI", title: "", url: "https://openai.com/x", publishedAt: null, credibility: 3 }],
        publishedAt: NOW.toISOString(),
        minor: false,
        isKev: false,
      },
      NOW,
    );
    expect(score.parts.reduce((n, p) => n + p.points, 0)).toBe(score.total);
    expect(score.parts.map((p) => p.label)).toEqual(["Baseline", "Source credibility", "Significance", "Engineering relevance", "Freshness"]);
    expect(score.parts.every((p) => p.reason.length > 0)).toBe(true);
  });
});

describe("merge and deduplication", () => {
  const item = (over: Partial<FeedItem>): FeedItem => ({
    sourceId: "openai",
    title: "Fixture: Introducing Model Z",
    url: "https://openai.com/index/model-z/",
    publishedAt: "2026-10-29T10:00:00.000Z",
    updatedAt: null,
    excerpt: "Model Z.",
    ...over,
  });

  it("treats the same canonical URL as one story and leaves it unchanged", () => {
    const stories: RadarStory[] = [];
    mergeItems(stories, [item({}), item({ url: "http://www.openai.com/index/model-z?utm_campaign=x" })], { now: NOW, lookbackDays: 7, sources: sourceMap });
    expect(stories).toHaveLength(1);
    const { stats } = mergeItems(stories, [item({})], { now: NOW, lookbackDays: 7, sources: sourceMap });
    expect(stats).toMatchObject({ newStories: 0, unchanged: 1, updatedStories: 0 });
    expect(stories[0].revisions).toHaveLength(0);
  });

  it("records a revision and re-queues analysis when the source edits a story", () => {
    const stories: RadarStory[] = [];
    mergeItems(stories, [item({})], { now: NOW, lookbackDays: 7, sources: sourceMap });
    stories[0].status = "analysed";
    const later = new Date(NOW.getTime() + 86_400_000);
    const { stats } = mergeItems(stories, [item({ title: "Fixture: Introducing Model Z (updated with pricing)" })], { now: later, lookbackDays: 7, sources: sourceMap });
    expect(stats.updatedStories).toBe(1);
    expect(stories[0]).toMatchObject({ status: "pending", updatedAt: later.toISOString(), publishedAt: "2026-10-29T10:00:00.000Z" });
    expect(stories[0].revisions[0].reason).toMatch(/Title changed/);
    expect(stories[0].contentHash).toBe(contentHash("Fixture: Introducing Model Z (updated with pricing)", "Model Z."));
  });

  it("folds a second outlet's report of the same event into one story", () => {
    const stories: RadarStory[] = [];
    mergeItems(
      stories,
      [
        item({}),
        item({ sourceId: "the-register", title: "Fixture: Introducing Model Z", url: "https://www.theregister.com/2026/10/29/model_z/", publishedAt: "2026-10-29T15:00:00.000Z" }),
      ],
      { now: NOW, lookbackDays: 7, sources: sourceMap },
    );
    expect(stories).toHaveLength(1);
    expect(stories[0].sources.map((s) => s.sourceId)).toEqual(["openai", "the-register"]);
    expect(stories[0].score.parts.find((p) => p.label === "Corroboration")?.points).toBe(8);
  });

  it("ignores items older than the lookback window", () => {
    const stories: RadarStory[] = [];
    const { stats } = mergeItems(stories, [item({ publishedAt: "2026-09-01T00:00:00.000Z" })], { now: NOW, lookbackDays: 7, sources: sourceMap });
    expect(stats.skippedOld).toBe(1);
    expect(stories).toHaveLength(0);
  });

  it("keeps the source date and flags estimated dates", () => {
    const stories: RadarStory[] = [];
    mergeItems(stories, [item({ publishedAt: null })], { now: NOW, lookbackDays: 7, sources: sourceMap });
    expect(stories[0]).toMatchObject({ publishedAt: NOW.toISOString(), dateEstimated: true });
  });
});

describe("analysis validation", () => {
  const keys = new Set(["system-design/caching"]);

  it("accepts a complete analysis and drops invented lesson links", () => {
    const { analysis, errors } = validateAnalysis(goodAnalysis, keys);
    expect(errors).toEqual([]);
    expect(analysis?.relatedTopics).toEqual(["system-design/caching"]);
  });

  it("rejects missing sections, out-of-range ratings and empty fact lists", () => {
    const { analysis, errors } = validateAnalysis({ ...goodAnalysis, whyItMatters: "", technicalSignificance: 9, sourceFacts: [] }, keys);
    expect(analysis).toBeNull();
    expect(errors.join(" ")).toMatch(/whyItMatters/);
    expect(errors.join(" ")).toMatch(/technicalSignificance/);
    expect(errors.join(" ")).toMatch(/sourceFacts/);
    expect(validateAnalysis("not json", keys).analysis).toBeNull();
  });
});

describe("pipeline", () => {
  it("ingests multiple sources, survives a malformed feed, dedupes across outlets and records source health", async () => {
    const { stories, state, run } = await runPipeline([], emptyState(), options());
    expect(run.sourcesOk).toBe(5);
    expect(run.sourcesFailed).toBe(1);
    expect(state.sources.cloudflare).toMatchObject({ consecutiveFailures: 1, lastOkAt: null });
    expect(state.sources.cloudflare.lastError).toMatch(/malformed XML/);
    expect(run.errors.some((e) => e.startsWith("cloudflare:"))).toBe(true);

    // The KEV entry and BleepingComputer's report share CVE-2026-99999: one story, two sources.
    const cve = stories.filter((s) => s.title.includes("CVE-2026-99999") || s.excerpt.includes("CVE-2026-99999"));
    expect(cve).toHaveLength(1);
    expect(cve[0].sources).toHaveLength(2);
    expect(new Set(stories.map((s) => s.category)).size).toBeGreaterThanOrEqual(3);
    expect(stories.find((s) => s.title.includes("very old"))).toBeUndefined();
    expect(stories.every((s) => validateStory(s).length === 0)).toBe(true);
    expect(run.analysisSkipped).toBe("no analyzer configured");
    expect(stories.find((s) => s.title === "TypeScript 7.0.3")?.status).toBe("below-threshold");
  });

  it("does not republish unchanged stories on the next run", async () => {
    const first = await runPipeline([], emptyState(), options());
    const count = first.stories.length;
    const second = await runPipeline(first.stories, first.state, options({ now: new Date(NOW.getTime() + 86_400_000) }));
    expect(second.stories).toHaveLength(count);
    expect(second.run.newStories).toBe(0);
    expect(second.run.updatedStories).toBe(0);
  });

  it("analyses the best stories, attaches provenance and never stores invalid output", async () => {
    const analyze = vi.fn(async (story: RadarStory) => ({
      raw: story.title.includes("Model Z") ? goodAnalysis : { headline: "broken" },
      model: "claude-test",
    }));
    const { stories, run } = await runPipeline([], emptyState(), options({ analyze }));
    const modelZ = stories.find((s) => s.title.includes("Model Z"));
    expect(modelZ?.status).toBe("analysed");
    expect(modelZ?.analysis).toMatchObject({ model: "claude-test", relatedTopics: ["system-design/caching"] });
    expect(modelZ?.score.parts.some((p) => p.label === "AI-rated significance")).toBe(true);
    const broken = stories.filter((s) => s.statusNote?.startsWith("Analysis failed"));
    expect(broken.length).toBe(run.analysisFailed);
    expect(broken.every((s) => !s.analysis && s.status === "pending" && s.attempts === 1)).toBe(true);
    expect(analyze.mock.calls.every(([s]) => !s.minor)).toBe(true);
  });

  it("gives up on a story after three failed analyses", async () => {
    const analyze = vi.fn(async () => ({ raw: {}, model: "m" }));
    let r = await runPipeline([], emptyState(), options({ analyze, sources: [src("openai")] }));
    for (let i = 0; i < 2; i++) r = await runPipeline(r.stories, r.state, options({ analyze, sources: [src("openai")] }));
    expect(r.stories.find((s) => s.title.includes("Model Z"))?.status).toBe("failed");
  });

  it("reports total failure without writing", async () => {
    const { run } = await runPipeline([], emptyState(), options({ fetchText: async () => { throw new HttpError("HTTP 503", 503); } }));
    expect(run).toMatchObject({ ok: false, sourcesOk: 0 });
  });
});

describe("store", () => {
  it("round-trips stories by month with state and run history", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-"));
    const { stories, state, run } = await runPipeline([], emptyState(), options());
    writeStore(dir, stories, state, run);
    writeStore(dir, stories, state, run);
    expect(fs.readdirSync(path.join(dir, "stories"))).toEqual(["2026-10.json"]);
    expect(readStories(dir)).toHaveLength(stories.length);
    expect(readState(dir).lastSuccessAt).toBe(NOW.toISOString());
    expect(readRuns(dir)).toHaveLength(2);
  });
});

describe("fetcher", () => {
  const res = (status: number, body = "", headers: Record<string, string> = {}) => new Response(body, { status, headers });

  it("retries 5xx and 429 with backoff, then succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(429, "", { "retry-after": "2" })).mockResolvedValueOnce(res(200, "ok"));
    const sleep = vi.fn(async () => {});
    const get = createFetcher({ userAgent: "t", minIntervalMs: 0, timeoutMs: 1000, retries: 2, maxBytes: 100, sleep, fetchImpl });
    await expect(get("https://a.example/feed")).resolves.toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("does not retry 404 and rejects oversized bodies", async () => {
    const notFound = vi.fn().mockResolvedValue(res(404));
    const get = createFetcher({ userAgent: "t", minIntervalMs: 0, timeoutMs: 1000, retries: 3, maxBytes: 5, sleep: async () => {}, fetchImpl: notFound });
    await expect(get("https://a.example/x")).rejects.toThrow("HTTP 404");
    expect(notFound).toHaveBeenCalledTimes(1);
    const big = createFetcher({ userAgent: "t", minIntervalMs: 0, timeoutMs: 1000, retries: 3, maxBytes: 5, sleep: async () => {}, fetchImpl: vi.fn().mockResolvedValue(res(200, "0123456789")) });
    await expect(big("https://a.example/x")).rejects.toThrow(/larger than/);
  });

  it("spaces requests to the same host", async () => {
    const sleep = vi.fn(async () => {});
    const get = createFetcher({ userAgent: "t", minIntervalMs: 5000, timeoutMs: 1000, retries: 0, maxBytes: 100, sleep, fetchImpl: vi.fn().mockImplementation(async () => res(200, "ok")) });
    await get("https://a.example/1");
    await get("https://a.example/2");
    expect(sleep).toHaveBeenCalledTimes(1);
    expect((sleep.mock.calls[0] as unknown as [number])[0]).toBeGreaterThan(4000);
  });
});

describe("source registry", () => {
  it("has unique ids, https URLs and covers every category", () => {
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
    for (const s of SOURCES) {
      if (s.kind === "github-releases") expect(s.url).toMatch(/^[\w.-]+\/[\w.-]+$/);
      else expect(s.url).toMatch(/^https:\/\//);
      expect(s.homepage).toMatch(/^https:\/\//);
    }
    expect(new Set(SOURCES.map((s) => s.category)).size).toBe(6);
  });
});

describe("analyzer", () => {
  const story = { id: "s", title: "T", canonicalUrl: "https://a.example/x", category: "ai-ml", publishedAt: NOW.toISOString(), dateEstimated: false, excerpt: "E", sources: [{ sourceId: "openai", sourceName: "OpenAI News", title: "T", url: "https://a.example/x", publishedAt: null, credibility: 3 }] } as unknown as RadarStory;
  const client = (res: object) => {
    const create = vi.fn().mockResolvedValue(res);
    return { create, client: { beta: { messages: { create } } } as unknown as Anthropic };
  };

  it("requests structured JSON from the current model with the lesson list in a cacheable system prompt", async () => {
    const { create, client: c } = client({ stop_reason: "end_turn", model: ANALYSIS_MODEL, content: [{ type: "text", text: JSON.stringify(goodAnalysis) }] });
    const analyze = createAnalyzer({ apiKey: "x", topics: [{ domain: "system-design", topic: "caching", title: "Caching" }], client: c });
    const out = await analyze(story, "article body");
    expect(out).toEqual({ raw: goodAnalysis, model: ANALYSIS_MODEL });
    const req = create.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.output_config.format.type).toBe("json_schema");
    expect(req.fallbacks).toBe("default");
    expect(req.system[0].text).toContain("system-design/caching — Caching");
    expect(req.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(req.messages[0].content).toContain("article body");
  });

  it("treats refusals, truncation and non-JSON as failures", async () => {
    await expect(createAnalyzer({ apiKey: "x", topics: [], client: client({ stop_reason: "refusal", stop_details: { category: "cyber" }, content: [] }).client })(story, null)).rejects.toThrow(AnalysisRefused);
    await expect(createAnalyzer({ apiKey: "x", topics: [], client: client({ stop_reason: "max_tokens", content: [] }).client })(story, null)).rejects.toThrow(/truncated/);
    await expect(createAnalyzer({ apiKey: "x", topics: [], client: client({ stop_reason: "end_turn", model: "m", content: [{ type: "text", text: "nope" }] }).client })(story, null)).rejects.toThrow(/valid JSON/);
  });
});
