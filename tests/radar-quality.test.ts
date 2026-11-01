import { describe, expect, it } from "vitest";
import { mergeFeeds } from "@/components/radar/live";
import { clusterStories, clusterTokens, documentFrequency, isSameEvent, weightedSimilarity } from "@/lib/radar/cluster";
import { buildFeed, displayExcerpt, selectBriefing, toListItem } from "@/lib/radar/feed";
import { normalizeStory, rescore } from "@/lib/radar/merge";
import { classifyCategory, isMinor, isOffTopic } from "@/lib/radar/rank";
import { SOURCES } from "@/lib/radar/sources";
import type { RadarFeed, RadarState, RadarStory } from "@/lib/radar/types";
import { validateStory } from "@/lib/radar/validate";
import { whyItMatters } from "@/lib/radar/why";

const NOW = new Date("2026-11-01T06:00:00Z");

function story(id: string, title: string, sourceId: string, over: Partial<RadarStory> = {}): RadarStory {
  const url = `https://${sourceId}.example.com/${id}`;
  const s: RadarStory = {
    id,
    title,
    canonicalUrl: url,
    category: "programming",
    publishedAt: "2026-10-30T10:00:00.000Z",
    dateEstimated: false,
    firstSeenAt: "2026-10-30T12:00:00.000Z",
    lastSeenAt: "2026-10-30T12:00:00.000Z",
    updatedAt: null,
    revisions: [],
    contentHash: id,
    excerpt: "",
    sources: [{ sourceId, sourceName: sourceId, title, url, publishedAt: "2026-10-30T10:00:00.000Z", credibility: 2 }],
    minor: false,
    score: { total: 0, parts: [] },
    importance: "routine",
    status: "pending",
    ...over,
  };
  rescore(s, NOW);
  return s;
}

// Real headlines from the feed that used to appear as separate stories.
const EXTENSION = [
  story("a", "Inside a malicious Claude Code-branded extension and its persistent SSH backdoor", "ms-security", { sources: [{ sourceId: "ms-security", sourceName: "Microsoft", title: "", url: "https://microsoft.example.com/a", publishedAt: null, credibility: 3 }] }),
  story("b", "Malicious Claude Code extension on Cursor planted SSH backdoors", "bleepingcomputer"),
  story("c", "Anthropic VS code extension on Cursor backdoored for nearly 12 hours", "the-register"),
];
const NOISE = [
  "Anthropic Says Nobody Needs a Mental Model of Claude Code. Practitioners Are Testing That",
  "Gemini 4 Carbon: Our next frontier model",
  "How we detect frontier model misalignment",
  "Hugging Face malware campaign returns to hijack GPUs for crypto mining",
  "Welcome Le Chonk: Mistral Large 4 on Hugging Face",
  "Cloudflare services for private origins is now generally available",
  "What took the Internet offline in Q3 2026",
  "Near-zero downtime upgrades: Announcing Cloud SQL for MySQL blue-green deployments",
].map((t, i) => story(`n${i}`, t, `src${i}`));

