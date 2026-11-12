"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { activeProgress, archivedAnswerCount, emptyProgress, recordActivity, recordCodingAttempt, recordCodingProblem, recordRead, recordSession } from "@/lib/progress";
import { LocalStore, createStore, type ProgressStore } from "@/lib/storage";
import { useAuth } from "./AuthGate";
import type { AnswerLog, CodingAttempt, CodingProblem, LearningActivity, ProgressData, ReadLog, SessionRecord } from "@/lib/types";

type SyncState = "idle" | "syncing" | "error";

interface ProgressContextValue {
  /** What counts for scores and recommendations (since the content epoch). */
  data: ProgressData;
  /** Everything stored, including archived answers. Use for export, import and merges. */
  raw: ProgressData;
  archivedCount: number;
  ready: boolean;
  storeKind: ProgressStore["kind"];
  syncState: SyncState;
  syncError: string | null;
  commitSession: (session: SessionRecord, answers: AnswerLog[]) => Promise<void>;
  commitRead: (read: ReadLog) => Promise<void>;
  commitActivity: (activity: LearningActivity) => Promise<void>;
  saveCodingProblem: (problem: CodingProblem) => Promise<void>;
  commitCodingAttempt: (attempt: CodingAttempt) => Promise<void>;
  replaceAll: (data: ProgressData) => Promise<void>;
  reload: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { syncToken } = useAuth();
  const storeRef = useRef<ProgressStore | null>(null);
  const [data, setData] = useState<ProgressData>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [storeKind, setStoreKind] = useState<ProgressStore["kind"]>("local");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);

  // Commits build on this browser's copy (the UI's source of truth); the remote is only fetched on load and merged when pushing.
  const localRef = useRef(new LocalStore());

  // Background pushes report their progress through the store.
  const openStore = useCallback(() => {
    const store = createStore(syncToken);
    store.onStatus = (state, message) => {
      setSyncState(state);
      setSyncError(state === "error" ? (message ?? "Sync failed") : null);
    };
    return store;
  }, [syncToken]);

  const reload = useCallback(async () => {
    if (storeRef.current) storeRef.current.onStatus = undefined;
    const store = openStore();
    storeRef.current = store;
    setStoreKind(store.kind);
    setSyncState(store.kind === "github" ? "syncing" : "idle");
    setData(await store.load());
    // A push started by load() reports its own result; keep an error it reported.
    setSyncState((s) => (s === "error" ? s : "idle"));
    setReady(true);
  }, [openStore]);

  useEffect(() => {
    // Loading from localStorage/GitHub is an external-system sync, which is what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  // GitHub pushes are debounced inside the store; `now` pushes immediately (import).
  const persist = useCallback(async (next: ProgressData, now = false) => {
    setData(next);
    const store = storeRef.current ?? openStore();
    setSyncState(store.kind === "github" ? "syncing" : "idle");
    setSyncError(null);
    try {
      await store.save(next);
      if (now) await store.flush?.();
      if (store.kind === "local") setSyncState("idle");
    } catch (err) {
      setSyncState("error");
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    }
  }, [openStore]);

  // Push pending changes before the page goes away or is backgrounded.
  useEffect(() => {
    const flush = () => void storeRef.current?.flush?.().catch(() => undefined);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const replaceAll = useCallback((d: ProgressData) => persist(d, true), [persist]);

  const commitSession = useCallback(
    async (session: SessionRecord, answers: AnswerLog[]) => {
      // Read the latest committed state rather than a possibly stale closure.
      await persist(recordSession(await localRef.current.load(), session, answers));
    },
    [persist],
  );

  const commitRead = useCallback(
    async (read: ReadLog) => {
      await persist(recordRead(await localRef.current.load(), read));
    },
    [persist],
  );

  // Quick actions (ticking an exercise, logging an attempt) show immediately, then persist like everything else.
  const applyNow = useCallback(
    async (change: (d: ProgressData) => ProgressData) => {
      setData(change);
      await persist(change(await localRef.current.load()));
    },
    [persist],
  );
  const commitActivity = useCallback((a: LearningActivity) => applyNow((d) => recordActivity(d, a)), [applyNow]);
  const saveCodingProblem = useCallback((p: CodingProblem) => applyNow((d) => recordCodingProblem(d, p)), [applyNow]);
  const commitCodingAttempt = useCallback((a: CodingAttempt) => applyNow((d) => recordCodingAttempt(d, a)), [applyNow]);

  const active = useMemo(() => activeProgress(data), [data]);
  const archivedCount = useMemo(() => archivedAnswerCount(data), [data]);

  const value = useMemo<ProgressContextValue>(
    () => ({
      data: active,
      raw: data,
      archivedCount,
      ready,
      storeKind,
      syncState,
      syncError,
      commitSession,
      commitRead,
      commitActivity,
      saveCodingProblem,
      commitCodingAttempt,
      replaceAll,
      reload,
    }),
    [active, data, archivedCount, ready, storeKind, syncState, syncError, commitSession, commitRead, commitActivity, saveCodingProblem, commitCodingAttempt, replaceAll, reload],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside <ProgressProvider>");
  return ctx;
}
