import { validateQuestions } from "../validate";
import type { Question } from "../types";

/**
 * Questions the nightly mentor writes for tonight's gaps. They live in the data repo (mentor/questions.json), so they
 * reach the site without a deploy. Append-only and immutable: a fix is a new id, so old answers keep their meaning.
 */
export interface GeneratedQuestion extends Question {
  /** The night it was written for. */
  forDate: string;
  /** Why this learner needs it, in a sentence. */
  why: string;
  /** Evidence ids behind the why; empty when nothing is known yet. */
  whyEvidenceIds: string[];
}

export interface QuestionBankFile {
  schema: 1;
  questions: GeneratedQuestion[];
}

export const MAX_QUESTIONS_PER_NIGHT = 12;
const OPTIONS = 4;
/** The correct option may be a little longer than the others, never a giveaway. */
const MAX_CORRECT_LENGTH_RATIO = 1.3;
/** Share of a night's batch where the correct option is the unique longest. Chance is 25%. */
const MAX_UNIQUE_LONGEST_SHARE = 0.4;

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function isQuestionBank(x: unknown): x is QuestionBankFile {
  const b = x as QuestionBankFile | null;
  return !!b && b.schema === 1 && Array.isArray(b.questions);
}

export function uniqueLongest(q: Pick<Question, "options" | "answer">): boolean {
  const lens = q.options.map((o) => o.length);
  const c = lens[q.answer];
  return c === Math.max(...lens) && lens.filter((l) => l === c).length === 1;
}

export interface QuestionCheckContext {
  forDate: string;
  /** Every question that already exists: the static bank and earlier generated ones. */
  existing: Pick<Question, "id" | "prompt">[];
  /** `domain/topic` keys a question may belong to. */
  topicKeys: ReadonlySet<string>;
  /** Evidence ids a why may cite: history plus tonight's. */
  evidenceIds: ReadonlySet<string>;
}

/** Errors for a night's proposed questions. Empty means every one of them may be published. */
export function validateGeneratedQuestions(raw: unknown, ctx: QuestionCheckContext): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return ["questions must be a list"];
  const errors: string[] = [];
  if (raw.length > MAX_QUESTIONS_PER_NIGHT) errors.push(`questions: at most ${MAX_QUESTIONS_PER_NIGHT} a night, got ${raw.length}`);

  const { errors: shape } = validateQuestions(raw);
  errors.push(...shape.map((e) => `questions: ${e}`));

  const ids = new Set(ctx.existing.map((q) => q.id));
  const prompts = new Set(ctx.existing.map((q) => norm(q.prompt)));
  const prefix = `m-${ctx.forDate}-`;
  raw.forEach((item, i) => {
    const q = item as Partial<GeneratedQuestion>;
    const add = (m: string) => errors.push(`questions[${i}] (${String(q?.id ?? "no id")}): ${m}`);
    if (typeof q?.id === "string") {
      if (!q.id.startsWith(prefix)) add(`id must start with ${prefix}`);
      if (ids.has(q.id)) add("id already exists");
      ids.add(q.id);
    }
    if (typeof q?.prompt === "string") {
      if (prompts.has(norm(q.prompt))) add("the same prompt already exists");
      prompts.add(norm(q.prompt));
    }
    if (!ctx.topicKeys.has(`${q?.domain}/${q?.topic}`)) add(`unknown topic ${q?.domain}/${q?.topic}`);
    if (q?.forDate !== ctx.forDate) add(`forDate must be ${ctx.forDate}`);
    if (typeof q?.why !== "string" || q.why.trim().length < 10) add("why is required");
    if (!Array.isArray(q?.whyEvidenceIds)) add("whyEvidenceIds is required");
    else for (const id of q.whyEvidenceIds) if (!ctx.evidenceIds.has(id)) add(`cites unknown evidence ${id}`);
    if (typeof q?.explanation === "string" && q.explanation.trim().length < 40) add("explanation must say why the answer is right and the tempting one wrong");
    if (Array.isArray(q?.options)) {
      if (q.options.length !== OPTIONS) add(`needs exactly ${OPTIONS} options`);
      else if (typeof q.answer === "number" && q.answer >= 0 && q.answer < OPTIONS) {
        const mean = q.options.reduce((s, o) => s + String(o).length, 0) / OPTIONS;
        if (String(q.options[q.answer]).length > mean * MAX_CORRECT_LENGTH_RATIO) add("the correct option is much longer than the others (a length tell)");
      }
    }
  });

  const wellFormed = raw.filter((q): q is GeneratedQuestion => Array.isArray(q?.options) && q.options.length === OPTIONS && typeof q.answer === "number");
  if (wellFormed.length >= 3) {
    const share = wellFormed.filter(uniqueLongest).length / wellFormed.length;
    if (share > MAX_UNIQUE_LONGEST_SHARE) errors.push(`questions: the correct option is the unique longest in ${Math.round(share * 100)}% of them; vary it`);
  }
  return errors;
}

/** The bank after tonight: old entries untouched, new ones appended. */
export function appendQuestions(bank: QuestionBankFile | null, added: GeneratedQuestion[]): QuestionBankFile {
  return { schema: 1, questions: [...(bank?.questions ?? []), ...added] };
}

/** Static questions plus generated ones. A static id always wins, so a generated question can never shadow one. */
export function mergeQuestionPools(base: Question[], generated: readonly Question[]): Question[] {
  const ids = new Set(base.map((q) => q.id));
  return [...base, ...generated.filter((q) => !ids.has(q.id))];
}

/** Per skill: how many questions exist, and how many this learner has never seen. Tells the mentor where the bank is thin. */
export function bankCoverage(questions: Question[], answeredIds: ReadonlySet<string>): { skillId: string; total: number; unseen: number; byDifficulty: [number, number, number] }[] {
  const map = new Map<string, { skillId: string; total: number; unseen: number; byDifficulty: [number, number, number] }>();
  for (const q of questions) {
    const skillId = `${q.domain}/${q.topic}`;
    const c = map.get(skillId) ?? { skillId, total: 0, unseen: 0, byDifficulty: [0, 0, 0] as [number, number, number] };
    c.total++;
    if (!answeredIds.has(q.id)) c.unseen++;
    c.byDifficulty[q.difficulty - 1]++;
    map.set(skillId, c);
  }
  return [...map.values()].sort((a, b) => a.skillId.localeCompare(b.skillId));
}
