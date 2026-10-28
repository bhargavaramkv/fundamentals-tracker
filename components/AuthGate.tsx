"use client";

import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { checkStoredAccess, clearVerified, describeAccessError, markVerified, verifyToken } from "@/lib/auth";
import { DATA_REPO, GitHubStore, writeSyncConfig } from "@/lib/storage";

type GateState = { phase: "checking" } | { phase: "locked"; error?: string } | { phase: "unlocked" };

interface AuthContextValue {
  /** Verifies and stores a new token; resolves to an error message, or null on success. */
  signIn: (token: string) => Promise<string | null>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthGate>");
  return ctx;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ phase: "checking" });

  useEffect(() => {
    let cancelled = false;
    void checkStoredAccess().then((result) => {
      if (cancelled) return;
      if (!result) setState({ phase: "locked" });
      else if (result.ok) setState({ phase: "unlocked" });
      else setState({ phase: "locked", error: describeAccessError(result) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (raw: string) => {
    const token = raw.trim();
    const result = await verifyToken(token);
    if (!result.ok) return describeAccessError(result);
    const store = new GitHubStore({ ...DATA_REPO, token });
    try {
      // Merge this browser's copy with the remote file and write it back (creates it on first sign-in).
      await store.save(await store.load());
    } catch (err) {
      return `Signed in, but the token can't write ${DATA_REPO.repo}: set Contents to "Read and write". (${
        err instanceof Error ? err.message : String(err)
      })`;
    }
    writeSyncConfig(token);
    markVerified();
    setState({ phase: "unlocked" });
    return null;
  }, []);

  const signOut = useCallback(() => {
    writeSyncConfig(null);
    clearVerified();
    setState({ phase: "locked" });
  }, []);

  return (
    <AuthContext.Provider value={{ signIn, signOut }}>
      {state.phase === "unlocked" ? (
        children
      ) : state.phase === "checking" ? (
        <Splash text="Verifying identity…" />
      ) : (
        <LockScreen initialError={state.error} onSubmit={signIn} />
      )}
    </AuthContext.Provider>
  );
}

function Splash({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
        <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle" />
        {text}
      </p>
    </div>
  );
}

function LockScreen({ initialError, onSubmit }: { initialError?: string; onSubmit: (token: string) => Promise<string | null> }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = await onSubmit(token);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <span className="rounded-lg border border-line-strong bg-accent/10 px-3 py-1.5 font-comic text-xl text-accent shadow-glow">
            BHARGAVA.DEV
          </span>
          <span className="flex items-center gap-2 rounded border border-line bg-black/40 px-2 py-1 font-mono text-[10px] text-bad">
            <span className="h-1.5 w-1.5 rounded-full bg-bad" /> RESTRICTED
          </span>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-line bg-surface/90 p-6 shadow-glow backdrop-blur-sm">
          <p className="font-mono text-[10px] tracking-[0.2em] text-ink-3">TRAINING FACILITY · LEVEL 7 CLEARANCE</p>
          <h1 className="mt-1 font-comic text-4xl text-white">Identity verification</h1>
          <p className="mt-2 text-sm text-ink-2">
            Present your access credential: the GitHub token with access to the private data vault. Unauthorized personnel
            don&apos;t get past this screen.
          </p>

          <label className="mt-5 block text-sm">
            <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">Access token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="github_pat_…"
              className="mt-1 w-full rounded-md border border-line bg-black/60 px-3 py-2.5 font-mono text-sm text-ink outline-none focus:border-accent focus:shadow-neon"
            />
          </label>

          {error && (
            <p role="alert" className="mt-3 rounded-md border border-bad/40 bg-bad-bg px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || token.trim().length < 20}
            className="mt-5 w-full rounded bg-accent px-4 py-2.5 font-comic text-xl text-accent-ink transition hover:bg-white hover:shadow-neon disabled:opacity-40"
          >
            {busy ? "Verifying…" : "Initiate"}
          </button>

          <details className="mt-5 text-xs text-ink-3">
            <summary className="cursor-pointer hover:text-ink-2">No credential yet?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                Create a{" "}
                <a
                  className="text-accent hover:underline"
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer"
                >
                  fine-grained token
                </a>{" "}
                with access to only <code>{DATA_REPO.repo}</code>.
              </li>
              <li>Repository permissions → Contents: Read and write.</li>
              <li>Paste it here. It stays in this browser and is only sent to api.github.com.</li>
            </ol>
          </details>
        </form>
      </div>
    </div>
  );
}
