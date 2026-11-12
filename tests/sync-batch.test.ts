import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubStore, type SyncConfig } from "@/lib/storage";
import { emptyProgress } from "@/lib/progress";
import type { AnswerLog, ProgressData } from "@/lib/types";

const config: SyncConfig = { owner: "o", repo: "r", branch: "main", path: "progress.json", token: "t" };

function withAnswers(ids: string[]): ProgressData {
  const answers = ids.map((id, i) => ({ id, answeredAt: `2026-01-01T00:00:0${i}Z` }) as unknown as AnswerLog);
  return { ...emptyProgress(), answers };
}

let storage: Map<string, string>;
let puts: { content: string }[];
let putStatus: number;

function mockFetch() {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts.push(JSON.parse(init.body as string) as { content: string });
      return new Response("{}", { status: putStatus });
    }
    // Remote file doesn't exist yet.
    return new Response("", { status: 404 });
  });
}

function pushedIds(i: number): string[] {
  const data = JSON.parse(Buffer.from(puts[i].content, "base64").toString("utf8")) as ProgressData;
  return data.answers.map((a) => a.id);
}

beforeEach(() => {
  vi.useFakeTimers();
  storage = new Map();
  puts = [];
  putStatus = 200;
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("batched GitHub sync", () => {
  it("coalesces three quick saves into one PUT with all changes", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    const store = new GitHubStore(config);
    await store.save(withAnswers(["a"]));
    await store.save(withAnswers(["a", "b"]));
    await store.save(withAnswers(["a", "b", "c"]));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.get("ft.progress.dirty")).toBe("1");
    await vi.advanceTimersByTimeAsync(3100);
    expect(puts).toHaveLength(1);
    expect(pushedIds(0)).toEqual(["a", "b", "c"]);
    expect(storage.has("ft.progress.dirty")).toBe(false);
  });

  it("keeps the dirty flag when the PUT fails, and a later flush succeeds", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const states: string[] = [];
    const store = new GitHubStore(config);
    store.onStatus = (s) => states.push(s);
    putStatus = 500;
    await store.save(withAnswers(["a"]));
    await expect(store.flush()).rejects.toThrow();
    expect(storage.get("ft.progress.dirty")).toBe("1");
    expect(states.at(-1)).toBe("error");
    putStatus = 200;
    await store.flush();
    expect(storage.has("ft.progress.dirty")).toBe(false);
    expect(states.at(-1)).toBe("idle");
    expect(pushedIds(puts.length - 1)).toEqual(["a"]);
  });

  it("pushes on load when a previous tab left the dirty flag set", async () => {
    storage.set("ft.progress.v1", JSON.stringify(withAnswers(["x"])));
    storage.set("ft.progress.dirty", "1");
    vi.stubGlobal("fetch", mockFetch());
    await new GitHubStore(config).load();
    expect(puts).toHaveLength(1);
    expect(pushedIds(0)).toEqual(["x"]);
    expect(storage.has("ft.progress.dirty")).toBe(false);
  });

  it("makes no requests when flushing with nothing dirty", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    await new GitHubStore(config).flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