describe("story clustering", () => {
  it("folds different headlines about one event into one story with all its sources", () => {
    const stories = [...EXTENSION.map((s) => structuredClone(s)), ...NOISE.map((s) => structuredClone(s))];
    const { merged } = clusterStories(stories, NOW);
    expect(merged).toBeGreaterThanOrEqual(1);
    const leaders = stories.filter((s) => s.sources.length > 1);
    expect(leaders).toHaveLength(1);
    // The primary source (the vendor's own report) leads.
    expect(leaders[0].id).toBe("a");
    expect(stories.find((s) => s.id === "b")?.duplicateOf).toBe("a");
  });

  it("points every duplicate at the final leader, and a second run changes nothing", () => {
    // b and c merge first; then a, the better source, takes over the cluster.
    const stories = [
      story("c", "Claude Code extension backdoor found on Cursor marketplace", "s3", { publishedAt: "2026-10-29T10:00:00.000Z" }),
      story("b", "Claude Code extension backdoor discovered on Cursor marketplace", "s2", { publishedAt: "2026-10-29T11:00:00.000Z" }),
      { ...story("a", "Claude Code extension backdoor on Cursor marketplace analysed", "s1"), sources: [{ sourceId: "s1", sourceName: "s1", title: "", url: "https://s1.example.com/a", publishedAt: null, credibility: 3 as const }] },
    ];
    clusterStories(stories, NOW);
    expect(stories.filter((s) => s.duplicateOf).map((s) => s.duplicateOf)).toEqual(["a", "a"]);
    expect(stories.find((s) => s.id === "a")?.sources).toHaveLength(3);
    expect(clusterStories(stories, NOW).merged).toBe(0);
  });

  it("merges a weaker match when the shared words are rare across the corpus", () => {
    const a = clusterTokens("Malicious Claude Code extension on Cursor planted SSH backdoors");
    const b = clusterTokens("Anthropic VS code extension on Cursor backdoored for nearly 12 hours");
    // A corpus where "code" is everywhere and the other shared words are rare.
    const corpus = [a, b, ...Array.from({ length: 150 }, (_, i) => new Set(["code", "claude", "anthropic", "malicious", "planted", "ssh", "vs", "nearly", "12", "hour", `filler${i}`]))];
    const { df, docs } = documentFrequency(corpus);
    const { score, shared } = weightedSimilarity(a, b, df, docs);
    expect(shared).toBe(4);
    expect(isSameEvent(score, shared)).toBe(true);
  });

  it("leaves unrelated stories alone even when they share words", () => {
    const stories = NOISE.map((s) => structuredClone(s));
    expect(clusterStories(stories, NOW).merged).toBe(0);
    expect(stories.every((s) => !s.duplicateOf)).toBe(true);
  });

  it("never merges two entries from the same source", () => {
    const stories = [story("x", "Hitachi Energy CoreTec Product", "cisa-advisories"), story("y", "Hitachi Energy TRO600 series products", "cisa-advisories")];
    expect(clusterStories(stories, NOW).merged).toBe(0);
  });

  it("never merges stories naming different CVEs", () => {
    const stories = [
      story("x", "Actively exploited: PHP Group PHP CVE-2026-109618 memory corruption", "cisa-kev"),
      story("y", "Actively exploited: PHP Group PHP CVE-2026-109619 memory corruption", "bleepingcomputer"),
    ];
    expect(clusterStories(stories, NOW).merged).toBe(0);
  });

  it("ignores stories published too far apart", () => {
    const stories = [
      story("x", "Malicious Claude Code extension on Cursor planted SSH backdoors", "s1"),
      story("y", "Malicious Claude Code extension on Cursor planted SSH backdoors", "s2", { publishedAt: "2026-10-20T10:00:00.000Z" }),
    ];
    expect(clusterStories(stories, NOW).merged).toBe(0);
  });

  it("scores token overlap by rarity", () => {
    const a = clusterTokens("rare-token alpha beta");
    const b = clusterTokens("rare-token alpha gamma");
    const { df, docs } = documentFrequency([a, b]);
    const { score, shared } = weightedSimilarity(a, b, df, docs);
    expect(shared).toBe(3);
    expect(score).toBeGreaterThan(0);
    expect(isSameEvent(0.34, 3)).toBe(true);
    expect(isSameEvent(0.34, 2)).toBe(false);
    expect(isSameEvent(0.25, 3)).toBe(false);
    expect(isSameEvent(0.25, 4)).toBe(true);
  });

  it("still validates after clustering", () => {
    const stories = EXTENSION.map((s) => structuredClone(s));
    const { changed } = clusterStories(stories, NOW);
    for (const s of changed) rescore(s, NOW);
    for (const s of stories) expect(validateStory(s)).toEqual([]);
  });
});

