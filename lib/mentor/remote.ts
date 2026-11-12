import type { KeyValueStore } from "@/lib/idb";
import type { Evidence } from "@/lib/knowledge/types";
import type { ReviewRequest } from "@/lib/journal/types";
import type { SessionReview } from "@/lib/review/types";
import type { WeeklyReport } from "@/lib/review/weekly";
import { DATA_REPO } from "@/lib/storage";
import { parseEvidenceFile, parseFailures, parseRequest, parseReview, parseWeekly, type ReviewFailure } from "./parse";

/**
 * Read-only access to the mentor files in the private data repo (reviews, weekly reports, knowledge evidence, review
 * requests, the V1 archive). Nothing here ever writes to GitHub. Files are cached by blob sha, so only changed files are
 * fetched and the last known data still shows offline.
 */

export interface MentorSource {
  /** path -> blob sha for the whole repo. */
  tree(): Promise<Map<string, string>>;
  /** The decoded text of a blob. */
  blob(sha: string): Promise<string>;
}

export interface ArchiveReport {
  /** File name without extension, e.g. 2026-11-06. */
  name: string;
  text: string;
}

export interface PendingRequest {
  request: ReviewRequest;
  failures: ReviewFailure[];
}

export interface MentorSnapshot {
  /** Newest first. */
  reviews: SessionReview[];
  /** Newest first. */
  pending: PendingRequest[];
  /** Newest week first. */
  weekly: WeeklyReport[];
  evidence: Evidence[];
  /** Newest first. */
  archive: ArchiveReport[];
  archiveReadme: string | null;
  /** Files skipped because they were unreadable or had an unexpected shape. */
  invalid: number;
  /** True when the tree could not be fetched and the last cached one was used. */
  stale: boolean;
}

export const EMPTY_SNAPSHOT: MentorSnapshot = { reviews: [], pending: [], weekly: [], evidence: [], archive: [], archiveReadme: null, invalid: 0, stale: false };

