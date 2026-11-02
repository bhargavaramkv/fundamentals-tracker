import type { RadarStory } from "./types";

export type WhyKind = "ai" | "rule";

export interface WhyItMatters {
  text: string;
  /** "ai": written by the model from the source. "rule": a fixed note chosen from signals in the headline. */
  kind: WhyKind;
}

const STACK = /\b(kubernetes|docker|postgres(?:ql)?|mongodb|redis|kafka|typescript|node(?:\.js)?|angular|react|\.net|c#|rust|python|azure|aws|github|llm)\b/gi;

/** Checked in order; the first match wins, so the most urgent reason is the one shown. */
const RULES: [RegExp, string][] = [
  [/\b(actively exploited|exploited in the wild|zero-day|0-day)\b/i, "Attackers are already using this. If you run the affected software, check your version and the vendor's fix today."],
  [/\b(backdoor(ed|s)?|malicious|supply[- ]chain|compromised?)\b/i, "Developer tools and dependencies are the entry point here. Check whether this reached your machine, your CI or your lockfile."],
  [/\b(critical|cve-\d|vulnerabilit(y|ies)|remote code execution|rce|flaw)\b/i, "A security issue in shared software. Check whether you depend on it, directly or transitively, before it reaches production."],
  [/\b(breach|leak(ed|s)?|stolen|exposed)\b/i, "A real incident. Rotate anything that could be affected and check how your own secrets and access are handled."],
  [/\b(end of life|end-of-life|deprecat\w*|sunset\w*|retir(es|ing|ement))\b/i, "This sets a deadline. Find out whether your code or infrastructure depends on it, and plan the migration before it's forced."],
  [/\b(outage|post-?mortem|incident)\b/i, "Failure reports show how real systems break. Compare this failure mode with the dependencies your own service relies on."],
  [/\b(generally available|general availability)\b/i, "General availability usually means it's supported for production use. Check the limits and pricing if you've been waiting for it."],
  [/\b(acqui(res|red|sition)|licen[cs]e change|relicens\w*)\b/i, "Ownership and licence changes can alter a tool's roadmap, price or terms. It matters if you build on this."],
  [/\bopen[- ]sourc(es|ed|ing)\b/i, "You can now read, run or fork this yourself. Check the licence before relying on it."],
  [/\b\d+\.0(?![.\d])/, "A major version can include breaking changes. Read the upgrade notes before moving to it."],
  [/\b(new model|model weights|llm|gpt-?\d|claude|gemini|llama)\b/i, "Models change what you can build and what it costs. Test it on your own workload rather than trusting published benchmarks."],
  [/\b(preview|beta|alpha)\b/i, "Previews can change before release. Worth evaluating now, but don't build production dependencies on it yet."],
];

/**
 * Why a developer should care. The AI analysis wins when there is one. Otherwise a rule picks a fixed note from signals
 * in the headline. These notes say what to check, and never assert anything about the event that the source didn't.
 */
export function whyItMatters(story: Pick<RadarStory, "title" | "excerpt" | "analysis" | "sources">): WhyItMatters | null {
  if (story.analysis?.whyItMatters) return { text: story.analysis.whyItMatters, kind: "ai" };
  if (story.sources.some((s) => s.sourceId === "cisa-kev")) {
    return { text: "CISA lists this as exploited in the wild. If you run the affected product, check your version and the vendor's fix today.", kind: "rule" };
  }
  for (const [re, text] of RULES) if (re.test(story.title)) return { text, kind: "rule" };
  const terms = [...new Set((`${story.title} ${story.excerpt.slice(0, 400)}`.match(STACK) ?? []).map((t) => t.toLowerCase()))];
  if (terms.length > 0) return { text: `Touches tools you may use: ${terms.slice(0, 4).join(", ")}. Check whether it changes anything in your setup.`, kind: "rule" };
  return null;
}
