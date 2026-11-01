import { createHash } from "node:crypto";
import { activeProgress, CONTENT_EPOCH, latestActivityAt } from "../progress";
import { buildProfile } from "../profile";
import { dueReviews } from "../srs";
import type { ProgressData, Question, TopicMeta } from "../types";
import type { Resource } from "../resources";
import { forDateOf, triggerOf } from "./time";
import {
  MENTOR_PROMPT_VERSION,
  MENTOR_SCHEMA,
  type Conversation,
  type EvidenceItem,
  type LearnerState,
  type MentorPacket,
  type MentorStatus,
  type NewInteractions,
  type PacketDecision,
  type Submission,
} from "./types";

/** Skills beyond the 20 lesson topics: the stack the owner actually works in. */
export const EXTRA_SKILLS = [
  { id: "stack/csharp-dotnet", title: "C# and .NET" },
  { id: "stack/angular", title: "Angular" },
  { id: "stack/typescript", title: "TypeScript" },
  { id: "stack/mongodb", title: "MongoDB" },
  { id: "stack/kubernetes", title: "Kubernetes" },
  { id: "stack/azure", title: "Azure" },
  { id: "practice/debugging", title: "Debugging" },
  { id: "practice/code-review", title: "Code review" },
  { id: "practice/testing", title: "Testing" },
];

export interface PacketInput {
  now: Date;
  progress: ProgressData;
  questions: Question[];
  topics: TopicMeta[];
  resources: Resource[];
  submissions: Submission[];
  conversations: Conversation[];
  processed: ReadonlySet<string>;
  previousState: LearnerState | null;
  evidence: EvidenceItem[];
  status: MentorStatus | null;
  /** Options as they stood when an answer was given, for answers older than a question rewrite. */
  pickedText?: (a: ProgressData["answers"][number]) => string | null;
}

const keyOf = (x: { domain: string; topic: string }) => `${x.domain}/${x.topic}`;
const convKey = (c: Conversation) => `conversation:${c.id}@${c.updatedAt}`;

