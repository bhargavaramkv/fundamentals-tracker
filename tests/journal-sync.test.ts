import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalJson, makeEvent, parseSession, requestPath, sessionPath } from "@/lib/journal/events";
import { memoryJournalLocal, getDeviceId } from "@/lib/journal/local";
import { GitHubJournalRemote, JournalSyncError, type JournalRemote } from "@/lib/journal/remote";
import { JournalSync } from "@/lib/journal/sync";
import { DATA_REPO } from "@/lib/storage";

class FakeRemote implements JournalRemote {
  files = new Map<string, { text: string; sha: string }>();
  counter = 0;
  writes: string[] = [];
  offline = false;
  status: number | null = null;
  failWrites = 0;
  /** Runs after a read and before the next write; used to inject a concurrent writer. */
  beforeWrite: (() => void) | null = null;

  private gate() {
    if (this.offline) throw new TypeError("Failed to fetch");
    if (this.status) throw new JournalSyncError(`status ${this.status}`, this.status);
  }
  async list() {
    this.gate();
    return new Map([...this.files].map(([p, f]) => [p, f.sha]));
  }
  async read(path: string) {
    this.gate();
    return this.files.get(path) ?? null;
  }
  async write(path: string, text: string, sha: string | null) {
    this.gate();
    if (this.failWrites > 0) {
      this.failWrites--;
      throw new JournalSyncError("boom", 500);
    }
    const hook = this.beforeWrite;
    this.beforeWrite = null;
    hook?.();
    const cur = this.files.get(path);
    if ((cur?.sha ?? null) !== sha) return { ok: false as const, status: cur ? 409 : 422 };
    const next = `s${++this.counter}`;
    this.files.set(path, { text, sha: next });
    this.writes.push(path);
    return { ok: true as const, sha: next };
  }
  /** Another device writing straight to the remote. */
  put(path: string, text: string) {
    this.files.set(path, { text, sha: `s${++this.counter}` });
  }
}

let clock = 1_700_000_000_000;
const now = () => clock;
const src = { kind: "docs" as const };

function device(remote: JournalRemote | null, name = "dev") {
  const local = memoryJournalLocal();
  return { local, sync: new JournalSync(local, name, remote, { now }), name };
}
const note = (d: { name: string }, text: string) => makeEvent({ kind: "note", text }, d.name, (clock += 10));
const ids = (s: { events: { id: string }[] }) => s.events.map((e) => e.id).sort();

