/**
 * The nightly mentor's deterministic steps, run by the Claude Code routine (docs/mentor-routine.md).
 *
 *   npm run --silent mentor -- collect --data <data repo> --out <packet.json>
 *   npm run --silent mentor -- commit  --data <data repo> --packet <packet.json> --proposal <proposal.json>
 *   npm run --silent mentor -- carry   --data <data repo> --packet <packet.json>
 *   npm run --silent mentor -- fail    --data <data repo> --packet <packet.json> --reason "<why>"
 *   npm run --silent mentor -- coding-collect --data <data repo> --out <packet.json>
 *   npm run --silent mentor -- coding-commit  --data <data repo> --packet <packet.json> --proposal <review.json>
 *
 * commit, carry and fail write only under mentor/ and publish with one git commit. Exit code 2 means the proposal was
 * rejected and nothing changed.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { emptyProgress, mergeProgress, normalizeProgress } from "../lib/progress";
import { buildPacket } from "../lib/mentor/packet";
import { forDateOf, triggerOf } from "../lib/mentor/time";
import { buildState, computeStatus, countsOf, pointerFor, renderReport, runIdOf } from "../lib/mentor/run";
import { MENTOR_PROMPT_VERSION, MENTOR_SCHEMA, type Conversation, type CurrentPointer, type EvidenceItem, type LearnerState, type MentorPacket, type MentorStatus, type RunRecord, type RunStatus, type Submission } from "../lib/mentor/types";
import { validateProposal } from "../lib/mentor/validate";
import { validateQuestions } from "../lib/validate";
import { buildCodingAnalysis, buildCodingPacket, isCodingAnalysis, isLeetCodeStore, validateCodingReview, type CodingPacket, type CodingReview } from "../lib/leetcode-history";
import type { Resource } from "../lib/resources";
import { DOMAINS, type Question, type TopicMeta } from "../lib/types";

const root = path.resolve(import.meta.dirname, "..");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function need(name: string): string {
  const v = arg(name);
  if (!v) throw new Error(`--${name} is required`);
  return v;
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const readJsonIf = <T>(file: string): T | null => (fs.existsSync(file) ? readJson<T>(file) : null);
function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
}
function jsonDir<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().flatMap((f) => {
    try {
      return [readJson<T>(path.join(dir, f))];
    } catch {
      // One damaged file shouldn't cost a night's analysis. It stays in place, unprocessed.
      console.error(`Skipped unreadable file: ${f}`);
      return [];
    }
  });
}

function loadContent(): { questions: Question[]; topics: TopicMeta[]; resources: Resource[] } {
  const raw = DOMAINS.flatMap((d) => readJson<unknown[]>(path.join(root, "content/questions", `${d}.json`)));
  const { questions, errors } = validateQuestions(raw);
  if (errors.length > 0) throw new Error(`Invalid content:\n${errors.join("\n")}`);
  const topics = DOMAINS.flatMap((domain) => {
    const dir = path.join(root, "content/lessons", domain);
    return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => {
      const { data } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
      return { domain, topic: f.replace(/\.md$/, ""), title: String(data.title), summary: String(data.summary) };
    });
  });
  return { questions, topics, resources: readJson<Resource[]>(path.join(root, "content/resources/registry.json")) };
}

function loadEvidence(dataDir: string): EvidenceItem[] {
  const dir = path.join(dataDir, "mentor/evidence");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().flatMap((f) =>
    fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as EvidenceItem),
  );
}

function loadState(dataDir: string): LearnerState | null {
  const current = readJsonIf<CurrentPointer>(path.join(dataDir, "mentor/current.json"));
  return current ? readJson<LearnerState>(path.join(dataDir, current.stateFile)) : null;
}

const processedFile = (dataDir: string) => path.join(dataDir, "mentor/processed.json");
const loadProcessed = (dataDir: string) => readJsonIf<{ keys: string[] }>(processedFile(dataDir))?.keys ?? [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** The routine may only ever change mentor/ in the data repo, and nothing in the app repo. */
function assertScope(dataDir: string) {
  const app = git(root, "status", "--porcelain").trim();
  if (app) throw new Error(`The app repo was modified, which the routine must never do:\n${app}`);
  const outside = git(dataDir, "status", "--porcelain").split("\n").filter(Boolean).filter((l) => !l.slice(3).replaceAll('"', "").startsWith("mentor/"));
  if (outside.length > 0) throw new Error(`Changes outside mentor/ in the data repo:\n${outside.join("\n")}`);
}

