"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { makeEvent } from "@/lib/journal/events";
import { getDeviceId, openJournalLocal, type JournalLocal, type SessionRecord } from "@/lib/journal/local";
import { GitHubJournalRemote } from "@/lib/journal/remote";
import { JournalSync, type RecordStatus, type SyncState } from "@/lib/journal/sync";
import type { JournalSession, SessionSource } from "@/lib/journal/types";
import { useAuth } from "./AuthGate";

type NewEvent = Parameters<typeof makeEvent>[0];
export type EndReflection = { learned?: string; difficult?: string; unclear?: string };

interface JournalContextValue {
  ready: boolean;
  /** Newest first, including discarded sessions. */
  records: SessionRecord[];
  statuses: Record<string, RecordStatus>;
  syncState: SyncState;
  /** False on the in-memory fallback: sessions are lost on refresh. */
  persistent: boolean;
  hasToken: boolean;
  /** The last failed write or storage error; shown to the user, never swallowed. */
  error: string | null;
  start: (input: { subject: string; source: SessionSource; objective?: string }) => Promise<JournalSession | null>;
  add: (sessionId: string, event: NewEvent) => Promise<boolean>;
  end: (sessionId: string, reflection: EndReflection) => Promise<boolean>;
  discard: (sessionId: string) => Promise<boolean>;
  syncNow: () => void;
}

const JournalContext = createContext<JournalContextValue | null>(null);
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function JournalProvider({ children }: { children: ReactNode }) {
  const { syncToken } = useAuth();
  const [store, setStore] = useState<{ local: JournalLocal; device: string } | null>(null);
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RecordStatus>>({});
  const [syncState, setSyncState] = useState<SyncState>({ state: "offline-only" });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef("");

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const local = await openJournalLocal();
        const device = await getDeviceId(local);
        if (live) setStore({ local, device });
      } catch (e) {
        if (live) setError(`Could not open the journal: ${errText(e)}`);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const sync = useMemo(
    () => (store ? new JournalSync(store.local, store.device, syncToken ? new GitHubJournalRemote(syncToken) : null) : null),
    [store, syncToken],
  );

  useEffect(() => {
    if (!sync || !store) return;
    const s = sync;
    deviceRef.current = store.device;
    let live = true;
    const refresh = async () => {
      try {
        const all = await s.sessions();
        const entries = await Promise.all(all.map(async (r) => [r.session.id, await s.status(r.session.id)] as const));
        if (!live) return;
        setRecords(all);
        setStatuses(Object.fromEntries(entries));
        setSyncState(s.syncState());
        setReady(true);
      } catch (e) {
        if (live) setError(`Could not read the journal: ${errText(e)}`);
      }
    };
    const unsubscribe = s.subscribe(() => void refresh());
    const run = () => void s.sync().catch((e) => live && setError(`Sync failed: ${errText(e)}`));
    const onVisible = () => document.visibilityState === "visible" && run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(run, 60_000);
    void refresh();
    run();
    return () => {
      live = false;
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
      s.dispose();
    };
  }, [sync, store]);

  // Runs a local write, then schedules a push. Failures are surfaced, not swallowed.
  const write = useCallback(
    async <T,>(fn: (s: JournalSync) => Promise<T>): Promise<T | null> => {
      if (!sync) {
        setError("The journal is not ready yet.");
        return null;
      }
      try {
        const result = await fn(sync);
        setError(null);
        sync.scheduleSync();
        return result;
      } catch (e) {
        setError(`Could not save: ${errText(e)}`);
        return null;
      }
    },
    [sync],
  );

  const value = useMemo<JournalContextValue>(
    () => ({
      ready,
      records,
      statuses,
      syncState,
      persistent: store?.local.persistent ?? true,
      hasToken: syncToken !== null,
      error,
      start: (input) => write((s) => s.createSession(input)),
      add: async (id, event) => (await write((s) => s.append(id, [makeEvent(event, deviceRef.current)]))) !== null,
      end: async (id, reflection) =>
        (await write(async (s) => {
          await s.append(id, [makeEvent({ kind: "end", ...reflection }, deviceRef.current)]);
          await s.requestReview(id);
        })) !== null,
      discard: async (id) => (await write((s) => s.append(id, [makeEvent({ kind: "discard" }, deviceRef.current)]))) !== null,
      syncNow: () => sync && void sync.sync().catch((e) => setError(`Sync failed: ${errText(e)}`)),
    }),
    [ready, records, statuses, syncState, store, syncToken, error, write, sync],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used inside <JournalProvider>");
  return ctx;
}
