import { execFileSync } from "node:child_process";
import path from "node:path";

/** Shared by the routine scripts. Same mechanism as scripts/learner-profile.ts and scripts/coding-review.ts. */

export const appRoot = path.resolve(import.meta.dirname, "..");

export function need(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`--${name} is required`);
  return v;
}

/** Positional arguments after the command: everything that is not a --flag or a flag's value. */
export function positionals(): string[] {
  const out: string[] = [];
  const args = process.argv.slice(3);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--data" || args[i] === "--out") i++;
    else if (!args[i].startsWith("--")) out.push(args[i]);
  }
  return out;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * Commits and pushes `files` (repo-relative) in the data repo. Refuses if the app repo has changes, or if the data
 * repo has changes outside `files`, so a routine can only ever publish what its script wrote.
 */
export function publish(dataDir: string, files: string[], message: string) {
  const app = git(appRoot, "status", "--porcelain").trim();
  if (app) throw new Error(`The app repo was modified, which the routine must never do:\n${app}`);
  const outside = git(dataDir, "status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean).filter((l) => !files.includes(l.slice(3).replaceAll('"', "")));
  if (outside.length > 0) throw new Error(`Changes outside ${files.join(", ")} in the data repo:\n${outside.join("\n")}`);
  git(dataDir, "add", "--", ...files);
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
