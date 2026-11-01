import type { CodingAttempt, CodingDifficulty, CodingOutcome, CodingProblem, ProgressData } from "./types";

/**
 * Manual LeetCode tracking. Automatic import isn't reliable for a static site: LeetCode has no public API, its GraphQL
 * endpoint is undocumented and blocks browser calls (no CORS, OPTIONS returns 405), and full submission history needs
 * the account's session cookie, which must never be put in frontend code. See docs/design/REDESIGN.md.
 */

export interface CodingPattern {
  id: string;
  label: string;
  /** The Learning Path topic this pattern exercises, when there is one. */
  topic?: string;
}

export const CODING_PATTERNS: CodingPattern[] = [
  { id: "arrays-hashing", label: "Arrays & hashing", topic: "dsa/hashing" },
  { id: "two-pointers", label: "Two pointers", topic: "dsa/complexity" },
  { id: "sliding-window", label: "Sliding window", topic: "dsa/complexity" },
  { id: "binary-search", label: "Binary search", topic: "dsa/complexity" },
  { id: "stack", label: "Stack" },
  { id: "linked-list", label: "Linked list" },
  { id: "trees", label: "Trees", topic: "dsa/trees-graphs" },
  { id: "graphs", label: "Graphs", topic: "dsa/trees-graphs" },
  { id: "heap", label: "Heap" },
  { id: "backtracking", label: "Backtracking" },
  { id: "dynamic-programming", label: "Dynamic programming", topic: "dsa/dynamic-programming" },
  { id: "greedy", label: "Greedy" },
  { id: "intervals", label: "Intervals" },
  { id: "bit-manipulation", label: "Bit manipulation" },
  { id: "sql", label: "SQL", topic: "databases/indexing" },
  { id: "concurrency", label: "Concurrency" },
];

export const PATTERN_TOPICS: Record<string, string | undefined> = Object.fromEntries(CODING_PATTERNS.map((p) => [p.id, p.topic]));
const PATTERN_LABELS = new Map(CODING_PATTERNS.map((p) => [p.id, p.label]));
export const patternLabel = (id: string) => PATTERN_LABELS.get(id) ?? id;

export const DIFFICULTY_LABEL: Record<CodingDifficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
export const OUTCOME_LABEL: Record<CodingOutcome, string> = { solved: "Solved unaided", "solved-with-help": "Solved with help", "not-solved": "Not solved" };

const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w, i) => {
      if (/^(i{1,3}|iv|v|vi{0,3}|ix|x|\d+)$/.test(w)) return w.toUpperCase();
      return i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export interface ParsedProblem {
  id: string;
  title: string;
  url?: string;
  number?: number;
}

/**
 * Reads what you typed: a leetcode.com problem link, "1. Two Sum", or just "Two Sum". A link is only kept when you gave
 * one, because a slug guessed from a title can be wrong.
 */
export function parseProblemInput(input: string): ParsedProblem | null {
  const text = input.trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (!/(^|\.)leetcode\.(com|cn)$/i.test(url.hostname)) return null;
    const slug = url.pathname.match(/\/problems\/([a-z0-9-]+)/i)?.[1]?.toLowerCase();
    if (!slug) return null;
    return { id: `lc-${slug}`, title: titleFromSlug(slug), url: `https://leetcode.com/problems/${slug}/` };
  }
  const numbered = text.match(/^(\d{1,5})\s*[.):-]?\s+(.+)$/);
  const title = numbered ? numbered[2].trim() : text;
  const slug = slugify(title);
  if (!slug) return null;
  return { id: `lc-${slug}`, title, ...(numbered ? { number: Number(numbered[1]) } : {}) };
}

export const activeProblems = (data: ProgressData): CodingProblem[] => data.codingProblems.filter((p) => !p.deletedAt);

export function attemptsFor(data: ProgressData, problemId: string): CodingAttempt[] {
  return data.codingAttempts.filter((a) => a.problemId === problemId).sort((a, b) => a.at.localeCompare(b.at));
}

const DAY = 86_400_000;

export interface ProblemStatus {
  problem: CodingProblem;
  attempts: CodingAttempt[];
  last: CodingAttempt | null;
  dueAt: string | null;
  isDue: boolean;
  overdueDays: number;
}