describe("classification", () => {
  it.each([
    ["Critical vulnerability found in Redis", "security"],
    ["pgAdmin 4 v9.19 Released", "databases"],
    ["Gemini 4 Carbon: Our next frontier model", "ai-ml"],
    ["Kubernetes Confidential Containers Get Attestation", "infrastructure"],
    ["AWS Lambda gets a new runtime", "cloud"],
    ["VS Code adds a new debugger view", "developer-tools"],
    ["TypeScript 7 changes its compiler", "programming"],
    ["Apache Software Foundation welcomes a project", "open-source"],
    ["PC chip plunge wipes out a quarter of Intel's value", "hardware"],
  ])("files %s under %s", (title, expected) => {
    expect(classifyCategory(title, "", "research")).toBe(expected);
  });

  it("falls back to the source's category", () => {
    expect(classifyCategory("Something else entirely", "", "open-source")).toBe("open-source");
  });

  it("hides general-interest stories with no engineering angle, only from general publications", () => {
    expect(isOffTopic("ieee-spectrum", "When Electric Cars Were for Women", "")).toBe(true);
    expect(isOffTopic("the-register", "Voyager 1 gives controllers the silent treatment", "")).toBe(true);
    expect(isOffTopic("the-register", "HTTP/3 is faster with some work and help from Cloudflare", "")).toBe(false);
    expect(isOffTopic("go-blog", "When Electric Cars Were for Women", "")).toBe(false);
  });

  it("treats pre-releases as minor, and doesn't read 5.0.1 as a major version", () => {
    expect(isMinor("Node.js 27.0.0-alpha.0.0.0 (Alpha)")).toBe(true);
    expect(whyItMatters({ title: "E-Maj 5.0.1 update", excerpt: "", sources: [] })).toBeNull();
    expect(whyItMatters({ title: "Rust 2.0 released", excerpt: "", sources: [] })?.text).toMatch(/breaking changes/);
  });

  it("reclassifies stored stories, including the retired 'developer' category", () => {
    const old = { ...story("o", "Angular 22 ships", "angular-blog"), category: "developer" } as unknown as RadarStory;
    const next = normalizeStory(old);
    expect(next.category).toBe("programming");
    expect(validateStory(next)).toEqual([]);
    const removed = normalizeStory({ ...story("r", "Voyager 1 goes quiet", "the-register"), category: "hardware" });
    expect(removed.offTopic).toBe(true);
  });

  it("every source has a current category and an https feed", () => {
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
    const categories = new Set(SOURCES.map((s) => s.category));
    for (const required of ["ai-ml", "developer-tools", "programming", "cloud", "databases", "infrastructure", "open-source"] as const) {
      expect(categories.has(required), required).toBe(true);
    }
    for (const s of SOURCES) if (s.kind !== "github-releases") expect(s.url.startsWith("https://"), s.id).toBe(true);
  });
});

describe("why it matters", () => {
  it("prefers the AI analysis and labels it", () => {
    const analysis = { whyItMatters: "Because of X." } as RadarStory["analysis"];
    expect(whyItMatters({ title: "Anything", excerpt: "", sources: [], analysis })).toEqual({ text: "Because of X.", kind: "ai" });
  });

  it("gives a rule note labelled as such, and nothing when there's no signal", () => {
    expect(whyItMatters({ title: "Cloudflare services now generally available", excerpt: "", sources: [] })?.kind).toBe("rule");
    expect(whyItMatters({ title: "A quiet story about nothing", excerpt: "", sources: [] })).toBeNull();
  });

  it("flags CISA's exploited list above everything else", () => {
    const s = story("k", "Actively exploited: PHP CVE-2026-1", "cisa-kev");
    expect(whyItMatters(s)?.text).toMatch(/exploited in the wild/);
  });
});

