import fs from "node:fs";
import path from "node:path";
import { deriveSession, parseSession, sessionHash } from "../journal/events";
import { JOURNAL_VERSION, type JournalSession, type ReviewRequest } from "../journal/types";
import { reviewPath, type SessionReview } from "./types";
import { validateReview } from "./validate";

/** Node-only reads and writes of the review files in the data repo. Everything here is idempotent. */

export { reviewPath };
export const failurePath = (requestId: string) => `journal/review-failures/${requestId}.json`;

export function readJsonIf<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
}

const dirs = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []);
const jsonFiles = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : []);

function isRequest(v: unknown): v is ReviewRequest {
  const r = v as Partial<ReviewRequest> | null;
  return !!r && r.v === JOURNAL_VERSION && typeof r.id === "string" && typeof r.sessionId === "string" && typeof r.requestedAt === "string" && !Number.isNaN(Date.parse(r.requestedAt)) && typeof r.device === "string" && typeof r.inputHash === "string";
}

export function listRequests(dataDir: string): { requests: ReviewRequest[]; unreadable: string[] } {
  const requests: ReviewRequest[] = [];
  const unreadable: string[] = [];
  for (const sid of dirs(path.join(dataDir, "journal/requests"))) {
    for (const f of jsonFiles(path.join(dataDir, "journal/requests", sid))) {
      const r = readJsonIf<unknown>(path.join(dataDir, "journal/requests", sid, f));
      if (isRequest(r) && r.sessionId === sid && `${r.id}.json` === f) requests.push(r);
      else unreadable.push(`journal/requests/${sid}/${f}`);
    }
  }
  requests.sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : a.id < b.id ? -1 : 1));
  return { requests, unreadable };
}

export function loadSession(dataDir: string, sessionId: string): JournalSession | null {
  const root = path.join(dataDir, "journal/sessions");
  for (const year of dirs(root)) {
    for (const month of dirs(path.join(root, year))) {
      const file = path.join(root, year, month, `${sessionId}.json`);
      if (fs.existsSync(file)) return parseSession(readJsonIf<unknown>(file))?.session ?? null;
    }
  }
  return null;
}

export function loadRequest(dataDir: string, requestId: string): ReviewRequest | null {
  return listRequests(dataDir).requests.find((r) => r.id === requestId) ?? null;
}

export interface PendingResult {
  pending: { requestId: string; sessionId: string; requestedAt: string; subject: string; failures: number }[];
  skipped: { requestId: string; reason: string }[];
}

/** Requests without a review file, oldest first. Requests whose session can't be reviewed are skipped, with the reason. */
export function findPending(dataDir: string): PendingResult {
  const out: PendingResult = { pending: [], skipped: [] };
  const { requests, unreadable } = listRequests(dataDir);
  for (const p of unreadable) out.skipped.push({ requestId: p, reason: "request file is unreadable or inconsistent" });
  for (const r of requests) {
    if (fs.existsSync(path.join(dataDir, reviewPath(r)))) continue;
    const session = loadSession(dataDir, r.sessionId);
    if (!session) {
      out.skipped.push({ requestId: r.id, reason: `session ${r.sessionId} not found or unreadable` });
      continue;
    }
    if (deriveSession(session, Date.parse(r.requestedAt)).status === "discarded") {
      out.skipped.push({ requestId: r.id, reason: `session ${r.sessionId} is discarded` });
      continue;
    }
    const failures = readJsonIf<unknown[]>(path.join(dataDir, failurePath(r.id)));
    out.pending.push({ requestId: r.id, sessionId: r.sessionId, requestedAt: r.requestedAt, subject: session.subject, failures: Array.isArray(failures) ? failures.length : 0 });
  }
  return out;
}

export type CommitResult = { status: "exists"; path: string } | { status: "written"; path: string; review: SessionReview } | { status: "rejected"; errors: string[] };

/** Earlier reviews named by `understood[].verifies.requestId`, found under journal/reviews/<sessionId>/<requestId>.json. */
function referencedReviews(dataDir: string, raw: unknown): Map<string, SessionReview> {
  const out = new Map<string, SessionReview>();
  const understood = (raw as { understood?: unknown })?.understood;
  if (!Array.isArray(understood)) return out;
  const ids = new Set(understood.map((f) => (f as { verifies?: { requestId?: unknown } })?.verifies?.requestId).filter((id): id is string => typeof id === "string"));
  const root = path.join(dataDir, "journal", "reviews");
  if (ids.size === 0 || !fs.existsSync(root)) return out;
  for (const sessionDir of fs.readdirSync(root)) {
    for (const id of ids) {
      const review = readJsonIf<SessionReview>(path.join(root, sessionDir, `${id}.json`));
      if (review) out.set(id, review);
    }
  }
  return out;
}

/** Validates and writes the review. A valid review that already exists is left untouched. */
export async function commitReview(dataDir: string, requestId: string, raw: unknown): Promise<CommitResult> {
  const request = loadRequest(dataDir, requestId);
  if (!request) return { status: "rejected", errors: [`no request ${requestId}`] };
  const rel = reviewPath(request);
  const session = loadSession(dataDir, request.sessionId);
  if (!session) return { status: "rejected", errors: [`session ${request.sessionId} not found or unreadable`] };
  const ctx = { request, session, currentHash: await sessionHash(session), priorReviews: referencedReviews(dataDir, raw) };
  const existing = readJsonIf<unknown>(path.join(dataDir, rel));
  if (existing && validateReview(existing, ctx).errors.length === 0) return { status: "exists", path: rel };
  if (deriveSession(session, Date.parse(request.requestedAt)).status === "discarded") return { status: "rejected", errors: [`session ${request.sessionId} is discarded`] };
  const { errors, review } = validateReview(raw, ctx);
  if (!review) return { status: "rejected", errors };
  writeJson(path.join(dataDir, rel), review);
  return { status: "written", path: rel, review };
}

/** Appends to the request's failure list; the list is never rewritten. */
export function recordFailure(dataDir: string, requestId: string, message: string, now: Date = new Date()): string {
  const rel = failurePath(requestId);
  const file = path.join(dataDir, rel);
  const list = readJsonIf<{ at: string; error: string }[]>(file) ?? [];
  writeJson(file, [...list, { at: now.toISOString(), error: message }]);
  return rel;
}
