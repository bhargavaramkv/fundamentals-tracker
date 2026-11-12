import { deriveSession } from "../journal/events";
import type { JournalSession } from "../journal/types";
import { reviewPath, type Finding, type SessionReview } from "../review/types";
import type { Evidence, LevelResult } from "./types";

const DAY_MS = 86_400_000;
const RETENTION_DAYS = 7;

export function normalizeConcept(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

const time = (e: Evidence) => Date.parse(e.at);
const isStrong = (e: Evidence) => e.strength === "moderate" || e.strength === "strong";
const day = (iso: string) => iso.slice(0, 10);

/**
 * The level the evidence supports for one concept. Levels are cumulative and derived, never stored.
 * Multiple-choice answers alone never give Understood. Contradicting evidence is listed and flags reassessment; it
 * never removes evidence or lowers the level on its own.
 */
export function levelOf(evidence: Evidence[], now: number): LevelResult {
  if (evidence.length === 0) return { level: "none", reasons: ["no evidence"], needsReassessment: false, dueForVerification: false, contradictions: [] };
  const items = [...evidence].sort((a, b) => time(a) - time(b) || (a.id < b.id ? -1 : 1));
  const reasons = [`exposed: ${items.length} evidence item(s)`];

  const understood = items.filter((e) => e.signal === "correct" && isStrong(e) && (e.kind === "written-explanation" || e.kind === "review-finding"));
  if (understood.length === 0) {
    if (items.some((e) => e.kind === "mcq-answer" && e.signal === "correct")) reasons.push("multiple-choice answers are weak evidence");
    return { level: "exposed", reasons, needsReassessment: false, dueForVerification: false, contradictions: [] };
  }
  const firstUnderstood = time(understood[0]);
  reasons.push(`understood: ${understood[0].kind} on ${day(understood[0].at)}`);

  let level: LevelResult["level"] = "understood";
  const applied = items.find((e) => (e.kind === "practical" || e.signal === "applied") && (e.signal === "correct" || e.signal === "applied"));
  if (applied) {
    level = "applied";
    reasons.push(`applied: ${applied.kind} on ${day(applied.at)}`);
  }
  const retained = items.find((e) => e.kind === "delayed-check" && e.signal === "correct" && time(e) - firstUnderstood >= RETENTION_DAYS * DAY_MS);
  if (retained) {
    level = "retained";
    reasons.push(`retained: delayed check on ${day(retained.at)}`);
  }

  const contradictions = items.filter((e) => (e.signal === "misconception" || e.signal === "incorrect") && isStrong(e) && time(e) > firstUnderstood);
  const needsReassessment = contradictions.length > 0;
  if (needsReassessment) reasons.push(`contradicted on ${day(contradictions[contradictions.length - 1].at)}; reassess`);

  const dueForVerification = needsReassessment || (level !== "retained" && now - firstUnderstood >= RETENTION_DAYS * DAY_MS);
  return { level, reasons, needsReassessment, dueForVerification, contradictions };
}

/** Groups evidence by concept key. */
export function groupByConcept(items: Evidence[]): Map<string, Evidence[]> {
  const out = new Map<string, Evidence[]>();
  for (const e of items) out.set(e.concept, [...(out.get(e.concept) ?? []), e]);
  return out;
}

/** The evidence a review gives. Ids are rev:<requestId>:<n>, in a fixed order, so mapping twice gives the same items. */
export function reviewEvidence(review: SessionReview, session: JournalSession): Evidence[] {
  const out: Evidence[] = [];
  const source = { repo: "data" as const, path: reviewPath(review), ref: review.id };
  const add = (concept: string, kind: Evidence["kind"], signal: Evidence["signal"], strength: Evidence["strength"], at: string, note?: string) =>
    out.push({ id: `rev:${review.id}:${out.length + 1}`, concept: normalizeConcept(concept), label: concept.trim(), subject: session.subject, kind, signal, strength, at, source, historical: false, ...(note ? { note } : {}) });
  const fromFindings = (list: Finding[], signal: Evidence["signal"], strength: Evidence["strength"]) => {
    for (const f of list) add(f.concept, "review-finding", signal, strength, review.createdAt, f.text);
  };
  fromFindings(review.understood, "correct", "moderate");
  fromFindings(review.misunderstandings, "misconception", "moderate");
  fromFindings(review.incomplete, "exposed", "weak");
  for (const item of deriveSession(session, Date.parse(review.createdAt)).timeline) {
    if (item.kind === "topic" && item.text.trim()) add(item.text, "review-finding", "exposed", "weak", item.at, "topic studied in a journal session");
  }
  return out;
}