function publish(dataDir: string, message: string) {
  assertScope(dataDir);
  git(dataDir, "add", "--", "mentor");
  git(dataDir, "commit", "-qm", message);
  for (let attempt = 1; ; attempt++) {
    try {
      // The browser syncs to the same branch, but never to the files written here.
      git(dataDir, "pull", "--rebase", "-q", "origin", "main");
      git(dataDir, "push", "-q", "origin", "HEAD:main");
      return;
    } catch (err) {
      if (attempt >= 4) throw err;
      execFileSync(process.execPath, ["-e", `setTimeout(()=>{},${attempt * 5000})`]);
    }
  }
}

function saveRun(dataDir: string, run: RunRecord, state: LearnerState | null, evidence: EvidenceItem[]): MentorStatus {
  writeJson(path.join(dataDir, `mentor/runs/${run.runId}.json`), run);
  const status = computeStatus(jsonDir<RunRecord>(path.join(dataDir, "mentor/runs")), readJsonIf<MentorStatus>(path.join(dataDir, "mentor/status.json")));
  writeJson(path.join(dataDir, "mentor/status.json"), status);
  fs.mkdirSync(path.join(dataDir, "mentor/reports"), { recursive: true });
  fs.writeFileSync(path.join(dataDir, `mentor/reports/${run.forDate}.md`), renderReport(run, status, state, evidence));
  return status;
}

function makeRun(packet: MentorPacket, status: RunStatus, extra: Partial<RunRecord> = {}): RunRecord {
  const finished = new Date();
  return {
    schema: MENTOR_SCHEMA,
    runId: runIdOf(packet, finished),
    forDate: packet.forDate,
    trigger: packet.trigger,
    startedAt: packet.startedAt,
    finishedAt: finished.toISOString(),
    status,
    inputHash: packet.inputHash,
    promptVersion: MENTOR_PROMPT_VERSION,
    newInteractions: countsOf(packet),
    stateVersion: null,
    levelChanges: [],
    checks: [],
    errors: [],
    ...extra,
  };
}

function collect() {
  const dataDir = need("data");
  const content = loadContent();
  const progressFile = path.join(dataDir, "progress.json");
  // Merging with an empty copy replays answers, so review state is rebuilt even when the file lacks it.
  const progress = fs.existsSync(progressFile) ? mergeProgress(normalizeProgress(readJson(progressFile)), emptyProgress()) : emptyProgress();
  const packet = buildPacket({
    now: new Date(),
    progress,
    ...content,
    submissions: jsonDir<Submission>(path.join(dataDir, "mentor/submissions")).filter((s) => typeof s?.id === "string" && typeof s.answer === "string" && Array.isArray(s.skillIds)),
    conversations: jsonDir<Conversation>(path.join(dataDir, "mentor/conversations")).filter((c) => typeof c?.id === "string" && typeof c.updatedAt === "string" && Array.isArray(c.turns)),
    processed: new Set(loadProcessed(dataDir)),
    previousState: loadState(dataDir),
    evidence: loadEvidence(dataDir),
    status: readJsonIf<MentorStatus>(path.join(dataDir, "mentor/status.json")),
  });
  writeJson(need("out"), packet);
  console.log(JSON.stringify({ decision: packet.decision, forDate: packet.forDate, trigger: packet.trigger, newInteractions: countsOf(packet) }));
}