/**
 * When to retry a problem. Being able to solve it again later is the real test. A miss comes back in 3 days and a
 * helped solve in 7. Unaided solves stretch from 14 to 30 to 90 days, then it's considered settled.
 */
export function nextRevisitDays(attempts: CodingAttempt[]): number | null {
  const last = attempts[attempts.length - 1];
  if (!last) return null;
  if (last.outcome === "not-solved") return 3;
  if (last.outcome === "solved-with-help") return 7;
  let streak = 0;
  for (let i = attempts.length - 1; i >= 0 && attempts[i].outcome === "solved"; i--) streak++;
  if (streak === 1) return 14;
  if (streak === 2) return 30;
  if (streak === 3) return 90;
  return null;
}

export function problemStatus(data: ProgressData, problem: CodingProblem, now: number = Date.now()): ProblemStatus {
  const attempts = attemptsFor(data, problem.id);
  const last = attempts[attempts.length - 1] ?? null;
  const days = nextRevisitDays(attempts);
  const dueMs = last && days !== null ? Date.parse(last.at) + days * DAY : null;
  return {
    problem,
    attempts,
    last,
    dueAt: dueMs === null ? null : new Date(dueMs).toISOString(),
    isDue: dueMs !== null && dueMs <= now,
    overdueDays: dueMs === null ? 0 : Math.max(0, Math.floor((now - dueMs) / DAY)),
  };
}

export function dueProblems(data: ProgressData, now: number = Date.now()): ProblemStatus[] {
  return activeProblems(data)
    .map((p) => problemStatus(data, p, now))
    .filter((s) => s.isDue)
    .sort((a, b) => (a.dueAt as string).localeCompare(b.dueAt as string));
}

export interface PatternStat {
  id: string;
  label: string;
  topic?: string;
  problems: number;
  /** Problems whose latest attempt was unaided. */
  unaided: number;
  /** Problems whose latest attempt needed help or failed. */
  struggling: number;
  /** Median minutes across attempts that recorded time. */
  medianMinutes: number | null;
  verdict: "weak" | "strong" | "ok" | "too-few";
}

/** Below this, one bad day would decide the verdict, so the page says there's too little to judge. */
const MIN_PROBLEMS = 2;

/** Weak areas per pattern, judged by your latest attempt at each problem, so getting better shows up. */
export function patternStats(data: ProgressData): PatternStat[] {
  const problems = activeProblems(data);
  const stats: PatternStat[] = [];
  for (const pattern of CODING_PATTERNS) {
    const mine = problems.filter((p) => p.patterns.includes(pattern.id));
    if (mine.length === 0) continue;
    const latest = mine.map((p) => attemptsFor(data, p.id)).filter((a) => a.length > 0);
    const unaided = latest.filter((a) => a[a.length - 1].outcome === "solved").length;
    const struggling = latest.length - unaided;
    const minutes = latest.flat().flatMap((a) => (a.minutes ? [a.minutes] : [])).sort((x, y) => x - y);
    const verdict = latest.length < MIN_PROBLEMS ? "too-few" : struggling / latest.length >= 0.5 ? "weak" : unaided / latest.length >= 0.75 ? "strong" : "ok";
    stats.push({
      id: pattern.id,
      label: pattern.label,
      topic: pattern.topic,
      problems: mine.length,
      unaided,
      struggling,
      medianMinutes: minutes.length ? minutes[Math.floor(minutes.length / 2)] : null,
      verdict,
    });
  }
  const order = { weak: 0, ok: 1, "too-few": 2, strong: 3 };
  return stats.sort((a, b) => order[a.verdict] - order[b.verdict] || b.struggling - a.struggling || b.problems - a.problems);
}

export interface DifficultyStat {
  difficulty: CodingDifficulty;
  problems: number;
  unaided: number;
}

export function difficultyStats(data: ProgressData): DifficultyStat[] {
  const problems = activeProblems(data);
  return (["easy", "medium", "hard"] as const).map((difficulty) => {
    const mine = problems.filter((p) => p.difficulty === difficulty);
    const unaided = mine.filter((p) => {
      const a = attemptsFor(data, p.id);
      return a[a.length - 1]?.outcome === "solved";
    }).length;
    return { difficulty, problems: mine.length, unaided };
  });
}
