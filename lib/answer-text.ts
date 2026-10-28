import type { AnswerLog, Question } from "./types";

/** Snapshot of option sets that were later rewritten (content/questions/legacy/*.json). */
export interface LegacyOptions {
  replacedAt: string;
  options: Record<string, string[]>;
}

/**
 * The option text the learner actually saw and picked. Newer answers carry it
 * directly; older ones are resolved against the option set that was live when
 * they were given, because `selected` is only an index.
 */
export function pickedOptionText(answer: AnswerLog, question: Question | undefined, legacy: LegacyOptions[] = []): string {
  if (answer.selectedText) return answer.selectedText;
  const snapshot = [...legacy]
    .sort((a, b) => a.replacedAt.localeCompare(b.replacedAt))
    .find((l) => answer.answeredAt < l.replacedAt && l.options[answer.questionId]);
  const options = snapshot ? snapshot.options[answer.questionId] : question?.options;
  return options?.[answer.selected] ?? "?";
}
