import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { FeedItem, SourceDef } from "./types";
import { htmlToText, toIso, truncate } from "./text";

const EXCERPT_MAX = 1200;

export class FeedParseError extends Error {}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: false,
  processEntities: true,
  htmlEntities: true,
  // Feeds are untrusted input: no DTD expansion beyond the built-in entities.
  allowBooleanAttributes: true,
});

type Node = Record<string, unknown>;

const list = (v: unknown): unknown[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

function text(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") return text((v as Node)["#text"]);
  return "";
}

function atomLink(v: unknown): string {
  const links = list(v) as Node[];
  const pick =
    links.find((l) => typeof l === "object" && (l["@_rel"] === undefined || l["@_rel"] === "alternate")) ?? links[0];
  if (!pick) return "";
  return typeof pick === "string" ? pick : text(pick["@_href"]);
}

function make(source: SourceDef, title: string, url: string, published: unknown, updated: unknown, body: string, now: Date): FeedItem | null {
  const cleanTitle = htmlToText(title).replace(/\s+/g, " ").trim();
  const cleanUrl = url.trim();
  if (!cleanTitle || !/^https?:\/\//i.test(cleanUrl)) return null;
  return {
    sourceId: source.id,
    title: truncate(cleanTitle, 220),
    url: cleanUrl,
    publishedAt: toIso(published, now),
    updatedAt: toIso(updated, now),
    excerpt: truncate(htmlToText(body), EXCERPT_MAX),
  };
}

/** Parses RSS 2.0, RSS 1.0 (RDF) or Atom. Throws FeedParseError when the document is none of those. */
export function parseFeed(xml: string, source: SourceDef, now: Date): FeedItem[] {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new FeedParseError(`malformed XML: ${valid.err.msg} (line ${valid.err.line})`);
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (err) {
    throw new FeedParseError(`malformed XML: ${(err as Error).message.slice(0, 120)}`);
  }
  const out: (FeedItem | null)[] = [];
  const rss = doc.rss as Node | undefined;
  const rdf = doc["rdf:RDF"] as Node | undefined;
  const atom = doc.feed as Node | undefined;

  if (rss?.channel) {
    for (const it of list((rss.channel as Node).item) as Node[]) {
      const guid = text(it.guid);
      const link = text(it.link) || (/^https?:\/\//.test(guid) ? guid : "");
      const body = text(it["content:encoded"]) || text(it.description);
      out.push(make(source, text(it.title), link, it.pubDate ?? it["dc:date"], it["atom:updated"], body, now));
    }
  } else if (rdf) {
    for (const it of list(rdf.item) as Node[]) {
      out.push(make(source, text(it.title), text(it.link), it["dc:date"], undefined, text(it.description), now));
    }
  } else if (atom) {
    for (const it of list(atom.entry) as Node[]) {
      const body = text(it.summary) || text(it.content);
      out.push(make(source, text(it.title), atomLink(it.link), it.published ?? it.updated, it.updated, body, now));
    }
  } else {
    throw new FeedParseError("not an RSS, RDF or Atom document");
  }
  return out.filter((x): x is FeedItem => x !== null);
}

interface GithubRelease {
  name?: string | null;
  tag_name?: string;
  html_url?: string;
  published_at?: string | null;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
}

/** GitHub REST `GET /repos/{owner}/{repo}/releases`. Drafts and pre-releases are skipped. */
export function parseGithubReleases(json: unknown, source: SourceDef, now: Date): FeedItem[] {
  if (!Array.isArray(json)) throw new FeedParseError("expected a JSON array of releases");
  const repo = source.url;
  return (json as GithubRelease[])
    .filter((r) => r && !r.draft && !r.prerelease && typeof r.html_url === "string")
    .map((r) => {
      const label = (r.name || r.tag_name || "").trim();
      const title = label.toLowerCase().includes(repo.split("/")[1].toLowerCase()) ? label : `${repo.split("/")[1]} ${label}`;
      return make(source, title, r.html_url as string, r.published_at, undefined, r.body ?? "", now);
    })
    .filter((x): x is FeedItem => x !== null);
}

interface KevEntry {
  cveID?: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  shortDescription?: string;
  requiredAction?: string;
  knownRansomwareCampaignUse?: string;
}

/** CISA Known Exploited Vulnerabilities catalog (JSON). One item per newly added CVE. */
export function parseKev(json: unknown, source: SourceDef, now: Date): FeedItem[] {
  const vulns = (json as { vulnerabilities?: unknown })?.vulnerabilities;
  if (!Array.isArray(vulns)) throw new FeedParseError("expected { vulnerabilities: [...] }");
  return (vulns as KevEntry[])
    .filter((v) => v && typeof v.cveID === "string" && /^CVE-\d{4}-\d+$/.test(v.cveID))
    .map((v) => {
      const body = [
        v.shortDescription,
        v.requiredAction ? `Required action: ${v.requiredAction}` : "",
        v.knownRansomwareCampaignUse === "Known" ? "Known to be used in ransomware campaigns." : "",
      ]
        .filter(Boolean)
        .join(" ");
      const title = `Actively exploited: ${v.vendorProject ?? ""} ${v.product ?? ""} ${v.cveID} (${v.vulnerabilityName ?? "vulnerability"})`;
      // The date CISA added it is when it became known-exploited; noon UTC avoids a timezone shift to the previous day.
      return make(source, title, `https://nvd.nist.gov/vuln/detail/${v.cveID}`, v.dateAdded ? `${v.dateAdded}T12:00:00Z` : null, undefined, body, now);
    })
    .filter((x): x is FeedItem => x !== null);
}

export function parseSource(body: string, source: SourceDef, now: Date): FeedItem[] {
  if (source.kind === "feed") return parseFeed(body, source, now);
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new FeedParseError("malformed JSON");
  }
  return source.kind === "github-releases" ? parseGithubReleases(json, source, now) : parseKev(json, source, now);
}
