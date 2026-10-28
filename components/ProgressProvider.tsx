"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { emptyProgress, recordRead, recordSession } from "@/lib/progress";
import { createStore, type ProgressStore } from "@/lib/storage";
import { useAuth } from "./AuthGate";
import type { AnswerLog, ProgressData, ReadLog, SessionRecord } from "@/lib/types";

type SyncState = "idle" | "syncing" | "error";

interface ProgressContextValue {
  data: ProgressData;
  ready: boolean;
  storeKind: ProgressStore["kind"];
  syncState: SyncState;
  syncError: string | null;
  commitSession: (session: SessionRecord, answers: AnswerLog[]) => Promise<void>;
  commitRead: (read: ReadLog) => Promise<void>;
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

  const reload = useCallback(async () => {
    const store = createStore(syncToken);
    storeRef.current = store;
    setStoreKind(store.kind);
    setSyncState(store.kind === "github" ? "syncing" : "idle");
    setData(await store.load());
    setSyncState("idle");
    setReady(true);
  }, [syncToken]);

  useEffect(() => {
    // Loading from localStorage/GitHub is an external-system sync, which is what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const persist = useCallback(async (next: ProgressData) => {
    setData(next);
    const store = storeRef.current ?? createStore(syncToken);
    setSyncState(store.kind === "github" ? "syncing" : "idle");
    setSyncError(null);
    try {
      await store.save(next);
      setSyncState("idle");
    } catch (err) {
      setSyncState("error");
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    }
  }, [syncToken]);

  const commitSession = useCallback(
    async (session: SessionRecord, answers: AnswerLog[]) => {
      // Read the latest committed state rather than a possibly stale closure.
      const base = storeRef.current ? await storeRef.current.load() : data;
      await persist(recordSession(base, session, answers));
    },
    [data, persist],
  );

  const commitRead = useCallback(
    async (read: ReadLog) => {
      const base = storeRef.current ? await storeRef.current.load() : data;
      await persist(recordRead(base, read));
    },
    [data, persist],
  );

  const value = useMemo<ProgressContextValue>(
    () => ({ data, ready, storeKind, syncState, syncError, commitSession, commitRead, replaceAll: persist, reload }),
    [data, ready, storeKind, syncState, syncError, commitSession, commitRead, persist, reload],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside <ProgressProvider>");
  return ctx;
}
