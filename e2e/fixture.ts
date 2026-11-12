import { readFileSync } from "node:fs";
import path from "node:path";
import type { AnswerLog, Domain, ProgressData, Question } from "../lib/types";

/** The fixed "now" for seeded runs: after REVIEW_EPOCH (2026-11-12T18:30Z) and CONTENT_EPOCH, so every record below counts. */
export const FIXED_NOW = "2026-11-26T12:00:00Z";
export const PROGRESS_KEY = "ft.progress.v1";

const DOMAINS: Domain[] = ["dsa", "oop", "databases", "web"];
const DAY = 86_400_000;

function questionsOf(domain: Domain): Question[] {
  const raw = JSON.parse(readFileSync(path.join(__dirname, "..", "content", "questions", `${domain}.json`), "utf8"));
  return Array.isArray(raw) ? raw : raw.questions;
}

/** Small deterministic progress: ~40 answers over 14 days across four domains, with misses, reads and two sessions. */
export function seededProgress(): ProgressData {
  const now = Date.parse(FIXED_NOW);
  const answers: AnswerLog[] = [];
  let n = 0;
  DOMAINS.forEach((domain, d) => {
    const qs = questionsOf(domain).slice(0, 10);
    qs.forEach((q, i) => {
      // Misses cluster in a few questions per domain; every 7th is an "I don't know".
      const unsure = n % 7 === 6;
      const correct = !unsure && (i + d) % 3 !== 0;
      // Spread over the last 13 days, newest answers on the last two days so the streak shows.
      const day = (n * 5) % 13;
      const at = new Date(now - day * DAY - (n % 5) * 3_600_000 - 1_800_000).toISOString();
      answers.push({
        id: `e2e-a${n}`,
        sessionId: `e2e-s${d % 2}`,
        mode: "practice",
        questionId: q.id,
        domain,
        topic: q.topic,
        difficulty: q.difficulty,
        correct,
        selected: unsure ? -1 : correct ? q.answer : (q.answer + 1) % q.options.length,
        unsure: unsure || undefined,
        timeMs: 8000 + (n % 6) * 3000,
        answeredAt: at,
      });
      n++;
    });
  });
  const iso = (daysAgo: number) => new Date(now - daysAgo * DAY - 3_600_000).toISOString();
  const lessons: [Domain, string][] = [["dsa", "big-o-basics"], ["dsa", "arrays-strings"], ["oop", "solid"], ["databases", "indexing"], ["web", "http"]];
  return {
    version: 1,
    updatedAt: new Date(now).toISOString(),
    answers,
    sessions: [
      { id: "e2e-s0", mode: "practice", startedAt: iso(2), finishedAt: iso(2), total: 10, correct: 7, domainScores: { dsa: 70, databases: 65 } },
      { id: "e2e-s1", mode: "practice", startedAt: iso(0), finishedAt: iso(0), total: 10, correct: 6, domainScores: { oop: 60, web: 55 } },
    ],
    reviews: {},
    reads: lessons.map(([domain, topic], i) => ({ id: `e2e-r${i}`, domain, topic, openedAt: iso(i * 2), durationMs: 120_000 + i * 30_000 })),
    activities: [],
    codingProblems: [],
    codingAttempts: [],
  };
}
