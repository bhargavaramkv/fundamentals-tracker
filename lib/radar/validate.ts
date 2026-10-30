import { RADAR_CATEGORIES, type RadarAnalysis, type RadarStory } from "./types";

const isStr = (v: unknown, min = 1): v is string => typeof v === "string" && v.trim().length >= min;
const isIso = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const isHttps = (v: unknown): v is string => typeof v === "string" && /^https:\/\/[^\s]+$/.test(v);
const strList = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every((x) => isStr(x));

/** The model's JSON output, before pipeline metadata (model, generatedAt, basedOn) is attached. */
export type AnalysisDraft = Omit<RadarAnalysis, "model" | "generatedAt" | "basedOn">;

/**
 * Validates model output. Lesson links are filtered to keys that exist (an invented key is dropped, not an error);
 * anything structurally wrong is an error, and the story stays unanalysed rather than publishing a partial analysis.
 */
export function validateAnalysis(raw: unknown, lessonKeys: ReadonlySet<string>): { analysis: AnalysisDraft | null; errors: string[] } {
  const a = raw as Partial<AnalysisDraft> | null;
  const errors: string[] = [];
  if (!a || typeof a !== "object") return { analysis: null, errors: ["analysis is not an object"] };

  const texts: (keyof AnalysisDraft)[] = ["headline", "summary", "whatHappened", "technicalExplanation", "whyItMatters", "industryImpact", "significanceRationale", "limitations"];
  for (const k of texts) if (!isStr(a[k], k === "limitations" ? 0 : 10)) errors.push(`${k} missing or too short`);
  if (isStr(a.headline) && a.headline.length > 160) errors.push("headline longer than 160 characters");
  if (isStr(a.summary) && a.summary.length > 600) errors.push("summary longer than 600 characters");

  if (!Array.isArray(a.fundamentals) || a.fundamentals.length === 0 || a.fundamentals.length > 8 || !a.fundamentals.every((f) => f && isStr(f.concept) && isStr(f.explanation, 20))) {
    errors.push("fundamentals must be 1-8 { concept, explanation } entries");
  }
  for (const [k, max] of [["applications", 8], ["learn", 8], ["sourceFacts", 12], ["companyClaims", 12], ["relatedTopics", 6]] as const) {
    if (!strList(a[k], max)) errors.push(`${k} must be a list of at most ${max} strings`);
  }
  if (Array.isArray(a.sourceFacts) && a.sourceFacts.length === 0) errors.push("sourceFacts must state at least one fact from the source");
  for (const k of ["technicalSignificance", "practicalRelevance"] as const) {
    if (!Number.isInteger(a[k]) || (a[k] as number) < 1 || (a[k] as number) > 5) errors.push(`${k} must be an integer 1-5`);
  }
  if (errors.length > 0) return { analysis: null, errors };
  return {
    analysis: { ...(a as AnalysisDraft), relatedTopics: (a.relatedTopics as string[]).filter((k) => lessonKeys.has(k)) },
    errors,
  };
}

/** Structural check for stored stories (used by the loader and tests). */
export function validateStory(raw: unknown): string[] {
  const s = raw as Partial<RadarStory> | null;
  if (!s || typeof s !== "object") return ["not an object"];
  const errors: string[] = [];
  if (!isStr(s.id) || !/^[a-z0-9-]+$/.test(s.id)) errors.push("id must be a lowercase slug");
  if (!isStr(s.title)) errors.push("title missing");
  if (!isHttps(s.canonicalUrl)) errors.push("canonicalUrl must be https");
  if (!RADAR_CATEGORIES.includes(s.category as never)) errors.push(`unknown category ${String(s.category)}`);
  for (const k of ["publishedAt", "firstSeenAt", "lastSeenAt"] as const) if (!isIso(s[k])) errors.push(`${k} must be an ISO date`);
  if (!Array.isArray(s.sources) || s.sources.length === 0 || !s.sources.every((x) => x && isHttps(x.url) && isStr(x.sourceName))) {
    errors.push("sources must be a non-empty list with https URLs");
  }
  if (!s.score || typeof s.score.total !== "number" || !Array.isArray(s.score.parts)) errors.push("score missing");
  else if (s.score.parts.reduce((n, p) => n + p.points, 0) !== s.score.total && s.score.total !== 0 && s.score.total !== 100) {
    errors.push("score parts must add up to the total");
  }
  if (s.status === "analysed" && !s.analysis) errors.push("analysed story without analysis");
  if (s.analysis && (!isStr(s.analysis.model) || !isIso(s.analysis.generatedAt) || !Array.isArray(s.analysis.basedOn))) {
    errors.push("analysis is missing provenance (model, generatedAt, basedOn)");
  }
  return errors;
}
