import { deriveSession } from "@/lib/journal/events";
import type { JournalSession } from "@/lib/journal/types";
import { levelOf, normalizeConcept, reviewEvidence } from "@/lib/knowledge/levels";
import type { Evidence, LevelResult } from "@/lib/knowledge/types";
import type { SessionReview } from "@/lib/review/types";

export interface ConceptSession {
  id: string;
  subject: string;
  at: string;
}

export interface ConceptRow {
  key: string;
  label: string;
  subject?: string;
  evidence: Evidence[];
  result: LevelResult;
  /** Non-discarded sessions that mention the concept as a topic or subject, newest first. */
  sessions: ConceptSession[];
  /** Latest evidence time. */
  lastAt: string;
}

/**
 * The concept list: stored evidence, review evidence for reviews whose session is known, and journal topics (exposure
 * only). Evidence is de-duplicated by id. Levels come from levelOf, never from here.
 */
export function buildConcepts(input: { evidence: Evidence[]; reviews: SessionReview[]; sessions: JournalSession[]; now: number }): ConceptRow[] {
  const byId = new Map<string, Evidence>();
  const add = (e: Evidence) => byId.set(e.id, e);
  for (const e of input.evidence) add({ ...e, concept: normalizeConcept(e.concept) });

  const sessionsById = new Map(input.sessions.map((s) => [s.id, s]));
  const reviewed = new Set<string>();
  for (const r of input.reviews) {
    const s = sessionsById.get(r.sessionId);
    if (!s) continue;
    reviewed.add(s.id);
    for (const e of reviewEvidence(r, s)) add(e);
  }

  const history = new Map<string, ConceptSession[]>();
  const labels = new Map<string, string>();
  for (const s of input.sessions) {
    const d = deriveSession(s, input.now);
    if (d.status === "discarded") continue;
    const names = new Map<string, string>();
    for (const n of [s.subject, ...d.topics]) if (n.trim()) names.set(normalizeConcept(n), n.trim());
    for (const [key, name] of names) {
      history.set(key, [...(history.get(key) ?? []), { id: s.id, subject: s.subject, at: d.lastEventAt }]);
      labels.set(key, labels.get(key) ?? name);
    }
    // Topics of sessions without a review are exposure. (Reviewed sessions already contribute theirs.)
    if (!reviewed.has(s.id)) {
      for (const t of d.topics) {
        const key = normalizeConcept(t);
        add({
          id: `topic:${s.id}:${key}`, concept: key, label: t.trim(), subject: s.subject, kind: "review-finding", signal: "exposed", strength: "weak",
          at: d.lastEventAt, source: { repo: "data", path: `journal/sessions/${s.id}`, ref: s.id }, historical: false, note: "topic studied in a journal session",
        });
      }
    }
  }

  const groups = new Map<string, Evidence[]>();
  for (const e of byId.values()) groups.set(e.concept, [...(groups.get(e.concept) ?? []), e]);

  const rows: ConceptRow[] = [];
  for (const [key, evidence] of groups) {
    evidence.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    const sessions = (history.get(key) ?? []).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    const subject = evidence.find((e) => e.subject)?.subject;
    rows.push({ key, label: labels.get(key) ?? evidence[0].label, ...(subject ? { subject } : {}), evidence, result: levelOf(evidence, input.now), sessions, lastAt: evidence[0].at });
  }
  return rows.sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : a.key < b.key ? -1 : 1));
}

export const LEVEL_FILTERS = ["all", "exposed", "understood", "applied", "retained", "reassess", "due"] as const;
export type LevelFilter = (typeof LEVEL_FILTERS)[number];

export function filterConcepts(rows: ConceptRow[], f: { query: string; subject: string; level: LevelFilter }): ConceptRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.key.includes(q) && !r.label.toLowerCase().includes(q)) return false;
    if (f.subject !== "all" && r.subject !== f.subject) return false;
    if (f.level === "all") return true;
    if (f.level === "reassess") return r.result.needsReassessment;
    if (f.level === "due") return r.result.dueForVerification;
    return r.result.level === f.level;
  });
}
