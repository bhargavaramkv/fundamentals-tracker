import { IdbStore, MemoryStore, idbAvailable, type KeyValueStore } from "@/lib/idb";
import { newId } from "./events";
import type { JournalSession, ReviewRequest } from "./types";

/** A photo kept on this device. Never deleted automatically: it is the only copy until uploads exist. */
export interface AttachmentRecord {
  id: string;
  sessionId: string;
  blob: Blob;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  name?: string;
  createdAt: string;
}

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
  attachments: KeyValueStore<AttachmentRecord>;
  /** False when running on the in-memory fallback: data is lost on refresh. */
  persistent: boolean;
}

const DB = "ft-journal";
/**
 * Database versions: 1 = sessions, requests, outbox, meta. 2 = adds attachments. Opening an older database at
 * DB_VERSION runs the upgrade, which only creates the missing store, so existing sessions and the outbox are kept.
 */
const DB_VERSION = 2;
export const JOURNAL_STORES = ["sessions", "requests", "outbox", "meta", "attachments"];

export function memoryJournalLocal(persistent = false): JournalLocal {
  return { sessions: new MemoryStore(), requests: new MemoryStore(), outbox: new MemoryStore(), meta: new MemoryStore(), attachments: new MemoryStore(), persistent };
}

export async function openJournalLocal(): Promise<JournalLocal> {
  if (!(await idbAvailable())) return memoryJournalLocal();
  return {
    sessions: new IdbStore<SessionRecord>(DB, "sessions", JOURNAL_STORES, DB_VERSION),
    requests: new IdbStore<RequestRecord>(DB, "requests", JOURNAL_STORES, DB_VERSION),
    outbox: new IdbStore<OutboxEntry>(DB, "outbox", JOURNAL_STORES, DB_VERSION),
    meta: new IdbStore<string>(DB, "meta", JOURNAL_STORES, DB_VERSION),
    attachments: new IdbStore<AttachmentRecord>(DB, "attachments", JOURNAL_STORES, DB_VERSION),
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
