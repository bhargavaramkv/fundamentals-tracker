import { canonicalJson, covers, createReviewRequest, createSession, mergeSessions, parseSession, requestPath, sessionPath } from "./events";
import type { JournalLocal, OutboxEntry, SessionRecord } from "./local";
import { JournalSyncError, type JournalRemote } from "./remote";
import type { JournalSession, ReviewRequest, SessionEvent } from "./types";

export type RecordStatus = "local" | "pending" | "syncing" | "synced" | "retrying" | "conflict";
export interface SyncState {
  state: "idle" | "syncing" | "error" | "offline-only";
  message?: string;
  lastSyncedAt?: string;
}

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
    // Events may have been appended during the push: keep them, and keep the entry queued if `merged` lacks them.
    await this.locked(async () => {
      const cur = (await this.local.sessions.get(entry.refId)) ?? rec;
      await this.local.sessions.put(entry.refId, { ...cur, session: mergeSessions(merged, cur.session), remoteSha: sha });
      if (covers(merged, cur.session)) await this.local.outbox.delete(entry.key);
      else {
        await this.local.outbox.put(entry.key, { ...entry, attempts: 0, nextAttemptAt: 0, lastError: undefined });
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