describe("JournalSync", () => {
  it("reports local with no remote", async () => {
    const a = device(null);
    const s = await a.sync.createSession({ subject: "HLD", source: src });
    expect(await a.sync.status(s.id)).toBe("local");
    expect(a.sync.syncState().state).toBe("offline-only");
    await a.sync.sync();
    expect((await a.sync.sessions()).length).toBe(1);
  });

  it("keeps data offline, backs off, then pushes when back", async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const s = await a.sync.createSession({ subject: "HLD", source: src });
    await a.sync.append(s.id, [note(a, "n1")]);
    expect(await a.sync.status(s.id)).toBe("pending");
    remote.offline = true;
    await a.sync.sync();
    expect(await a.sync.status(s.id)).toBe("retrying");
    const e1 = (await a.local.outbox.get(`session:${s.id}`))!;
    expect(e1.attempts).toBe(1);
    expect(e1.nextAttemptAt).toBe(clock + 10_000);
    expect(a.sync.syncState().state).toBe("error");

    clock = e1.nextAttemptAt;
    await a.sync.sync();
    const e2 = (await a.local.outbox.get(`session:${s.id}`))!;
    expect(e2.attempts).toBe(2);
    expect(e2.nextAttemptAt - clock).toBe(20_000);
    expect((await a.sync.sessions())[0].session.events).toHaveLength(2);

    remote.offline = false;
    clock = e2.nextAttemptAt;
    await a.sync.sync();
    expect(await a.sync.status(s.id)).toBe("synced");
    expect(a.sync.syncState().state).toBe("idle");
    expect(parseSession(JSON.parse(remote.files.get(sessionPath(s))!.text))!.session.events).toHaveLength(2);
  });

  it("caps backoff at 10 minutes and flags a rejected token", async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const s = await a.sync.createSession({ subject: "x", source: src });
    remote.status = 401;
    await a.sync.sync();
    expect(a.sync.syncState()).toMatchObject({ state: "error", message: "GitHub rejected the sync token" });
    await a.local.outbox.put(`session:${s.id}`, { ...(await a.local.outbox.get(`session:${s.id}`))!, attempts: 20, nextAttemptAt: 0 });
    remote.status = 500;
    await a.sync.sync();
    expect((await a.local.outbox.get(`session:${s.id}`))!.nextAttemptAt).toBe(clock + 600_000);
  });

  it("recovers a session on another device and converges concurrent edits", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "A");
    const b = device(remote, "B");
    const s = await a.sync.createSession({ subject: "HLD", source: src });
    await a.sync.sync();
    await b.sync.sync();
    expect((await b.sync.sessions()).map((r) => r.session.id)).toEqual([s.id]);
    expect(await b.sync.status(s.id)).toBe("synced");

    remote.offline = true;
    await b.sync.append(s.id, [note(b, "from B")]);
    await a.sync.append(s.id, [makeEvent({ kind: "pause" }, "A", (clock += 10))]);
    await a.sync.sync();
    await b.sync.sync();
    remote.offline = false;
    clock += 1_000_000;
    await b.sync.sync();
    await a.sync.sync();
    await b.sync.sync();
    const ra = (await a.sync.sessions())[0].session;
    const rb = (await b.sync.sessions())[0].session;
    const rr = parseSession(JSON.parse(remote.files.get(sessionPath(s))!.text))!.session;
    expect(ra.events).toHaveLength(3);
    expect(canonicalJson(ra)).toBe(canonicalJson(rb));
    expect(canonicalJson(ra)).toBe(canonicalJson(rr));
  });

  it("merges when another device writes between read and write", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "A");
    const b = device(remote, "B");
    const s = await a.sync.createSession({ subject: "x", source: src });
    await a.sync.sync();
    await b.sync.sync();
    await b.sync.append(s.id, [note(b, "B-note")]);
    await a.sync.append(s.id, [note(a, "A-note")]);
    remote.beforeWrite = () => {
      // B wins the race.
      void b.sync.sync();
    };
    // Make B's push land synchronously instead: write its file straight away.
    remote.beforeWrite = () => {
      const rb = parseSession(JSON.parse(remote.files.get(sessionPath(s))!.text))!.session;
      remote.put(sessionPath(s), JSON.stringify({ ...rb, events: [...rb.events, note(b, "B-note")] }));
    };
    await a.sync.sync();
    const rr = parseSession(JSON.parse(remote.files.get(sessionPath(s))!.text))!.session;
    expect(rr.events.map((e) => ("text" in e ? e.text : e.kind)).sort()).toEqual(["A-note", "B-note", "start"].sort());
    expect(await a.sync.status(s.id)).toBe("synced");
  });

  it("stops on a corrupted remote file and leaves it alone", async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const s = await a.sync.createSession({ subject: "x", source: src });
    const path = sessionPath(s);
    for (const bad of ["{not json", JSON.stringify({ ...s, events: [...s.events, { kind: "note" }] })]) {
      remote.put(path, bad);
      const before = remote.files.get(path)!;
      await a.sync.sync();
      expect(await a.sync.status(s.id)).toBe("conflict");
      expect(remote.files.get(path)).toEqual(before);
      expect(remote.writes).toHaveLength(0);
      expect((await a.sync.sessions())[0].session.events).toHaveLength(1);
      await a.local.outbox.delete(`session:${s.id}`);
      await a.local.sessions.put(s.id, { session: s, remoteSha: null, path });
      await a.local.outbox.put(`session:${s.id}`, { key: `session:${s.id}`, kind: "session", refId: s.id, queuedAt: "x", attempts: 0, nextAttemptAt: 0 });
    }
  });

  it("keeps events appended during an in-flight push and pushes them next", async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const s = await a.sync.createSession({ subject: "x", source: src });
    remote.beforeWrite = () => void a.sync.append(s.id, [note(a, "late")]);
    await a.sync.sync();
    const rr = parseSession(JSON.parse(remote.files.get(sessionPath(s))!.text))!.session;
    expect(rr.events).toHaveLength(2);
    expect(ids((await a.sync.sessions())[0].session)).toEqual(ids(rr));
    expect(await a.sync.status(s.id)).toBe("synced");
  });

  it("uploads review requests once and never overwrites", async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const s = await a.sync.createSession({ subject: "x", source: src });
    const r = await a.sync.requestReview(s.id);
    await a.sync.sync();
    expect((await a.local.requests.get(r.id))!.uploaded).toBe(true);
    expect(remote.files.has(requestPath(r))).toBe(true);
    const n = remote.writes.length;
    await a.sync.sync();
    expect(remote.writes).toHaveLength(n);

    // Existing identical file -> uploaded.
    const b = device(remote);
    await b.local.sessions.put(s.id, (await a.local.sessions.get(s.id))!);
    const r2 = await b.sync.requestReview(s.id);
    remote.put(requestPath(r2), JSON.stringify(r2));
    await b.sync.sync();
    expect((await b.local.requests.get(r2.id))!.uploaded).toBe(true);

    // Existing different file -> conflict, untouched.
    const r3 = await b.sync.requestReview(s.id);
    remote.put(requestPath(r3), JSON.stringify({ ...r3, inputHash: "other" }));
    const before = remote.files.get(requestPath(r3))!;
    await b.local.requests.delete(r3.id);
    await b.local.requests.put(r3.id, { request: r3, uploaded: false });
    await b.sync.sync();
    expect((await b.local.outbox.get(`request:${r3.id}`))!.conflict).toBeTruthy();
    expect(remote.files.get(requestPath(r3))).toEqual(before);
  });

  it("adds unknown remote sessions and reports unreadable ones without deleting", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "A");
    const s = await a.sync.createSession({ subject: "x", source: src });
    await a.sync.sync();
    remote.put("journal/sessions/2026/01/broken.json", "nope");
    remote.put("journal/other.txt", "ignored");
    const b = device(remote, "B");
    await b.sync.sync();
    expect((await b.sync.sessions()).map((r) => r.session.id)).toEqual([s.id]);
    expect(b.sync.syncState().message).toContain("journal/sessions/2026/01/broken.json");
    expect(remote.files.get("journal/sessions/2026/01/broken.json")!.text).toBe("nope");
  });

  it("runs one push for concurrent sync calls", async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    await a.sync.createSession({ subject: "x", source: src });
    await Promise.all([a.sync.sync(), a.sync.sync()]);
    expect(remote.writes).toHaveLength(1);
  });

  it("creates a stable device id", async () => {
    const local = memoryJournalLocal();
    expect(await getDeviceId(local)).toBe(await getDeviceId(local));
  });
});

