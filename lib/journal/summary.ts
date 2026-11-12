import { deriveSession } from "./events";
import type { SessionRecord } from "./local";
import { SOURCE_KINDS, type SourceKind } from "./types";

/** Distinct subjects of non-discarded sessions, newest first (records come newest first). Case-insensitive. */
export function recentSubjects(records: SessionRecord[], limit = 6): string[] {
  const seen = new Map<string, string>();
  for (const { session } of records) {
    const d = deriveSession(session);
    const key = d.subject.toLowerCase();
    if (!key || seen.has(key) || d.status === "discarded") continue;
    seen.set(key, d.subject);
  }
  return [...seen.values()].slice(0, limit);
}

/** The source of the newest session, or "other" when there is none. */
export function lastSource(records: SessionRecord[]): SourceKind {
  const kind = records[0] ? deriveSession(records[0].session).source.kind : undefined;
  return SOURCE_KINDS.find((k) => k === kind) ?? "other";
}

export interface TopicSummary {
  topic: string;
  sessions: number;
  /** ISO time of the latest activity in any session that mentions the topic. */
  lastStudied: string;
}

/** Subjects and topics across non-discarded sessions, counted once per session, most recently studied first. */
export function topicSummary(records: SessionRecord[]): TopicSummary[] {
  const map = new Map<string, TopicSummary>();
  for (const { session } of records) {
    const d = deriveSession(session);
    if (d.status === "discarded") continue;
    const names = new Map<string, string>();
    for (const name of [d.subject, ...d.topics]) if (name.trim() && !names.has(name.trim().toLowerCase())) names.set(name.trim().toLowerCase(), name.trim());
    for (const [key, name] of names) {
      const cur = map.get(key);
      if (!cur) map.set(key, { topic: name, sessions: 1, lastStudied: d.lastEventAt });
      else {
        cur.sessions += 1;
        if (d.lastEventAt > cur.lastStudied) cur.lastStudied = d.lastEventAt;
      }
    }
  }
  return [...map.values()].sort((a, b) => (a.lastStudied < b.lastStudied ? 1 : a.lastStudied > b.lastStudied ? -1 : 0));
}
