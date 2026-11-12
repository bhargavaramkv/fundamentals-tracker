import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubStore } from "@/lib/storage";
import { emptyProgress } from "@/lib/progress";
import type { ProgressData } from "@/lib/types";
import { answer } from "./helpers";

const config = { owner: "o", repo: "r", branch: "main", path: "progress.json", token: "t" };
const b64 = (data: unknown) => Buffer.from(JSON.stringify(data), "utf8").toString("base64");
const withAnswers = (...ids: string[]): ProgressData => ({ ...emptyProgress(), answers: ids.map((id) => answer({ id, correct: true })) });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function stubStorage() {
  const mem = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("GitHubStore.fetchRemote", () => {
  it("returns content and sha that belong together even when the file changes between requests", async () => {
    // Each GET sees the file as it is at that moment, and the file moves on after every GET.
    const versions = [
      { sha: "sha-old", data: withAnswers("a") },
      { sha: "sha-new", data: withAnswers("a", "b") },
    ];
    let reads = 0;
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      const v = versions[Math.min(reads++, versions.length - 1)];
      const accept = (init?.headers as Record<string, string>).Accept;
      return accept.includes("raw") ? json(v.data) : json({ sha: v.sha, encoding: "base64", content: b64(v.data) });
    });
    const remote = await new GitHubStore(config).fetchRemote();
    const expected = versions.find((v) => v.sha === remote.sha)!;
    expect(remote.data.answers.map((a) => a.id)).toEqual(expected.data.answers.map((a) => a.id));
  });

  it("fetches the blob by its sha when the contents response has no inline content", async () => {
    const data = withAnswers("big");
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      if (url.includes("/git/blobs/sha-big")) return json({ content: b64(data), encoding: "base64" });
      return json({ sha: "sha-big", content: "", encoding: "none" });
    });
    const remote = await new GitHubStore(config).fetchRemote();
    expect(remote.sha).toBe("sha-big");
    expect(remote.data.answers.map((a) => a.id)).toEqual(["big"]);
    expect(urls.some((u) => u.includes("/git/blobs/sha-big"))).toBe(true);
  });

  it("returns an empty file and a null sha on 404", async () => {
    vi.stubGlobal("fetch", async () => json({}, 404));
    const remote = await new GitHubStore(config).fetchRemote();
    expect(remote.sha).toBeNull();
    expect(remote.data.answers).toEqual([]);
  });
});

describe("GitHubStore push conflict", () => {
  it("re-reads and re-merges after a 409, so the retry keeps the newer remote answers", async () => {
    stubStorage();
    let remote = { sha: "s1", data: withAnswers("r1") };
    const puts: { sha?: string; ids: string[] }[] = [];
    let conflictOnce = true;
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(init.body as string) as { sha?: string; content: string };
        const written = JSON.parse(Buffer.from(body.content, "base64").toString("utf8")) as ProgressData;
        puts.push({ sha: body.sha, ids: written.answers.map((a) => a.id).sort() });
        if (conflictOnce) {
          conflictOnce = false;
          remote = { sha: "s2", data: withAnswers("r1", "r2") }; // another device got in first
          return json({}, 409);
        }
        return json({ content: { sha: "s3" } });
      }
      return json({ sha: remote.sha, encoding: "base64", content: b64(remote.data) });
    });
    const store = new GitHubStore(config);
    await store.save(withAnswers("mine"));
    await store.flush();
    expect(puts).toHaveLength(2);
    expect(puts[1].sha).toBe("s2");
    expect(puts[1].ids).toEqual(["mine", "r1", "r2"]);
  });
});
