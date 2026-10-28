import { describe, expect, it } from "vitest";
import { computeActivity } from "@/lib/activity";
import { buildProfile, confidenceFor, isWeak } from "@/lib/profile";
import { emptyProgress, mergeProgress, recordSession, summarizeSession } from "@/lib/progress";
import { buildPracticeSet } from "@/lib/recommend";
import { applyAnswers, BOX_INTERVAL_HOURS, dueReviews } from "@/lib/srs";
import type { Question, TopicMeta } from "@/lib/types";
import { answer } from "./helpers";

const NOW = Date.parse("2026-10-02T10:00:00.000Z");
const topics: TopicMeta[] = [
  { domain: "dsa", topic: "hashing", title: "Hashing", summary: "" },
  { domain: "dsa", topic: "complexity", title: "Complexity", summary: "" },
  { domain: "web", topic: "http", title: "HTTP", summary: "" },
];

function q(id: string, domain: Question["domain"], topic: string, difficulty: Question["difficulty"] = 1): Question {
  return { id, domain, topic, difficulty, prompt: "prompt text", options: ["a", "b"], answer: 0, explanation: "explanation" };
}

describe("profile", () => {
  it("flags a topic weak after repeated misses and strong after consistent hits", () => {
    const answers = [
      answer({ topic: "hashing", correct: false }),
      answer({ topic: "hashing", correct: false }),
      answer({ topic: "hashing", correct: true }),
      answer({ topic: "complexity", correct: true }),
      answer({ topic: "complexity", correct: true }),
      answer({ topic: "complexity", correct: true }),
    ];
    const profile = buildProfile(answers, topics, NOW);
    expect(profile.weakTopics.map((t) => t.topic)).toEqual(["hashing"]);
    expect(profile.strongTopics.map((t) => t.topic)).toEqual(["complexity"]);
  });

  it("does not call a topic weak on a single miss", () => {
    expect(isWeak({ domain: "dsa", topic: "x", attempts: 1, correct: 0, score: 0, recentMisses: 1 })).toBe(false);
  });

  it("weights recent answers more than old ones", () => {
    const answers = [
      answer({ correct: false, answeredAt: "2026-06-01T00:00:00.000Z" }),
      answer({ correct: true, answeredAt: "2026-10-01T00:00:00.000Z" }),
    ];
    const score = buildProfile(answers, topics, NOW).domains.find((d) => d.domain === "dsa")!.score;
    expect(score).toBeGreaterThan(90);
  });

  it("scales confidence with evidence and coverage", () => {
    expect(confidenceFor(3, 1, 4)).toBe("low");
    expect(confidenceFor(20, 3, 4)).toBe("medium");
    expect(confidenceFor(20, 4, 4)).toBe("high");
  });
});

describe("spaced repetition", () => {
  it("adds missed questions to the deck and promotes them on correct reviews", () => {
    const miss = answer({ questionId: "q1", correct: false, answeredAt: "2026-10-01T00:00:00.000Z" });
    let reviews = applyAnswers({}, [miss]);
    expect(reviews.q1.box).toBe(0);
    expect(Date.parse(reviews.q1.dueAt) - Date.parse(miss.answeredAt)).toBe(BOX_INTERVAL_HOURS[0] * 3600_000);

    reviews = applyAnswers(reviews, [answer({ questionId: "q1", correct: true, answeredAt: "2026-10-01T06:00:00.000Z" })]);
    expect(reviews.q1.box).toBe(1);
    expect(reviews.q1.lapses).toBe(1);
  });

  it("ignores first-time correct answers", () => {
    expect(applyAnswers({}, [answer({ questionId: "q9", correct: true })])).toEqual({});
  });

  it("returns due reviews only", () => {
    const reviews = applyAnswers({}, [answer({ questionId: "q1", correct: false, answeredAt: "2026-10-02T09:00:00.000Z" })]);
    expect(dueReviews(reviews, NOW)).toHaveLength(0);
    expect(dueReviews(reviews, NOW + 5 * 3600_000)).toHaveLength(1);
  });
});

describe("progress merge", () => {
  it("unions answers from two devices without losing any", () => {
    const a = recordSession(emptyProgress(), summarizeSession("s1", "practice", "2026-10-01T00:00:00Z", [answer({ correct: true })]), [
      answer({ id: "x1", correct: true }),
    ]);
    const b = recordSession(emptyProgress(), summarizeSession("s2", "practice", "2026-10-01T00:00:00Z", [answer({ correct: false })]), [
      answer({ id: "x2", correct: false, questionId: "qq" }),
    ]);
    const merged = mergeProgress(a, b);
    expect(merged.answers.map((x) => x.id).sort()).toEqual(["x1", "x2"]);
    expect(merged.sessions).toHaveLength(2);
    expect(merged.reviews.qq).toBeDefined();
    expect(mergeProgress(merged, merged).answers).toHaveLength(2);
  });
});

describe("practice set", () => {
  it("puts due reviews and weak topics ahead of everything else", () => {
    const questions = [q("h1", "dsa", "hashing"), q("h2", "dsa", "hashing"), q("c1", "dsa", "complexity"), q("w1", "web", "http")];
    const answers = [
      answer({ questionId: "h1", topic: "hashing", correct: false, answeredAt: "2026-10-01T00:00:00.000Z" }),
      answer({ questionId: "h2", topic: "hashing", correct: false, answeredAt: "2026-10-01T00:01:00.000Z" }),
      answer({ questionId: "c1", topic: "complexity", correct: true, answeredAt: "2026-10-01T00:02:00.000Z" }),
    ];
    const data = { ...emptyProgress(), answers, reviews: applyAnswers({}, answers) };
    const set = buildPracticeSet(data, questions, topics, 3, NOW);
    expect(set.slice(0, 2).map((x) => x.id).sort()).toEqual(["h1", "h2"]);
    expect(set[2].id).toBe("w1"); // untested topic before an already-mastered one
  });
});

describe("activity", () => {
  it("counts a streak of consecutive days ending yesterday", () => {
    const answers = ["2026-09-29T12:00:00", "2026-09-30T12:00:00", "2026-10-01T12:00:00"].map((t) =>
      answer({ correct: true, answeredAt: new Date(t).toISOString() }),
    );
    const a = computeActivity(answers, new Date("2026-10-02T12:00:00"));
    expect(a.streak).toBe(3);
    expect(a.daysSinceActive).toBe(1);
  });

  it("breaks the streak after a missed day", () => {
    const answers = [answer({ correct: true, answeredAt: new Date("2026-09-28T12:00:00").toISOString() })];
    const a = computeActivity(answers, new Date("2026-10-02T12:00:00"));
    expect(a.streak).toBe(0);
    expect(a.daysSinceActive).toBe(4);
  });
});