function commit() {
  const dataDir = need("data");
  const packet = readJson<MentorPacket>(need("packet"));
  if (packet.decision !== "analyse" && packet.decision !== "bootstrap") throw new Error(`Nothing to commit for decision "${packet.decision}"`);
  const proposal = readJson<unknown>(need("proposal"));
  const history = loadEvidence(dataDir);
  const { resources } = loadContent();
  const { errors, checks, evidence } = validateProposal(proposal, {
    packet,
    previous: packet.previousState,
    history,
    resourceIds: new Set(resources.map((r) => r.id)),
  });
  if (errors.length > 0) {
    console.error(`Proposal rejected. Nothing was written.\n${errors.map((e) => `- ${e}`).join("\n")}`);
    process.exit(2);
  }

  const run = makeRun(packet, packet.decision === "bootstrap" ? "bootstrapped" : "analysed", { checks });
  const state = buildState(proposal as Parameters<typeof buildState>[0], packet, run.runId, run.finishedAt);
  run.stateVersion = state.version;
  run.levelChanges = state.levelChanges;

  // Append only: earlier evidence is never rewritten.
  for (const e of evidence) {
    const file = path.join(dataDir, `mentor/evidence/${e.forDate.slice(0, 7)}.jsonl`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(e)}\n`);
  }
  writeJson(path.join(dataDir, `mentor/states/${state.forDate}.json`), state);
  writeJson(processedFile(dataDir), { keys: [...new Set([...loadProcessed(dataDir), ...packet.processedKeys])] });
  const status = saveRun(dataDir, run, state, evidence);
  writeJson(path.join(dataDir, "mentor/current.json"), pointerFor(state));
  publish(dataDir, `mentor: ${run.status} ${run.forDate} (state v${state.version})`);
  console.log(JSON.stringify({ status: run.status, stateVersion: state.version, evidence: evidence.length, levelChanges: state.levelChanges.length, nights: status.consecutiveNights }));
}

/** No new work: say so and keep the plan. Nothing about the learner changes. */
function carry() {
  const dataDir = need("data");
  const packet = readJson<MentorPacket>(need("packet"));
  if (packet.decision !== "no-new-evidence") throw new Error(`Can't carry the plan forward for decision "${packet.decision}"`);
  const run = makeRun(packet, "no-new-evidence", { checks: ["No new interactions, so no learner data changed"] });
  const status = saveRun(dataDir, run, null, []);
  publish(dataDir, `mentor: no new evidence ${run.forDate}`);
  console.log(JSON.stringify({ status: run.status, nights: status.consecutiveNights }));
}

/** Records a failed night. The learner state and its pointer aren't touched, so the last valid plan stays live. */
function fail() {
  const dataDir = need("data");
  const now = new Date();
  // The failure may have happened before a packet existed.
  const packet = readJsonIf<MentorPacket>(need("packet")) ?? ({
    forDate: forDateOf(now),
    trigger: triggerOf(now),
    startedAt: now.toISOString(),
    inputHash: "",
    newInteractions: {},
  } as unknown as MentorPacket);
  const run = makeRun(packet, "failed", { errors: [need("reason")] });
  saveRun(dataDir, run, null, []);
  publish(dataDir, `mentor: failed ${run.forDate}`);
  console.log(JSON.stringify({ status: "failed", reason: run.errors[0] }));
}

/** Tonight's LeetCode work for review. leetcode/ is written by the data repo's nightly pull and only read here. */
function codingCollect() {
  const dataDir = need("data");
  const store = readJsonIf<unknown>(path.join(dataDir, "leetcode/submissions.json"));
  if (!isLeetCodeStore(store)) throw new Error("leetcode/submissions.json is missing or damaged");
  const previous = readJsonIf<unknown>(path.join(dataDir, "mentor/coding.json"));
  const packet = buildCodingPacket(store.submissions, isCodingAnalysis(previous) ? previous : null, forDateOf(new Date()));
  writeJson(need("out"), packet);
  console.log(JSON.stringify({ decision: packet.decision, forDate: packet.forDate, unreviewed: packet.unreviewedCount, included: packet.newSubmissions.length }));
}

function codingCommit() {
  const dataDir = need("data");
  const packet = readJson<CodingPacket>(need("packet"));
  const review = readJson<unknown>(need("proposal"));
  const errors = validateCodingReview(review, packet);
  if (errors.length > 0) {
    console.error(`Review rejected. Nothing was written.\n${errors.map((e) => `- ${e}`).join("\n")}`);
    process.exit(2);
  }
  writeJson(path.join(dataDir, "mentor/coding.json"), buildCodingAnalysis(review as CodingReview, packet, new Date().toISOString()));
  publish(dataDir, `mentor: coding review ${packet.forDate}`);
  console.log(JSON.stringify({ status: "reviewed", forDate: packet.forDate }));
}

const commands: Record<string, () => void> = { collect, commit, carry, fail, "coding-collect": codingCollect, "coding-commit": codingCommit };
const command = commands[process.argv[2] ?? ""];
if (!command) {
  console.error(`Unknown command. Use one of: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}
command();
