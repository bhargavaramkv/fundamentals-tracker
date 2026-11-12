import { IdbStore, MemoryStore, idbAvailable, type KeyValueStore } from "@/lib/idb";
import { newId } from "./events";
import type { JournalSession, ReviewRequest } from "./types";

export interface SessionRecord {
  session: JournalSession;
  /** Blob sha of the remote file as of the last sync; null if never uploaded. */
  remoteSha: string | null;
  path: string;
}

export interface RequestRecord {
  request: ReviewRequest;
  uploaded: boolean;
}

export interface OutboxEntry {
  /** `session:<id>` or `request:<id>`. */
  key: string;
  kind: "session" | "request";
  refId: string;
  queuedAt: string;
  attempts: number;
  /** Epoch ms. */
  nextAttemptAt: number;
  lastError?: string;
  /** Set when the remote copy needs a human; the entry is then never retried. */
  conflict?: string;
}

export interface JournalLocal {
  sessions: KeyValueStore<SessionRecord>;
  requests: KeyValueStore<RequestRecord>;
  outbox: KeyValueStore<OutboxEntry>;
  meta: KeyValueStore<string>;
  /** False when running on the in-memory fallback: data is lost on refresh. */
  persistent: boolean;
}

const DB = "ft-journal";
const STORES = ["sessions", "requests", "outbox", "meta"];

export function memoryJournalLocal(persistent = false): JournalLocal {
  return { sessions: new MemoryStore(), requests: new MemoryStore(), outbox: new MemoryStore(), meta: new MemoryStore(), persistent };
}

export async function openJournalLocal(): Promise<JournalLocal> {
  if (!(await idbAvailable())) return memoryJournalLocal();
  return {
    sessions: new IdbStore<SessionRecord>(DB, "sessions", STORES),
    requests: new IdbStore<RequestRecord>(DB, "requests", STORES),
    outbox: new IdbStore<OutboxEntry>(DB, "outbox", STORES),
    meta: new IdbStore<string>(DB, "meta", STORES),
    persistent: true,
  };
}

export async function getDeviceId(local: JournalLocal): Promise<string> {
  const existing = await local.meta.get("deviceId");
  if (existing) return existing;
  const id = newId();
  await local.meta.put("deviceId", id);
  return id;
}
