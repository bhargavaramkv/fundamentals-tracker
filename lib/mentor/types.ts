/**
 * The nightly mentor's data. Everything here lives under mentor/ in the private data repo. The nightly Claude Code
 * routine proposes it, code validates it, and the site only renders what passed. See docs/design/MENTOR.md.
 */
import type { CodingContext } from "../leetcode-history";
import type { GeneratedQuestion } from "./questions";

export const MENTOR_SCHEMA = 1;
/** Bump when the routine's instructions change, so the same input can be analysed again under the new rules. */
export const MENTOR_PROMPT_VERSION = 2;
export const MENTOR_TIME_ZONE = "Asia/Kolkata";
/** Nights in a row the routine must succeed before the mentor becomes the home page. */
export const PRIMARY_AFTER_NIGHTS = 5;

/** Knowing a concept and being able to apply it are tracked apart. */
export const DIMENSIONS = ["concept", "problemSolving", "reasoning", "practical"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  concept: "Concept",
  problemSolving: "Problem solving",
  reasoning: "Reasoning",
  practical: "Practical",
};

/** null means not tested yet, which is never the same as a low level. */
export type Level = 0 | 1 | 2 | 3 | 4;
export const LEVEL_LABEL: Record<Level, string> = {
  0: "Gap shown",
  1: "Aware",
  2: "Partial",
  3: "Demonstrated",
  4: "Applies independently",
};
export type Knowledge = "untested" | "partial" | "demonstrated";
export function knowledgeOf(level: Level | null): Knowledge {
  return level === null ? "untested" : level >= 3 ? "demonstrated" : "partial";
}

export type AssessmentConfidence = "low" | "medium" | "high";

export interface DimensionState {
  level: Level | null;
  confidence: AssessmentConfidence;
  evidenceIds: string[];
}

export interface SkillState {
  id: string;
  title: string;
  dimensions: Record<Dimension, DimensionState>;
  trend: "improving" | "steady" | "regressing" | "unknown";
  lastDemonstratedAt: string | null;
  nextRevisionAt: string | null;
}

export type EvidenceSourceKind = "answer" | "activity" | "coding" | "read" | "submission" | "conversation";

/** What Claude proposes for one observation. Code adds the rest (see EvidenceItem). */
export interface ProposedEvidence {
  id: string;
  skillId: string;
  dimension: Dimension;
  direction: "supports" | "contradicts" | "neutral";
  strength: "weak" | "moderate" | "strong";
  source: { kind: EvidenceSourceKind; id: string };
  /** Verbatim from the source; required for written work. Checked by code. */
  quote?: string;
  note: string;
}

/** Stored append-only in mentor/evidence/<YYYY-MM>.jsonl. Never rewritten. */
export interface EvidenceItem extends ProposedEvidence {
  forDate: string;
  /** Groups evidence that came from one sitting, so one session can't count as two independent demonstrations. */
  sessionKey: string;
  occurredAt: string;
}

export interface Misconception {
  id: string;
  skillId: string;
  description: string;
  status: "active" | "resolved";
  evidenceIds: string[];
}

export interface Assessment {
  skillId: string;
  note: string;
  evidenceIds: string[];
}

export interface PlanResourceRef {
  /** An id from content/resources/registry.json. Claude can't introduce a URL of its own. */
  id: string;
  why: string;
}

export interface MentorActivity {
  id: string;
  kind: "dialogue" | "explain-back" | "code-problem" | "quiz" | "practical" | "revision";
  title: string;
  skillIds: string[];
  objective: string;
  why: string;
  /** Empty only when noEvidenceYet is true: "I don't know yet" is an honest reason. */
  whyEvidenceIds: string[];
  noEvidenceYet: boolean;
  expectedOutcomes: string[];
  /** What to do, written for this learner. Answered in the app or in a mentor session. */
  exercise: string;
  /** What a good answer demonstrates. Used when grading it. */
  rubric: string[];
  minutes: number;
  resources: PlanResourceRef[];
}

export interface RevisionItem {
  skillId: string;
  due: string;
  why: string;
}

export interface DailyPlan {
  forDate: string;
  primary: MentorActivity;
  supporting: MentorActivity[];
  revision: RevisionItem[];
}

export interface RoadmapItem {
  skillId: string;
  title: string;
  status: "now" | "next" | "later" | "done";
  why: string;
}

export interface SubmissionFeedback {
  submissionId: string;
  verdict: "strong" | "partial" | "weak";
  feedback: string;
}

/** The nightly routine's only output. Written to a temp file and checked by validateProposal before anything persists. */
export interface Proposal {
  schema: typeof MENTOR_SCHEMA;
  forDate: string;
  inputHash: string;
  analysis: {
    summary: string;
    improved: string[];
    regressed: string[];
    decisionRationale: string;
  };
  evidence: ProposedEvidence[];
  profile: {
    /** Only skills with something to say. A skill left out stays untested. */
    skills: SkillState[];
    misconceptions: Misconception[];
    strengths: Assessment[];
    weaknesses: Assessment[];
    longTermObjectives: string[];
  };
  roadmap: { items: RoadmapItem[]; changes: { change: string; why: string }[] };
  plan: DailyPlan;
  feedback: SubmissionFeedback[];
  /** New practice questions for tonight's gaps. Optional; appended to mentor/questions.json, never kept in the state. */
  questions?: GeneratedQuestion[];
}

