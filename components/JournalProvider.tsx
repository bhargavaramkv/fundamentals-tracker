"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { compressImage, sha256Hex } from "@/lib/journal/attachments";
import { makeEvent, newId } from "@/lib/journal/events";
import { getDeviceId, openJournalLocal, type JournalLocal, type SessionRecord } from "@/lib/journal/local";
import { GitHubJournalRemote } from "@/lib/journal/remote";
import type { QueueInfo } from "@/lib/journal/status";
import { JournalSync, type ConflictInspection, type RecordStatus, type SyncState } from "@/lib/journal/sync";
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
  /** navigator.onLine, kept live. */
  online: boolean;
  queue: QueueInfo;
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
  /** Reads both copies of a session in conflict. Does not write. */
  inspectConflict: (sessionId: string) => Promise<ConflictInspection | null>;
  retryConflict: (sessionId: string) => Promise<boolean>;
  /** Backs up the GitHub copy, then overwrites it with the merged result. */
  resolveConflict: (sessionId: string) => Promise<boolean>;
  /** Compresses a photo, stores it on this device, then records an `attach` event. False if anything failed (nothing is lost). */
  addPhoto: (sessionId: string, file: File) => Promise<boolean>;
  /** The stored photo blob, or null when it is not on this device. */
  loadPhoto: (attachmentId: string) => Promise<Blob | null>;
}

const JournalContext = createContext<JournalContextValue | null>(null);
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function JournalProvider({ children }: { children: ReactNode }) {
  const { syncToken } = useAuth();
  const [store, setStore] = useState<{ local: JournalLocal; device: string } | null>(null);
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RecordStatus>>({});
  const [syncState, setSyncState] = useState<SyncState>({ state: "offline-only" });
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueueInfo>({ queued: 0, nextAttemptAt: null, conflicts: 0 });
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
        const q = await s.queueInfo();
        if (!live) return;
        setQueue(q);
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
    const setNet = () => setOnline(navigator.onLine);
    setNet();
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(run, 60_000);
    void refresh();
    run();
    return () => {
      live = false;
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener("online", setNet);
      window.removeEventListener("offline", setNet);
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

  const addEvent = useCallback(async (id: string, event: NewEvent) => (await write((s) => s.append(id, [makeEvent(event, deviceRef.current)]))) !== null, [write]);

  const value = useMemo<JournalContextValue>(
    () => ({
      ready,
      records,
      statuses,
      syncState,
      online,
      queue,
      persistent: store?.local.persistent ?? true,
      hasToken: syncToken !== null,
      error,
      start: (input) => write((s) => s.createSession(input)),
      add: addEvent,
      end: async (id, reflection) =>
        (await write(async (s) => {
          await s.append(id, [makeEvent({ kind: "end", ...reflection }, deviceRef.current)]);
          await s.requestReview(id);
        })) !== null,
      discard: async (id) => (await write((s) => s.append(id, [makeEvent({ kind: "discard" }, deviceRef.current)]))) !== null,
      syncNow: () => sync && void sync.sync().catch((e) => setError(`Sync failed: ${errText(e)}`)),
      inspectConflict: async (id) => {
        try {
          return (await sync?.inspectConflict(id)) ?? null;
        } catch (e) {
          setError(`Could not read the GitHub copy: ${errText(e)}`);
          return null;
        }
      },
      retryConflict: async (id) => {
        try {
          await sync?.retryConflict(id);
          return true;
        } catch (e) {
          setError(`Retry failed: ${errText(e)}`);
          return false;
        }
      },
      resolveConflict: async (id) => {
        try {
          await sync?.resolveConflict(id);
          setError(null);
          return true;
        } catch (e) {
          setError(`Repair did not complete: ${errText(e)}`);
          return false;
        }
      },
      addPhoto: async (id, file) => {
        if (!store || !sync) return false;
        try {
          const { blob, width, height } = await compressImage(file);
          const attachmentId = newId();
          const sha256 = await sha256Hex(blob);
          // The blob is saved before the event that points to it, so an event never refers to a missing photo.
          await store.local.attachments.put(attachmentId, { id: attachmentId, sessionId: id, blob, mime: blob.type, width, height, bytes: blob.size, sha256, ...(file.name ? { name: file.name } : {}), createdAt: new Date().toISOString() });
          return await addEvent(id, { kind: "attach", attachmentId, mime: blob.type, width, height, bytes: blob.size, sha256, ...(file.name ? { name: file.name } : {}) });
        } catch (e) {
          setError(`Could not save the photo: ${errText(e)}`);
          return false;
        }
      },
      loadPhoto: async (aid) => (await store?.local.attachments.get(aid))?.blob ?? null,
    }),
    [ready, records, statuses, syncState, online, queue, store, syncToken, error, write, sync, addEvent],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used inside <JournalProvider>");
  return ctx;
}
