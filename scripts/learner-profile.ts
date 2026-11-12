/**
 * The learner profile's deterministic steps, run by the daily routine (docs/daily-routine.md).
 *
 *   npm run --silent learner -- show   --data <data repo>
 *   npm run --silent learner -- commit --data <data repo> --proposal <profile.json>
 *
 * commit writes only learner/profile.json and publishes with one git commit. Exit code 2 means the profile was
 * rejected and nothing changed.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { validateLearnerProfile } from "../lib/learner";

const root = path.resolve(import.meta.dirname, "..");
const OUTPUT = "learner/profile.json";

function need(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`--${name} is required`);
  return v;
}

function lessonKeys(): Set<string> {
  const dir = path.join(root, "content/lessons");
  const keys = new Set<string>();
  for (const domain of fs.readdirSync(dir)) {
    for (const f of fs.readdirSync(path.join(dir, domain))) if (f.endsWith(".md")) keys.add(`${domain}/${f.slice(0, -3)}`);
  }
  return keys;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** The routine may only ever change the profile file in the data repo, and nothing in the app repo. */
function publish(dataDir: string, message: string) {
  const app = git(root, "status", "--porcelain").trim();
  if (app) throw new Error(`The app repo was modified, which the routine must never do:\n${app}`);
  const outside = git(dataDir, "status", "--porcelain").split("\n").filter(Boolean).filter((l) => l.slice(3).replaceAll('"', "") !== OUTPUT);
  if (outside.length > 0) throw new Error(`Changes outside ${OUTPUT} in the data repo:\n${outside.join("\n")}`);
  git(dataDir, "add", "--", OUTPUT);
  git(dataDir, "commit", "-qm", message);
  for (let attempt = 1; ; attempt++) {
    try {
      git(dataDir, "pull", "--rebase", "-q", "origin", "main");
      git(dataDir, "push", "-q", "origin", "HEAD:main");
      return;
    } catch (err) {
      if (attempt >= 4) throw err;
      execFileSync(process.execPath, ["-e", `setTimeout(()=>{},${attempt * 5000})`]);
    }
  }
}

function show() {
  const file = path.join(need("data"), OUTPUT);
  console.log(fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "null");
}

function commit() {
  const dataDir = need("data");
  const profile = JSON.parse(fs.readFileSync(need("proposal"), "utf8")) as unknown;
  const errors = validateLearnerProfile(profile, lessonKeys());
  if (errors.length > 0) {
    console.error(`Profile rejected. Nothing was written.\n${errors.map((e) => `- ${e}`).join("\n")}`);
    process.exit(2);
  }
  const file = path.join(dataDir, OUTPUT);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(profile, null, 1)}\n`);
  publish(dataDir, `learner profile ${new Date().toISOString().slice(0, 10)}`);
  console.log(JSON.stringify({ status: "updated" }));
}

const commands: Record<string, () => void> = { show, commit };
const command = commands[process.argv[2] ?? ""];
if (!command) {
  console.error(`Unknown command. Use one of: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}
command();