export function buildPacket(input: PacketInput): MentorPacket {
  const { now, progress, questions, topics, resources, processed, previousState, evidence, status } = input;
  const active = activeProgress(progress);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const isNew = (k: string) => !processed.has(k);

  const newAnswers = active.answers.filter((a) => isNew(`answer:${a.id}`));
  const newActivities = active.activities.filter((a) => a.kind !== "resource" && isNew(`activity:${a.id}`));
  const newResourceVisits = active.activities.filter((a) => a.kind === "resource" && isNew(`activity:${a.id}`));
  const newAttempts = active.codingAttempts.filter((a) => isNew(`coding:${a.id}`));
  const newReads = active.reads.filter((r) => isNew(`read:${r.id}`));
  const newSubmissions = input.submissions.filter((s) => isNew(`submission:${s.id}`));
  const newConversations = input.conversations.filter((c) => isNew(convKey(c)) && c.turns.some((t) => t.role === "learner"));

  const newInteractions: NewInteractions = {
    answers: newAnswers.map((a) => {
      const q = byId.get(a.questionId);
      return {
        id: a.id,
        sessionId: a.sessionId,
        mode: a.mode,
        questionId: a.questionId,
        skillId: keyOf(a),
        difficulty: a.difficulty,
        correct: a.correct,
        prompt: q?.prompt ?? null,
        picked: a.selectedText ?? input.pickedText?.(a) ?? null,
        correctOption: q ? (q.options[q.answer] ?? null) : null,
        timeMs: a.timeMs,
        answeredAt: a.answeredAt,
      };
    }),
    activities: newActivities.map((a) => ({
      id: a.id,
      kind: a.kind,
      skillId: keyOf(a),
      refId: a.refId,
      ...("rating" in a ? { rating: a.rating } : {}),
      ...("note" in a && a.note ? { note: a.note } : {}),
      at: a.at,
    })),
    coding: newAttempts.map((a) => {
      const p = active.codingProblems.find((x) => x.id === a.problemId);
      return {
        id: a.id,
        problemId: a.problemId,
        title: p?.title ?? null,
        difficulty: p?.difficulty ?? null,
        patterns: p?.patterns ?? [],
        problemNotes: p?.notes ?? null,
        outcome: a.outcome,
        ...(a.minutes !== undefined ? { minutes: a.minutes } : {}),
        ...(a.notes ? { notes: a.notes } : {}),
        at: a.at,
      };
    }),
    reads: newReads.map((r) => ({ id: r.id, skillId: keyOf(r), openedAt: r.openedAt, durationMs: r.durationMs })),
    submissions: newSubmissions,
    conversations: newConversations,
  };

  const processedKeys = [
    ...newAnswers.map((a) => `answer:${a.id}`),
    ...newActivities.map((a) => `activity:${a.id}`),
    ...newResourceVisits.map((a) => `activity:${a.id}`),
    ...newAttempts.map((a) => `coding:${a.id}`),
    ...newReads.map((r) => `read:${r.id}`),
    ...newSubmissions.map((s) => `submission:${s.id}`),
    ...newConversations.map(convKey),
  ];

  const forDate = forDateOf(now);
  const inputHash = createHash("sha256")
    .update(JSON.stringify({ v: MENTOR_PROMPT_VERSION, forDate, state: previousState?.version ?? 0, keys: [...processedKeys].sort() }))
    .digest("hex");

  const hasNew = Object.values(newInteractions).some((l) => (l as unknown[]).length > 0);
  const decision: PacketDecision =
    status?.lastSuccessForDate === forDate ? "already-done" : !previousState ? "bootstrap" : hasNew ? "analyse" : "no-new-evidence";

  // Facts from the existing engines.
  const profile = buildProfile(active.answers, topics, now.getTime());
  const misses = new Map<string, { n: number; picks: string[]; skillId: string }>();
  for (const a of active.answers) {
    if (a.correct) continue;
    const m = misses.get(a.questionId) ?? { n: 0, picks: [], skillId: keyOf(a) };
    m.n++;
    if (a.selectedText) m.picks.push(a.selectedText);
    misses.set(a.questionId, m);
  }
  const retrievedSkills = new Set([...active.answers.map(keyOf), ...active.activities.filter((a) => a.kind !== "resource").map(keyOf)]);
  const last = latestActivityAt(active);

  const touched = new Set([
    ...newInteractions.answers.map((a) => a.skillId),
    ...newInteractions.activities.map((a) => a.skillId),
    ...newInteractions.reads.map((a) => a.skillId),
    ...newInteractions.submissions.flatMap((s) => s.skillIds),
    ...(previousState ? [previousState.plan.primary, ...previousState.plan.supporting].flatMap((a) => a.skillIds) : []),
  ]);

  const archived = progress.answers.filter((a) => a.answeredAt < CONTENT_EPOCH);
  const missedByTopic: Record<string, number> = {};
  for (const a of archived) if (!a.correct) missedByTopic[keyOf(a)] = (missedByTopic[keyOf(a)] ?? 0) + 1;

  return {
    schema: MENTOR_SCHEMA,
    promptVersion: MENTOR_PROMPT_VERSION,
    forDate,
    trigger: triggerOf(now),
    startedAt: now.toISOString(),
    decision,
    inputHash,
    newInteractions,
    previousState,
    relevantEvidence: evidence.filter((e) => touched.has(e.skillId)),
    facts: {
      weakTopics: profile.weakTopics.map((t) => ({ skillId: keyOf(t), attempts: t.attempts, correct: t.correct, score: t.score })),
      repeatedMisses: [...misses.entries()].filter(([, m]) => m.n >= 2).map(([questionId, m]) => ({ questionId, skillId: m.skillId, misses: m.n, picks: m.picks })),
      fastAnswers: newAnswers.filter((a) => a.timeMs < 5000).map((a) => ({ id: a.id, questionId: a.questionId, timeMs: a.timeMs, correct: a.correct })),
      dueQuestionIds: dueReviews(active.reviews, now.getTime()).map((r) => r.questionId),
      readsWithoutRetrieval: [...new Set(active.reads.map(keyOf))].filter((k) => !retrievedSkills.has(k)),
      daysSinceLastInteraction: last ? Math.floor((now.getTime() - Date.parse(last)) / 86_400_000) : null,
    },
    archived: { count: archived.length, missedByTopic },
    skillCatalogue: [...topics.map((t) => ({ id: keyOf(t), title: t.title })), ...EXTRA_SKILLS],
    resources: resources.map((r) => ({ id: r.id, title: r.title, publisher: r.publisher, tier: r.tier, topics: r.topics })),
    processedKeys,
  };
}
