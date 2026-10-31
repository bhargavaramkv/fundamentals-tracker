import Anthropic from "@anthropic-ai/sdk";
import { RADAR_CATEGORY_LABELS, type RadarStory, type TopicRef } from "./types";

export const ANALYSIS_MODEL = "claude-opus-5-5";

const str = { type: "string" } as const;
const strList = { type: "array", items: str } as const;
const rating = { type: "integer", enum: [1, 2, 3, 4, 5] } as const;

/** JSON schema the model must follow (structured outputs); validateAnalysis re-checks limits the schema can't express. */
export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline", "summary", "whatHappened", "technicalExplanation", "whyItMatters", "industryImpact", "fundamentals",
    "applications", "learn", "relatedTopics", "sourceFacts", "companyClaims", "technicalSignificance",
    "practicalRelevance", "significanceRationale", "limitations",
  ],
  properties: {
    headline: str,
    summary: str,
    whatHappened: str,
    technicalExplanation: str,
    whyItMatters: str,
    industryImpact: str,
    fundamentals: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["concept", "explanation"], properties: { concept: str, explanation: str } },
    },
    applications: strList,
    learn: strList,
    relatedTopics: strList,
    sourceFacts: strList,
    companyClaims: strList,
    technicalSignificance: rating,
    practicalRelevance: rating,
    significanceRationale: str,
    limitations: str,
  },
} as const;

/** Stable across runs so the prompt prefix caches; the per-story material goes in the user turn. */
export function systemPrompt(topics: TopicRef[]): string {
  return `You write the Tech Radar for "Fundamentals", a personal learning site for a full-stack engineer (C#/.NET, Angular, TypeScript, MongoDB, Kubernetes, Azure) who wants to understand technology news through the engineering fundamentals behind it.

You receive one news item: its metadata, the feed excerpt, and (when it could be fetched) the text of the original article. Produce an analysis as JSON.

Ground rules — these matter more than anything else:
- Use only the provided text. Do not add facts, numbers, dates, names, versions or quotes that are not in it. If the text is thin (for example only a short excerpt), say less and explain the gap in "limitations".
- "sourceFacts": concrete statements the source itself reports as fact (what shipped, what was found, which versions, dates). Keep each one attributable to the provided text.
- "companyClaims": assertions the vendor or author makes about itself that the text does not independently establish (performance numbers, "fastest", "most secure", roadmap promises). Phrase them as claims, e.g. "OpenAI says…". Empty list if there are none.
- Everything else (technicalExplanation, whyItMatters, industryImpact, fundamentals, applications, learn) is your analysis. It may draw on well-established general engineering knowledge to teach the fundamentals, but must not present guesses about this specific event as fact. Hedge forecasts ("could", "is likely to").
- "relatedTopics": choose 0-4 keys ONLY from the lesson list below, and only when the story genuinely exercises that topic. An empty list is better than a forced link.
- "fundamentals": 2-5 concepts the story turns on (e.g. for a new model: transformer attention, context windows, inference cost, tool calling), each explained in 2-4 sentences for an engineer.
- "learn": 2-5 concrete things a developer should study or try next.
- headline: plain and specific, at most 120 characters, no hype. summary: 1-2 sentences, at most 300 characters.
- technicalSignificance / practicalRelevance: 1 (trivial) to 5 (landmark / directly changes how engineers work). Most stories are 2-3. Justify briefly in significanceRationale.
- Write in plain English. Paragraph fields: 2-5 sentences each. No markdown headings.

Lesson list (key — title):
${topics.map((t) => `${t.domain}/${t.topic} — ${t.title}`).join("\n")}`;
}

export function userPrompt(story: RadarStory, articleText: string | null): string {
  const corroboration = story.sources
    .slice(1)
    .map((s) => `- ${s.sourceName}: "${s.title}" (${s.url})`)
    .join("\n");
  return `Category: ${RADAR_CATEGORY_LABELS[story.category]}
Primary source: ${story.sources[0].sourceName} (${story.canonicalUrl})
Published: ${story.publishedAt}${story.dateEstimated ? " (source gave no date; this is when it was found)" : ""}
Title: ${story.title}
${corroboration ? `Also reported by:\n${corroboration}\n` : ""}
Feed excerpt:
"""
${story.excerpt || "(none)"}
"""

${articleText ? `Article text (fetched from the primary source, may include page chrome):\n"""\n${articleText}\n"""` : "The article page could not be fetched; only the excerpt above is available."}`;
}

export interface AnalyzerResult {
  raw: unknown;
  model: string;
}

export type Analyzer = (story: RadarStory, articleText: string | null) => Promise<AnalyzerResult>;

export class AnalysisRefused extends Error {}

/** Claude-backed analyzer. Throws on refusal, truncation or non-JSON output; the pipeline records the failure. */
export function createAnalyzer(opts: { apiKey: string; topics: TopicRef[]; client?: Anthropic }): Analyzer {
  const client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 4, timeout: 180_000 });
  const system = systemPrompt(opts.topics);
  return async (story, articleText) => {
    const res = await client.beta.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: ANALYSIS_SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: "user", content: userPrompt(story, articleText) }],
    });
    if (res.stop_reason === "refusal") throw new AnalysisRefused(`model declined (${res.stop_details?.category ?? "no category"})`);
    if (res.stop_reason === "max_tokens") throw new Error("analysis truncated at max_tokens");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      return { raw: JSON.parse(text), model: res.model };
    } catch {
      throw new Error("model output was not valid JSON");
    }
  };
}