describe("feed", () => {
  const state: RadarState = { version: 1, lastRunAt: NOW.toISOString(), lastSuccessAt: NOW.toISOString(), sources: {} };

  it("strips the boilerplate CISA appends to every entry", () => {
    expect(displayExcerpt({ excerpt: "PHP contains a flaw. Required action: Apply mitigations." })).toBe("PHP contains a flaw.");
  });

  it("list items carry source, date, summary, category and the original link", () => {
    const i = toListItem(story("a", "T", "go-blog", { excerpt: "Summary." }));
    expect(i).toMatchObject({ sourceName: "go-blog", summary: "Summary.", category: "programming", publishedAt: "2026-10-30T10:00:00.000Z", url: "https://go-blog.example.com/a" });
  });

  it("omits duplicates and old stories, and records source health", () => {
    const feed = buildFeed(
      [story("keep", "Keep", "a"), story("dup", "Dup", "b", { duplicateOf: "keep" }), story("old", "Old", "c", { publishedAt: "2026-09-01T00:00:00.000Z" })],
      { ...state, sources: { "go-blog": { lastAttemptAt: "", lastOkAt: null, lastError: "HTTP 500", consecutiveFailures: 2, lastItemCount: 0 } } },
      NOW,
    );
    expect(feed.items.map((i) => i.id)).toEqual(["keep"]);
    expect(feed.problems).toEqual([{ name: "The Go Blog", error: "HTTP 500", failures: 2 }]);
  });

  it("the briefing is varied: one story per source, at most two per category", () => {
    const stories = [
      story("a1", "One", "s1", { category: "ai-ml", score: { total: 90, parts: [] } }),
      story("a2", "Two", "s1", { category: "ai-ml", score: { total: 89, parts: [] } }),
      story("a3", "Three", "s2", { category: "ai-ml", score: { total: 88, parts: [] } }),
      story("a4", "Four", "s3", { category: "ai-ml", score: { total: 87, parts: [] } }),
      story("b1", "Five", "s4", { category: "cloud", score: { total: 50, parts: [] } }),
    ];
    expect(selectBriefing(stories, "2026-10-30T12:00:00.000Z")).toEqual(["a1", "a3", "b1"]);
  });

  it("the briefing excludes minor, off-topic and duplicate stories", () => {
    const stories = [story("m", "M", "s1", { minor: true }), story("o", "O", "s2", { offTopic: true }), story("d", "D", "s3", { duplicateOf: "x" })];
    expect(selectBriefing(stories, "2026-10-30T12:00:00.000Z")).toEqual([]);
  });
});

describe("live feed merge", () => {
  const item = (id: string, publishedAt: string) => ({ ...toListItem(story(id, id, "s")), publishedAt });
  const feed = (lastSuccessAt: string, items: RadarFeed["items"]): RadarFeed => ({
    version: 1, generatedAt: lastSuccessAt, lastSuccessAt, lastRunAt: lastSuccessAt, sourceCount: 1, healthyCount: 1, problems: [], briefing: [], items,
  });

  it("adds live stories and keeps history only the build has", () => {
    const build = feed("2026-10-30T00:00:00Z", [item("old", "2026-09-01T00:00:00Z"), item("same", "2026-10-29T00:00:00Z")]);
    const live = feed("2026-11-01T00:00:00Z", [item("new", "2026-10-31T00:00:00Z"), { ...item("same", "2026-10-29T00:00:00Z"), title: "Updated" }]);
    const merged = mergeFeeds(build, live);
    expect(merged.items.map((i) => i.id)).toEqual(["new", "same", "old"]);
    expect(merged.items[1].title).toBe("Updated");
    expect(merged.lastSuccessAt).toBe("2026-11-01T00:00:00Z");
  });

  it("falls back to the build when the live feed is missing or older", () => {
    const build = feed("2026-10-30T00:00:00Z", [item("b", "2026-10-29T00:00:00Z")]);
    expect(mergeFeeds(build, null)).toBe(build);
    expect(mergeFeeds(build, feed("2026-10-01T00:00:00Z", []))).toBe(build);
  });
});
