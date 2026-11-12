import fs from "node:fs";
import path from "node:path";
import { deriveSession, sessionHash } from "../journal/events";
import { normalizeConcept } from "../knowledge/levels";
import type { Evidence, EvidenceFile } from "../knowledge/types";
import { loadRequest, loadSession, readJsonIf } from "./data";
import type { SessionReview } from "./types";

export const REVIEW_RULES = [
  "You are a thoughtful engineering teacher reviewing what the owner wrote in one study session.",
  "Every understood, misunderstandings, incomplete and unsupportedClaims finding, and every learningBehaviour observation, needs at least one evidence ref: {eventId, quote?} from the timeline below.",
  "A quote must be copied exactly (character for character) from that event's text; never fabricate or paraphrase a quote. Omit quote if unsure.",
  "Absence of a concept is not proof of ignorance. Put such things in missingConcepts with a question the owner can answer; evidence may be empty there.",
  "If the session gives too little to judge, set insufficientEvidence true, leave understood empty, say so in explanationQuality (level insufficient-evidence), and ask verification questions.",
  "Prior knowledge below is context, not proof for this session. Do not cite it as evidence refs; evidence refs point only at this session's events.",
  "Write only the JSON object, with exactly these fields. Do not include sessionChangedSinceRequest.",
];

export const REVIEW_SCHEMA = {
  v: 1,
  id: "<requestId>",
  sessionId: "<sessionId>",
  inputHash: "<request.inputHash>",
  createdAt: "<ISO 8601 time now>",
  model: "<the model you are, e.g. claude-sonnet-5-5>",
  summary: "string, 1-2000 chars",
  understood: "[{concept, text, evidence:[{eventId, quote?}] (1-5)}] (0-10)",
  misunderstandings: "same shape as understood",
  incomplete: "same shape as understood",
  unsupportedClaims: "same shape as understood",
  missingConcepts: "[{concept, text, question, evidence:[{eventId, quote?}] (0-5)}] (0-10)",
  explanationQuality: { level: "clear | partial | unclear | insufficient-evidence", note: "string", evidence: "[{eventId, quote?}] (1-5; 0 allowed only for insufficient-evidence)" },
  learningBehaviour: { observations: "[{concept, text, evidence}] (0-10, evidence required)", improvements: "string[] (0-5)" },
  nextSteps: "string[] (1-5)",
  verificationQuestions: "[{concept, question}] (1-5)",
  insufficientEvidence: "boolean; if true, understood must be empty",
};

const tokens = (s: string) => normalizeConcept(s);
function matchesTopic(concept: string, topics: string[]): boolean {
  const last = concept.split("/").pop() ?? concept;
  return topics.some((t) => concept.includes(t) || (last.length >= 3 && t.includes(last)));
}

/** One self-contained document for the reviewing Claude session. */
export async function buildReviewContext(dataDir: string, requestId: string) {
  const request = loadRequest(dataDir, requestId);
  if (!request) throw new Error(`No request ${requestId}`);
  const session = loadSession(dataDir, request.sessionId);
  if (!session) throw new Error(`Session ${request.sessionId} not found or unreadable`);
  const derived = deriveSession(session, Date.parse(request.requestedAt));
  const topics = derived.topics.map(tokens);

  const store = readJsonIf<EvidenceFile>(path.join(dataDir, "knowledge/evidence.json"));
  const evidence: Evidence[] = (store?.items ?? []).filter((e) => matchesTopic(e.concept, topics)).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? -1 : 1)).slice(0, 40);

  const earlier: unknown[] = [];
  const reviewsDir = path.join(dataDir, "journal/reviews");
  const files = fs.existsSync(reviewsDir) ? fs.readdirSync(reviewsDir).flatMap((sid) => fs.readdirSync(path.join(reviewsDir, sid)).map((f) => path.join(reviewsDir, sid, f))) : [];
  const reviews = files.map((f) => readJsonIf<SessionReview>(f)).filter((r): r is SessionReview => !!r && r.v === 1 && r.id !== requestId);
  reviews.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const r of reviews) {
    const other = loadSession(dataDir, r.sessionId);
    if (!other) continue;
    const shared = deriveSession(other, Date.parse(r.createdAt)).topics.map(tokens).filter((t) => topics.includes(t));
    if (shared.length === 0) continue;
    const pick = (list: { concept: string; text: string }[]) => list.map((f) => ({ concept: f.concept, text: f.text }));
    earlier.push({
      source: `review ${r.id} of session ${r.sessionId}, written by ${r.model} on ${r.createdAt}`,
      strength: "moderate (model judgement from that session's own words)",
      sharedTopics: shared,
      understood: pick(r.understood),
      misunderstandings: pick(r.misunderstandings),
      incomplete: pick(r.incomplete),
      requestId: r.id,
      verificationQuestions: r.verificationQuestions,
    });
    if (earlier.length >= 5) break;
  }

  return {
    task: "Write a SessionReview for this request.",
    rules: REVIEW_RULES,
    schema: REVIEW_SCHEMA,
    request,
    sessionChangedSinceRequest: (await sessionHash(session)) !== request.inputHash,
    session: {
      id: session.id,
      subject: session.subject,
      source: session.source,
      objective: session.objective ?? null,
      status: derived.status,
      startedAt: derived.startedAt,
      endedAt: derived.endedAt,
      activeMinutes: Math.round(derived.activeMs / 60_000),
      topics: derived.topics,
      timeline: derived.timeline.map((t) => ({
        eventId: t.id,
        at: t.at,
        kind: t.kind,
        ...(t.kind === "end" ? { reflection: t.reflection } : t.text ? { text: t.text, ...(t.edited ? { edited: true } : {}) } : {}),
      })),
    },
    priorKnowledge: {
      note: "Context only. Not evidence for this session.",
      evidenceFile: evidence.map((e) => ({ source: `${e.source.path} (${e.source.ref})`, kind: e.kind, signal: e.signal, strength: e.strength, historical: e.historical, at: e.at, concept: e.concept, note: e.note ?? null })),
      earlierReviews: earlier,
    },
  };
}
