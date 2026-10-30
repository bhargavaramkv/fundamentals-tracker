import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith("#x")) return safeCodePoint(parseInt(k.slice(2), 16), m);
    if (k.startsWith("#")) return safeCodePoint(parseInt(k.slice(1), 10), m);
    return ENTITIES[k] ?? m;
  });
}

function safeCodePoint(n: number, fallback: string): string {
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : fallback;
}

/** HTML (or text) to whitespace-collapsed plain text. Drops script/style/nav chrome. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > max * 0.6 ? at : max).trimEnd()}…`;
}

const TRACKING = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$|source$|cmpid$|ocid$)/i;

/** Canonical form for deduplication: https, lowercase host without www, no tracking params, no fragment or trailing slash. */
export function canonicalUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

export function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Hash of what a reader sees; a change means the source edited the story. */
export function contentHash(title: string, excerpt: string): string {
  return sha(`${normalizeTitle(title)}\n${excerpt.replace(/\s+/g, " ").trim().slice(0, 600)}`).slice(0, 16);
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").trim();
}

const STOP = new Set(
  "a an and are as at be by for from has have how in into is it its new of on or our the their this to was we what when why will with you your now introducing announcing update updates".split(
    " ",
  ),
);

export function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

/** Jaccard similarity of significant title tokens (0-1). */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/** Identifiers that name the same event across sources: CVE IDs and GHSA IDs. */
export function eventKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(/\bCVE-\d{4}-\d{4,}\b/gi)) keys.add(m[0].toUpperCase());
  for (const m of text.matchAll(/\bGHSA(?:-[23456789cfghjmpqrvwx]{4}){3}\b/gi)) keys.add(m[0].toUpperCase());
  return [...keys];
}

export function slugify(s: string, max = 60): string {
  const slug = normalizeTitle(s).replace(/\./g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug.slice(0, max).replace(/-[^-]*$/, (m) => (slug.length > max ? "" : m)) || "story";
}

/** Parses a date string to ISO, or null when missing or implausible (future by more than a day, or before 2000). */
export function toIso(value: unknown, now: Date): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const d = new Date(value);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  if (t > now.getTime() + 86_400_000 || d.getUTCFullYear() < 2000) return null;
  return d.toISOString();
}
