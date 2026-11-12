import { describe, expect, it } from "vitest";
import { emptyProgress } from "@/lib/progress";
import { buildPracticeSet } from "@/lib/recommend";
import { applyAnswers } from "@/lib/srs";
import type { Question, TopicMeta } from "@/lib/types";
import { answer } from "./helpers";

const NOW = Date.parse("2026-10-02T10:00:00.000Z");
const topics: TopicMeta[] = [
  { domain: "dsa", topic: "hashing", title: "Hashing", summary: "" },
  { domain: "dsa", topic: "arrays", title: "Arrays", summary: "" },
  { domain: "system-design", topic: "scalability", title: "Scalability", summary: "" },
  { domain: "system-design", topic: "caching", title: "Caching", summary: "" },
  { domain: "web", topic: "http", title: "HTTP", summary: "" },
];
const q = (id: string, domain: Question["domain"], topic: string): Question => ({
  id,
  domain,
  topic,
  difficulty: 1,
  prompt: "prompt text",
  options: ["a", "b"],
  answer: 0,
  explanation: "explanation",
});
const questions = [
  q("h1", "dsa", "hashing"),
  q("a1", "dsa", "arrays"),
  q("s1", "system-design", "scalability"),
  q("s2", "system-design", "scalability"),
  q("c1", "system-design", "caching"),
  q("w1", "web", "http"),
];
const focus = ["system-design/scalability", "system-design/caching"];
const ids = (set: Question[]) => set.map((x) => x.id);

describe("focus-aware practice set", () => {
  it("leads with focus topics, in order, when nothing is due", () => {
    const set = buildPracticeSet(emptyProgress(), questions, topics, 3, NOW, focus);
    expect(ids(set)).toEqual(["s1", "c1", "s2"]);
  });

  it("still puts due reviews before focus topics", () => {
    const answers = [answer({ questionId: "w1", domain: "web", topic: "http", correct: false, answeredAt: "2026-10-01T00:00:00.000Z" })];
    const data = { ...emptyProgress(), answers, reviews: applyAnswers({}, answers) };
    expect(ids(buildPracticeSet(data, questions, topics, 3, NOW, focus))[0]).toBe("w1");
  });

  it("is unchanged without a focus", () => {
    const base = buildPracticeSet(emptyProgress(), questions, topics, 5, NOW);
    expect(ids(buildPracticeSet(emptyProgress(), questions, topics, 5, NOW, []))).toEqual(ids(base));
    expect(ids(base)).toContain("h1");
  });

  it("samples untested topics from the focus tracks only", () => {
    const set = buildPracticeSet(emptyProgress(), questions, topics, 3, NOW, ["system-design/scalability"]);
    expect(set.every((x) => x.domain === "system-design")).toBe(true);
  });
});
