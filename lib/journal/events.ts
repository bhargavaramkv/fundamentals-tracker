import { JOURNAL_VERSION, SOURCE_KINDS, type JournalSession, type ReviewRequest, type SessionEvent, type SessionStatus, type StoredEvent } from "./types";

/**
 * Pure functions over a session's event log: ids, validation, merging and everything derived from the log.
 * No I/O, so they behave the same in the browser, in Node scripts and in tests.
 */

const KNOWN = new Set(["start", "pause", "resume", "topic", "note", "difficulty", "bookmark", "end", "edit", "discard"]);
const CONTROL = new Set(["start", "pause", "resume", "end"]);

/** Time-sortable unique id: 9 chars of base-36 milliseconds, then 12 random base-36 chars. */
export function newId(now: number = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let rand = "";
  for (const b of bytes) rand += (b % 36).toString(36);
  return now.toString(36).padStart(9, "0") + rand;
}

export function isKnownEvent(e: StoredEvent): e is SessionEvent {
  return KNOWN.has(e.kind);
}

/** Events sort by time, then id, so every device sees the same order. */
export function compareEvents(a: StoredEvent, b: StoredEvent): number {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isIso = (v: unknown): v is string => isStr(v) && !Number.isNaN(Date.parse(v));

/** Same JSON regardless of key order, so identical content always hashes and compares the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export interface ParsedSession {
  session: JournalSession;
  /** Events that had no usable id, time or device. They can't be merged, so callers must not overwrite their source. */
  rejected: number;
}

/** Checks unknown JSON (IndexedDB, remote file). Null if the header itself is unusable. */
export function parseSession(raw: unknown): ParsedSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source = r.source as Record<string, unknown> | undefined;
  if (r.v !== JOURNAL_VERSION || !isStr(r.id) || !r.id || !isIso(r.createdAt) || !isStr(r.device) || !isStr(r.subject)) return null;
  if (!source || !(SOURCE_KINDS as readonly unknown[]).includes(source.kind) || (source.title !== undefined && !isStr(source.title))) return null;
  if (r.objective !== undefined && !isStr(r.objective)) return null;
  if (!Array.isArray(r.events)) return null;
  const events: StoredEvent[] = [];
  let rejected = 0;
  for (const e of r.events as unknown[]) {
    const x = e as Record<string, unknown> | null;
    if (x && isStr(x.id) && x.id && isIso(x.at) && isStr(x.device) && isStr(x.kind)) events.push(x as StoredEvent);
    else rejected++;
  }
  return {
    session: {
      v: JOURNAL_VERSION,
      id: r.id,
      createdAt: r.createdAt,
      device: r.device,
      subject: r.subject,
      source: { kind: source.kind as JournalSession["source"]["kind"], ...(isStr(source.title) ? { title: source.title } : {}) },
      ...(isStr(r.objective) ? { objective: r.objective } : {}),
      events: [...events].sort(compareEvents),
    },
    rejected,
  };
}

/**
 * Union of two copies of the same session. Commutative, associative and idempotent, so devices can merge in any order
 * and converge. The header is immutable; if two copies disagree (only possible through corruption), the one with the
 * smaller canonical JSON wins so the result is still deterministic.
 */
export function mergeSessions(a: JournalSession, b: JournalSession): JournalSession {
  if (a.id !== b.id) throw new Error(`Can't merge different sessions (${a.id}, ${b.id})`);
  const header = (s: JournalSession) => canonicalJson({ ...s, events: [] });
  const base = header(a) <= header(b) ? a : b;
  const byId = new Map<string, StoredEvent>();
  for (const e of [...a.events, ...b.events]) {
    const prev = byId.get(e.id);
    // Same id means the same event; differing copies are corruption, resolved deterministically.
    if (!prev || canonicalJson(e) < canonicalJson(prev)) byId.set(e.id, e);
  }
  return { ...base, events: [...byId.values()].sort(compareEvents) };
}

/** True when `b` has nothing `a` lacks (so pushing `a` over `b` loses nothing). */
export function covers(a: JournalSession, b: JournalSession): boolean {
  const ids = new Set(a.events.map((e) => e.id));
  return b.events.every((e) => ids.has(e.id));
}

/** sha256 hex of the session's canonical JSON. */
export async function sessionHash(session: JournalSession): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson({ ...session, events: [...session.events].sort(compareEvents) }));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createReviewRequest(session: JournalSession, device: string, now: number = Date.now()): Promise<ReviewRequest> {
  return { v: JOURNAL_VERSION, id: newId(now), sessionId: session.id, requestedAt: new Date(now).toISOString(), device, inputHash: await sessionHash(session) };
}

export function sessionPath(s: Pick<JournalSession, "id" | "createdAt">): string {
  const d = new Date(s.createdAt);
  return `journal/sessions/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${s.id}.json`;
}

export function requestPath(r: Pick<ReviewRequest, "id" | "sessionId">): string {
  return `journal/requests/${r.sessionId}/${r.id}.json`;
}

export interface Interval {
  start: number;
  end: number;
}

