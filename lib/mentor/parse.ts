import { EVIDENCE_KINDS, EVIDENCE_SIGNALS, EVIDENCE_STRENGTHS, type Evidence } from "@/lib/knowledge/types";
import { EXPLANATION_LEVELS, REVIEW_FINDING_LISTS, REVIEW_VERSION, type EvidenceRef, type Finding, type SessionReview } from "@/lib/review/types";
import type { WeeklyReport } from "@/lib/review/weekly";
import { JOURNAL_VERSION, type ReviewRequest } from "@/lib/journal/types";

/**
 * Defensive shape checks for files read from the data repo. The routines validate before they write; the browser still
 * never trusts what it reads. Every parser returns null for anything unusable, so callers can skip and count it.
 */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isIso = (v: unknown): v is string => isStr(v) && !Number.isNaN(Date.parse(v));
const strs = (v: unknown): string[] | null => (Array.isArray(v) && v.every(isStr) ? (v as string[]) : null);

function refs(v: unknown): EvidenceRef[] | null {
  if (!Array.isArray(v)) return null;
  const out: EvidenceRef[] = [];
  for (const r of v) {
    if (!isObj(r) || !isStr(r.eventId) || (r.quote !== undefined && !isStr(r.quote))) return null;
    out.push({ eventId: r.eventId, ...(r.quote !== undefined ? { quote: r.quote } : {}) });
  }
  return out;
}

function finding(v: unknown, withQuestion: boolean): (Finding & { question?: string }) | null {
  if (!isObj(v) || !isStr(v.concept) || !isStr(v.text)) return null;
  const evidence = refs(v.evidence);
  if (!evidence) return null;
  if (withQuestion && !isStr(v.question)) return null;
  const verifies = isObj(v.verifies) && isStr(v.verifies.requestId) && isStr(v.verifies.question) ? { requestId: v.verifies.requestId, question: v.verifies.question } : undefined;
  return { concept: v.concept, text: v.text, evidence, ...(withQuestion ? { question: v.question as string } : {}), ...(verifies ? { verifies } : {}) };
}

function findings(v: unknown, withQuestion = false): (Finding & { question?: string })[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map((f) => finding(f, withQuestion));
  return out.every((f) => f !== null) ? (out as (Finding & { question?: string })[]) : null;
}

export function parseReview(raw: unknown): SessionReview | null {
  if (!isObj(raw) || raw.v !== REVIEW_VERSION) return null;
  if (!isStr(raw.id) || !raw.id || !isStr(raw.sessionId) || !raw.sessionId || !isStr(raw.inputHash) || !isIso(raw.createdAt) || !isStr(raw.model) || !isStr(raw.summary)) return null;
  const lists: Record<string, Finding[]> = {};
  for (const k of REVIEW_FINDING_LISTS) {
    const l = findings(raw[k]);
    if (!l) return null;
    lists[k] = l;
  }
  const missing = findings(raw.missingConcepts, true);
  const q = raw.explanationQuality;
  const lb = raw.learningBehaviour;
  if (!missing || !isObj(q) || !isObj(lb)) return null;
  const qEvidence = refs(q.evidence);
  const observations = findings(lb.observations);
  const improvements = strs(lb.improvements);
  const nextSteps = strs(raw.nextSteps);
  if (!(EXPLANATION_LEVELS as readonly unknown[]).includes(q.level) || !isStr(q.note) || !qEvidence || !observations || !improvements || !nextSteps) return null;
  if (!Array.isArray(raw.verificationQuestions) || !raw.verificationQuestions.every((x) => isObj(x) && isStr(x.concept) && isStr(x.question))) return null;
  if (typeof raw.insufficientEvidence !== "boolean") return null;
  return {
    v: REVIEW_VERSION,
    id: raw.id,
    sessionId: raw.sessionId,
    inputHash: raw.inputHash,
    createdAt: raw.createdAt,
    model: raw.model,
    summary: raw.summary,
    understood: lists.understood,
    misunderstandings: lists.misunderstandings,
    incomplete: lists.incomplete,
    unsupportedClaims: lists.unsupportedClaims,
    missingConcepts: missing as SessionReview["missingConcepts"],
    explanationQuality: { level: q.level as SessionReview["explanationQuality"]["level"], note: q.note, evidence: qEvidence },
    learningBehaviour: { observations, improvements },
    nextSteps,
    verificationQuestions: (raw.verificationQuestions as { concept: string; question: string }[]).map((x) => ({ concept: x.concept, question: x.question })),
    insufficientEvidence: raw.insufficientEvidence,
    ...(raw.sessionChangedSinceRequest === true ? { sessionChangedSinceRequest: true as const } : {}),
  };
}

