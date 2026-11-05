import { activeProgress } from "../progress";
import { DATA_REPO } from "../storage";
import type { ProgressData } from "../types";
import { daysBetween, forDateOf } from "./time";
import type { CurrentPointer, LearnerState, MentorActivity, MentorStatus, Submission } from "./types";

/** Reads what the nightly routine published, using the existing sync token. Nothing here needs Claude or an API key. */
const contentsUrl = (p: string) => `https://api.github.com/repos/${DATA_REPO.owner}/${DATA_REPO.repo}/contents/${p}`;

export async function readFile<T>(token: string, p: string): Promise<T | null> {
  const res = await fetch(`${contentsUrl(p)}?ref=${encodeURIComponent(DATA_REPO.branch)}`, {
    headers: { Accept: "application/vnd.github.raw+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
  return (await res.json()) as T;
}

/** Defends the page against a damaged file: the routine validates on write, this checks on read. */
export function isUsableState(s: unknown): s is LearnerState {
  const x = s as LearnerState | null;
  return !!x && typeof x.version === "number" && !!x.plan?.primary?.objective && Array.isArray(x.plan.supporting) && Array.isArray(x.plan.revision) && Array.isArray(x.profile?.skills) && Array.isArray(x.profile?.strengths) && Array.isArray(x.profile?.weaknesses) && Array.isArray(x.roadmap?.items) && Array.isArray(x.roadmap?.changes) && typeof x.analysis?.summary === "string";
}

export type MentorLoad =
  | { kind: "no-token" }
  | { kind: "error"; message: string }
  | { kind: "empty"; status: MentorStatus | null }
  | { kind: "ready"; state: LearnerState; status: MentorStatus | null };

export async function loadMentor(token: string | null): Promise<MentorLoad> {
  if (!token) return { kind: "no-token" };
  try {
    const [current, status] = await Promise.all([readFile<CurrentPointer>(token, "mentor/current.json"), readFile<MentorStatus>(token, "mentor/status.json")]);
    if (!current) return { kind: "empty", status };
    const state = await readFile<unknown>(token, current.stateFile);
    if (!isUsableState(state)) return { kind: "error", message: "The latest mentor state couldn't be read." };
    return { kind: "ready", state, status };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : "Couldn't reach GitHub" };
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Each submission is its own new file, so it can't conflict with anything else writing to the repo. */
export async function saveSubmission(token: string, s: Submission): Promise<void> {
  const res = await fetch(contentsUrl(`mentor/submissions/${s.id}.json`), {
    method: "PUT",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: JSON.stringify({ message: `submission: ${s.activityId}`, content: toBase64(`${JSON.stringify(s, null, 1)}\n`), branch: DATA_REPO.branch }),
  });
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
}

/**
 * Opens a Claude Code session on the data repo, signed in with the owner's own Claude account and billed to the
 * subscription. The session's behaviour comes from that repo's CLAUDE.md. The prompt is only prefilled: it's sent when
 * the owner presses enter on claude.ai.
 */
export function mentorSessionUrl(prompt: string): string {
  const q = new URLSearchParams({ prompt, repositories: `${DATA_REPO.owner}/${DATA_REPO.repo}` });
  return `https://claude.ai/code?${q.toString()}`;
}

export function activityPrompt(a: MentorActivity): string {
  return `Mentor session for today's activity ${a.id}: ${a.title}. Follow CLAUDE.md.`;
}

export const DIAGNOSTIC_PROMPT = "Mentor session: run my adaptive diagnostic. Follow CLAUDE.md.";
export const OPEN_PROMPT = "Mentor session: I want to discuss something. Follow CLAUDE.md, then ask me what's on my mind.";

export type Freshness = "fresh" | "carried" | "stale";

/**
 * How much the page can trust the plan. Stale means the mentor has been silent long enough to say so plainly.
 * A night with nothing new leaves the plan as it was, so the last successful run counts as well as the plan's own date.
 */
export function freshnessOf(state: LearnerState, now: Date, status?: MentorStatus | null): { kind: Freshness; ageDays: number } {
  const heardFrom = [state.plan.forDate, status?.lastSuccessForDate].filter((d): d is string => !!d).sort().at(-1) as string;
  const ageDays = daysBetween(heardFrom, forDateOf(now));
  return { kind: ageDays <= 0 ? "fresh" : ageDays <= 3 ? "carried" : "stale", ageDays };
}

/** Work done since the last analysis that tonight's run hasn't seen. Reading and resource visits aren't evidence, so they don't count. */
export function workSince(data: ProgressData, since: string): { answers: number; activities: number } {
  const active = activeProgress(data);
  return {
    answers: active.answers.filter((a) => a.answeredAt > since).length,
    activities: active.activities.filter((a) => a.kind !== "resource" && a.at > since).length,
  };
}

/** Today's run didn't report in. A quota limit or outage leaves no session behind, so this is all anyone can know. */
export function missedTonight(status: MentorStatus | null, now: Date): boolean {
  if (!status?.lastRunForDate) return false;
  const local = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(now);
  return status.lastRunForDate < forDateOf(now) && Number(local) >= 6;
}
