import { DATA_REPO } from "@/lib/storage";

/** The journal files in the private data repo. Paths are repo-relative, e.g. journal/sessions/2026/11/<id>.json. */
export interface JournalRemote {
  /** path -> blob sha, only paths under journal/. Empty when the repo or branch has no commits yet. */
  list(): Promise<Map<string, string>>;
  /** null when the file doesn't exist. */
  read(path: string): Promise<{ text: string; sha: string } | null>;
  /** `sha` is the file's current blob sha, or null to create. 409/422 (stale sha, or file already exists) is {ok:false}. */
  write(path: string, text: string, sha: string | null): Promise<{ ok: true; sha: string } | { ok: false; status: number }>;
}

export class JournalSyncError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const encodePath =(p: string) => p.split("/").map(encodeURIComponent).join("/");

export class GitHubJournalRemote implements JournalRemote {
  private readonly base = `https://api.github.com/repos/${DATA_REPO.owner}/${DATA_REPO.repo}`;

  constructor(private readonly token: string) {}

  private headers(accept = "application/vnd.github+json"): HeadersInit {
    return { Accept: accept, Authorization: `Bearer ${this.token}`, "X-GitHub-Api-Version": "2022-11-28" };
  }

  private get(url: string, accept?: string): Promise<Response> {
    return fetch(url, { headers: this.headers(accept), cache: "no-store" });
  }

  async list(): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const ref = await this.get(`${this.base}/git/ref/heads/${encodeURIComponent(DATA_REPO.branch)}`);
    // 404: no such branch yet. 409: the repo has no commits.
    if (ref.status === 404 || ref.status === 409) return out;
    if (!ref.ok) throw new JournalSyncError(`GitHub list failed (${ref.status})`, ref.status);
    const commitSha = ((await ref.json()) as { object: { sha: string } }).object.sha;
    const commit = await this.get(`${this.base}/git/commits/${commitSha}`);
    if (!commit.ok) throw new JournalSyncError(`GitHub list failed (${commit.status})`, commit.status);
    const treeSha = ((await commit.json()) as { tree: { sha: string } }).tree.sha;
    const tree = await this.get(`${this.base}/git/trees/${treeSha}?recursive=1`);
    if (!tree.ok) throw new JournalSyncError(`GitHub list failed (${tree.status})`, tree.status);
    for (const n of ((await tree.json()) as { tree: { path: string; type: string; sha: string }[] }).tree) {
      if (n.type === "blob" && n.path.startsWith("journal/")) out.set(n.path, n.sha);
    }
    return out;
  }

  async read(path: string): Promise<{ text: string; sha: string } | null> {
    const url = `${this.base}/contents/${encodePath(path)}?ref=${encodeURIComponent(DATA_REPO.branch)}`;
    const meta = await this.get(url);
    if (meta.status === 404) return null;
    if (!meta.ok) throw new JournalSyncError(`GitHub read failed (${meta.status})`, meta.status);
    const { sha, content, encoding } = (await meta.json()) as { sha: string; content?: string; encoding?: string };
    // Content must belong to exactly this sha: writing with a sha newer than the content we merged would drop events.
    // The contents response carries both together up to 1 MB; above that, fetch the blob by its sha.
    if (encoding === "base64" && content) return { text: fromBase64(content), sha };
    const blob = await this.get(`${this.base}/git/blobs/${sha}`);
    if (!blob.ok) throw new JournalSyncError(`GitHub read failed (${blob.status})`, blob.status);
    return { text: fromBase64(((await blob.json()) as { content: string }).content), sha };
  }

  async write(path: string, text: string, sha: string | null) {
    const res = await fetch(`${this.base}/contents/${encodePath(path)}`, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ message: `journal: ${path}`, content: toBase64(text), branch: DATA_REPO.branch, ...(sha ? { sha } : {}) }),
      cache: "no-store",
    });
    if (res.status === 409 || res.status === 422) return { ok: false as const, status: res.status };
    if (!res.ok) throw new JournalSyncError(`GitHub write failed (${res.status})`, res.status);
    return { ok: true as const, sha: ((await res.json()) as { content: { sha: string } }).content.sha };
  }
}
