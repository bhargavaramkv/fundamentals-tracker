export const DOMAINS = [
  "dsa",
  "oop",
  "databases",
  "system-design",
  "web",
  "os",
] as const;

export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  dsa: "Data structures & algorithms",
  oop: "OOP & design principles",
  databases: "Databases",
  "system-design": "System design",
  web: "Web & networking",
  os: "Operating systems & concurrency",
};

export type Difficulty = 1 | 2 | 3;

export interface Question {
  id: string;
  domain: Domain;
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  /** Optional code shown under the prompt. */
  code?: string;
  options: string[];
  /** Index into options. */
  answer: number;
  explanation: string;
}

export interface TopicMeta {
  domain: Domain;
  topic: string;
  title: string;
  summary: string;
  /** Reading time in minutes (words / 200). */
  minutes?: number;
}

/** A multiple-choice question inside a lesson step. Engagement only: never stored or scored. */
export interface QuickCheck {
  prompt: string;
  options: string[];
  /** Index into options. */
  answer: number;
  explanation: string;
}

export interface StepThrough {
  title: string;
  frames: { visual: string; caption: string }[];
}

export interface Reveal {
  prompt: string;
  answer: string;
}

export type StepBlock =
  | { kind: "html"; html: string }
  | { kind: "check"; check: QuickCheck }
  | { kind: "steps"; steps: StepThrough }
  | { kind: "reveal"; reveal: Reveal };

/** One screen of a lesson: the content under one `## ` heading. */
export interface LessonStep {
  title: string;
  blocks: StepBlock[];
}

export interface Lesson extends TopicMeta {
  html: string;
  steps: LessonStep[];
}

export interface CurriculumStage {
  id: string;
  title: string;
  summary: string;
  /** Topic slugs in teaching order; only those with a lesson file. */
  topics: string[];
}

export interface CurriculumTrack {
  domain: Domain;
  title: string;
  tagline: string;
  stages: CurriculumStage[];
}

export interface Curriculum {
  tracks: CurriculumTrack[];
}

export type SessionMode = "assessment" | "practice";

export interface AnswerLog {
  id: string;
  sessionId: string;
  mode: SessionMode;
  questionId: string;
  domain: Domain;
  topic: string;
  difficulty: Difficulty;
  correct: boolean;
  /** Index into the options as stored at answer time (options may be reordered later). */
  selected: number;
  /** Text of the picked option, so analysis survives later rewrites of the question. */
  selectedText?: string;
  /** The learner chose "I don't know" instead of guessing. Always `correct: false`, `selected: -1`. */
  unsure?: boolean;
  timeMs: number;
  answeredAt: string;
}

export interface SessionRecord {
  id: string;
  mode: SessionMode;
  startedAt: string;
  finishedAt: string;
  total: number;
  correct: number;
  /** 0-100 per domain answered in this session. */
  domainScores: Partial<Record<Domain, number>>;
}

/** Leitner-style spaced repetition state for one question. */
export interface ReviewState {
  questionId: string;
  box: number;
  dueAt: string;
  lapses: number;
  lastAnsweredAt: string;
}

/** One lesson visit that lasted long enough to count as reading. */
export interface ReadLog {
  id: string;
  domain: Domain;
  topic: string;
  openedAt: string;
  durationMs: number;
}

/** Self-graded result of a written exercise. */
export type ExerciseRating = "got-it" | "partial" | "missed";

/**
 * One piece of learning evidence other than a quiz answer. Append-only, like answers: the latest record for a ref wins,
 * and nothing is ever removed, so merging devices can't lose or resurrect anything.
 */
export type LearningActivity = {
  id: string;
  domain: Domain;
  topic: string;
  at: string;
} & (
  | { kind: "resource"; refId: string }
  | { kind: "exercise"; refId: string; rating: ExerciseRating }
  | { kind: "practical"; refId: string; note?: string }
);

export type CodingDifficulty = "easy" | "medium" | "hard";
/** Whether the solution was your own: a hint or a read solution is recorded differently from solving it unaided. */
export type CodingOutcome = "solved" | "solved-with-help" | "not-solved";

export interface CodingProblem {
  /** Derived from the LeetCode slug, so adding the same problem on two devices merges into one. */
  id: string;
  title: string;
  /** Only set when a real link was entered; never guessed from a title. */
  url?: string;
  /** LeetCode's problem number, when known. */
  number?: number;
  difficulty: CodingDifficulty;
  /** Pattern ids from CODING_PATTERNS (lib/coding.ts). */
  patterns: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  /** Soft delete, so a removal survives merging with a device that still has the problem. */
  deletedAt?: string;
}

export interface CodingAttempt {
  id: string;
  problemId: string;
  at: string;
  outcome: CodingOutcome;
  minutes?: number;
  notes?: string;
}

export interface ProgressData {
  version: 1;
  updatedAt: string;
  answers: AnswerLog[];
  sessions: SessionRecord[];
  reviews: Record<string, ReviewState>;
  reads: ReadLog[];
  /** Added with the topic workspaces. Older files simply have none. */
  activities: LearningActivity[];
  codingProblems: CodingProblem[];
  codingAttempts: CodingAttempt[];
}

export type Confidence = "low" | "medium" | "high";

export interface TopicStat {
  domain: Domain;
  topic: string;
  attempts: number;
  correct: number;
  /** Recency- and difficulty-weighted accuracy, 0-100. */
  score: number;
  /** Wrong answers among the last 5 attempts. */
  recentMisses: number;
}

export interface DomainStat {
  domain: Domain;
  attempts: number;
  score: number;
  confidence: Confidence;
  topics: TopicStat[];
}

export interface SkillProfile {
  domains: DomainStat[];
  weakTopics: TopicStat[];
  strongTopics: TopicStat[];
}

/** A retrieval prompt: write your answer, then compare and grade yourself. */
export interface Exercise {
  id: string;
  prompt: string;
  /** A model answer to compare against. */
  answer: string;
  minutes: number;
}

/** Hands-on work done outside the app, recorded with a note. */
export interface PracticalTask {
  id: string;
  title: string;
  task: string;
  /** How you know you've finished. */
  done: string;
  minutes: number;
}

export interface TopicWorkspace {
  /** Suggested position within the domain. A suggestion only: nothing is locked. */
  order: number;
  /** Topic keys (domain/topic) that help to know first. */
  prerequisites: string[];
  objectives: string[];
  exercises: Exercise[];
  practical: PracticalTask[];
}

export interface FunStory {
  id: string;
  title: string;
  year: number;
  hook: string;
  story: string;
  lesson: string;
  relatesTo: string;
}

export interface FunFact {
  id: string;
  fact: string;
}
