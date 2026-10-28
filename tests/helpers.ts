import type { AnswerLog, Difficulty, Domain } from "@/lib/types";

let n = 0;

export function answer(partial: Partial<AnswerLog> & { correct: boolean }): AnswerLog {
  n++;
  return {
    id: `a${n}`,
    sessionId: "s1",
    mode: "practice",
    questionId: partial.questionId ?? `q${n}`,
    domain: (partial.domain ?? "dsa") as Domain,
    topic: partial.topic ?? "hashing",
    difficulty: (partial.difficulty ?? 2) as Difficulty,
    selected: 0,
    timeMs: 1000,
    answeredAt: partial.answeredAt ?? "2026-10-01T10:00:00.000Z",
    ...partial,
  };
}
