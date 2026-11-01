/** Where a learning resource comes from. The source decides how much it can be trusted (see TIER_FOR_SOURCE). */
export const RESOURCE_SOURCES = ["standard", "official-docs", "university", "book", "education", "blog", "video"] as const;
export type ResourceSource = (typeof RESOURCE_SOURCES)[number];

/** 1: authoritative. 2: established educational. 3: supplementary, useful but not a reference. */
export type ReliabilityTier = 1 | 2 | 3;

export const TIER_FOR_SOURCE: Record<ResourceSource, ReliabilityTier> = {
  standard: 1,
  "official-docs": 1,
  university: 1,
  book: 2,
  education: 2,
  blog: 3,
  video: 3,
};

export const SOURCE_LABEL: Record<ResourceSource, string> = {
  standard: "Standard",
  "official-docs": "Official docs",
  university: "University",
  book: "Book",
  education: "Established guide",
  blog: "Blog",
  video: "Video",
};

export const TIER_LABEL: Record<ReliabilityTier, string> = {
  1: "Authoritative",
  2: "Established",
  3: "Supplementary",
};

export interface Resource {
  id: string;
  title: string;
  publisher: string;
  source: ResourceSource;
  tier: ReliabilityTier;
  url: string;
  /** Lesson keys (`domain/topic`) this resource supports. */
  topics: string[];
  /** What to read it for. */
  note: string;
  /** Date (YYYY-MM-DD) the URL was last confirmed to resolve to this resource. See scripts/verify-resources.ts. */
  verifiedAt: string;
}

/** A link older than this is shown as due for re-checking. */
export const VERIFY_MAX_AGE_DAYS = 180;

export function isVerificationStale(verifiedAt: string, now: number = Date.now()): boolean {
  return now - Date.parse(`${verifiedAt}T00:00:00Z`) > VERIFY_MAX_AGE_DAYS * 86_400_000;
}

/** Most reliable first; within a tier the registry's order stands. */
export function resourcesForTopic(all: Resource[], key: string): Resource[] {
  return all.filter((r) => r.topics.includes(key)).sort((a, b) => a.tier - b.tier);
}

/** Checks the registry's rules. Blogs and videos can never be presented as authoritative. */
export function validateResources(raw: unknown[], lessonKeys: ReadonlySet<string>, now: number = Date.now()): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  raw.forEach((item, i) => {
    const r = item as Partial<Resource>;
    const where = `resource[${i}] (${String(r?.id ?? "no id")})`;
    const add = (msg: string) => errors.push(`${where}: ${msg}`);
    if (typeof r.id !== "string" || !/^[a-z0-9-]+$/.test(r.id)) add("id must be a lowercase slug");
    else if (seenIds.has(r.id)) add("duplicate id");
    else seenIds.add(r.id);
    for (const k of ["title", "publisher", "note"] as const) if (typeof r[k] !== "string" || !r[k]?.trim()) add(`${k} is required`);
    if (typeof r.url !== "string" || !/^https:\/\/\S+$/.test(r.url)) add("url must be https");
    else if (seenUrls.has(r.url)) add("duplicate url");
    else seenUrls.add(r.url);
    if (!RESOURCE_SOURCES.includes(r.source as ResourceSource)) add(`unknown source ${String(r.source)}`);
    else if (r.tier !== TIER_FOR_SOURCE[r.source as ResourceSource]) add(`a ${String(r.source)} resource must be tier ${TIER_FOR_SOURCE[r.source as ResourceSource]}`);
    if (!Array.isArray(r.topics) || r.topics.length === 0) add("needs at least one topic");
    else for (const t of r.topics) if (!lessonKeys.has(t)) add(`unknown topic ${t}`);
    if (typeof r.verifiedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.verifiedAt)) add("verifiedAt must be YYYY-MM-DD");
    else if (Date.parse(`${r.verifiedAt}T00:00:00Z`) > now + 86_400_000) add("verifiedAt is in the future");
  });
  return errors;
}
