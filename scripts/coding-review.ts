/**
 * The nightly LeetCode review's deterministic steps, run by the Claude Code routine (docs/coding-routine.md).
 *
 *   npm run --silent coding-review -- collect --data <data repo> --out <packet.json>
 *   npm run --silent coding-review -- commit  --data <data repo> --packet <packet.json> --proposal <review.json>
 *
 * commit writes only mentor/coding.json (the path is kept so existing data still loads) and publishes with one git
 * commit. Exit code 2 means the review was rejected and nothing changed.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildCodingAnalysis, buildCodingPacket, isCodingAnalysis, isLeetCodeStore, validateCodingReview, type CodingPacket, type CodingReview } from "../lib/leetcode-history";

const root = path.resolve(import.meta.dirname, "..");
const OUTPUT = "mentor/coding.json";

function need(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`--${name} is required`);
  return v;
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const readJsonIf = <T>(file: string): T | null => (fs.existsSync(file) ? readJson<T>(file) : null);
function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
}

/** Today's date in the owner's time zone (India). */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** The routine may only ever change the review file in the data repo, and nothing in the app repo. */
function publish(dataDir: string, message: string) {
  const app = git(root, "status", "--porcelain").trim();
  if (app) throw new Error(`The app repo was modified, which the routine must never do:\n${app}`);
  const outside = git(dataDir, "status", "--porcelain").split("\n").filter(Boolean).filter((l) => l.slice(3).replaceAll('"', "") !== OUTPUT);
  if (outside.length > 0) throw new Error(`Changes outside ${OUTPUT} in the data repo:\n${outside.join("\n")}`);
  git(dataDir, "add", "--", OUTPUT);
  git(dataDir, "commit", "-qm", message);
  for (let attempt = 1; ; attempt++) {
    try {
      // The browser syncs to the same branch, but never to this file.
      git(dataDir, "pull", "--rebase", "-q", "origin", "main");
      git(dataDir, "push", "-q", "origin", "HEAD:main");
      return;
    } catch (err) {
      if (attempt >= 4) throw err;
      execFileSync(process.execPath, ["-e", `setTimeout(()=>{},${attempt * 5000})`]);
    }
  }
}

/** Tonight's LeetCode work for review. leetcode/ is written by the data repo's nightly pull and only read here. */
function collect() {
  const dataDir = need("data");
  const store = readJsonIf<unknown>(path.join(dataDir, "leetcode/submissions.json"));
  if (!isLeetCodeStore(store)) throw new Error("leetcode/submissions.json is missing or damaged");
  const previous = readJsonIf<unknown>(path.join(dataDir, OUTPUT));
  const packet = buildCodingPacket(store.submissions, isCodingAnalysis(previous) ? previous : null, today());
  writeJson(need("out"), packet);
  console.log(JSON.stringify({ decision: packet.decision, forDate: packet.forDate, unreviewed: packet.unreviewedCount, included: packet.newSubmissions.length }));
}

function commit() {
  const dataDir = need("data");
  const packet = readJson<CodingPacket>(need("packet"));
  const review = readJson<unknown>(need("proposal"));
  const errors = validateCodingReview(review, packet);
  if (errors.length > 0) {
    console.error(`Review rejected. Nothing was written.\n${errors.map((e) => `- ${e}`).join("\n")}`);
    process.exit(2);
  }
  writeJson(path.join(dataDir, OUTPUT), buildCodingAnalysis(review as CodingReview, packet, new Date().toISOString()));
  publish(dataDir, `coding review ${packet.forDate}`);
  console.log(JSON.stringify({ status: "reviewed", forDate: packet.forDate }));
}

const commands: Record<string, () => void> = { collect, commit };
const command = commands[process.argv[2] ?? ""];
if (!command) {
  console.error(`Unknown command. Use one of: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}
command();