describe("GitHubJournalRemote", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists journal blobs via ref, commit and tree", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      const body = url.includes("/git/ref/")
        ? { object: { sha: "c1" } }
        : url.includes("/git/commits/")
          ? { tree: { sha: "t1" } }
          : { tree: [{ path: "journal/sessions/a.json", type: "blob", sha: "b1" }, { path: "progress.json", type: "blob", sha: "b2" }, { path: "journal", type: "tree", sha: "b3" }] };
      return new Response(JSON.stringify(body));
    });
    const map = await new GitHubJournalRemote("tok").list();
    expect([...map]).toEqual([["journal/sessions/a.json", "b1"]]);
    expect(urls[0]).toContain(`/repos/${DATA_REPO.owner}/${DATA_REPO.repo}/git/ref/heads/main`);
    expect(urls[2]).toContain("/git/trees/t1?recursive=1");
  });

  it("returns an empty list for a missing ref or empty repo", async () => {
    for (const status of [404, 409]) {
      vi.stubGlobal("fetch", async () => new Response("{}", { status }));
      expect((await new GitHubJournalRemote("t").list()).size).toBe(0);
    }
  });

  it("reads 404 as null and throws on other errors", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
    expect(await new GitHubJournalRemote("t").read("journal/x.json")).toBeNull();
    vi.stubGlobal("fetch", async () => new Response("", { status: 500 }));
    await expect(new GitHubJournalRemote("t").read("journal/x.json")).rejects.toMatchObject({ status: 500 });
  });

  it("reads content and sha from one response, or the blob of that exact sha above 1 MB", async () => {
    const b64 = Buffer.from("a → b", "utf8").toString("base64");
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ sha: "s1", content: b64, encoding: "base64" }));
    });
    expect(await new GitHubJournalRemote("t").read("journal/x.json")).toEqual({ text: "a → b", sha: "s1" });
    expect(urls).toHaveLength(1);
    urls.length = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(url.includes("/git/blobs/") ? { content: b64 } : { sha: "big", content: "", encoding: "none" }));
    });
    expect(await new GitHubJournalRemote("t").read("journal/x.json")).toEqual({ text: "a → b", sha: "big" });
    expect(urls[1]).toContain("/git/blobs/big");
  });

  it("writes base64 UTF-8 with the sha and maps 409/422", async () => {
    let body: { content: string; sha?: string; message: string } | null = null;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      if (url.includes("a%20b")) expect(url).toContain("/contents/journal/a%20b/x.json");
      body = JSON.parse(init!.body as string);
      return new Response(JSON.stringify({ content: { sha: "new" } }));
    });
    const r = new GitHubJournalRemote("t");
    expect(await r.write("journal/a b/x.json", "a → b", "old")).toEqual({ ok: true, sha: "new" });
    expect(Buffer.from(body!.content, "base64").toString("utf8")).toBe("a → b");
    expect(body!.sha).toBe("old");
    expect(body!.message).toBe("journal: journal/a b/x.json");
    await r.write("journal/n.json", "x", null);
    expect(body!.sha).toBeUndefined();
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 422 }));
    expect(await r.write("journal/n.json", "x", null)).toEqual({ ok: false, status: 422 });
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
    await expect(r.write("journal/n.json", "x", null)).rejects.toMatchObject({ status: 500 });
  });
});

