import { addDays, daysBetween } from "./time";
import { levelChanges } from "./validate";
import {
  LEVEL_LABEL,
  MENTOR_SCHEMA,
  PRIMARY_AFTER_NIGHTS,
  type CurrentPointer,
  type EvidenceItem,
  type LearnerState,
  type MentorPacket,
  type MentorStatus,
  type Proposal,
  type RunRecord,
  type RunStatus,
} from "./types";

export function runIdOf(packet: MentorPacket, finishedAt: Date): string {
  return `${packet.forDate}-${finishedAt.toISOString().slice(11, 19).replaceAll(":", "")}`;
}

export function countsOf(packet: MentorPacket): Record<string, number> {
  return Object.fromEntries(Object.entries(packet.newInteractions).map(([k, v]) => [k, (v as unknown[]).length]));
}

export function buildState(proposal: Proposal, packet: MentorPacket, runId: string, generatedAt: string): LearnerState {
  const { evidence: _evidence, questions: _questions, ...rest } = proposal;
  void _evidence;
  void _questions;
  return {
    ...rest,
    version: (packet.previousState?.version ?? 0) + 1,
    generatedAt,
    runId,
    levelChanges: levelChanges(packet.previousState, proposal.profile),
    skillCatalogue: packet.skillCatalogue,
  };
}

export function pointerFor(state: LearnerState): CurrentPointer {
  return {
    schema: MENTOR_SCHEMA,
    stateFile: `mentor/states/${state.forDate}.json`,
    version: state.version,
    forDate: state.forDate,
    runId: state.runId,
    generatedAt: state.generatedAt,
  };
}

const SUCCESS: RunStatus[] = ["analysed", "bootstrapped", "no-new-evidence"];

/** Worked out from the whole run history, so it can't drift from what actually happened. */
export function computeStatus(runs: RunRecord[], previous: MentorStatus | null): MentorStatus {
  const sorted = [...runs].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const last = sorted.at(-1) ?? null;
  const successes = sorted.filter((r) => SUCCESS.includes(r.status));
  const lastSuccess = successes.at(-1) ?? null;
  const lastAnalysed = [...sorted].reverse().find((r) => r.status === "analysed" || r.status === "bootstrapped") ?? null;

  const scheduledByDate = new Map<string, RunRecord>();
  for (const r of successes) if (r.trigger === "scheduled") scheduledByDate.set(r.forDate, r);

  let consecutiveNights = 0;
  let analysedInStreak = 0;
  if (last) {
    for (let d = last.forDate; ; d = addDays(d, -1)) {
      const r = scheduledByDate.get(d);
      if (!r) break;
      consecutiveNights++;
      if (r.status === "analysed") analysedInStreak++;
    }
  }

  const missedDates: string[] = [];
  if (sorted.length > 0 && last) {
    const dates = new Set(sorted.map((r) => r.forDate));
    const first = sorted[0].forDate;
    for (let d = addDays(first, 1); daysBetween(d, last.forDate) > 0; d = addDays(d, 1)) if (!dates.has(d)) missedDates.push(d);
  }

  // Five nights in a row, at least one of which actually analysed work. Once passed, it stays passed.
  const primaryEligible = previous?.primaryEligible === true || (consecutiveNights >= PRIMARY_AFTER_NIGHTS && analysedInStreak >= 1);

  return {
    schema: MENTOR_SCHEMA,
    lastRunAt: last?.finishedAt ?? null,
    lastRunStatus: last?.status ?? null,
    lastRunForDate: last?.forDate ?? null,
    lastSuccessAt: lastSuccess?.finishedAt ?? null,
    lastSuccessForDate: lastSuccess?.forDate ?? null,
    lastAnalysedForDate: lastAnalysed?.forDate ?? null,
    consecutiveNights,
    analysedInStreak,
    missedDates,
    primaryEligible,
    primarySince: previous?.primarySince ?? (primaryEligible ? (last?.forDate ?? null) : null),
  };
}

const levelWord = (l: number | null) => (l === null ? "untested" : LEVEL_LABEL[l as keyof typeof LEVEL_LABEL]);

/** The night's validation report: mentor/reports/<forDate>.md. */
export function renderReport(run: RunRecord, status: MentorStatus, state: LearnerState | null, evidence: EvidenceItem[]): string {
  const lines = [
    `# Nightly mentor report: ${run.forDate}`,
    "",
    `- **Outcome:** ${run.status}`,
    `- **Trigger:** ${run.trigger}`,
    `- **Started:** ${run.startedAt}`,
    `- **Finished:** ${run.finishedAt}`,
    `- **Learner state:** ${run.stateVersion === null ? "unchanged" : `version ${run.stateVersion}`}`,
    `- **New interactions:** ${Object.entries(run.newInteractions).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `- **Nights in a row:** ${status.consecutiveNights} of ${PRIMARY_AFTER_NIGHTS} needed, ${status.analysedInStreak} with real analysis`,
    `- **Last success:** ${status.lastSuccessAt ?? "none yet"}`,
    `- **Nights with no run on record:** ${status.missedDates.length > 0 ? status.missedDates.join(", ") : "none"}`,
    "",
  ];
  if (run.errors.length > 0) {
    lines.push("## Why it failed", "", "The previous learner state was kept.", "", ...run.errors.map((e) => `- ${e}`), "");
  }
  if (run.checks.length > 0) {
    lines.push("## Checks passed", "", ...run.checks.map((c) => `- ${c}`), "");
  }
  if (run.levelChanges.length > 0) {
    lines.push("## Level changes", "", ...run.levelChanges.map((c) => `- ${c.skillId} ${c.dimension}: ${levelWord(c.from)} to ${levelWord(c.to)} (${c.evidenceIds.join(", ")})`), "");
  }
  if (state && run.stateVersion !== null) {
    lines.push("## Decision", "", state.analysis.summary, "", state.analysis.decisionRationale, "", `**Tomorrow's primary objective:** ${state.plan.primary.objective}`, "");
  }
  if (evidence.length > 0) {
    lines.push("## New evidence", "", ...evidence.map((e) => `- ${e.id}: ${e.skillId} ${e.dimension}, ${e.direction} (${e.strength}). ${e.note}`), "");
  }
  return lines.join("\n");
}
