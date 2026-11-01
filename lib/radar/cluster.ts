import { eventKeys } from "./text";
import type { Credibility, RadarStory } from "./types";

/**
 * Finds stories that report the same event under different headlines ("Malicious Claude Code extension on Cursor
 * planted SSH backdoors" and "Anthropic VS Code extension on Cursor backdoored for nearly 12 hours"). Plain title
 * similarity misses these, so the feed showed one event several times.
 *
 * Tokens are lightly stemmed and weighted by how rare they are in the recent corpus: sharing "cursor", "backdoor" and
 * "extension" says far more than sharing "code" or "ai".
 */

const DAY = 86_400_000;
const WINDOW = 4 * DAY;
/** Tuned on real headlines: strong overlap on 3+ tokens, or a weaker overlap backed by 4+ shared tokens. */
export function isSameEvent(score: number, shared: number): boolean {
  return (score >= 0.34 && shared >= 3) || (score >= 0.25 && shared >= 4);
}

const STOP = new Set(
  "a about after against all also an and any are as at be been before being but by can could did do does for from had has have how if in into is it its just like may might more most new no not now of off on one or our out over say says said should so some still such than that the their them then there these they this to two under up us use used using very via was we were what when where which while who why will with within without would you your introducing announcing announces announced update updates available now release releases released blog post week today".split(
    " ",
  ),
);

function stem(t: string): string {
  if (t.length <= 4) return t;
  return t.replace(/(ing|ers|ed|es|s)$/, "");
}

/** Significant, lightly stemmed tokens of a headline. */
export function clusterTokens(title: string): Set<string> {
  const out = new Set<string>();
  for (const raw of title.toLowerCase().split(/[^\p{L}\p{N}.+#-]+/u)) {
    const t = raw.replace(/^[.-]+|[.-]+$/g, "");
    if (t.length < 2 || STOP.has(t)) continue;
    // "post-quantum" contributes both the phrase and its parts' best match when split elsewhere.
    for (const part of t.split("-")) if (part.length > 1 && !STOP.has(part)) out.add(stem(part));
  }
  return out;
}

export function documentFrequency(titles: Iterable<Set<string>>): { df: Map<string, number>; docs: number } {
  const df = new Map<string, number>();
  let docs = 0;
  for (const tokens of titles) {
    docs++;
    for (const t of tokens) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return { df, docs };
}

/** IDF-weighted Jaccard similarity of two token sets (0-1), plus how many tokens they share. */
export function weightedSimilarity(a: Set<string>, b: Set<string>, df: Map<string, number>, docs: number): { score: number; shared: number } {
  const idf = (t: string) => Math.log(1 + docs / (df.get(t) ?? 1));
  let inter = 0;
  let union = 0;
  let shared = 0;
  for (const t of a) {
    union += idf(t);
    if (b.has(t)) {
      inter += idf(t);
      shared++;
    }
  }
  for (const t of b) if (!a.has(t)) union += idf(t);
  return { score: union === 0 ? 0 : inter / union, shared };
}

/** Stories naming different CVEs are different events, however alike the headlines read. */
function differentEvents(a: RadarStory, b: RadarStory): boolean {
  const ka = eventKeys(a.title);
  const kb = eventKeys(b.title);
  return ka.length > 0 && kb.length > 0 && !ka.some((k) => kb.includes(k));
}

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/** The story that should lead a cluster: analysed beats unanalysed, then better source, then earliest report. */
function leaderOrder(a: RadarStory, b: RadarStory): number {
  const cred = (s: RadarStory): Credibility => s.sources[0].credibility;
  return (
    Number(Boolean(b.analysis)) - Number(Boolean(a.analysis)) ||
    cred(b) - cred(a) ||
    a.publishedAt.localeCompare(b.publishedAt) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Marks later reports of an event as `duplicateOf` the cluster's leader and adds them to its sources. Nothing is
 * deleted: a duplicate keeps its id and page, it just stops appearing in lists. Returns the leaders it changed, which
 * the caller rescores (corroboration counts toward rank).
 */
export function clusterStories(stories: RadarStory[], now: Date): { merged: number; changed: Set<RadarStory> } {
  const changed = new Set<RadarStory>();
  let merged = 0;
  // Only recent stories: older ones are settled, and an event's reports arrive within days of each other.
  const recent = stories.filter((s) => now.getTime() - Date.parse(s.publishedAt) < 30 * DAY);
  const tokens = new Map(recent.map((s) => [s, clusterTokens(s.title)]));
  const { df, docs } = documentFrequency(tokens.values());
  const byId = new Map(stories.map((s) => [s.id, s]));
  const leaderOf = (s: RadarStory): RadarStory => {
    let cur = s;
    while (cur.duplicateOf && byId.has(cur.duplicateOf)) cur = byId.get(cur.duplicateOf) as RadarStory;
    return cur;
  };

  const ordered = [...recent].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i];
      const b = ordered[j];
      if (Date.parse(b.publishedAt) - Date.parse(a.publishedAt) > WINDOW) break;
      if (a.minor || b.minor) continue;
      // One source doesn't report one event twice: same-source look-alikes are separate advisories or releases.
      if (a.sources[0].sourceId === b.sources[0].sourceId) continue;
      if (differentEvents(a, b)) continue;
      const la = leaderOf(a);
      const lb = leaderOf(b);
      if (la === lb) continue;
      const { score, shared } = weightedSimilarity(tokens.get(a) as Set<string>, tokens.get(b) as Set<string>, df, docs);
      if (!isSameEvent(score, shared)) continue;
      const [leader, dup] = [la, lb].sort(leaderOrder);
      dup.duplicateOf = leader.id;
      merged++;
      for (const src of dup.sources) {
        if (!leader.sources.some((x) => x.url === src.url || hostOf(x.url) === hostOf(src.url))) leader.sources.push(src);
      }
      changed.add(leader);
      changed.delete(dup);
    }
  }
  // A leader can itself be folded into a better report later, so point every duplicate at the final leader.
  for (const s of stories) if (s.duplicateOf) s.duplicateOf = leaderOf(s).id;
  return { merged, changed };
}
