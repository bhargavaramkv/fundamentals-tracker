import { canonicalJson, covers, createReviewRequest, createSession, mergeSessions, parseSession, requestPath, sessionPath } from "./events";
import type { JournalLocal, OutboxEntry, SessionRecord } from "./local";
import { JournalSyncError, type JournalRemote } from "./remote";
import type { QueueInfo } from "./status";
import type { JournalSession, ReviewRequest, SessionEvent, StoredEvent } from "./types";

export type RecordStatus = "local" | "pending" | "syncing" | "synced" | "retrying" | "conflict";
export interface SyncState {
  state: "idle" | "syncing" | "error" | "offline-only";
  message?: string;
  lastSyncedAt?: string;
}

export interface EventBrief {
  id: string;
  kind: string;
  at: string;
}

/** What a human needs to decide about a session whose GitHub copy could not be merged. Read-only. */
export interface ConflictInspection {
  reason: string;
  local: { events: number; lastEvent: EventBrief | null };
  remote:
    | { state: "missing" }
    | { state: "unreadable"; sha: string; text: string }
    /** Parsed, but some events had no usable id, time or device (`rejected`), so it was not overwritten. */
    | { state: "readable"; sha: string; text: string; events: number; rejected: number; onlyLocal: EventBrief[]; onlyRemote: EventBrief[] };
}

const brief = (e: StoredEvent): EventBrief => ({ id: e.id, kind: e.kind, at: e.at });
export const conflictBackupPath = (sessionId: string, sha: string) => `journal/conflicts/${sessionId}/${sha}.json`;

const MAX_WRITE_TRIES = 3;
const TOKEN_MESSAGE = "GitHub rejected the sync token";

