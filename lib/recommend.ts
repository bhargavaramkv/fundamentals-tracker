import { buildProfile, isWeak, WEAK_SCORE } from "./profile";
import { dueReviews } from "./srs";
import type { ProgressData, Question, SkillProfile, TopicMeta, TopicStat } from "./types";

/** weak: confirmed by 2+ answers; shaky: missed but too little evidence to be sure. */
export type FocusReason = "weak" | "reviews-due" | "shaky" | "untested";

export interface FocusTopic {
  meta: TopicMeta;
  reason: FocusReason;
  stat?: TopicStat;
  dueCount: number;
}

export interface Recommendations {
  profile: SkillProfile;
  focus: FocusTopic[];
  dueQuestionIds: string[];
}

const topicKey = (t: { domain: string; topic: string }) => `${t.domain}/${t.topic}`;

export function recommend(
  data: ProgressData,
  questions: Question[],
  topics: TopicMeta[],
  now: number = Date.now(),
): Recommendations {
  const profile = buildProfile(data.answers, topics, now);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const metaByKey = new Map(topics.map((t) => [topicKey(t), t]));

  const due = dueReviews(data.reviews, now).filter((r) => byId.has(r.questionId));
  const dueByTopic = new Map<string, number>();
  for (const r of due) {
    const key = topicKey(byId.get(r.questionId) as Question);
    dueByTopic.set(key, (dueByTopic.get(key) ?? 0) + 1);
  }

  const focus: FocusTopic[] = [];
  const used = new Set<string>();
  const push = (key: string, reason: FocusReason, stat?: TopicStat) => {
    const meta = metaByKey.get(key);
    if (!meta || used.has(key)) return;
    used.add(key);
    focus.push({ meta, reason, stat, dueCount: dueByTopic.get(key) ?? 0 });
  };

  for (const stat of profile.weakTopics) push(topicKey(stat), "weak", stat);
  for (const key of [...dueByTopic.keys()].sort((a, b) => (dueByTopic.get(b) ?? 0) - (dueByTopic.get(a) ?? 0))) {
    push(key, "reviews-due", profile.domains.flatMap((d) => d.topics).find((t) => topicKey(t) === key));
  }
  const allStats = profile.domains.flatMap((d) => d.topics);
  for (const t of allStats.filter((x) => x.attempts > 0 && !isWeak(x) && x.score < WEAK_SCORE).sort((a, b) => a.score - b.score)) {
    push(topicKey(t), "shaky", t);
  }
  for (const t of allStats) if (t.attempts === 0) push(topicKey(t), "untested", t);

  return { profile, focus, dueQuestionIds: due.map((r) => r.questionId) };
}

/** Last time each question was answered, and whether that answer was correct. */
function lastSeen(data: ProgressData): Map<string, { at: string; correct: boolean }> {
  const map = new Map<string, { at: string; correct: boolean }>();
  for (const a of data.answers) {
    const prev = map.get(a.questionId);
    if (!prev || a.answeredAt > prev.at) map.set(a.questionId, { at: a.answeredAt, correct: a.correct });
  }
  return map;
}

/**
 * Builds an adaptive practice set: due reviews first, then weak and shaky topics,
 * then topics never tested, then whatever was seen least recently.
 */
export function buildPracticeSet(
  data: ProgressData,
  questions: Question[],
  topics: TopicMeta[],
  size = 10,
  now: number = Date.now(),
): Question[] {
  const rec = recommend(data, questions, topics, now);
  const seen = lastSeen(data);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const picked: Question[] = [];
  const pickedIds = new Set<string>();
  const add = (q: Question | undefined) => {
    if (!q || pickedIds.has(q.id) || picked.length >= size) return;
    pickedIds.add(q.id);
    picked.push(q);
  };

  // Least recently seen first; never-seen before seen; previously-wrong before previously-right.
  const freshness = (q: Question) => {
    const s = seen.get(q.id);
    if (!s) return "0";
    return `${s.correct ? "2" : "1"}${s.at}`;
  };

  for (const id of rec.dueQuestionIds.slice(0, Math.ceil(size / 2))) add(byId.get(id));

  const weak = rec.focus.filter((f) => f.reason === "weak" || f.reason === "shaky");
  // Round-robin across weak topics so one topic doesn't eat the whole session.
  const pools = weak.map((f) => {
    const easyFirst = (f.stat?.score ?? 0) < 40;
    return questions
      .filter((q) => q.domain === f.meta.domain && q.topic === f.meta.topic)
      .sort((a, b) => freshness(a).localeCompare(freshness(b)) || (easyFirst ? a.difficulty - b.difficulty : b.difficulty - a.difficulty));
  });
  for (let round = 0; picked.length < size && pools.some((p) => p.length > round); round++) {
    for (const pool of pools) add(pool[round]);
  }

  for (const f of rec.focus.filter((x) => x.reason === "untested")) {
    const q = questions
      .filter((x) => x.domain === f.meta.domain && x.topic === f.meta.topic)
      .sort((a, b) => a.difficulty - b.difficulty)[0];
    add(q);
  }

  for (const q of [...questions].sort((a, b) => freshness(a).localeCompare(freshness(b)))) add(q);
  return picked;
}
