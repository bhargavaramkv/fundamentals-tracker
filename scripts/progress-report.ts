/**
 * Daily-routine analysis: reads a progress.json export and the repo's content,
 * then prints a Markdown report (or JSON with --json) describing activity,
 * recurring failures and which topics need better lessons or more questions.
 *
 * Usage: npm run report -- --data ../fundamentals-tracker-data/progress.json [--json] [--now ISO] [--since ISO]
 *        npm run report -- --data … --since ISO --check   # one line of JSON: is there anything new to analyse?
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { computeActivity } from "../lib/activity";
import { emptyProgress, latestActivityAt, mergeProgress, normalizeProgress } from "../lib/progress";
import { recommend } from "../lib/recommend";
import { DOMAINS, DOMAIN_LABELS, type ProgressData, type Question, type TopicMeta } from "../lib/types";
import { validateQuestions } from "../lib/validate";

const DAY_MS = 24 * 60 * 60 * 1000;
const root = path.resolve(import.meta.dirname, "..");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadContent(): { questions: Question[]; topics: TopicMeta[] } {
  const raw = DOMAINS.flatMap((d) => JSON.parse(fs.readFileSync(path.join(root, "content/questions", `${d}.json`), "utf8")) as unknown[]);
  const { questions, errors } = validateQuestions(raw);
  if (errors.length) throw new Error(`Invalid content:\n${errors.join("\n")}`);
  const topics = DOMAINS.flatMap((domain) => {
    const dir = path.join(root, "content/lessons", domain);
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const { data } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
        return { domain, topic: f.replace(/\.md$/, ""), title: String(data.title), summary: String(data.summary) };
      });
  });
  return { questions, topics };
}

function loadProgress(file: string | undefined): ProgressData {
  if (!file || !fs.existsSync(file)) return emptyProgress();
  // Merging with an empty copy replays answers, so review state is rebuilt even if the file lacks it.
  return mergeProgress(normalizeProgress(JSON.parse(fs.readFileSync(file, "utf8"))), emptyProgress());
}

export function buildReport(data: ProgressData, questions: Question[], topics: TopicMeta[], now: Date, since: string | null = null) {
  const nowMs = now.getTime();
  const latest = latestActivityAt(data);
  const titleOf = (domain: string, topic: string) => topics.find((t) => t.domain === domain && t.topic === topic)?.title ?? topic;
  const readsLast24h = data.reads.filter((r) => nowMs - Date.parse(r.openedAt) <= DAY_MS);
  const newAnswers = since ? data.answers.filter((a) => a.answeredAt > since) : data.answers;
  const newReads = since ? data.reads.filter((r) => r.openedAt > since) : data.reads;
  const newSessions = since ? data.sessions.filter((x) => x.finishedAt > since) : data.sessions;
  const activity = computeActivity(data.answers, now);
  const last24h = data.answers.filter((a) => nowMs - Date.parse(a.answeredAt) <= DAY_MS);
  const rec = recommend(data, questions, topics, nowMs);
  const byId = new Map(questions.map((q) => [q.id, q]));

  // Questions missed 2+ times are the strongest signal that a lesson or explanation isn't landing.
  const missCounts = new Map<string, number>();
  for (const a of data.answers) if (!a.correct) missCounts.set(a.questionId, (missCounts.get(a.questionId) ?? 0) + 1);
  const repeatedMisses = [...missCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id, misses]) => {
      const q = byId.get(id);
      const wrongPicks = data.answers.filter((a) => a.questionId === id && !a.correct).map((a) => q?.options[a.selected] ?? "?");
      return { id, misses, topic: q ? `${q.domain}/${q.topic}` : "unknown", prompt: q?.prompt ?? "(question removed)", wrongPicks };
    });

  const weakTopics = rec.profile.weakTopics.map((t) => ({
    key: `${t.domain}/${t.topic}`,
    score: t.score,
    attempts: t.attempts,
    recentMisses: t.recentMisses,
    questionsAvailable: questions.filter((q) => q.domain === t.domain && q.topic === t.topic).length,
  }));

  return {
    generatedAt: now.toISOString(),
    totals: { answers: data.answers.length, sessions: data.sessions.length },
    activity: { ...activity, practicedLast24h: last24h.length > 0, answersLast24h: last24h.length },
    nudge: activity.daysSinceActive === null || activity.daysSinceActive >= 2,
    domains: rec.profile.domains.map((d) => ({ domain: d.domain, score: d.score, attempts: d.attempts, confidence: d.confidence })),
    weakTopics,
    repeatedMisses,
    untestedTopics: rec.focus.filter((f) => f.reason === "untested").map((f) => `${f.meta.domain}/${f.meta.topic}`),
    reviewsDue: rec.dueQuestionIds.length,
    reading: {
      last24h: readsLast24h.length,
      topicsLast24h: [...new Set(readsLast24h.map((r) => `${r.domain}/${r.topic}`))],
    },
    latestActivityAt: latest,
    since,
    newActivity: latest !== null && (since === null || latest > since),
    sinceLastAnalysis: {
      answers: newAnswers.length,
      correct: newAnswers.filter((a) => a.correct).length,
      sessions: newSessions.map((x) => ({ mode: x.mode, total: x.total, correct: x.correct, finishedAt: x.finishedAt })),
      reads: newReads.map((r) => ({ topic: `${r.domain}/${r.topic}`, title: titleOf(r.domain, r.topic), minutes: Math.round(r.durationMs / 6000) / 10 })),
      topicsPracticed: [...new Set(newAnswers.map((a) => `${a.domain}/${a.topic}`))],
    },
  };
}

type Report = ReturnType<typeof buildReport>;

function toMarkdown(r: Report): string {
  const lines: string[] = [];
  lines.push(`## Progress report · ${r.generatedAt.slice(0, 10)}`, "");
  if (r.totals.answers === 0) {
    lines.push("No progress data yet (no synced answers).", "");
  }
  lines.push(
    `- Practiced in last 24h: **${r.activity.practicedLast24h ? `yes (${r.activity.answersLast24h} answers)` : "no"}**`,
    `- Last active: ${r.activity.lastActive ?? "never"} · streak ${r.activity.streak} day(s)`,
    `- Totals: ${r.totals.answers} answers in ${r.totals.sessions} sessions · ${r.reviewsDue} reviews due`,
    `- Reading in last 24h: ${r.reading.last24h ? `${r.reading.last24h} lesson(s): ${r.reading.topicsLast24h.join(", ")}` : "none"}`,
    "",
  );
  if (r.nudge) {
    lines.push(
      `> **Nudge:** ${r.activity.daysSinceActive === null ? "You haven't started yet" : `It's been ${r.activity.daysSinceActive} days since your last practice`}. One 10-question adaptive round takes about 8 minutes.`,
      "",
    );
  }
  lines.push("| Domain | Score | Answers | Confidence |", "|---|---|---|---|");
  for (const d of r.domains) lines.push(`| ${DOMAIN_LABELS[d.domain]} | ${d.attempts ? `${d.score}%` : "–"} | ${d.attempts} | ${d.confidence} |`);
  lines.push("");
  lines.push("### Weak topics");
  if (r.weakTopics.length === 0) lines.push("None detected.");
  for (const t of r.weakTopics) {
    lines.push(`- \`${t.key}\`: ${t.score}% over ${t.attempts} answers, ${t.recentMisses} misses in the last 5, ${t.questionsAvailable} questions in the bank`);
  }
  lines.push("", "### Repeatedly missed questions");
  if (r.repeatedMisses.length === 0) lines.push("None.");
  for (const m of r.repeatedMisses) {
    lines.push(`- \`${m.id}\` (${m.topic}), missed ${m.misses}×: ${m.prompt}`, `  - wrong picks: ${m.wrongPicks.map((w) => `"${w}"`).join(", ")}`);
  }
  if (r.untestedTopics.length) lines.push("", `### Untested topics`, r.untestedTopics.map((t) => `\`${t}\``).join(", "));
  if (r.since) {
    const s = r.sinceLastAnalysis;
    lines.push("", `### New since last analysis (${r.since})`);
    if (!r.newActivity) lines.push("Nothing new.");
    else {
      lines.push(`- ${s.answers} answers (${s.correct} correct) in ${s.sessions.length} session(s); topics: ${s.topicsPracticed.join(", ") || "none"}`);
      for (const rd of s.reads) lines.push(`- read \`${rd.topic}\` (${rd.title}) for ${rd.minutes} min`);
    }
  }
  return lines.join("\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMain) {
  const { questions, topics } = loadContent();
  const data = loadProgress(arg("data"));
  const now = arg("now") ? new Date(arg("now") as string) : new Date();
  const report = buildReport(data, questions, topics, now, arg("since") ?? null);
  if (process.argv.includes("--check")) {
    // Cheap gate for the hourly check: one line, no analysis needed to read it.
    const { newActivity, latestActivityAt: latest, since } = report;
    process.stdout.write(JSON.stringify({ newActivity, latestActivityAt: latest, since, nudge: report.nudge }) + "\n");
  } else {
    process.stdout.write(process.argv.includes("--json") ? JSON.stringify(report, null, 2) + "\n" : toMarkdown(report) + "\n");
  }
}