describe("conflict inspection and repair", () => {
  /** Device A has pushed a session, then added a local note while the remote file is replaced by `remoteText`. */
  async function conflicted(remoteText: (current: string) => string) {
    const remote = new FakeRemote();
    const a = device(remote, "A");
    const s = await a.sync.createSession({ subject: "HLD", source: src });
    await a.sync.sync();
    const path = (await a.local.sessions.get(s.id))!.path;
    await a.sync.append(s.id, [note(a, "local note")]);
    remote.put(path, remoteText(remote.files.get(path)!.text));
    await a.sync.sync();
    return { remote, a, s, path };
  }
  /** A remote copy with an extra event from device B plus one invalid event, so it parses but must not be overwritten. */
  const remoteWithBadEvent = (text: string) => {
    const o = JSON.parse(text);
    o.events.push(makeEvent({ kind: "note", text: "remote note" }, "B", (clock += 10)), { junk: true });
    return JSON.stringify(o, null, 2);
  };

  it("flags an unreadable remote copy and inspects both sides without writing", async () => {
    const { remote, a, s } = await conflicted(() => "{ not json");
    expect(await a.sync.status(s.id)).toBe("conflict");
    const before = remote.writes.length;
    const info = await a.sync.inspectConflict(s.id);
    expect(remote.writes.length).toBe(before);
    expect(info.reason).toMatch(/unreadable/);
    expect(info.local.events).toBe(2);
    expect(info.local.lastEvent?.kind).toBe("note");
    expect(info.remote).toMatchObject({ state: "unreadable", text: "{ not json" });
  });

  it("lists which events are only local or only remote when the remote parses", async () => {
    const { a, s } = await conflicted(remoteWithBadEvent);
    const info = await a.sync.inspectConflict(s.id);
    if (info.remote.state !== "readable") throw new Error("expected readable");
    expect(info.remote.rejected).toBe(1);
    expect(info.remote.onlyLocal.map((e) => e.kind)).toEqual(["note"]);
    expect(info.remote.onlyRemote.map((e) => e.kind)).toEqual(["note"]);
  });

  it("repair backs up the GitHub copy verbatim before overwriting, and loses no event", async () => {
    const { remote, a, s, path } = await conflicted(remoteWithBadEvent);
    const original = remote.files.get(path)!;
    const writesBefore = remote.writes.length;
    await a.sync.resolveConflict(s.id);

    const backupPath = `journal/conflicts/${s.id}/${original.sha}.json`;
    expect(remote.files.get(backupPath)?.text).toBe(original.text);
    // The backup is written strictly before the overwrite.
    expect(remote.writes.slice(writesBefore)).toEqual([backupPath, path]);
    const repaired = parseSession(JSON.parse(remote.files.get(path)!.text))!;
    expect(repaired.rejected).toBe(0);
    const texts = repaired.session.events.filter((e) => e.kind === "note").map((e) => (e as { text: string }).text).sort();
    expect(texts).toEqual(["local note", "remote note"]);
    expect(ids((await a.local.sessions.get(s.id))!.session)).toEqual(ids(repaired.session));
    expect(await a.sync.status(s.id)).toBe("synced");
  });

  it("repairs an unreadable remote with the local copy, keeping the garbage in the backup", async () => {
    const { remote, a, s, path } = await conflicted(() => "<<<< merge garbage >>>>");
    const sha = remote.files.get(path)!.sha;
    await a.sync.resolveConflict(s.id);
    expect(remote.files.get(`journal/conflicts/${s.id}/${sha}.json`)?.text).toBe("<<<< merge garbage >>>>");
    expect(parseSession(JSON.parse(remote.files.get(path)!.text))!.session.events).toHaveLength(2);
    expect(await a.sync.status(s.id)).toBe("synced");
  });

  it("a failed backup aborts: the GitHub copy is untouched and the conflict stays", async () => {
    const { remote, a, s, path } = await conflicted(() => "<<<< garbage >>>>");
    const before = remote.files.get(path)!;
    remote.failWrites = 1;
    await expect(a.sync.resolveConflict(s.id)).rejects.toThrow();
    expect(remote.files.get(path)).toEqual(before);
    expect([...remote.files.keys()].some((p) => p.startsWith("journal/conflicts/"))).toBe(false);
    expect(await a.sync.status(s.id)).toBe("conflict");
    expect((await a.local.sessions.get(s.id))!.session.events).toHaveLength(2);
  });

  it("a backup path that already holds different content aborts instead of overwriting", async () => {
    const { remote, a, s, path } = await conflicted(() => "<<<< garbage >>>>");
    remote.put(`journal/conflicts/${s.id}/${remote.files.get(path)!.sha}.json`, "something else");
    const before = remote.files.get(path)!;
    await expect(a.sync.resolveConflict(s.id)).rejects.toThrow(/back up/);
    expect(remote.files.get(path)).toEqual(before);
  });

  it("if the remote changes while repairing, the overwrite is refused and the backup remains", async () => {
    const { remote, a, s, path } = await conflicted(() => "<<<< garbage >>>>");
    const write = remote.write.bind(remote);
    let n = 0;
    remote.write = async (p, text, sha) => {
      if (++n === 2) remote.put(path, "<<<< changed again >>>>");
      return write(p, text, sha);
    };
    await expect(a.sync.resolveConflict(s.id)).rejects.toThrow(/changed/);
    expect(remote.files.get(path)!.text).toBe("<<<< changed again >>>>");
    expect([...remote.files.keys()].filter((p) => p.startsWith("journal/conflicts/"))).toHaveLength(1);
    expect(await a.sync.status(s.id)).toBe("conflict");
  });

  it("retry keeps the conflict while the remote is unreadable and clears it once it merges", async () => {
    const { remote, a, s, path } = await conflicted(() => "<<<< garbage >>>>");
    await a.sync.retryConflict(s.id);
    expect(await a.sync.status(s.id)).toBe("conflict");
    expect(remote.files.get(path)!.text).toBe("<<<< garbage >>>>");
    const good = (await a.local.sessions.get(s.id))!.session;
    remote.put(path, JSON.stringify({ ...good, events: good.events.slice(0, 1) }, null, 2));
    await a.sync.retryConflict(s.id);
    expect(await a.sync.status(s.id)).toBe("synced");
    expect(parseSession(JSON.parse(remote.files.get(path)!.text))!.session.events).toHaveLength(2);
  });

  it("two devices converge through the remote with no lost events (cross-device merging, which e2e cannot run without a token)", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "A");
    const b = device(remote, "B");
    const s = await a.sync.createSession({ subject: "HLD", source: src });
    await a.sync.sync();
    await b.sync.sync();
    await a.sync.append(s.id, [note(a, "from A"), makeEvent({ kind: "meta", subject: "System design" }, "A", (clock += 10))]);
    await b.sync.append(s.id, [note(b, "from B"), makeEvent({ kind: "edit", target: s.events[0].id, text: "x" }, "B", (clock += 10))]);
    await a.sync.sync();
    await b.sync.sync();
    await a.sync.sync();
    const sa = (await a.local.sessions.get(s.id))!.session;
    const sb = (await b.local.sessions.get(s.id))!.session;
    expect(ids(sa)).toEqual(ids(sb));
    expect(sa.events).toHaveLength(5);
  });

  it("queueInfo counts queued entries, the next retry and conflicts", async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const s = await a.sync.createSession({ subject: "HLD", source: src });
    expect(await a.sync.queueInfo()).toEqual({ queued: 1, nextAttemptAt: null, conflicts: 0 });
    remote.offline = true;
    await a.sync.sync();
    const q = await a.sync.queueInfo();
    expect(q.queued).toBe(1);
    expect(q.nextAttemptAt).toBe(clock + 10_000);
    remote.offline = false;
    clock = q.nextAttemptAt!;
    remote.put((await a.local.sessions.get(s.id))!.path, "garbage");
    await a.sync.sync();
    expect(await a.sync.queueInfo()).toEqual({ queued: 0, nextAttemptAt: null, conflicts: 1 });
  });
});
