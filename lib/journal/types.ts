/**
 * Learning Journal data contracts (V2). Design: docs/v2/ARCHITECTURE.md.
 *
 * A session is an append-only log of events. Nothing in it is ever overwritten: status, active time and topics are
 * derived (lib/journal/events.ts). Copies from different devices merge by event id, so merging is order-independent
 * and can't lose an event.
 */

export const JOURNAL_VERSION = 1;

export const SOURCE_KINDS = ["atlas", "docs", "book", "course", "video", "article", "leetcode", "other"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_LABELS: Record<SourceKind, string> = {
  atlas: "Engineering Atlas",
  docs: "Documentation",
  book: "Book",
  course: "Course",
  video: "Video",
  article: "Article",
  leetcode: "LeetCode",
  other: "Other",
};

export interface SessionSource {
  kind: SourceKind;
  /** e.g. the book or course name. */
  title?: string;
}

interface EventBase {
  /** Globally unique and time-sortable (newId). */
  id: string;
  /** Device clock, ISO 8601. */
  at: string;
  /** Random per-browser id (deviceId), for diagnosing conflicts. */
  device: string;
}

export type SessionEvent = EventBase &
  (
    | { kind: "start" }
    | { kind: "pause" }
    | { kind: "resume" }
    | { kind: "topic"; text: string }
    | { kind: "note"; text: string }
    | { kind: "difficulty"; text: string }
    /** activeMs: the session's active time when the bookmark was added. */
    | { kind: "bookmark"; label: string; activeMs: number }
    | { kind: "end"; learned?: string; difficult?: string; unclear?: string }
    /** Replaces the text of an earlier topic/note/difficulty/bookmark. Empty text hides it; the original stays in the log. */
    | { kind: "edit"; target: string; text: string }
    /** Soft delete of the whole session. */
    | { kind: "discard" }
  );

export type EventKind = SessionEvent["kind"];

/** An event from a newer app version. Kept verbatim so merging never drops it; ignored when deriving. */
export type UnknownEvent = EventBase & { kind: string; [field: string]: unknown };

export type StoredEvent = SessionEvent | UnknownEvent;

/** One file per session: journal/sessions/YYYY/MM/<id>.json in the private data repo. */
export interface JournalSession {
  v: typeof JOURNAL_VERSION;
  id: string;
  /** When the session was created (UTC); fixes the file path. Immutable. */
  createdAt: string;
  /** Device that created it. */
  device: string;
  /** Free text, e.g. "HLD". Not tied to the lesson syllabus. Immutable. */
  subject: string;
  source: SessionSource;
  objective?: string;
  events: StoredEvent[];
}

/**
 * Asks for an AI review of a session. Immutable: written once, never edited. A re-review is a new request.
 * Path: journal/requests/<sessionId>/<id>.json. The review engine (a later phase) treats a request as pending until a
 * review with the same requestId exists, and must check that the session still hashes to inputHash.
 */
export interface ReviewRequest {
  v: typeof JOURNAL_VERSION;
  id: string;
  sessionId: string;
  requestedAt: string;
  device: string;
  /** sha256 (hex) of the session's canonical JSON when the request was made (sessionHash). */
  inputHash: string;
}

export type SessionStatus = "active" | "paused" | "ended" | "discarded";
