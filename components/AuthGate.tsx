"use client";

import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  describeTokenError,
  endSession,
  loadSyncToken,
  restoreSession,
  saveSyncToken,
  signInWithPassword,
  verifyToken,
} from "@/lib/auth";
import { DATA_REPO, GitHubStore } from "@/lib/storage";

type GateState = { phase: "checking" } | { phase: "locked" } | { phase: "unlocked"; key: CryptoKey; syncToken: string | null };

interface AuthContextValue {
  syncToken: string | null;
  /** Verifies a GitHub token, does a first sync, and stores it encrypted. Resolves to an error message or null. */
  connectSync: (token: string) => Promise<string | null>;
  disconnectSync: () => Promise<void>;
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

  const unlock = useCallback(async (key: CryptoKey) => {
    setState({ phase: "unlocked", key, syncToken: await loadSyncToken(key) });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void restoreSession().then((key) => {
      if (cancelled) return;
      if (key) void unlock(key);
      else setState({ phase: "locked" });
    });
    return () => {
      cancelled = true;
    };
  }, [unlock]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const key = await signInWithPassword(username, password);
      if (!key) return false;
      await unlock(key);
      return true;
    },
    [unlock],
  );

  const connectSync = useCallback(
    async (raw: string) => {
      if (state.phase !== "unlocked") return "Sign in first.";
      const token = raw.trim();
      const check = await verifyToken(token);
      if (!check.ok) return describeTokenError(check);
      const store = new GitHubStore({ ...DATA_REPO, token });
      try {
        // Merge this browser's copy with the remote file and write it back (creates it on first connect).
        await store.save(await store.load());
      } catch (err) {
        return `The token can read ${DATA_REPO.repo} but can't write to it. Set Contents to "Read and write". (${
          err instanceof Error ? err.message : String(err)
        })`;
      }
      await saveSyncToken(state.key, token);
      setState({ ...state, syncToken: token });
      return null;
    },
    [state],
  );

  const disconnectSync = useCallback(async () => {
    if (state.phase !== "unlocked") return;
    await saveSyncToken(state.key, null);
    setState({ ...state, syncToken: null });
  }, [state]);

  const signOut = useCallback(() => {
    endSession();
    setState({ phase: "locked" });
  }, []);

  if (state.phase === "checking") {
    return <p className="m-auto text-sm text-ink-3">Loading…</p>;
  }
  if (state.phase === "locked") return <LoginScreen onSubmit={signIn} />;

  return (
    <AuthContext.Provider value={{ syncToken: state.syncToken, connectSync, disconnectSync, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginScreen({ onSubmit }: { onSubmit: (username: string, password: string) => Promise<boolean> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await onSubmit(username, password);
    setBusy(false);
    if (!ok) setError("Incorrect username or password.");
  };

  const input = "mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <p className="font-semibold tracking-tight">
          Fundamentals<span className="text-accent">.</span>
        </p>
        <h1 className="mt-4 text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-ink-2">This tracker is private.</p>

        <label className="mt-5 block text-sm">
          <span className="text-ink-2">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            className={input}
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-ink-2">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={input}
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
