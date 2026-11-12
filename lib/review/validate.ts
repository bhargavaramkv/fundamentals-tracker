import { deriveSession } from "../journal/events";
import type { JournalSession, ReviewRequest } from "../journal/types";
import { EXPLANATION_LEVELS, REVIEW_FINDING_LISTS, REVIEW_VERSION, type EvidenceRef, type SessionReview } from "./types";

/** Every text an event can be quoted from, after edits. Events with no text (start, pause, ...) map to []. */
export function eventTexts(session: JournalSession, now: number): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of session.events) out.set(e.id, []);
  for (const item of deriveSession(session, now).timeline) {
    if (item.kind === "end") out.set(item.id, [item.reflection?.learned, item.reflection?.difficult, item.reflection?.unclear].filter((t): t is string => !!t));
    else if (item.text) out.set(item.id, [item.text]);
  }
  return out;
}

export interface ReviewContext {
  request: ReviewRequest;
  session: JournalSession;
  /** sessionHash of the session as stored now. */
  currentHash: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Checks an unknown review against its request and session. Returns every problem found; `review` is set only when
 * there are none. Nothing is repaired or guessed.
 */
export function validateReview(raw: unknown, ctx: ReviewContext): { errors: string[]; review?: SessionReview } {
  const errors: string[] = [];
  const err = (path: string, msg: string) => void errors.push(`${path}: ${msg}`);
  if (!isObj(raw)) return { errors: ["review: must be a JSON object"] };

  const str = (v: unknown, path: string, max: number): v is string => {
    if (typeof v !== "string") return err(path, "must be a string"), false;
    if (v.trim().length < 1) return err(path, "must not be empty"), false;
    if (v.length > max) return err(path, `must be at most ${max} characters`), false;
    return true;
  };
  const arr = (v: unknown, path: string, min: number, max: number): v is unknown[] => {
    if (!Array.isArray(v)) return err(path, "must be an array"), false;
    if (v.length < min || v.length > max) return err(path, `must have ${min}-${max} items (has ${v.length})`), false;
    return true;
  };

  const texts = eventTexts(ctx.session, Date.parse(ctx.request.requestedAt));
  const evidence = (v: unknown, path: string, min: number) => {
    if (!arr(v, path, min, 5)) return;
    v.forEach((r, i) => {
      const p = `${path}[${i}]`;
      if (!isObj(r)) return err(p, "must be an object");
      const ref = r as Partial<EvidenceRef>;
      if (typeof ref.eventId !== "string" || !ref.eventId) return err(p, "eventId is required");
      const available = texts.get(ref.eventId);
      if (!available) return err(p, `eventId ${ref.eventId} is not an event of session ${ctx.session.id}`);
      if (ref.quote === undefined) return;
      if (!str(ref.quote, `${p}.quote`, 300)) return;
      if (!available.some((t) => t.includes(ref.quote!))) err(p, `quote is not an exact substring of the text of event ${ref.eventId}`);
    });
  };
  const finding = (v: unknown, path: string, withQuestion: boolean) => {
    if (!isObj(v)) return err(path, "must be an object");
    str(v.concept, `${path}.concept`, 100);
    str(v.text, `${path}.text`, 1000);
    if (withQuestion) str(v.question, `${path}.question`, 300);
    evidence(v.evidence, `${path}.evidence`, withQuestion ? 0 : 1);
  };
  const findings = (v: unknown, path: string, withQuestion = false) => {
    if (arr(v, path, 0, 10)) v.forEach((f, i) => finding(f, `${path}[${i}]`, withQuestion));
  };

  if (raw.v !== REVIEW_VERSION) err("v", `must be ${REVIEW_VERSION}`);
  if (raw.id !== ctx.request.id) err("id", `must equal the request id ${ctx.request.id}`);
  if (raw.sessionId !== ctx.request.sessionId) err("sessionId", `must equal the request's session ${ctx.request.sessionId}`);
  if (raw.inputHash !== ctx.request.inputHash) err("inputHash", "must equal the request's inputHash");
  if (typeof raw.createdAt !== "string" || Number.isNaN(Date.parse(raw.createdAt))) err("createdAt", "must be an ISO 8601 time");
  str(raw.model, "model", 100);
  str(raw.summary, "summary", 2000);
  for (const k of REVIEW_FINDING_LISTS) findings(raw[k], k);
  findings(raw.missingConcepts, "missingConcepts", true);

  const q = raw.explanationQuality;
  if (!isObj(q)) err("explanationQuality", "must be an object");
  else {
    if (!(EXPLANATION_LEVELS as readonly unknown[]).includes(q.level)) err("explanationQuality.level", `must be one of ${EXPLANATION_LEVELS.join(", ")}`);
    str(q.note, "explanationQuality.note", 1000);
    evidence(q.evidence, "explanationQuality.evidence", q.level === "insufficient-evidence" ? 0 : 1);
  }

  const lb = raw.learningBehaviour;
  if (!isObj(lb)) err("learningBehaviour", "must be an object");
  else {
    findings(lb.observations, "learningBehaviour.observations");
    if (arr(lb.improvements, "learningBehaviour.improvements", 0, 5)) lb.improvements.forEach((s, i) => str(s, `learningBehaviour.improvements[${i}]`, 300));
  }
  if (arr(raw.nextSteps, "nextSteps", 1, 5)) raw.nextSteps.forEach((s, i) => str(s, `nextSteps[${i}]`, 300));
  if (arr(raw.verificationQuestions, "verificationQuestions", 1, 5)) {
    raw.verificationQuestions.forEach((v, i) => {
      if (!isObj(v)) return err(`verificationQuestions[${i}]`, "must be an object");
      str(v.concept, `verificationQuestions[${i}].concept`, 100);
      str(v.question, `verificationQuestions[${i}].question`, 300);
    });
  }

  if (typeof raw.insufficientEvidence !== "boolean") err("insufficientEvidence", "must be true or false");
  else if (raw.insufficientEvidence && Array.isArray(raw.understood) && raw.understood.length > 0) err("understood", "must be empty when insufficientEvidence is true");

  if (errors.length > 0) return { errors };
  const review = { ...(raw as unknown as SessionReview) };
  delete review.sessionChangedSinceRequest;
  if (ctx.currentHash !== ctx.request.inputHash) review.sessionChangedSinceRequest = true;
  return { errors, review };
}
