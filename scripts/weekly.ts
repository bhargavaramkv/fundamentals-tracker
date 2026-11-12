/**
 * The weekly coaching routine's deterministic steps (docs/weekly-routine.md).
 *
 *   npm run --silent weekly -- context [YYYY-Www] --data <data repo>
 *   npm run --silent weekly -- commit  <report.json> [--replace] --data <data repo>
 *
 * commit writes only journal/weekly/<week>.json and publishes with one git commit. Exit code 2 means the report was
 * rejected (or differs from the existing one without --replace) and nothing changed.
 */
import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "../lib/journal/events";
import type { JournalSession } from "../lib/journal/types";
import { publish, need, positionals } from "../lib/data-publish";
import { loadSession, readJsonIf, writeJson } from "../lib/review/data";
import type { SessionReview } from "../lib/review/types";
import { addWeeks, previousCompleteWeek, sufficiencyFor, validateWeekly, weekStartMs, weeklyActivity, weeklyPath, type WeeklyReport } from "../lib/review/weekly";

const WEEK = /^\d{4}-W\d{2}$/;

function allSessions(dataDir: string): JournalSession[] {
  const root = path.join(dataDir, "journal/sessions");
  if (!fs.existsSync(root)) return [];
  const ids = fs.readdirSync(root).flatMap((y) => fs.readdirSync(path.join(root, y)).flatMap((m) => fs.readdirSync(path.join(root, y, m)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5))));
  return ids.sort().map((id) => loadSession(dataDir, id)).filter((s): s is JournalSession => !!s);
}

function allReviews(dataDir: string): SessionReview[] {
  const root = path.join(dataDir, "journal/reviews");
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .sort()
    .flatMap((sid) => fs.readdirSync(path.join(root, sid)).sort().map((f) => readJsonIf<SessionReview>(path.join(root, sid, f))))
    .filter((r): r is SessionReview => !!r && r.v === 1);
}

function context() {
  const dataDir = need("data");
  const nowMs = Date.now();
  const week = positionals()[0] ?? previousCompleteWeek(nowMs);
  if (!WEEK.test(week) || weekStartMs(week) === null) throw new Error(`Not an ISO week: ${week}`);
  const sessions = allSessions(dataDir);
  const reviews = allReviews(dataDir);
  const activity = weeklyActivity(sessions, reviews, week, nowMs);
  const weekSessionIds = new Set(
    sessions.filter((s) => weeklyActivity([s], [], week, nowMs).sessions === 1).map((s) => s.id),
  );
  const prev = readJsonIf<WeeklyReport>(path.join(dataDir, weeklyPath(addWeeks(week, -1))));
  console.log(
    JSON.stringify(
      {
        week,
        ...sufficiencyFor(sessions, week, nowMs),
        activity,
        reviews: reviews.filter((r) => weekSessionIds.has(r.sessionId)),
        sessions: sessions.filter((s) => weekSessionIds.has(s.id)).map((s) => ({ id: s.id, subject: s.subject, eventIds: s.events.map((e) => e.id) })),
        previousReport: prev,
      },
      null,
      1,
    ),
  );
}

function commit() {
  const dataDir = need("data");
  const [file] = positionals();
  if (!file) throw new Error("usage: commit <report.json> [--replace]");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { week?: unknown };
  const week = typeof raw.week === "string" ? raw.week : "";
  if (!WEEK.test(week) || weekStartMs(week) === null) {
    console.error("Report rejected. Nothing was written.\n- week: must be an ISO week like 2026-W46");
    process.exit(2);
  }
  const { errors, report } = validateWeekly(raw, { week, sessions: allSessions(dataDir), reviews: allReviews(dataDir), nowMs: Date.now() });
  if (!report) {
    console.error(`Report rejected. Nothing was written.\n${errors.map((e) => `- ${e}`).join("\n")}`);
    process.exit(2);
  }
  const rel = weeklyPath(week);
  const existing = readJsonIf<WeeklyReport>(path.join(dataDir, rel));
  const same = (a: WeeklyReport, b: WeeklyReport) => canonicalJson({ ...a, createdAt: "" }) === canonicalJson({ ...b, createdAt: "" });
  if (existing && same(existing, report)) {
    console.log(JSON.stringify({ status: "exists", path: rel }));
    return;
  }
  if (existing && !process.argv.includes("--replace")) {
    console.error(`A different report for ${week} already exists. Nothing was written. Use --replace to replace it.`);
    process.exit(2);
  }
  writeJson(path.join(dataDir, rel), report);
  publish(dataDir, [rel], `weekly report ${week}`);
  console.log(JSON.stringify({ status: existing ? "replaced" : "written", path: rel }));
}

const commands: Record<string, () => void> = { context, commit };
const command = commands[process.argv[2] ?? ""];
if (!command) {
  console.error(`Unknown command. Use one of: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}
command();
