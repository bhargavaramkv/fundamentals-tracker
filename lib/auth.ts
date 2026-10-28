import { DATA_REPO, readSyncConfig } from "./storage";

/**
 * GitHub Pages can't run server-side auth, so the portal is unlocked by proving
 * access to the owner's *private* data repo with a fine-grained token. Anyone
 * without that access is kept on the sign-in screen.
 */
export type AccessResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "no-access" | "not-private" | "offline" | "error"; status?: number };

const VERIFIED_KEY = "ft.verifiedAt.v1";
/** How long a previous successful check still counts while offline. */
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export async function verifyToken(token: string): Promise<AccessResult> {
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
  // A public data repo would let any token through, so refuse to unlock.
  if (!repo.private) return { ok: false, reason: "not-private" };
  return { ok: true };
}

export function markVerified(): void {
  window.localStorage.setItem(VERIFIED_KEY, String(Date.now()));
}

export function clearVerified(): void {
  window.localStorage.removeItem(VERIFIED_KEY);
}

/** Re-checks the stored token on load; allows a short offline grace period after a recent success. */
export async function checkStoredAccess(): Promise<AccessResult | null> {
  const config = readSyncConfig();
  if (!config) return null;
  const result = await verifyToken(config.token);
  if (result.ok) {
    markVerified();
    return result;
  }
  if (result.reason === "offline") {
    const last = Number(window.localStorage.getItem(VERIFIED_KEY) ?? 0);
    if (Date.now() - last < OFFLINE_GRACE_MS) return { ok: true };
  }
  return result;
}

export function describeAccessError(result: Exclude<AccessResult, { ok: true }>): string {
  const repo = `${DATA_REPO.owner}/${DATA_REPO.repo}`;
  switch (result.reason) {
    case "invalid":
      return "GitHub rejected this token. It's invalid, expired, or copied incompletely.";
    case "no-access":
      return `This token can't access ${repo}. Access denied.`;
    case "not-private":
      return `${repo} is public, so it can't be used to verify identity. Make it private first.`;
    case "offline":
      return "Couldn't reach GitHub to verify. Check your connection.";
    default:
      return `Verification failed (HTTP ${result.status ?? "?"}).`;
  }
}
