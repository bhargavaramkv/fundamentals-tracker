/**
 * Session review contract (V2). Written to journal/reviews/<sessionId>/<requestId>.json by a Claude Code routine
 * through `npm run journal-review`; never by the browser. Design: docs/v2/ARCHITECTURE.md, docs/review-routine.md.
 */

export const REVIEW_VERSION = 1;

/** Points at one session event, optionally at an exact quote from its text. */
export interface EvidenceRef {
  eventId: string;
  quote?: string;
}

export interface Finding {
  concept: string;
  text: string;
  evidence: EvidenceRef[];
}

/** Absence is not proof, so evidence may be empty; the question is how the owner can show the concept. */
export interface MissingConcept extends Finding {
  question: string;
}

export const EXPLANATION_LEVELS = ["clear", "partial", "unclear", "insufficient-evidence"] as const;
export type ExplanationLevel = (typeof EXPLANATION_LEVELS)[number];

export interface SessionReview {
  v: typeof REVIEW_VERSION;
  /** The review request's id. */
  id: string;
  sessionId: string;
  /** Copied from the request. */
  inputHash: string;
  createdAt: string;
  /** The model that wrote the review, as reported by the routine. */
  model: string;
  summary: string;
  understood: Finding[];
  misunderstandings: Finding[];
  incomplete: Finding[];
  unsupportedClaims: Finding[];
  missingConcepts: MissingConcept[];
  explanationQuality: { level: ExplanationLevel; note: string; evidence: EvidenceRef[] };
  learningBehaviour: { observations: Finding[]; improvements: string[] };
  /** 1-5 */
  nextSteps: string[];
  /** 1-5 */
  verificationQuestions: { concept: string; question: string }[];
  insufficientEvidence: boolean;
  /** Set by the commit script, only when true: the session gained events after the request was made. */
  sessionChangedSinceRequest?: true;
}

export const REVIEW_FINDING_LISTS = ["understood", "misunderstandings", "incomplete", "unsupportedClaims"] as const;

export const reviewPath = (r: { id: string; sessionId: string }) => `journal/reviews/${r.sessionId}/${r.id}.json`;
