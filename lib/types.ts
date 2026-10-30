export const DOMAINS = [
  "dsa",
  "oop",
  "databases",
  "system-design",
  "web",
] as const;

export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  dsa: "Data structures & algorithms",
  oop: "OOP & design principles",
  databases: "Databases",
  "system-design": "System design",
  web: "Web & networking",
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
}

export interface Lesson extends TopicMeta {
  html: string;
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

export interface ProgressData {
  version: 1;
  updatedAt: string;
  answers: AnswerLog[];
  sessions: SessionRecord[];
  reviews: Record<string, ReviewState>;
  reads: ReadLog[];
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
