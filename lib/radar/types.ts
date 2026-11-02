/** Tech Radar: data shapes shared by the ingestion pipeline (scripts/) and the static pages (app/radar/). */

export const RADAR_CATEGORIES = [
  "ai-ml",
  "developer-tools",
  "programming",
  "cloud",
  "databases",
  "infrastructure",
  "open-source",
  "security",
  "hardware",
  "research",
] as const;
export type RadarCategory = (typeof RADAR_CATEGORIES)[number];

export const RADAR_CATEGORY_LABELS: Record<RadarCategory, string> = {
  "ai-ml": "AI",
  "developer-tools": "Developer tools",
  programming: "Programming",
  cloud: "Cloud",
  databases: "Databases",
  infrastructure: "Infrastructure",
  "open-source": "Open source",
  security: "Security",
  hardware: "Hardware",
  research: "Research",
};

/** 3 = the vendor or project itself (primary source), 2 = established publication or research venue, 1 = aggregator. */
export type Credibility = 1 | 2 | 3;

export type SourceKind = "feed" | "github-releases" | "cisa-kev";

export interface SourceDef {
  id: string;
  name: string;
  kind: SourceKind;
  /** Feed URL, GitHub `owner/repo` for releases, or the KEV JSON URL. */
  url: string;
  homepage: string;
  category: RadarCategory;
  credibility: Credibility;
  /** Most items taken from this source per run (newest first). */
  maxItems: number;
  /** Optional case-insensitive filter: only titles/summaries matching it are kept (for broad feeds). */
  include?: string;
}

/** One entry as read from a source, before deduplication. */
export interface FeedItem {
  sourceId: string;
  title: string;
  url: string;
  /** Original publication time (ISO), or null when the source gives none. */
  publishedAt: string | null;
  /** Source-reported update time (ISO), when given. */
  updatedAt: string | null;
  /** Plain-text excerpt from the feed (HTML stripped, truncated). */
  excerpt: string;
}

export interface StorySource {
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string | null;
  credibility: Credibility;
}

export interface ScorePart {
  label: string;
  points: number;
  reason: string;
}

export type Importance = "high" | "notable" | "routine";

export interface StoryRevision {
  at: string;
  reason: string;
  contentHash: string;
}

export interface FundamentalNote {
  concept: string;
  explanation: string;
}

export interface RadarAnalysis {
  headline: string;
  summary: string;
  whatHappened: string;
  technicalExplanation: string;
  whyItMatters: string;
  industryImpact: string;
  fundamentals: FundamentalNote[];
  applications: string[];
  learn: string[];
  /** Existing lesson keys (`domain/topic`); unknown keys are dropped at validation. */
  relatedTopics: string[];
  /** Statements the source text itself makes as fact. */
  sourceFacts: string[];
  /** Assertions the vendor or author makes about itself (benchmarks, "fastest", roadmaps). */
  companyClaims: string[];
  /** AI-rated, 1-5. */
  technicalSignificance: number;
  practicalRelevance: number;
  significanceRationale: string;
  /** What the analysis could not establish from the source text. */
  limitations: string;
  model: string;
  generatedAt: string;
  /** URLs whose text was given to the model. */
  basedOn: string[];
}

export type StoryStatus = "analysed" | "pending" | "below-threshold" | "failed";

export interface RadarStory {
  id: string;
  title: string;
  canonicalUrl: string;
  category: RadarCategory;
  /** Original publication date from the primary source (ISO). Falls back to first-seen time, flagged by `dateEstimated`. */
  publishedAt: string;
  dateEstimated: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Set when the source changed the story after it was first published here. */
  updatedAt: string | null;
  revisions: StoryRevision[];
  contentHash: string;
  excerpt: string;
  /** Primary source first, then corroborating sources. */
  sources: StorySource[];
  minor: boolean;
  /** General-interest story from a mixed publication with no engineering angle. Kept, but hidden like a minor update. */
  offTopic?: boolean;
  /** Id of the story this one reports the same event as. It stays stored and reachable, but leaves every list. */
  duplicateOf?: string;
  score: { total: number; parts: ScorePart[] };
  importance: Importance;
  status: StoryStatus;
  /** Why the story is pending or failed (e.g. "Source updated; re-analysis pending"). */
  statusNote?: string;
  /** Failed analysis attempts so far; the pipeline gives up after 3. */
  attempts?: number;
  analysis?: RadarAnalysis;
}

export interface SourceHealth {
  lastAttemptAt: string;
  lastOkAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  lastItemCount: number;
}

export interface RadarState {
  version: 1;
  lastRunAt: string | null;
  /** Last run in which at least one source succeeded and the store was written. */
  lastSuccessAt: string | null;
  sources: Record<string, SourceHealth>;
}

export interface RunLog {
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  sourcesOk: number;
  sourcesFailed: number;
  itemsFetched: number;
  newStories: number;
  updatedStories: number;
  corroborated: number;
  unchanged: number;
  analysed: number;
  analysisFailed: number;
  analysisSkipped: string | null;
  errors: string[];
}

/** List-sized story view for feed pages (keeps page payloads small). */
export interface RadarListItem {
  id: string;
  title: string;
  summary: string;
  category: RadarCategory;
  publishedAt: string;
  dateEstimated: boolean;
  firstSeenAt: string;
  updatedAt: string | null;
  importance: Importance;
  score: number;
  minor: boolean;
  analysed: boolean;
  /** The original article. */
  url: string;
  sourceName: string;
  sourceCount: number;
  related: string[];
  /** Why a developer should care; null when there's nothing specific to say. */
  why: string | null;
  whyKind: "ai" | "rule" | null;
}

export interface SourceProblem {
  name: string;
  error: string;
  failures: number;
}

/** feed.json on the radar-data branch: public, secret-free, read by the site at runtime. */
export interface RadarFeed {
  version: 1;
  generatedAt: string;
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  sourceCount: number;
  healthyCount: number;
  problems: SourceProblem[];
  briefing: string[];
  items: RadarListItem[];
}

/** An existing lesson the analysis may link to. */
export interface TopicRef {
  domain: string;
  topic: string;
  title: string;
}