export interface LevelChange {
  skillId: string;
  dimension: Dimension;
  from: Level | null;
  to: Level | null;
  evidenceIds: string[];
}

/** One version of what the mentor believes. Written to mentor/states/<forDate>.json and never edited. */
export interface LearnerState extends Omit<Proposal, "evidence" | "questions"> {
  version: number;
  generatedAt: string;
  runId: string;
  /** Worked out by code from the previous version, not reported by Claude. */
  levelChanges: LevelChange[];
  /** Anything here that isn't in profile.skills is untested. */
  skillCatalogue: { id: string; title: string }[];
}

export interface CurrentPointer {
  schema: typeof MENTOR_SCHEMA;
  stateFile: string;
  version: number;
  forDate: string;
  runId: string;
  generatedAt: string;
}

export type RunStatus = "analysed" | "bootstrapped" | "no-new-evidence" | "failed";

export interface RunRecord {
  schema: typeof MENTOR_SCHEMA;
  runId: string;
  forDate: string;
  /** Only runs in the night window count towards the five-night gate. */
  trigger: "scheduled" | "manual";
  startedAt: string;
  finishedAt: string;
  status: RunStatus;
  inputHash: string;
  promptVersion: number;
  newInteractions: Record<string, number>;
  stateVersion: number | null;
  levelChanges: LevelChange[];
  checks: string[];
  errors: string[];
}

export interface MentorStatus {
  schema: typeof MENTOR_SCHEMA;
  lastRunAt: string | null;
  lastRunStatus: RunStatus | null;
  lastRunForDate: string | null;
  lastSuccessAt: string | null;
  lastSuccessForDate: string | null;
  lastAnalysedForDate: string | null;
  consecutiveNights: number;
  analysedInStreak: number;
  /** Days with no run on record: a quota limit, pause or outage leaves no session behind to report it. */
  missedDates: string[];
  primaryEligible: boolean;
  primarySince: string | null;
}

/** An answer written in the app. Stored in mentor/submissions/<id>.json; graded by the next nightly run. */
export interface Submission {
  id: string;
  forDate: string;
  activityId: string;
  skillIds: string[];
  prompt: string;
  answer: string;
  submittedAt: string;
}

/** A mentor session, saved by that session to mentor/conversations/<id>.json. */
export interface Conversation {
  id: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  activityId?: string;
  turns: { role: "mentor" | "learner"; text: string }[];
}

export interface PacketAnswer {
  id: string;
  sessionId: string;
  mode: string;
  questionId: string;
  skillId: string;
  difficulty: number;
  correct: boolean;
  prompt: string | null;
  picked: string | null;
  correctOption: string | null;
  timeMs: number;
  answeredAt: string;
}

export interface PacketActivity {
  id: string;
  kind: string;
  skillId: string;
  refId: string;
  rating?: string;
  note?: string;
  at: string;
}

export interface PacketCoding {
  id: string;
  problemId: string;
  title: string | null;
  difficulty: string | null;
  patterns: string[];
  problemNotes: string | null;
  outcome: string;
  minutes?: number;
  notes?: string;
  at: string;
}

export interface PacketRead {
  id: string;
  skillId: string;
  openedAt: string;
  durationMs: number;
}

export interface NewInteractions {
  answers: PacketAnswer[];
  activities: PacketActivity[];
  coding: PacketCoding[];
  reads: PacketRead[];
  submissions: Submission[];
  conversations: Conversation[];
}

export type PacketDecision = "already-done" | "bootstrap" | "analyse" | "no-new-evidence";

/** Everything one night's analysis may look at, and no more. */
export interface MentorPacket {
  schema: typeof MENTOR_SCHEMA;
  promptVersion: number;
  forDate: string;
  trigger: RunRecord["trigger"];
  startedAt: string;
  decision: PacketDecision;
  inputHash: string;
  newInteractions: NewInteractions;
  previousState: LearnerState | null;
  /** Past evidence for the skills touched tonight or in the current plan. */
  relevantEvidence: EvidenceItem[];
  /** Computed by the existing engines, so the analysis never has to count. */
  facts: {
    weakTopics: { skillId: string; attempts: number; correct: number; score: number }[];
    repeatedMisses: { questionId: string; skillId: string; misses: number; picks: string[] }[];
    fastAnswers: { id: string; questionId: string; timeMs: number; correct: boolean }[];
    dueQuestionIds: string[];
    readsWithoutRetrieval: string[];
    daysSinceLastInteraction: number | null;
    /** Per skill: questions in the bank and how many are still unseen. Where it's thin, write questions. */
    questionBank: { skillId: string; total: number; unseen: number; byDifficulty: [number, number, number] }[];
  };
  /** Answers from before the question rewrite: context only, never evidence. */
  archived: { count: number; missedByTopic: Record<string, number> };
  /** The LeetCode record and its latest review. Context for choosing priorities, never evidence for a level. Null when there's no history. */
  coding?: CodingContext | null;
  skillCatalogue: { id: string; title: string }[];
  resources: { id: string; title: string; publisher: string; tier: number; topics: string[] }[];
  /** Keys recorded as processed once this night's analysis commits. */
  processedKeys: string[];
}
