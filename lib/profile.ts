import {
  DOMAINS,
  type AnswerLog,
  type Confidence,
  type DomainStat,
  type SkillProfile,
  type TopicMeta,
  type TopicStat,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Answers lose half their weight every 21 days, so the profile tracks current skill. */
const HALF_LIFE_DAYS = 21;

export const WEAK_SCORE = 60;
export const STRONG_SCORE = 80;

function answerWeight(a: AnswerLog, now: number): number {
  const ageDays = Math.max(0, (now - Date.parse(a.answeredAt)) / DAY_MS);
  const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  // Harder questions say more about real understanding.
  const difficulty = 0.75 + 0.25 * a.difficulty;
  return recency * difficulty;
}

export function weightedScore(answers: AnswerLog[], now: number): number {
  let total = 0;
  let correct = 0;
  for (const a of answers) {
    const w = answerWeight(a, now);
    total += w;
    if (a.correct) correct += w;
  }
  return total === 0 ? 0 : Math.round((100 * correct) / total);
}

export function confidenceFor(attempts: number, topicsCovered: number, topicsTotal: number): Confidence {
  if (attempts < 5) return "low";
  if (attempts < 15 || topicsCovered < topicsTotal) return "medium";
  return "high";
}

function topicStat(meta: Pick<TopicMeta, "domain" | "topic">, answers: AnswerLog[], now: number): TopicStat {
  const sorted = [...answers].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  const recent = sorted.slice(-5);
  return {
    domain: meta.domain,
    topic: meta.topic,
    attempts: answers.length,
    correct: answers.filter((a) => a.correct).length,
    score: weightedScore(answers, now),
    recentMisses: recent.filter((a) => !a.correct).length,
  };
}

/** A topic is weak if it has enough evidence and is either low-scoring or failing repeatedly. */
export function isWeak(t: TopicStat): boolean {
  return t.attempts >= 2 && (t.score < WEAK_SCORE || t.recentMisses >= 2);
}

export function isStrong(t: TopicStat): boolean {
  return t.attempts >= 3 && t.score >= STRONG_SCORE && t.recentMisses <= 1;
}

export function buildProfile(
  answers: AnswerLog[],
  topics: Pick<TopicMeta, "domain" | "topic">[],
  now: number = Date.now(),
): SkillProfile {
  const byTopic = new Map<string, AnswerLog[]>();
  for (const a of answers) {
    const key = `${a.domain}/${a.topic}`;
    const list = byTopic.get(key);
    if (list) list.push(a);
    else byTopic.set(key, [a]);
  }

  // Include topics that only exist in answers (e.g. a lesson was renamed) so no data is hidden.
  const known = new Set(topics.map((t) => `${t.domain}/${t.topic}`));
  const allTopics = [...topics];
  for (const a of answers) {
    const key = `${a.domain}/${a.topic}`;
    if (!known.has(key)) {
      known.add(key);
      allTopics.push({ domain: a.domain, topic: a.topic });
    }
  }

  const domains: DomainStat[] = DOMAINS.map((domain) => {
    const domainTopics = allTopics.filter((t) => t.domain === domain);
    const stats = domainTopics.map((t) => topicStat(t, byTopic.get(`${t.domain}/${t.topic}`) ?? [], now));
    const domainAnswers = answers.filter((a) => a.domain === domain);
    const covered = stats.filter((s) => s.attempts > 0).length;
    return {
      domain,
      attempts: domainAnswers.length,
      score: weightedScore(domainAnswers, now),
      confidence: confidenceFor(domainAnswers.length, covered, domainTopics.length),
      topics: stats,
    };
  });

  const allStats = domains.flatMap((d) => d.topics);
  return {
    domains,
    weakTopics: allStats.filter(isWeak).sort((a, b) => a.score - b.score || b.recentMisses - a.recentMisses),
    strongTopics: allStats.filter(isStrong).sort((a, b) => b.score - a.score),
  };
}
