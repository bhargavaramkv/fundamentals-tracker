import type { Credibility, Importance, RadarAnalysis, RadarCategory, ScorePart, StorySource } from "./types";

const CATEGORY_TERMS: [RadarCategory, RegExp][] = [
  ["security", /\b(cve-\d|vulnerab|exploit|zero-day|0-day|ransomware|breach|malware|phishing|backdoor|patch tuesday|advisory|attack|threat actor|supply[- ]chain attack|leak(ed)?)\b/i],
  ["ai-ml", /\b(ai|llm|gpt|claude|gemini|llama|model weights|inference|transformer|neural|machine learning|agentic|agents?|diffusion|fine-tun|embedding)\b/i],
  ["cloud", /\b(aws|azure|google cloud|gcp|kubernetes|k8s|serverless|data ?cent(er|re)|postgres|mysql|mongodb|database|distributed|outage|cdn|terraform|container)\b/i],
  ["hardware", /\b(chip|cpu|gpu|semiconductor|tsmc|intel|amd|arm|risc-v|quantum|robot|battery|fab|nm process|wafer)\b/i],
  ["developer", /\b(programming|language|framework|compiler|typescript|javascript|python|rust|golang|java|\.net|c#|npm|open[- ]source|ide|github|release)\b/i],
  ["research", /\b(paper|research|study|arxiv|benchmark|breakthrough|scientists)\b/i],
];

/** Picks a category for stories from mixed-topic publications; falls back to the source's default. */
export function classifyCategory(title: string, excerpt: string, fallback: RadarCategory): RadarCategory {
  const t = `${title} ${excerpt.slice(0, 400)}`;
  for (const [cat, re] of CATEGORY_TERMS) if (re.test(title)) return cat;
  for (const [cat, re] of CATEGORY_TERMS) if (re.test(t)) return cat;
  return fallback;
}

/** Patch/maintenance releases and routine housekeeping: kept for history, hidden from the briefing by default. */
export function isMinor(title: string): boolean {
  if (/\b(v?\d+\.\d+\.(?!0\b)\d+)\b/.test(title) && !/\b(security|cve|critical|vulnerab)/i.test(title)) return true;
  return /\b(patch release|bug ?fix(es)? release|maintenance release|release candidate|\brc\d*\b|nightly|weekly digest|this week in|newsletter|roundup|webinar|podcast|join us|meetup|recap)\b/i.test(title);
}

const MAJOR = /\b(launch(es|ed)?|introduc(es|ing|ed)|announc(es|ing|ed)|unveil(s|ed)?|general availability|generally available|now available|open[- ]sourc(es|ed|ing)|acqui(res|red|sition)|partnership|zero-day|actively exploited|critical|breakthrough|new model|\d+\.0\b|deprecat(es|ed|ion)|end of life|outage|postmortem|post-mortem)\b/i;
const MODERATE = /\b(preview|beta|release[sd]?|improv(es|ed|ements)|faster|benchmark|study|research|update[sd]?)\b/i;
const RELEVANCE = /\b(kubernetes|docker|postgres(ql)?|mongodb|redis|kafka|typescript|javascript|node(\.js)?|angular|react|\.net|c#|rust|go|python|azure|aws|database|distributed|consensus|latency|throughput|cache|caching|concurren\w*|compiler|runtime|garbage collect\w*|memory safety|tls|oauth|authentication|api|llm|inference|context window|tool calling|agents?|vector|index(es|ing)?|replication|sharding|observability|ci\/cd|supply chain)\b/gi;

const CREDIBILITY_POINTS: Record<Credibility, number> = { 3: 20, 2: 14, 1: 8 };

export interface ScoreInput {
  title: string;
  excerpt: string;
  category: RadarCategory;
  sources: StorySource[];
  publishedAt: string;
  minor: boolean;
  isKev: boolean;
  analysis?: Pick<RadarAnalysis, "technicalSignificance" | "practicalRelevance" | "significanceRationale">;
}

/**
 * Explainable 0-100 score. Each part names its reason so the UI can show why a story ranks where it does.
 * Signals: source credibility, independent corroboration, significance terms, practical relevance to software
 * engineers, freshness, minor-release penalty, and (once analysed) the model's own significance ratings.
 */
export function scoreStory(input: ScoreInput, now: Date): { total: number; parts: ScorePart[] } {
  const parts: ScorePart[] = [{ label: "Baseline", points: 15, reason: "Every story from a tracked source starts here" }];
  const best = Math.max(...input.sources.map((s) => s.credibility)) as Credibility;
  parts.push({ label: "Source credibility", points: CREDIBILITY_POINTS[best], reason: best === 3 ? "Primary source (the vendor or project itself)" : best === 2 ? "Established publication or research venue" : "Aggregator" });

  const independent = new Set(input.sources.map((s) => new URL(s.url).hostname.replace(/^www\./, ""))).size;
  if (independent > 1) parts.push({ label: "Corroboration", points: Math.min(16, (independent - 1) * 8), reason: `Reported by ${independent} independent sources` });

  const text = `${input.title} ${input.excerpt.slice(0, 600)}`;
  const major = input.title.match(MAJOR) ?? text.match(MAJOR);
  if (major) parts.push({ label: "Significance", points: 15, reason: `Major development ("${major[0].toLowerCase()}")` });
  else {
    const moderate = text.match(MODERATE);
    if (moderate) parts.push({ label: "Significance", points: 5, reason: `Incremental development ("${moderate[0].toLowerCase()}")` });
  }
  if (input.isKev) parts.push({ label: "Exploitation", points: 12, reason: "Listed by CISA as exploited in the wild" });

  const terms = [...new Set((text.match(RELEVANCE) ?? []).map((m) => m.toLowerCase()))];
  if (terms.length > 0) parts.push({ label: "Engineering relevance", points: Math.min(15, terms.length * 3), reason: `Touches ${terms.slice(0, 5).join(", ")}` });

  const ageH = (now.getTime() - new Date(input.publishedAt).getTime()) / 3_600_000;
  if (ageH <= 36) parts.push({ label: "Freshness", points: 5, reason: "Published in the last 36 hours" });
  else if (ageH > 96) parts.push({ label: "Freshness", points: -5, reason: "Published more than 4 days before it was found" });

  if (input.minor) parts.push({ label: "Minor update", points: -20, reason: "Patch, maintenance or housekeeping post" });

  if (input.analysis) {
    const { technicalSignificance: t, practicalRelevance: p } = input.analysis;
    parts.push({ label: "AI-rated significance", points: (t + p) * 3 - 12, reason: `Technical ${t}/5, practical ${p}/5: ${input.analysis.significanceRationale}` });
  }

  const total = Math.max(0, Math.min(100, Math.round(parts.reduce((n, p) => n + p.points, 0))));
  return { total, parts };
}

export function importanceOf(total: number): Importance {
  return total >= 65 ? "high" : total >= 45 ? "notable" : "routine";
}
