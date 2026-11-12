import { emptyProgress, mergeProgress, normalizeProgress } from "./progress";
import type { ProgressData } from "./types";

/**
 * Storage abstraction for progress data. The UI only talks to this interface,
 * so swapping localStorage for another backend is a one-file change.
 */
export interface ProgressStore {
  readonly kind: "local" | "github";
  load(): Promise<ProgressData>;
  save(data: ProgressData): Promise<void>;
  /** Pushes any pending changes to the remote now. Local-only stores have nothing to push. */
  flush?(): Promise<void>;
  /** Called as a background push starts, succeeds or fails. */
  onStatus?: (state: "idle" | "syncing" | "error", message?: string) => void;
}

const PROGRESS_KEY = "ft.progress.v1";
/** Set while local changes haven't reached the remote yet; survives a closed tab. */
const DIRTY_KEY = "ft.progress.dirty";
/** Quiet period before a burst of saves is pushed as one commit. */
const PUSH_DELAY_MS = 3000;

/** Always-available store: this browser's localStorage. */
export class LocalStore implements ProgressStore {
  readonly kind = "local" as const;

  async load(): Promise<ProgressData> {
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY);
      return raw ? normalizeProgress(JSON.parse(raw)) : emptyProgress();
    } catch {
      return emptyProgress();
    }
  }

  async save(data: ProgressData): Promise<void> {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
  }
}

export interface SyncConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  /** Fine-grained PAT, Contents read/write on the data repo only. Stored encrypted in this browser. */
  token: string;
}

/**
 * The private repo that stores progress.json. Fixed at build time so it can't
 * be redirected from the browser.
 */
export const DATA_REPO: Omit<SyncConfig, "token"> = {
  owner: process.env.NEXT_PUBLIC_DATA_OWNER || "bhargavaramkv",
  repo: process.env.NEXT_PUBLIC_DATA_REPO || "fundamentals-tracker-data",
  branch: "main",
  path: "progress.json",
};

/** Reads a JSON file from the data repo with the sync token; null when it doesn't exist. */
export async function readFile<T>(token: string, p: string): Promise<T | null> {
  const url = `https://api.github.com/repos/${DATA_REPO.owner}/${DATA_REPO.repo}/contents/${p}?ref=${encodeURIComponent(DATA_REPO.branch)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github.raw+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
  return (await res.json()) as T;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

interface RemoteFile {
  data: ProgressData;
  sha: string | null;
}

export class GitHubSyncError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/**
 * Keeps localStorage as the source of truth for the UI and mirrors it to a
 * JSON file in a private GitHub repo, so the daily routine can read it.
 * Merges are append-only, so concurrent devices never lose answers.
 */
export class GitHubStore implements ProgressStore {
  readonly kind = "github" as const;

  constructor(
    private readonly config: SyncConfig,
    private readonly local: LocalStore = new LocalStore(),
  ) {}

  private url(): string {
    const { owner, repo, path } = this.config;
    return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  }

  private headers(accept = "application/vnd.github+json"): HeadersInit {
    return {
      Accept: accept,
      Authorization: `Bearer ${this.config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async fetchRemote(): Promise<RemoteFile> {
    const ref = `?ref=${encodeURIComponent(this.config.branch)}`;
    const meta = await fetch(this.url() + ref, { headers: this.headers(), cache: "no-store" });
    if (meta.status === 404) return { data: emptyProgress(), sha: null };
    if (!meta.ok) throw new GitHubSyncError(`GitHub read failed (${meta.status})`, meta.status);
    const { sha } = (await meta.json()) as { sha: string };
    // The raw media type works for files above the 1 MB inline-content limit.
    const raw = await fetch(this.url() + ref, { headers: this.headers("application/vnd.github.raw+json"), cache: "no-store" });
    if (!raw.ok) throw new GitHubSyncError(`GitHub read failed (${raw.status})`, raw.status);
    return { data: normalizeProgress(await raw.json()), sha };
  }

  private async putRemote(data: ProgressData, sha: string | null): Promise<Response> {
    return fetch(this.url(), {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `progress: ${data.answers.length} answers (${data.updatedAt})`,
        content: toBase64(JSON.stringify(data, null, 1)),
        branch: this.config.branch,
        ...(sha ? { sha } : {}),
      }),
    });
  }

  onStatus?: ProgressStore["onStatus"];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  /** Bumped on every save so a finished push knows whether newer changes arrived meanwhile. */
  private generation = 0;

  private isDirty(): boolean {
    try {
      return window.localStorage.getItem(DIRTY_KEY) === "1";
    } catch {
      return false;
    }
  }

  private setDirty(dirty: boolean): void {
    try {
      if (dirty) window.localStorage.setItem(DIRTY_KEY, "1");
      else window.localStorage.removeItem(DIRTY_KEY);
    } catch {
      // Storage unavailable: the in-memory generation still drives this session.
    }
  }

  async load(): Promise<ProgressData> {
    const local = await this.local.load();
    try {
      const remote = await this.fetchRemote();
      const merged = mergeProgress(local, remote.data);
      await this.local.save(merged);
      if (this.isDirty()) await this.flush().catch(() => undefined);
      return merged;
    } catch {
      // Offline or bad token: keep working from this browser's copy.
      return local;
    }
  }

  async save(data: ProgressData): Promise<void> {
    await this.local.save(data);
    this.generation++;
    this.setDirty(true);
    this.onStatus?.("syncing");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch(() => undefined); // failures are reported through onStatus
    }, PUSH_DELAY_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight) {
      // Don't double-push; if more changes landed during it, push those afterwards.
      await this.inFlight;
      if (this.isDirty()) await this.flush();
      return;
    }
    if (!this.isDirty()) return;
    this.onStatus?.("syncing");
    this.inFlight = this.push().finally(() => {
      this.inFlight = null;
    });
    await this.inFlight;
  }

  private async push(): Promise<void> {
    const startGeneration = this.generation;
    try {
      await this.pushOnce();
      if (this.generation === startGeneration) {
        this.setDirty(false);
        this.onStatus?.("idle");
      }
    } catch (err) {
      this.onStatus?.("error", err instanceof Error ? err.message : "Sync failed");
      throw err;
    }
  }

  private async pushOnce(): Promise<void> {
    const data = await this.local.load();
    // Retry once on a sha conflict (another device pushed in between).
    for (let attempt = 0; attempt < 2; attempt++) {
      const remote = await this.fetchRemote();
      const merged = mergeProgress(data, remote.data);
      const res = await this.putRemote(merged, remote.sha);
      if (res.ok) {
        // Merge with the current local copy so changes saved during the push aren't overwritten.
        await this.local.save(mergeProgress(await this.local.load(), merged));
        return;
      }
      if (res.status !== 409 && res.status !== 422) {
        throw new GitHubSyncError(`GitHub write failed (${res.status})`, res.status);
      }
    }
    throw new GitHubSyncError("GitHub write conflicted twice; your answers are safe locally and will sync next time.");
  }
}

export function createStore(syncToken: string | null): ProgressStore {
  return syncToken ? new GitHubStore({ ...DATA_REPO, token: syncToken }) : new LocalStore();
}
