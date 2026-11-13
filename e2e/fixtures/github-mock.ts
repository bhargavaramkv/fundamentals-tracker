/**
 * Serves a synthetic data repo (see data-repo.ts) in place of api.github.com, so the app can run in synced mode with
 * no real token. Reads come from memory; PUT/DELETE on the contents API change memory only. Nothing leaves the browser.
 *
 * Endpoints the app uses: GET /repos/o/r (token check), git/ref/heads/<branch>, git/commits/<sha>,
 * git/trees/<sha>?recursive=1, git/blobs/<sha>, contents/<path> (JSON with base64 content, or the raw file when the
 * Accept header asks for raw), PUT/DELETE contents/<path>. raw.githubusercontent.com is only used by the legacy manual
 * coding tracker feed; it is answered with a 404 so that screen stays quiet.
 */
import { createHash } from "node:crypto";
import type { Page, Route } from "@playwright/test";
import type { DataRepo } from "./data-repo";

const DATA_REPO_NAME = "fundamentals-tracker-data";

interface RepoState {
  files: Map<string, { text: string; sha: string }>;
  blobs: Map<string, string>;
  version: number;
}

export interface GitHubMock {
  /** Current text of a file in the (mutable) data repo, or undefined. */
  read(path: string): string | undefined;
  /** Every write the app made: "owner/repo:path". */
  writes: string[];
  /** Every request seen, "METHOD path". */
  log: string[];
}

const blobSha = (text: string) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
const fakeSha = (s: string) => createHash("sha1").update(s).digest("hex");
const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, accept, content-type, x-github-api-version",
  "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
  "access-control-expose-headers": "*",
};

export async function mockGitHub(page: Page, data: DataRepo): Promise<GitHubMock> {
  const repos = new Map<string, RepoState>();
  const repoOf = (owner: string, name: string): RepoState => {
    const key = `${owner}/${name}`;
    let r = repos.get(key);
    if (!r) {
      r = { files: new Map(), blobs: new Map(), version: 1 };
      if (name === DATA_REPO_NAME) {
        for (const [p, text] of Object.entries(data.files)) {
          const sha = blobSha(text);
          r.files.set(p, { text, sha });
          r.blobs.set(sha, text);
        }
      }
      repos.set(key, r);
    }
    return r;
  };
  const treeSha = (r: RepoState) => fakeSha(`tree:${r.version}:${[...r.files].map(([p, f]) => p + f.sha).join(",")}`);
  const commitSha = (r: RepoState) => fakeSha(`commit:${treeSha(r)}`);

  const mock: GitHubMock = {
    writes: [],
    log: [],
    read: () => undefined,
  };
  // The owner is only known once the app makes a request, so look the data repo up by name.
  mock.read = (path) => {
    for (const [key, r] of repos) if (key.endsWith(`/${DATA_REPO_NAME}`)) return r.files.get(path)?.text;
    return undefined;
  };

  const reply = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, headers: CORS, contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
  const notFound = (route: Route) => reply(route, 404, { message: "Not Found" });

  await page.route(/^https:\/\/raw\.githubusercontent\.com\//, (route) => route.fulfill({ status: 404, headers: CORS, contentType: "text/plain", body: "404: Not Found" }));

  await page.route(/^https:\/\/api\.github\.com\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    mock.log.push(`${method} ${url.pathname}`);
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });

    const m = /^\/repos\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(url.pathname);
    if (!m) return notFound(route);
    const [, owner, name, rest = ""] = m;
    const repo = repoOf(owner, name);

    if (rest === "") return reply(route, 200, { name, full_name: `${owner}/${name}`, private: true });

    const ref = /^git\/ref\/heads\/(.+)$/.exec(rest);
    if (ref) return repo.files.size === 0 ? reply(route, 409, { message: "Git Repository is empty." }) : reply(route, 200, { ref: `refs/heads/${ref[1]}`, object: { sha: commitSha(repo), type: "commit" } });

    const commit = /^git\/commits\/(.+)$/.exec(rest);
    if (commit) return reply(route, 200, { sha: commit[1], tree: { sha: treeSha(repo) } });

    if (/^git\/trees\//.test(rest)) {
      return reply(route, 200, {
        sha: treeSha(repo),
        truncated: false,
        tree: [...repo.files].map(([path, f]) => ({ path, mode: "100644", type: "blob", sha: f.sha, size: Buffer.byteLength(f.text) })),
      });
    }

    const blob = /^git\/blobs\/(.+)$/.exec(rest);
    if (blob) {
      const text = repo.blobs.get(blob[1]);
      return text === undefined ? notFound(route) : reply(route, 200, { sha: blob[1], encoding: "base64", content: b64(text), size: Buffer.byteLength(text) });
    }

    const contents = /^contents\/(.+)$/.exec(rest);
    if (!contents) return notFound(route);
    const path = contents[1].split("/").map(decodeURIComponent).join("/");
    const file = repo.files.get(path);

    if (method === "GET") {
      if (!file) return notFound(route);
      if ((req.headers()["accept"] ?? "").includes("raw")) return reply(route, 200, file.text);
      return reply(route, 200, { type: "file", name: path.split("/").pop(), path, sha: file.sha, encoding: "base64", content: b64(file.text), size: Buffer.byteLength(file.text) });
    }

    if (method === "PUT") {
      const body = req.postDataJSON() as { content: string; sha?: string };
      // GitHub: 422 when the file exists and no sha is sent, 409 when the sha is stale.
      if (file && !body.sha) return reply(route, 422, { message: "Invalid request. \"sha\" wasn't supplied." });
      if (file && body.sha !== file.sha) return reply(route, 409, { message: `${path} does not match ${body.sha}` });
      if (!file && body.sha) return reply(route, 422, { message: "sha provided but file does not exist" });
      const text = Buffer.from(body.content, "base64").toString("utf8");
      const sha = blobSha(text);
      repo.files.set(path, { text, sha });
      repo.blobs.set(sha, text);
      repo.version++;
      mock.writes.push(`${owner}/${name}:${path}`);
      return reply(route, file ? 200 : 201, { content: { path, sha }, commit: { sha: commitSha(repo) } });
    }

    if (method === "DELETE") {
      if (!file) return notFound(route);
      repo.files.delete(path);
      repo.version++;
      mock.writes.push(`${owner}/${name}:${path} (deleted)`);
      return reply(route, 200, { commit: { sha: commitSha(repo) } });
    }
    return reply(route, 405, { message: "Method not allowed" });
  });

  return mock;
}
