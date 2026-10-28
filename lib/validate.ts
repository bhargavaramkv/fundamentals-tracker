import { DOMAINS, type Domain, type Question } from "./types";

const TOPIC_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isDomain(value: unknown): value is Domain {
  return typeof value === "string" && (DOMAINS as readonly string[]).includes(value);
}

/** Validates raw question JSON and returns typed questions plus human-readable errors. */
export function validateQuestions(raw: unknown[]): { questions: Question[]; errors: string[] } {
  const errors: string[] = [];
  const questions: Question[] = [];
  const seen = new Set<string>();

  raw.forEach((item, i) => {
    const q = item as Partial<Question>;
    const where = `question[${i}] (${String(q?.id ?? "no id")})`;
    const problems: string[] = [];

    if (typeof q.id !== "string" || q.id.length === 0) problems.push("missing id");
    else if (seen.has(q.id)) problems.push("duplicate id");
    if (!isDomain(q.domain)) problems.push(`unknown domain "${String(q.domain)}"`);
    if (typeof q.topic !== "string" || !TOPIC_SLUG.test(q.topic)) problems.push("topic must be a kebab-case slug");
    if (q.difficulty !== 1 && q.difficulty !== 2 && q.difficulty !== 3) problems.push("difficulty must be 1, 2 or 3");
    if (typeof q.prompt !== "string" || q.prompt.trim().length < 10) problems.push("prompt too short");
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.some((o) => typeof o !== "string" || !o.trim())) {
      problems.push("options must be 2+ non-empty strings");
    } else if (new Set(q.options).size !== q.options.length) {
      problems.push("options must be unique");
    }
    if (typeof q.answer !== "number" || !Array.isArray(q.options) || q.answer < 0 || q.answer >= q.options.length || !Number.isInteger(q.answer)) {
      problems.push("answer must be a valid option index");
    }
    if (typeof q.explanation !== "string" || q.explanation.trim().length < 20) problems.push("explanation too short");
    if (q.code !== undefined && typeof q.code !== "string") problems.push("code must be a string");

    if (problems.length > 0) {
      errors.push(`${where}: ${problems.join("; ")}`);
      return;
    }
    seen.add(q.id as string);
    questions.push(q as Question);
  });

  return { questions, errors };
}
