import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { validateQuestions } from "@/lib/validate";
import { DOMAINS } from "@/lib/types";

const root = path.resolve(import.meta.dirname, "..", "content");

function rawQuestions(): unknown[] {
  return DOMAINS.flatMap((d) => JSON.parse(fs.readFileSync(path.join(root, "questions", `${d}.json`), "utf8")) as unknown[]);
}

function lessonKeys(): string[] {
  return DOMAINS.flatMap((d) =>
    fs
      .readdirSync(path.join(root, "lessons", d))
      .filter((f) => f.endsWith(".md"))
      .map((f) => `${d}/${f.replace(/\.md$/, "")}`),
  );
}

describe("content", () => {
  it("every question passes validation", () => {
    const { errors } = validateQuestions(rawQuestions());
    expect(errors).toEqual([]);
  });

  it("questions in each file belong to that file's domain", () => {
    for (const d of DOMAINS) {
      const list = JSON.parse(fs.readFileSync(path.join(root, "questions", `${d}.json`), "utf8")) as { domain: string }[];
      expect(list.every((q) => q.domain === d)).toBe(true);
    }
  });

  it("every question topic has a lesson, and every lesson has at least 3 questions", () => {
    const { questions } = validateQuestions(rawQuestions());
    const lessons = new Set(lessonKeys());
    for (const q of questions) expect(lessons.has(`${q.domain}/${q.topic}`), `${q.id} has no lesson`).toBe(true);
    for (const key of lessons) {
      const count = questions.filter((q) => `${q.domain}/${q.topic}` === key).length;
      expect(count, `${key} has ${count} questions`).toBeGreaterThanOrEqual(3);
    }
  });

  it("every lesson has a title and summary in frontmatter", () => {
    for (const key of lessonKeys()) {
      const { data, content } = matter(fs.readFileSync(path.join(root, "lessons", `${key}.md`), "utf8"));
      expect(typeof data.title, key).toBe("string");
      expect(typeof data.summary, key).toBe("string");
      expect(content.trim().length, key).toBeGreaterThan(200);
    }
  });

  it("covers all five domains with mixed difficulty", () => {
    const { questions } = validateQuestions(rawQuestions());
    for (const d of DOMAINS) {
      const diffs = new Set(questions.filter((q) => q.domain === d).map((q) => q.difficulty));
      expect(diffs.size, d).toBe(3);
    }
  });

  it("gives no length tell: the correct option isn't systematically the longest", () => {
    const { questions } = validateQuestions(rawQuestions());
    const uniqueLongest = (q: (typeof questions)[number]) => {
      const lens = q.options.map((o) => o.length);
      const c = lens[q.answer];
      return c === Math.max(...lens) && lens.filter((l) => l === c).length === 1;
    };
    // With 4 options, chance is 25%. Allow some slack, but not a pattern you can exploit.
    const overall = questions.filter(uniqueLongest).length / questions.length;
    expect(overall, `correct answer is the unique longest option in ${Math.round(overall * 100)}% of questions`).toBeLessThanOrEqual(0.3);
    for (const d of DOMAINS) {
      const qs = questions.filter((q) => q.domain === d);
      const share = qs.filter(uniqueLongest).length / qs.length;
      expect(share, `${d}: ${Math.round(share * 100)}% unique-longest`).toBeLessThanOrEqual(0.4);
    }
    const ratio =
      questions.reduce((sum, q) => {
        const mean = q.options.reduce((a, o) => a + o.length, 0) / q.options.length;
        return sum + q.options[q.answer].length / mean;
      }, 0) / questions.length;
    expect(ratio, "mean correct-option length relative to its question's mean").toBeLessThanOrEqual(1.1);
  });
});

describe("fun content", () => {
  const lessonSet = new Set(lessonKeys());
  it("fun stories and facts are well-formed and link to real lessons", () => {
    const stories = JSON.parse(fs.readFileSync(path.join(root, "fun", "stories.json"), "utf8")) as {
      id: string;
      relatesTo: string;
      hook: string;
      story: string;
      lesson: string;
    }[];
    const facts = JSON.parse(fs.readFileSync(path.join(root, "fun", "facts.json"), "utf8")) as { id: string; fact: string }[];
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length);
    expect(new Set(facts.map((s) => s.id)).size).toBe(facts.length);
    for (const s of stories) {
      expect(lessonSet.has(s.relatesTo), `${s.id}: unknown lesson ${s.relatesTo}`).toBe(true);
      expect(s.hook && s.story && s.lesson, s.id).toBeTruthy();
    }
    for (const f of facts) expect(f.fact.length, f.id).toBeGreaterThan(20);
  });
});
