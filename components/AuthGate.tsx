"use client";

import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  describeTokenError,
  endSession,
  fetchSharedToken,
  loadSyncToken,
  publishSharedToken,
  removeSharedToken,
  restoreSession,
  saveSyncToken,
  SHARED_TOKEN,
  signInWithPassword,
  verifyToken,
} from "@/lib/auth";
import { DATA_REPO, GitHubStore } from "@/lib/storage";
import { BrandMark } from "./BrandMark";

type GateState =
  | { phase: "checking" }
  | { phase: "locked" }
  | { phase: "unlocked"; key: CryptoKey; syncToken: string | null; shared: boolean };

export interface ConnectResult {
  error: string | null;
  /** Set when sync works on this device but couldn't be saved for the whole account. */
  warning: string | null;
}

interface AuthContextValue {
  syncToken: string | null;
  /** True when the token comes from (or was saved to) the account-wide encrypted copy. */
  sharedAcrossDevices: boolean;
  /** Verifies a GitHub token, does a first sync, and saves it encrypted for this account. */
  connectSync: (token: string) => Promise<ConnectResult>;
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
    // The account-wide copy wins, so a token replaced on one device reaches every other device.
    const [shared, local] = await Promise.all([fetchSharedToken(key), loadSyncToken(key)]);
    if (shared && shared !== local) await saveSyncToken(key, shared);
    setState({ phase: "unlocked", key, syncToken: shared ?? local, shared: shared !== null });
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
    async (raw: string): Promise<ConnectResult> => {
      if (state.phase !== "unlocked") return { error: "Sign in first.", warning: null };
      const token = raw.trim();
      const check = await verifyToken(token);
      if (!check.ok) return { error: describeTokenError(check), warning: null };
      const store = new GitHubStore({ ...DATA_REPO, token });
      try {
        // Merge this browser's copy with the remote file and write it back (creates it on first connect).
        await store.save(await store.load());
      } catch (err) {
        return {
          error: `The token can read ${DATA_REPO.repo} but can't write to it. Set Contents to "Read and write". (${
            err instanceof Error ? err.message : String(err)
          })`,
          warning: null,
        };
      }
      await saveSyncToken(state.key, token);
      const published = await publishSharedToken(state.key, token);
      setState({ ...state, syncToken: token, shared: published.ok });
      return {
        error: null,
        warning: published.ok
          ? null
          : `Sync works on this device, but couldn't be saved for your other devices (HTTP ${published.status ?? "?"}). ` +
            `Give the token access to ${SHARED_TOKEN.repo} as well (Contents: Read and write) and save it again.`,
      };
    },
    [state],
  );

  const disconnectSync = useCallback(async () => {
    if (state.phase !== "unlocked") return;
    if (state.syncToken) await removeSharedToken(state.syncToken);
    await saveSyncToken(state.key, null);
    setState({ ...state, syncToken: null, shared: false });
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
    <AuthContext.Provider
      value={{ syncToken: state.syncToken, sharedAcrossDevices: state.shared, connectSync, disconnectSync, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function LoginScreen({ onSubmit }: { onSubmit: (username: string, password: string) => Promise<boolean> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await onSubmit(username, password);
    setBusy(false);
    if (!ok) {
      // Keep the username; never keep a rejected password around.
      setPassword("");
      setError("Incorrect username or password.");
    }
  };

  const input = "field mt-1 text-sm";

  return (
    <div className="flex flex-1 items-center justify-center px-[max(1rem,env(safe-area-inset-left))] pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-surface p-7">
        <BrandMark className="text-lg" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-2">Sign in to continue your practice. This tracker is private.</p>

        <label className="mt-5 block text-sm">
          <span className="text-ink-2">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
            className={input}
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-ink-2">Password</span>
          <span className="relative mt-1 block">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              className="field pr-16 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-ink-2 hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>

        {error && (
          <p id="login-error" role="alert" className="mt-3 rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary btn-lg mt-6 w-full"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
