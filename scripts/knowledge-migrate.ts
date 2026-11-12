/**
 * One-off, repeatable migration of MCQ answers and V1 mentor evidence into knowledge/evidence.json.
 *
 *   npm run --silent knowledge-migrate -- [--dry-run] --data <data repo>   (default; writes nothing)
 *   npm run --silent knowledge-migrate -- commit --data <data repo>
 *
 * commit writes only knowledge/evidence.json and publishes with one git commit. Existing items are never changed;
 * re-running with unchanged sources writes nothing. Source records are only read.
 */
import fs from "node:fs";
import path from "node:path";
import { publish, need, appRoot } from "../lib/data-publish";
import { count, mergeEvidence, migrate, type MentorLine } from "../lib/knowledge/migrate";
import type { EvidenceFile } from "../lib/knowledge/types";
import { CONTENT_EPOCH } from "../lib/progress";
import { readJsonIf } from "../lib/review/data";
import type { AnswerLog } from "../lib/types";

const OUTPUT = "knowledge/evidence.json";
const MENTOR_DIRS = ["mentor/evidence", "archive/mentor-v1/evidence"];

function questionTopics() {
  const dir = path.join(appRoot, "content/questions");
  const out = new Map<string, { domain: string; topic: string }>();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    for (const q of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { id: string; domain: string; topic: string }[]) out.set(q.id, { domain: q.domain, topic: q.topic });
  }
  return out;
}

function mentorLines(dataDir: string): MentorLine[] {
  const out: MentorLine[] = [];
  for (const rel of MENTOR_DIRS) {
    const dir = path.join(dataDir, rel);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl")).sort()) {
      for (const text of fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter((l) => l.trim())) {
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          raw = undefined;
        }
        out.push({ path: `${rel}/${f}`, raw });
      }
    }
  }
  return out;
}

function main() {
  const dataDir = need("data");
  const commit = process.argv[2] === "commit";
  const progress = readJsonIf<{ answers?: AnswerLog[] }>(path.join(dataDir, "progress.json"));
  if (!progress?.answers) throw new Error("progress.json is missing or damaged");
  const result = migrate({ answers: progress.answers, questionTopics: questionTopics(), mentor: mentorLines(dataDir), epoch: CONTENT_EPOCH });
  const existing = readJsonIf<EvidenceFile>(path.join(dataDir, OUTPUT));
  const merged = mergeEvidence(existing, result.items);
  const text = `${JSON.stringify(merged, null, 1)}\n`;
  const file = path.join(dataDir, OUTPUT);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  const known = new Set((existing?.items ?? []).map((e) => e.id));
  const summary = {
    mode: commit ? "commit" : "dry-run",
    migrated: result.items.length,
    newItems: result.items.filter((e) => !known.has(e.id)).length,
    alreadyPresent: result.items.filter((e) => known.has(e.id)).length,
    byKind: count(result.items, (e) => e.kind),
    bySignal: count(result.items, (e) => e.signal),
    byConcept: count(result.items, (e) => e.concept),
    skipped: {
      archivedAnswersBeforeContentEpoch: result.skipped.archivedAnswers,
      mentorEntriesOnArchivedAnswers: result.skipped.archivedMentor,
      duplicateMentorEntries: result.skipped.duplicateMentor,
      uncertainLeftForReassessment: result.skipped.uncertain.length,
    },
    uncertain: result.skipped.uncertain,
  };
  console.log(JSON.stringify(summary, null, 1));
  if (!commit) return;
  if (text === current) {
    console.log(JSON.stringify({ status: "unchanged" }));
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  publish(dataDir, [OUTPUT], `knowledge evidence migration (${merged.items.length} items)`);
  console.log(JSON.stringify({ status: "updated", items: merged.items.length }));
}

main();