const statusOf = (e: unknown) => (e instanceof JournalSyncError ? e.status : undefined);
const isAuth = (e: unknown) => statusOf(e) === 401 || statusOf(e) === 403;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function parseText(text: string) {
  try {
    return parseSession(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Offline-first journal sync: local IndexedDB is the source of truth, GitHub files are the replica. */
export class JournalSync {
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly inflight = new Set<string>();
  private lock: Promise<unknown> = Promise.resolve();
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private problem: string | undefined;
  private lastSyncedAt: string | undefined;

  constructor(
    private readonly local: JournalLocal,
    private readonly device: string,
    private readonly remote: JournalRemote | null,
    opts: { now?: () => number } = {},
  ) {
    this.now = opts.now ?? Date.now;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  /** Serialises read-modify-write on local records so a finishing push can't overwrite a concurrent append. */
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.lock.then(fn, fn);
    this.lock = run.catch(() => undefined);
    return run;
  }

  private async enqueue(kind: OutboxEntry["kind"], refId: string) {
    const key = `${kind}:${refId}`;
    await this.local.outbox.put(key, { key, kind, refId, queuedAt: new Date(this.now()).toISOString(), attempts: 0, nextAttemptAt: 0 });
    if (this.running) this.again = true;
  }

  /** All local sessions, newest first. */
  async sessions(): Promise<SessionRecord[]> {
    const all = (await this.local.sessions.entries()).map(([, r]) => r);
    return all.sort((a, b) => (a.session.createdAt < b.session.createdAt ? 1 : a.session.createdAt > b.session.createdAt ? -1 : 0));
  }

  async createSession(input: { subject: string; source: JournalSession["source"]; objective?: string }): Promise<JournalSession> {
    const session = createSession({ ...input, device: this.device }, this.now());
    await this.locked(async () => {
      await this.local.sessions.put(session.id, { session, remoteSha: null, path: sessionPath(session) });
      await this.enqueue("session", session.id);
    });
    this.notify();
    return session;
  }

  async append(sessionId: string, events: SessionEvent[]): Promise<JournalSession> {
    const session = await this.locked(async () => {
      const rec = await this.local.sessions.get(sessionId);
      if (!rec) throw new Error(`Unknown session ${sessionId}`);
      const merged = mergeSessions(rec.session, { ...rec.session, events });
      await this.local.sessions.put(sessionId, { ...rec, session: merged });
      await this.enqueue("session", sessionId);
      return merged;
    });
    this.notify();
    return session;
  }

  async requestReview(sessionId: string): Promise<ReviewRequest> {
    const rec = await this.local.sessions.get(sessionId);
    if (!rec) throw new Error(`Unknown session ${sessionId}`);
    const request = await createReviewRequest(rec.session, this.device, this.now());
    await this.local.requests.put(request.id, { request, uploaded: false });
    await this.enqueue("request", request.id);
    this.notify();
    return request;
  }

  async status(sessionId: string): Promise<RecordStatus> {
    if (!this.remote) return "local";
    const key = `session:${sessionId}`;
    const entry = await this.local.outbox.get(key);
    if (entry?.conflict) return "conflict";
    if (this.inflight.has(key)) return "syncing";
    if (entry) return entry.lastError ? "retrying" : "pending";
    return (await this.local.sessions.get(sessionId))?.remoteSha ? "synced" : "pending";
  }

  syncState(): SyncState {
    const lastSyncedAt = this.lastSyncedAt;
    if (!this.remote) return { state: "offline-only" };
    if (this.problem) return { state: "error", message: this.problem, lastSyncedAt };
    return { state: this.running ? "syncing" : "idle", lastSyncedAt };
  }

  /** Queue size and the earliest retry time, for the sync indicator. */
  async queueInfo(): Promise<QueueInfo> {
    const entries = (await this.local.outbox.entries()).map(([, e]) => e);
    const retries = entries.filter((e) => !e.conflict && e.lastError).map((e) => e.nextAttemptAt);
    return { queued: entries.filter((e) => !e.conflict).length, nextAttemptAt: retries.length ? Math.min(...retries) : null, conflicts: entries.filter((e) => e.conflict).length };
  }

  /** Reads both copies of a session in conflict. Writes nothing. */
  async inspectConflict(sessionId: string): Promise<ConflictInspection> {
    const remote = this.remote;
    const entry = await this.local.outbox.get(`session:${sessionId}`);
    const rec = await this.local.sessions.get(sessionId);
    if (!remote || !rec) throw new Error("There is nothing to inspect for this session");
    const last = rec.session.events[rec.session.events.length - 1];
    const local = { events: rec.session.events.length, lastEvent: last ? brief(last) : null };
    const reason = entry?.conflict ?? "No conflict is recorded for this session";
    const file = await remote.read(rec.path);
    if (!file) return { reason, local, remote: { state: "missing" } };
    const parsed = parseText(file.text);
    if (!parsed || parsed.session.id !== sessionId) return { reason, local, remote: { state: "unreadable", sha: file.sha, text: file.text } };
    const localIds = new Set(rec.session.events.map((e) => e.id));
    const remoteIds = new Set(parsed.session.events.map((e) => e.id));
    return {
      reason,
      local,
      remote: {
        state: "readable",
        sha: file.sha,
        text: file.text,
        events: parsed.session.events.length,
        rejected: parsed.rejected,
        onlyLocal: rec.session.events.filter((e) => !remoteIds.has(e.id)).map(brief),
        onlyRemote: parsed.session.events.filter((e) => !localIds.has(e.id)).map(brief),
      },
    };
  }

  /** Clears the conflict flag and re-reads and re-merges. If the remote copy still can't be merged, the conflict comes back. */
  async retryConflict(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    const entry = await this.local.outbox.get(key);
    if (entry?.conflict) await this.local.outbox.put(key, { ...entry, conflict: undefined, lastError: undefined, attempts: 0, nextAttemptAt: 0 });
    this.notify();
    await this.sync();
  }

  /**
   * "Keep both and repair". Order matters and is never changed:
   *  1. Copy the current GitHub file, byte for byte, to journal/conflicts/<id>/<remoteSha>.json (create-only).
   *  2. Only once that exists, overwrite the original with local + every parseable remote event, guarded by the sha
   *     we read, so a file that changed in the meantime is not overwritten.
   * If step 1 fails nothing else is written. If step 2 fails the backup remains and the conflict stays flagged.
   */
  async resolveConflict(sessionId: string): Promise<void> {
    const remote = this.remote;
    const key = `session:${sessionId}`;
    const entry = await this.local.outbox.get(key);
    const rec = await this.local.sessions.get(sessionId);
    if (!remote || !rec || !entry) throw new Error("There is nothing to repair for this session");

    const file = await remote.read(rec.path);
    let merged = rec.session;
    if (file) {
      const backup = conflictBackupPath(sessionId, file.sha);
      const w = await remote.write(backup, file.text, null);
      if (!w.ok) {
        // Already there is fine only if it holds exactly what we are about to overwrite.
        const existing = await remote.read(backup);
        if (existing?.text !== file.text) throw new JournalSyncError("Could not back up the GitHub copy, so nothing was changed", w.status);
      }
      const parsed = parseText(file.text);
      if (parsed && parsed.session.id === sessionId) merged = mergeSessions(merged, parsed.session);
    }
    const w = await remote.write(rec.path, JSON.stringify(merged, null, 2) + "\n", file?.sha ?? null);
    if (!w.ok) throw new JournalSyncError("The GitHub copy changed while repairing. The backup is kept; try again.", w.status);
    await this.finishPush(entry, rec, merged, w.sha);
    this.notify();
  }

  scheduleSync(delayMs = 1500) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sync();
    }, delayMs);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  /** Single-flight: concurrent callers share the running sync, which repeats once more if changes arrived meanwhile. */
  sync(): Promise<void> {
    const remote = this.remote;
    if (!remote) return Promise.resolve();
    if (this.running) return this.running;
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.run(remote);
        } while (this.again);
      } finally {
        this.running = null;
        this.notify();
      }
    })();
    this.notify();
    return this.running;
  }

  private async run(remote: JournalRemote) {
    this.problem = undefined;
    const problems: string[] = [];
    const authFailed = await this.push(remote, problems);
    if (!authFailed) {
      try {
        await this.pull(remote, problems);
        this.lastSyncedAt = new Date(this.now()).toISOString();
        await this.local.meta.put("lastPull", this.lastSyncedAt);
      } catch (e) {
        problems.push(isAuth(e) ? TOKEN_MESSAGE : `Pull failed: ${errText(e)}`);
      }
    }
    this.problem = problems.length ? [...new Set(problems)].join("; ") : undefined;
  }

  /** Returns true when the token was rejected (nothing else is worth trying). */
  private async push(remote: JournalRemote, problems: string[]): Promise<boolean> {
    const due = (await this.local.outbox.entries())
      .map(([, e]) => e)
      .filter((e) => !e.conflict && e.nextAttemptAt <= this.now())
      .sort((a, b) => (a.queuedAt < b.queuedAt ? -1 : a.queuedAt > b.queuedAt ? 1 : 0));
    for (const entry of due) {
      this.inflight.add(entry.key);
      this.notify();
      try {
        if (entry.kind === "session") await this.pushSession(remote, entry);
        else await this.pushRequest(remote, entry);
      } catch (e) {
        await this.fail(entry, e);
        if (isAuth(e)) {
          problems.push(TOKEN_MESSAGE);
          return true;
        }
      } finally {
        this.inflight.delete(entry.key);
        this.notify();
      }
    }
    return false;
  }

  private async fail(entry: OutboxEntry, e: unknown) {
    const cur = (await this.local.outbox.get(entry.key)) ?? entry;
    const attempts = cur.attempts + 1;
    await this.local.outbox.put(entry.key, { ...cur, attempts, nextAttemptAt: this.now() + Math.min(5000 * 2 ** attempts, 600_000), lastError: errText(e) });
  }

  private async markConflict(entry: OutboxEntry, message: string) {
    const cur = (await this.local.outbox.get(entry.key)) ?? entry;
    await this.local.outbox.put(entry.key, { ...cur, conflict: message, lastError: undefined });
  }

  private async pushSession(remote: JournalRemote, entry: OutboxEntry) {
    const rec = await this.local.sessions.get(entry.refId);
    if (!rec) return void (await this.local.outbox.delete(entry.key));
    let merged = rec.session;
    let sha: string;
    for (let tries = 0; ; tries++) {
      if (tries === MAX_WRITE_TRIES) throw new JournalSyncError("Remote kept changing during the write", 409);
      const file = await remote.read(rec.path);
      const parsed = file ? parseText(file.text) : null;
      if (file && (!parsed || parsed.rejected > 0)) {
        return void (await this.markConflict(entry, "The remote file is unreadable or has invalid events; it was not overwritten"));
      }
      merged = parsed ? mergeSessions(merged, parsed.session) : merged;
      if (file && parsed && canonicalJson(merged) === canonicalJson(parsed.session)) {
        sha = file.sha;
        break;
      }
      const w = await remote.write(rec.path, JSON.stringify(merged, null, 2) + "\n", file?.sha ?? null);
      if (w.ok) {
        sha = w.sha;
        break;
      }
    }
    await this.finishPush(entry, rec, merged, sha);
  }

  /** Events may have been appended during the push: keep them, and keep the entry queued if `merged` lacks them. */
  private async finishPush(entry: OutboxEntry, rec: SessionRecord, merged: JournalSession, sha: string) {
    await this.locked(async () => {
      const cur = (await this.local.sessions.get(entry.refId)) ?? rec;
      await this.local.sessions.put(entry.refId, { ...cur, session: mergeSessions(merged, cur.session), remoteSha: sha });
      if (covers(merged, cur.session)) await this.local.outbox.delete(entry.key);
      else {
        await this.local.outbox.put(entry.key, { ...entry, attempts: 0, nextAttemptAt: 0, lastError: undefined, conflict: undefined });
        this.again = true;
      }
    });
  }

  private async pushRequest(remote: JournalRemote, entry: OutboxEntry) {
    const rec = await this.local.requests.get(entry.refId);
    if (!rec) return void (await this.local.outbox.delete(entry.key));
    const path = requestPath(rec.request);
    const w = await remote.write(path, JSON.stringify(rec.request, null, 2) + "\n", null);
    if (!w.ok) {
      const file = await remote.read(path);
      let same = false;
      try {
        same = !!file && canonicalJson(JSON.parse(file.text)) === canonicalJson(rec.request);
      } catch {
        // unparseable: counts as different
      }
      if (!same) return void (await this.markConflict(entry, "A different review request already exists at this path"));
    }
    await this.local.requests.put(entry.refId, { ...rec, uploaded: true });
    await this.local.outbox.delete(entry.key);
  }

  private async pull(remote: JournalRemote, problems: string[]) {
    const listing = await remote.list();
    for (const [path, sha] of listing) {
      const m = /^journal\/(sessions|requests)\/.+\/([^/]+)\.json$/.exec(path);
      if (!m) continue;
      const id = m[2];
      if (m[1] === "requests") {
        const rec = await this.local.requests.get(id);
        // A conflict entry means the remote file differs from ours, so it must not count as uploaded.
        if (rec && !rec.uploaded && !(await this.local.outbox.get(`request:${id}`))?.conflict) {
          await this.local.requests.put(id, { ...rec, uploaded: true });
          await this.local.outbox.delete(`request:${id}`);
        }
        continue;
      }
      const have = await this.local.sessions.get(id);
      if (have?.remoteSha === sha) continue;
      const file = await remote.read(path);
      if (!file) continue;
      const parsed = parseText(file.text);
      if (!parsed || parsed.rejected > 0) {
        problems.push(`Skipped unreadable remote file ${path}`);
        continue;
      }
      const remoteSession = parsed.session;
      await this.locked(async () => {
        const cur = await this.local.sessions.get(remoteSession.id);
        const merged = cur ? mergeSessions(cur.session, remoteSession) : remoteSession;
        await this.local.sessions.put(remoteSession.id, { session: merged, remoteSha: file.sha, path: cur?.path ?? sessionPath(merged) });
        if (!covers(remoteSession, merged)) await this.enqueue("session", remoteSession.id);
      });
    }
    this.notify();
  }
}
