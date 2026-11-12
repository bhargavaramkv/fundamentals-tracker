/**
 * Knowledge evidence (V2). One item is one observation about one concept, from one source. Items are append-only:
 * a level is derived from them (levels.ts) and never stored. File: knowledge/evidence.json in the data repo.
 */

export const EVIDENCE_KINDS = ["mcq-answer", "written-explanation", "review-finding", "practical", "delayed-check"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_SIGNALS = ["exposed", "correct", "incorrect", "misconception", "applied"] as const;
export type EvidenceSignal = (typeof EVIDENCE_SIGNALS)[number];

export const EVIDENCE_STRENGTHS = ["weak", "moderate", "strong"] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export interface Evidence {
  /** Unique and stable: the same source observation always gets the same id. */
  id: string;
  /** Normalised key: lowercase, trimmed, single spaces. */
  concept: string;
  label: string;
  subject?: string;
  kind: EvidenceKind;
  signal: EvidenceSignal;
  strength: EvidenceStrength;
  /** When the observation happened (ISO 8601). */
  at: string;
  /** Where it came from: a file in the data repo, and a reference inside it (answer id, request id, ...). */
  source: { repo: "data"; path: string; ref: string };
  /** True for items migrated from before the journal existed. */
  historical: boolean;
  note?: string;
}

export interface EvidenceFile {
  v: 1;
  generatedBy: string;
  items: Evidence[];
}

export const KNOWLEDGE_LEVELS = ["none", "exposed", "understood", "applied", "retained"] as const;
export type KnowledgeLevel = (typeof KNOWLEDGE_LEVELS)[number];

export interface LevelResult {
  level: KnowledgeLevel;
  reasons: string[];
  needsReassessment: boolean;
  dueForVerification: boolean;
  contradictions: Evidence[];
}
