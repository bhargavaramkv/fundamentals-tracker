"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { describeTokenError, fetchSharedToken, publishSharedToken, removeSharedToken, SHARED_TOKEN, signInWithPassword, vault, verifyToken } from "@/lib/auth";
import {
  clearLegacySession,
  enrollDevice,
  forgetDevice,
  openDeviceStore,
  restoreDevice,
  updateDeviceToken,
  upgradeLegacySession,
  type DeviceStore,
} from "@/lib/device-session";
import { DATA_REPO, GitHubStore } from "@/lib/storage";
import { login } from "@/lib/vault";
import { BrandMark } from "./BrandMark";

type GateState =
  | { phase: "checking" }
  | { phase: "locked" }
  /** passwordKey is set only after a password sign-in in this tab; it is never stored. */
  | { phase: "unlocked"; passwordKey: CryptoKey | null; syncToken: string | null; shared: boolean };

export interface ConnectResult {
  error: string | null;
  /** Set when sync works on this device but couldn't be saved for the whole account. */
  warning: string | null;
}

interface AuthContextValue {
  syncToken: string | null;
  /** True when the token comes from (or was saved to) the account-wide encrypted copy. */
  sharedAcrossDevices: boolean;
  /** False after a restored session: saving a token for every device then needs the password again. */
  canShareToken: boolean;
  /** Whether this browser keeps the sign-in (IndexedDB available). */
  remembered: boolean;
  /** Verifies a GitHub token, does a first sync, and saves it for this device and (with the password) the account. */
  connectSync: (token: string, password?: string) => Promise<ConnectResult>;
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
  const storeRef = useRef<DeviceStore | null>(null);
  const [remembered, setRemembered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const store = await openDeviceStore().catch(() => null);
      storeRef.current = store;
      setRemembered(store !== null);
      if (!store) clearLegacySession();
      const session = store ? ((await restoreDevice(store, vault)) ?? (await upgradeLegacySession(store, vault))) : null;
      if (cancelled) return;
      setState(session ? { phase: "unlocked", passwordKey: null, syncToken: session.token, shared: session.shared } : { phase: "locked" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const key = await signInWithPassword(username, password);
    if (!key) return false;
    const store = storeRef.current;
    // The account-wide copy wins, so a token replaced on one device reaches this one; else keep this device's own.
    const [shared, own] = await Promise.all([fetchSharedToken(key), store ? restoreDevice(store, vault) : null]);
    const token = shared ?? own?.token ?? null;
    if (store) await enrollDevice(store, vault, token, shared !== null).catch(() => undefined);
    setState({ phase: "unlocked", passwordKey: key, syncToken: token, shared: shared !== null });
    return true;
  }, []);

  const connectSync = useCallback(
    async (raw: string, password?: string): Promise<ConnectResult> => {
      if (state.phase !== "unlocked") return { error: "Sign in first.", warning: null };
      const passwordKey = state.passwordKey ?? (password ? await login(vault, vault.username, password) : null);
      if (password && !passwordKey) return { error: "That password is incorrect.", warning: null };
      const token = raw.trim();
      const check = await verifyToken(token);
      if (!check.ok) return { error: describeTokenError(check), warning: null };
      const store = new GitHubStore({ ...DATA_REPO, token });
      try {
        // Merge this browser's copy with the remote file and write it back (creates it on first connect).
        await store.save(await store.load());
        await store.flush(); // push now, so a token without write access is reported here
      } catch (err) {
        return {
          error: `The token can read ${DATA_REPO.repo} but can't write to it. Set Contents to "Read and write". (${
            err instanceof Error ? err.message : String(err)
          })`,
          warning: null,
        };
      }
      const published = passwordKey ? await publishSharedToken(passwordKey, token) : null;
      const shared = published?.ok ?? false;
      if (storeRef.current) await updateDeviceToken(storeRef.current, token, shared);
      setState({ ...state, passwordKey: passwordKey ?? state.passwordKey, syncToken: token, shared });
      return {
        error: null,
        warning: !published
          ? "Sync works on this device. Enter your password with the token to save it for your other devices too."
          : published.ok
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
    if (storeRef.current) await updateDeviceToken(storeRef.current, null, false);
    setState({ ...state, syncToken: null, shared: false });
  }, [state]);

  const signOut = useCallback(() => {
    clearLegacySession();
    if (storeRef.current) void forgetDevice(storeRef.current);
    setState({ phase: "locked" });
  }, []);

  if (state.phase === "checking") {
    return <p className="m-auto text-sm text-ink-3">Loading…</p>;
  }
  if (state.phase === "locked") return <LoginScreen onSubmit={signIn} />;

  return (
    <AuthContext.Provider
      value={{
        syncToken: state.syncToken,
        sharedAcrossDevices: state.shared,
        canShareToken: state.passwordKey !== null,
        remembered,
        connectSync,
        disconnectSync,
        signOut,
      }}
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