/** Total length covered by the intervals, counting overlaps once. */
export function unionMs(intervals: Interval[]): number {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  let total = 0;
  let curStart = -Infinity;
  let curEnd = -Infinity;
  for (const i of sorted) {
    if (i.start > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = i.start;
      curEnd = i.end;
    } else if (i.end > curEnd) curEnd = i.end;
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

export interface TimelineItem {
  id: string;
  at: string;
  device: string;
  kind: "start" | "pause" | "resume" | "topic" | "note" | "difficulty" | "bookmark" | "end";
  /** Current text after edits (empty = hidden by an edit). */
  text: string;
  /** Text before any edit, kept so nothing is lost. */
  original: string;
  edited: boolean;
  activeMs?: number;
  reflection?: Reflection;
}

export interface Reflection {
  at: string;
  learned?: string;
  difficult?: string;
  unclear?: string;
}

export interface DerivedSession {
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  activeMs: number;
  /** Run intervals before union; overlapping ones come from devices that ran the timer at the same time. */
  intervals: Interval[];
  /** Distinct topics after edits, first-mentioned first, case-insensitive. */
  topics: string[];
  timeline: TimelineItem[];
  /** Non-empty end-of-session answers. Usually one; more if two devices both ended the session. All are kept. */
  reflections: Reflection[];
  lastEventAt: string;
  /** Events from a newer app version, ignored here but preserved in the file. */
  unknownEvents: number;
}

/**
 * Derives the session's state from its log.
 *
 * Timer: control events (start, resume, pause, end) are replayed in order. start/resume opens a run interval at its
 * time; pause/end closes every open interval at its time. Two devices that each resumed open two overlapping intervals,
 * which the union counts once. The latest `end` ends the session; earlier ends (another device that ended first) act
 * as pauses. An open interval of an unfinished session runs to `now`.
 */
export function deriveSession(session: JournalSession, now: number = Date.now()): DerivedSession {
  const events = [...session.events].sort(compareEvents);
  const known = events.filter(isKnownEvent);
  const ends = known.filter((e) => e.kind === "end");
  const lastEnd = ends.length ? ends[ends.length - 1] : null;

  const intervals: Interval[] = [];
  let open: number[] = [];
  const close = (at: number) => {
    for (const s of open) intervals.push({ start: s, end: at });
    open = [];
  };
  let lastControl: SessionEvent["kind"] | null = null;
  for (const e of known) {
    if (!CONTROL.has(e.kind)) continue;
    const t = Date.parse(e.at);
    if (e.kind === "start" || e.kind === "resume") open.push(t);
    else close(t);
    lastControl = e.kind;
    if (e === lastEnd) break;
  }
  if (!lastEnd) close(Math.max(now, ...open));

  const discarded = known.some((e) => e.kind === "discard");
  const status: SessionStatus = discarded ? "discarded" : lastEnd ? "ended" : lastControl === "pause" ? "paused" : "active";

  // Latest edit per target wins; edits apply in log order.
  const edits = new Map<string, string>();
  for (const e of known) if (e.kind === "edit") edits.set(e.target, e.text);

  const timeline: TimelineItem[] = [];
  const reflections: Reflection[] = [];
  const topics = new Map<string, string>();
  for (const e of known) {
    if (e.kind === "edit" || e.kind === "discard") continue;
    const base = { id: e.id, at: e.at, device: e.device };
    if (e.kind === "topic" || e.kind === "note" || e.kind === "difficulty" || e.kind === "bookmark") {
      const original = e.kind === "bookmark" ? e.label : e.text;
      const text = edits.get(e.id) ?? original;
      timeline.push({ ...base, kind: e.kind, text, original, edited: edits.has(e.id), ...(e.kind === "bookmark" ? { activeMs: e.activeMs } : {}) });
      if (e.kind === "topic" && text.trim() && !topics.has(text.trim().toLowerCase())) topics.set(text.trim().toLowerCase(), text.trim());
    } else if (e.kind === "end") {
      const reflection: Reflection = { at: e.at };
      for (const k of ["learned", "difficult", "unclear"] as const) if (e[k]?.trim()) reflection[k] = e[k]!.trim();
      if (Object.keys(reflection).length > 1) reflections.push(reflection);
      timeline.push({ ...base, kind: "end", text: "", original: "", edited: false, reflection });
    } else {
      timeline.push({ ...base, kind: e.kind, text: "", original: "", edited: false });
    }
  }

  const start = known.find((e) => e.kind === "start");
  return {
    status,
    startedAt: start?.at ?? session.createdAt,
    endedAt: lastEnd?.at ?? null,
    activeMs: unionMs(intervals),
    intervals,
    topics: [...topics.values()],
    timeline,
    reflections,
    lastEventAt: events.length ? events[events.length - 1].at : session.createdAt,
    unknownEvents: events.length - known.length,
  };
}

/** A new session with its start event. */
export function createSession(input: { subject: string; source: JournalSession["source"]; objective?: string; device: string }, now: number = Date.now()): JournalSession {
  const at = new Date(now).toISOString();
  const objective = input.objective?.trim();
  const title = input.source.title?.trim();
  return {
    v: JOURNAL_VERSION,
    id: newId(now),
    createdAt: at,
    device: input.device,
    subject: input.subject.trim(),
    source: { kind: input.source.kind, ...(title ? { title } : {}) },
    ...(objective ? { objective } : {}),
    events: [{ id: newId(now), at, device: input.device, kind: "start" }],
  };
}

type NewEvent = SessionEvent extends infer E ? (E extends SessionEvent ? Omit<E, "id" | "at" | "device"> : never) : never;

/** Builds an event stamped with a fresh id, the time and this device. */
export function makeEvent(event: NewEvent, device: string, now: number = Date.now()): SessionEvent {
  return { ...event, id: newId(now), at: new Date(now).toISOString(), device } as SessionEvent;
}
