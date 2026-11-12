import { canonicalJson } from "../journal/events";
import type { AnswerLog } from "../types";
import { normalizeConcept } from "./levels";
import type { Evidence, EvidenceFile } from "./types";

/** Pure mapping of the pre-journal records (MCQ answers, V1 mentor evidence) to Evidence. No I/O. */

export const GENERATED_BY = "scripts/knowledge-migrate.ts";
const FAST_MS = 3000;

export interface MentorLine {
  /** Repo-relative path of the .jsonl file. */
  path: string;
  /** Parsed JSON, or undefined when the line did not parse. */
  raw: unknown;
}

export interface MigrationInput {
  answers: AnswerLog[];
  /** question id -> its topic, from content/questions/*.json. */
  questionTopics: Map<string, { domain: string; topic: string }>;
  mentor: MentorLine[];
  /** Answers before this are archived and skipped (CONTENT_EPOCH). */
  epoch: string;
}

export interface Migration {
  items: Evidence[];
  skipped: { archivedAnswers: number; archivedMentor: number; duplicateMentor: number; uncertain: { id: string; reason: string }[] };
}

const label = (topic: string) => topic.replace(/-/g, " ");
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export function migrate(input: MigrationInput): Migration {
  const items: Evidence[] = [];
  const skipped: Migration["skipped"] = { archivedAnswers: 0, archivedMentor: 0, duplicateMentor: 0, uncertain: [] };
  const answers = new Map(input.answers.map((a) => [a.id, a]));

  for (const a of input.answers) {
    if (a.answeredAt < input.epoch) {
      skipped.archivedAnswers++;
      continue;
    }
    const q = input.questionTopics.get(a.questionId);
    const domain = q?.domain ?? a.domain;
    const topic = q?.topic ?? a.topic;
    const uncertain = a.unsure || a.timeMs < FAST_MS;
    items.push({
      id: `mig:mcq:${a.id}`,
      concept: normalizeConcept(`${domain}/${topic}`),
      label: label(topic),
      subject: domain,
      kind: "mcq-answer",
      signal: uncertain ? "exposed" : a.correct ? "correct" : "incorrect",
      strength: "weak",
      at: a.answeredAt,
      source: { repo: "data", path: "progress.json", ref: a.id },
      historical: true,
      ...(a.unsure ? { note: "marked unsure" } : a.timeMs < FAST_MS ? { note: "answered in under 3 seconds" } : {}),
    });
  }

  const seen = new Map<string, string>();
  for (const line of input.mentor) {
    const e = line.raw as Record<string, unknown> | undefined;
    const id = isStr(e?.id) ? (e.id as string) : `${line.path}:?`;
    const uncertain = (reason: string) => void skipped.uncertain.push({ id, reason });
    if (!e || typeof e !== "object" || !isStr(e.id)) {
      uncertain("line is not a JSON object with an id");
      continue;
    }
    const key = canonicalJson(e);
    if (seen.has(e.id)) {
      if (seen.get(e.id) === key) skipped.duplicateMentor++;
      else uncertain("same id appears twice with different content");
      continue;
    }
    seen.set(e.id, key);
    const source = e.source as { kind?: unknown; id?: unknown } | undefined;
    if (source?.kind !== "answer" || !isStr(source.id)) {
      uncertain(`source is ${typeof source?.kind === "string" ? `a ${source.kind}` : "unknown"}, not an answer (reading or neutral evidence is not understanding)`);
      continue;
    }
    const answer = answers.get(source.id);
    if (!answer) {
      uncertain(`answer ${source.id} not found in progress.json`);
      continue;
    }
    if (answer.answeredAt < input.epoch) {
      skipped.archivedMentor++;
      continue;
    }
    if (e.direction !== "supports" && e.direction !== "contradicts") {
      uncertain(`direction "${String(e.direction)}" is not supports or contradicts`);
      continue;
    }
    if ((e.dimension !== "concept" && e.dimension !== "practical") || !["weak", "moderate", "strong"].includes(e.strength as string)) {
      uncertain("dimension or strength is not recognised");
      continue;
    }
    if ((e.direction === "supports") !== answer.correct) {
      uncertain(`direction ${e.direction} disagrees with the answer, which was ${answer.correct ? "correct" : "incorrect"}`);
      continue;
    }
    if (!isStr(e.skillId) || !isStr(e.occurredAt) || Number.isNaN(Date.parse(e.occurredAt))) {
      uncertain("skillId or occurredAt is missing");
      continue;
    }
    const concept = normalizeConcept(e.skillId);
    if (concept !== normalizeConcept(`${answer.domain}/${answer.topic}`)) {
      uncertain(`skill ${concept} differs from the answer's topic ${answer.domain}/${answer.topic}`);
      continue;
    }
    items.push({
      id: `mig:mentor:${e.id}`,
      concept,
      label: label(answer.topic),
      subject: answer.domain,
      // The entry judges a multiple-choice answer, so it is weak whatever the mentor called it.
      kind: "mcq-answer",
      signal: e.direction === "supports" ? "correct" : "incorrect",
      strength: "weak",
      at: e.occurredAt,
      source: { repo: "data", path: line.path, ref: e.id },
      historical: true,
      note: `${isStr(e.note) ? e.note : "mentor entry"} [V1 mentor: ${e.dimension}, ${e.strength}]`,
    });
  }
  return { items, skipped };
}

/** Existing items are never changed; items with new ids are appended. Sorted by id, so equal input gives equal bytes. */
export function mergeEvidence(existing: EvidenceFile | null, incoming: Evidence[]): EvidenceFile {
  const byId = new Map((existing?.items ?? []).map((e) => [e.id, e]));
  for (const e of incoming) if (!byId.has(e.id)) byId.set(e.id, e);
  return { v: 1, generatedBy: existing?.generatedBy ?? GENERATED_BY, items: [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) };
}

export function count<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) out[key(i)] = (out[key(i)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}