const cites = (v: unknown) => Array.isArray(v) && v.every((c) => isObj(c) && isStr(c.sessionId) && (c.eventId === undefined || isStr(c.eventId)));
const wFindings = (v: unknown) => Array.isArray(v) && v.every((f) => isObj(f) && isStr(f.concept) && isStr(f.text) && cites(f.evidence));

export function parseWeekly(raw: unknown): WeeklyReport | null {
  if (!isObj(raw) || raw.v !== 1 || !isStr(raw.week) || !/^\d{4}-W\d{2}$/.test(raw.week) || !isIso(raw.createdAt) || !isStr(raw.model)) return null;
  if (raw.sufficiency !== "coaching" && raw.sufficiency !== "activity-only") return null;
  const a = raw.activity;
  if (!isObj(a) || !isObj(a.findings) || typeof a.sessions !== "number" || typeof a.endedSessions !== "number" || typeof a.activeMinutes !== "number" || typeof a.reviews !== "number" || typeof a.difficultyEvents !== "number" || !strs(a.topics)) return null;
  for (const k of ["improved", "weak", "repeatedMisunderstandings", "revisit", "learnNext"]) if (!wFindings(raw[k])) return null;
  if (!strs(raw.priorities)) return null;
  if (!Array.isArray(raw.previousRecommendations) || !raw.previousRecommendations.every((r) => isObj(r) && isStr(r.text) && ["yes", "no", "unclear"].includes(r.followed as string) && cites(r.evidence))) return null;
  return raw as unknown as WeeklyReport;
}

export function parseEvidenceFile(raw: unknown): { items: Evidence[]; invalid: number } | null {
  if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.items)) return null;
  const items: Evidence[] = [];
  let invalid = 0;
  for (const e of raw.items) {
    const ok =
      isObj(e) && isStr(e.id) && isStr(e.concept) && isStr(e.label) && isIso(e.at) && typeof e.historical === "boolean" &&
      (EVIDENCE_KINDS as readonly unknown[]).includes(e.kind) && (EVIDENCE_SIGNALS as readonly unknown[]).includes(e.signal) && (EVIDENCE_STRENGTHS as readonly unknown[]).includes(e.strength) &&
      isObj(e.source) && isStr(e.source.path) && isStr(e.source.ref) && (e.subject === undefined || isStr(e.subject)) && (e.note === undefined || isStr(e.note));
    if (ok) items.push(e as unknown as Evidence);
    else invalid++;
  }
  return { items, invalid };
}

export function parseRequest(raw: unknown): ReviewRequest | null {
  if (!isObj(raw) || raw.v !== JOURNAL_VERSION || !isStr(raw.id) || !isStr(raw.sessionId) || !isIso(raw.requestedAt) || !isStr(raw.device) || !isStr(raw.inputHash)) return null;
  return raw as unknown as ReviewRequest;
}

export interface ReviewFailure {
  at: string;
  error: string;
}

export function parseFailures(raw: unknown): ReviewFailure[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ReviewFailure[] = [];
  for (const f of raw) {
    if (!isObj(f) || !isStr(f.at) || !isStr(f.error)) return null;
    out.push({ at: f.at, error: f.error });
  }
  return out;
}