const TREE_KEY = "tree";
const CONCURRENCY = 8;

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export class GitHubMentorSource implements MentorSource {
  private readonly base = `https://api.github.com/repos/${DATA_REPO.owner}/${DATA_REPO.repo}`;

  constructor(
    private readonly token: string,
    private readonly doFetch: typeof fetch = (...a) => fetch(...a),
  ) {}

  private get(url: string): Promise<Response> {
    return this.doFetch(url, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.token}`, "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store" });
  }

  async tree(): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const ref = await this.get(`${this.base}/git/ref/heads/${encodeURIComponent(DATA_REPO.branch)}`);
    // 404: no such branch yet. 409: the repo has no commits.
    if (ref.status === 404 || ref.status === 409) return out;
    if (!ref.ok) throw new Error(`GitHub read failed (${ref.status})`);
    const commitSha = ((await ref.json()) as { object: { sha: string } }).object.sha;
    const commit = await this.get(`${this.base}/git/commits/${commitSha}`);
    if (!commit.ok) throw new Error(`GitHub read failed (${commit.status})`);
    const treeSha = ((await commit.json()) as { tree: { sha: string } }).tree.sha;
    const tree = await this.get(`${this.base}/git/trees/${treeSha}?recursive=1`);
    if (!tree.ok) throw new Error(`GitHub read failed (${tree.status})`);
    for (const n of ((await tree.json()) as { tree: { path: string; type: string; sha: string }[] }).tree) if (n.type === "blob") out.set(n.path, n.sha);
    return out;
  }

  async blob(sha: string): Promise<string> {
    const res = await this.get(`${this.base}/git/blobs/${sha}`);
    if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
    return fromBase64(((await res.json()) as { content: string }).content);
  }
}

const REVIEW = /^journal\/reviews\/([^/]+)\/([^/]+)\.json$/;
const WEEKLY = /^journal\/weekly\/(\d{4}-W\d{2})\.json$/;
const REQUEST = /^journal\/requests\/([^/]+)\/([^/]+)\.json$/;
const ARCHIVE = /^archive\/mentor-v1\/reports\/([^/]+)\.md$/;
const EVIDENCE_PATH = "knowledge/evidence.json";
const README_PATH = "archive/mentor-v1/README.md";

async function mapLimit<T, R>(items: T[], fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) out.push(...(await Promise.all(items.slice(i, i + CONCURRENCY).map(fn))));
  return out;
}

const newestFirst = <T,>(key: (t: T) => string) => (a: T, b: T) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0);

/**
 * Reads the tree once, then only the blobs that are needed and not cached. Never throws for bad content: invalid files
 * are counted. Throws only when there is neither a fresh tree nor a cached one.
 */
export async function loadMentor(source: MentorSource, cache: KeyValueStore<string>): Promise<MentorSnapshot> {
  let tree: Map<string, string>;
  let stale = false;
  try {
    tree = await source.tree();
    await cache.put(TREE_KEY, JSON.stringify([...tree])).catch(() => undefined);
  } catch (e) {
    const cached = await cache.get(TREE_KEY).catch(() => undefined);
    if (!cached) throw e;
    try {
      tree = new Map(JSON.parse(cached) as [string, string][]);
    } catch {
      throw e;
    }
    stale = true;
  }

  let invalid = 0;
  /** Text of a file, from cache or the network. Null when absent or unavailable (the latter is counted). */
  const text = async (path: string): Promise<string | null> => {
    const sha = tree.get(path);
    if (!sha) return null;
    try {
      const hit = await cache.get(`blob:${sha}`);
      if (hit !== undefined) return hit;
      const t = await source.blob(sha);
      await cache.put(`blob:${sha}`, t).catch(() => undefined);
      return t;
    } catch {
      invalid++;
      return null;
    }
  };
  /** Parsed JSON, or undefined when absent, unavailable or not JSON. */
  const json = async (path: string): Promise<unknown> => {
    const t = await text(path);
    if (t === null) return undefined;
    try {
      return JSON.parse(t);
    } catch {
      invalid++;
      return undefined;
    }
  };

  const paths = [...tree.keys()];
  const reviewed = new Set<string>();
  const reviewPaths: string[] = [];
  const weeklyPaths: string[] = [];
  const requestPaths: string[] = [];
  const archivePaths: string[] = [];
  for (const p of paths) {
    const r = REVIEW.exec(p);
    if (r) {
      reviewed.add(`${r[1]}/${r[2]}`);
      reviewPaths.push(p);
    } else if (WEEKLY.test(p)) weeklyPaths.push(p);
    else if (REQUEST.test(p)) requestPaths.push(p);
    else if (ARCHIVE.test(p)) archivePaths.push(p);
  }

  const reviews: SessionReview[] = [];
  for (const [p, raw] of await mapLimit(reviewPaths, async (p) => [p, await json(p)] as const)) {
    if (raw === undefined) continue;
    const m = REVIEW.exec(p)!;
    const review = parseReview(raw);
    if (review && review.sessionId === m[1] && review.id === m[2]) reviews.push(review);
    else invalid++;
  }
  reviews.sort(newestFirst((r) => r.createdAt));

  const weekly: WeeklyReport[] = [];
  for (const [p, raw] of await mapLimit(weeklyPaths, async (p) => [p, await json(p)] as const)) {
    if (raw === undefined) continue;
    const w = parseWeekly(raw);
    if (w && WEEKLY.exec(p)![1] === w.week) weekly.push(w);
    else invalid++;
  }
  weekly.sort(newestFirst((w) => w.week));

  let evidence: Evidence[] = [];
  if (tree.has(EVIDENCE_PATH)) {
    const raw = await json(EVIDENCE_PATH);
    if (raw !== undefined) {
      const f = parseEvidenceFile(raw);
      if (f) {
        evidence = f.items;
        invalid += f.invalid;
      } else invalid++;
    }
  }

  // Pending = a request with no review. Only those requests (and their failure logs) are fetched.
  const pending: PendingRequest[] = [];
  const pendingPaths = requestPaths.filter((p) => {
    const m = REQUEST.exec(p)!;
    return !reviewed.has(`${m[1]}/${m[2]}`);
  });
  for (const l of await mapLimit(pendingPaths, async (p) => {
    const m = REQUEST.exec(p)!;
    const raw = await json(p);
    if (raw === undefined) return null;
    const request = parseRequest(raw);
    if (!request || request.sessionId !== m[1] || request.id !== m[2]) {
      invalid++;
      return null;
    }
    let failures: ReviewFailure[] = [];
    const fRaw = await json(`journal/review-failures/${request.id}.json`);
    if (fRaw !== undefined) {
      const parsed = parseFailures(fRaw);
      if (parsed) failures = parsed;
      else invalid++;
    }
    return { request, failures };
  })) {
    if (l) pending.push(l);
  }
  pending.sort(newestFirst((p) => p.request.requestedAt));

  const archive: ArchiveReport[] = [];
  for (const p of archivePaths) {
    const t = await text(p);
    if (t !== null) archive.push({ name: ARCHIVE.exec(p)![1], text: t });
  }
  archive.sort(newestFirst((a) => a.name));

  return { reviews, pending, weekly, evidence, archive, archiveReadme: await text(README_PATH), invalid, stale };
}
