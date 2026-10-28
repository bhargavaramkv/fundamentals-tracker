import loginVault from "./login-vault.json";
import { DATA_REPO } from "./storage";
import { exportKey, importKey, keyMatches, login, seal, unseal, type LoginVault, type Sealed } from "./vault";

/**
 * Username/password login for the static site. A successful login yields an
 * AES key derived from the credentials. The key is kept for 30 days so you
 * stay signed in, and the GitHub sync token is stored encrypted under it, so
 * signing out leaves nothing usable behind.
 */
const vault = loginVault as LoginVault;
const SESSION_KEY = "ft.session.v1";
const TOKEN_KEY = "ft.syncToken.v1";
const SESSION_DAYS = 30;

interface StoredSession {
  key: string;
  expiresAt: number;
}

export async function signInWithPassword(username: string, password: string): Promise<CryptoKey | null> {
  const key = await login(vault, username, password);
  if (!key) return null;
  const session: StoredSession = { key: await exportKey(key), expiresAt: Date.now() + SESSION_DAYS * 86_400_000 };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return key;
}

/** Restores a still-valid session; the stored key must still match the current vault. */
export async function restoreSession(): Promise<CryptoKey | null> {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (Date.now() > session.expiresAt) return null;
    const key = await importKey(session.key);
    return (await keyMatches(vault, key)) ? key : null;
  } catch {
    return null;
  }
}

export function endSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

export async function loadSyncToken(key: CryptoKey): Promise<string | null> {
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? await unseal(key, JSON.parse(raw) as Sealed) : null;
  } catch {
    return null;
  }
}

export async function saveSyncToken(key: CryptoKey, token: string | null): Promise<void> {
  if (token) window.localStorage.setItem(TOKEN_KEY, JSON.stringify(await seal(key, token)));
  else window.localStorage.removeItem(TOKEN_KEY);
}

export type TokenCheck =
  | { ok: true }
  | { ok: false; reason: "invalid" | "no-access" | "not-private" | "offline" | "error"; status?: number };

/** Confirms a sync token can read the private data repo before it's saved. */
export async function verifyToken(token: string): Promise<TokenCheck> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${DATA_REPO.owner}/${DATA_REPO.repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "offline" };
  }
  if (res.status === 401) return { ok: false, reason: "invalid", status: 401 };
  if (res.status === 403 || res.status === 404) return { ok: false, reason: "no-access", status: res.status };
  if (!res.ok) return { ok: false, reason: "error", status: res.status };
  const repo = (await res.json()) as { private?: boolean };
  // Progress must never sync to a public repo.
  if (!repo.private) return { ok: false, reason: "not-private" };
  return { ok: true };
}

export function describeTokenError(result: Exclude<TokenCheck, { ok: true }>): string {
  const repo = `${DATA_REPO.owner}/${DATA_REPO.repo}`;
  switch (result.reason) {
    case "invalid":
      return "GitHub rejected the token (401). It's invalid, expired, or copied incompletely.";
    case "no-access":
      return `The token can't see ${repo} (${result.status}). Under Repository access, add ${repo}.`;
    case "not-private":
      return `${repo} is public. Make it private before syncing progress to it.`;
    case "offline":
      return "Couldn't reach api.github.com. Check your connection.";
    default:
      return `GitHub returned HTTP ${result.status ?? "?"}.`;
  }
}
