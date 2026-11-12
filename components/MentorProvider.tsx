"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { IdbStore, MemoryStore, idbAvailable, type KeyValueStore } from "@/lib/idb";
import { EMPTY_SNAPSHOT, GitHubMentorSource, loadMentor, type MentorSnapshot } from "@/lib/mentor/remote";
import type { SessionReview } from "@/lib/review/types";
import { useAuth } from "./AuthGate";

interface MentorContextValue extends MentorSnapshot {
  hasToken: boolean;
  loading: boolean;
  /** True once the first load finished (successfully or not). */
  loaded: boolean;
  error: string | null;
  /** Latest review per session id. */
  reviewsBySession: Map<string, SessionReview>;
  refresh: () => void;
}

const MentorContext = createContext<MentorContextValue | null>(null);

async function openCache(): Promise<KeyValueStore<string>> {
  return (await idbAvailable()) ? new IdbStore<string>("ft-mentor", "cache", ["cache"]) : new MemoryStore<string>();
}

export function MentorProvider({ children }: { children: ReactNode }) {
  const { syncToken } = useAuth();
  const [snap, setSnap] = useState<MentorSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!syncToken) return;
    let live = true;
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      setLoading(true);
      try {
        const next = await loadMentor(new GitHubMentorSource(syncToken), await openCache());
        if (!live) return;
        setSnap(next);
        setError(next.stale ? "Offline: showing the last data saved on this device." : null);
      } catch (e) {
        if (live) setError(`Could not load reviews: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        running = false;
        if (live) {
          setLoading(false);
          setLoaded(true);
        }
      }
    };
    const onVisible = () => document.visibilityState === "visible" && void run();
    document.addEventListener("visibilitychange", onVisible);
    void run();
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [syncToken, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const value = useMemo<MentorContextValue>(() => {
    const data = syncToken ? snap : EMPTY_SNAPSHOT;
    const reviewsBySession = new Map<string, SessionReview>();
    // Reviews are newest first, so the first one seen per session is the latest.
    for (const r of data.reviews) if (!reviewsBySession.has(r.sessionId)) reviewsBySession.set(r.sessionId, r);
    return { ...data, hasToken: syncToken !== null, loading: syncToken ? loading : false, loaded: loaded || !syncToken, error: syncToken ? error : null, reviewsBySession, refresh };
  }, [snap, syncToken, loading, loaded, error, refresh]);

  return <MentorContext.Provider value={value}>{children}</MentorContext.Provider>;
}

export function useMentor(): MentorContextValue {
  const ctx = useContext(MentorContext);
  if (!ctx) throw new Error("useMentor must be used inside <MentorProvider>");
  return ctx;
}
