import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { currentTopic, nextLesson, streak, todayGoal, trackKeys } from "@/lib/curriculum";
import { parseLessonSteps } from "@/lib/lesson-steps";
import { emptyProgress } from "@/lib/progress";
import { DOMAINS, type Curriculum, type ProgressData } from "@/lib/types";
import { answer } from "./helpers";

const c: Curriculum = {
  tracks: [
    { domain: "dsa", title: "DSA", tagline: "", stages: [{ id: "f", title: "F", summary: "", topics: ["a", "b"] }, { id: "c", title: "C", summary: "", topics: ["c"] }] },
    { domain: "oop", title: "OOP", tagline: "", stages: [{ id: "f", title: "F", summary: "", topics: ["x", "y"] }] },
  ],
};

const withAnswers = (...a: ReturnType<typeof answer>[]): ProgressData => ({ ...emptyProgress(), answers: a });
const at = (iso: string) => new Date(iso).getTime();

describe("curriculum helpers", () => {
  it("lists keys in course order", () => {
    expect(trackKeys(c.tracks[0])).toEqual(["dsa/a", "dsa/b", "dsa/c"]);
  });

  it("current topic is the first one not done", () => {
    expect(currentTopic(c.tracks[0], new Set(["dsa/a"]))).toBe("dsa/b");
    expect(currentTopic(c.tracks[0], new Set(["dsa/a", "dsa/b", "dsa/c"]))).toBeNull();
  });

  it("a new learner starts at the first track's first topic", () => {
    expect(nextLesson(c, emptyProgress(), new Set())).toBe("dsa/a");
  });

  it("continues the track touched most recently", () => {
    const data = withAnswers(
      answer({ correct: true, domain: "dsa", topic: "a", answeredAt: "2026-11-01T10:00:00Z" }),
      answer({ correct: true, domain: "oop", topic: "x", answeredAt: "2026-11-02T10:00:00Z" }),
    );
    expect(nextLesson(c, data, new Set(["dsa/a"]))).toBe("oop/x");
    expect(nextLesson(c, data, new Set(["dsa/a", "oop/x"]))).toBe("oop/y");
  });

  it("counts reads and activities as touching a track", () => {
    const data: ProgressData = {
      ...withAnswers(answer({ correct: true, domain: "dsa", topic: "a", answeredAt: "2026-11-01T10:00:00Z" })),
      reads: [{ id: "r", domain: "oop", topic: "x", openedAt: "2026-11-03T10:00:00Z", durationMs: 30000 }],
    };
    expect(nextLesson(c, data, new Set(["dsa/a"]))).toBe("oop/x");
  });

  it("moves to another track when the latest one is finished, and to null when all are", () => {
    const data = withAnswers(answer({ correct: true, domain: "oop", topic: "y", answeredAt: "2026-11-02T10:00:00Z" }));
    expect(nextLesson(c, data, new Set(["oop/x", "oop/y"]))).toBe("dsa/a");
    expect(nextLesson(c, data, new Set(["oop/x", "oop/y", "dsa/a", "dsa/b", "dsa/c"]))).toBeNull();
  });
});

describe("streak and goal", () => {
  const now = at("2026-11-10T15:00:00");
  const day = (d: string, h = 10) => answer({ correct: true, answeredAt: new Date(`${d}T${String(h).padStart(2, "0")}:00:00`).toISOString() });

  it("is 0 with no activity", () => {
    expect(streak(emptyProgress(), now)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(streak(withAnswers(day("2026-11-10"), day("2026-11-09"), day("2026-11-08")), now)).toBe(3);
  });

  it("still counts when today has nothing yet", () => {
    expect(streak(withAnswers(day("2026-11-09"), day("2026-11-08")), now)).toBe(2);
  });

  it("stops at a gap", () => {
    expect(streak(withAnswers(day("2026-11-10"), day("2026-11-08"), day("2026-11-07")), now)).toBe(1);
    expect(streak(withAnswers(day("2026-11-08")), now)).toBe(0);
  });

  it("counts reads and activities as activity", () => {
    const data: ProgressData = {
      ...withAnswers(day("2026-11-09")),
      reads: [{ id: "r", domain: "dsa", topic: "a", openedAt: new Date("2026-11-10T09:00:00").toISOString(), durationMs: 30000 }],
    };
    expect(streak(data, now)).toBe(2);
  });

  it("goal is met by one lesson read or ten answers today", () => {
    expect(todayGoal(emptyProgress(), now).met).toBe(false);
    const nine = withAnswers(...Array.from({ length: 9 }, () => day("2026-11-10")));
    expect(todayGoal(nine, now)).toMatchObject({ answers: 9, met: false });
    expect(todayGoal(withAnswers(...Array.from({ length: 10 }, () => day("2026-11-10"))), now).met).toBe(true);
    const read: ProgressData = { ...emptyProgress(), reads: [{ id: "r", domain: "dsa", topic: "a", openedAt: new Date("2026-11-10T09:00:00").toISOString(), durationMs: 30000 }] };
    expect(todayGoal(read, now)).toMatchObject({ lessons: 1, met: true });
    expect(todayGoal(withAnswers(day("2026-11-09")), now).answers).toBe(0);
  });
});

describe("lesson step parser", () => {
  const f = "x.md";
  it("splits on ## headings and drops empty intros", () => {
    const steps = parseLessonSteps("## One\n\nHello\n\n## Two\n\nWorld", f);
    expect(steps.map((s) => s.title)).toEqual(["One", "Two"]);
    expect(steps[0].blocks).toHaveLength(1);
  });

  it("keeps text before the first heading as an intro on step 1", () => {
    const steps = parseLessonSteps("Intro text\n\n## One\n\nBody", f);
    expect(steps).toHaveLength(1);
    expect(steps[0].blocks[0]).toMatchObject({ kind: "html" });
    expect(JSON.stringify(steps[0].blocks)).toContain("Intro text");
  });

  it("extracts single-line and multi-line check blocks in position", () => {
    const md = [
      "## One",
      "Before",
      "```check",
      '{"prompt": "Q1", "options": ["a", "b"], "answer": 1, "explanation": "because"}',
      "```",
      "Between",
      "```check",
      "{",
      '  "prompt": "Q2",',
      '  "options": ["a", "b", "c"],',
      '  "answer": 0,',
      '  "explanation": "so"',
      "}",
      "```",
    ].join("\n");
    const [step] = parseLessonSteps(md, f);
    expect(step.blocks.map((b) => b.kind)).toEqual(["html", "check", "html", "check"]);
    expect(step.blocks[1]).toMatchObject({ check: { prompt: "Q1", answer: 1 } });
    expect(step.blocks[3]).toMatchObject({ check: { prompt: "Q2", options: ["a", "b", "c"] } });
  });

  it("does not split on ## inside other code fences", () => {
    const steps = parseLessonSteps("## One\n\n```bash\n## not a heading\n```\n", f);
    expect(steps).toHaveLength(1);
    expect(JSON.stringify(steps[0].blocks)).toContain("not a heading");
  });

  it("throws naming the file on invalid checks", () => {
    const wrap = (json: string) => `## One\n\`\`\`check\n${json}\n\`\`\``;
    expect(() => parseLessonSteps(wrap("{nope"), f)).toThrow(/x\.md.*JSON/);
    expect(() => parseLessonSteps(wrap('{"prompt":"q","options":["a","b"],"answer":2,"explanation":"e"}'), f)).toThrow(/x\.md.*answer/);
    expect(() => parseLessonSteps(wrap('{"prompt":"q","options":["a"],"answer":0,"explanation":"e"}'), f)).toThrow(/x\.md.*options/);
  });

  it("parses steps and reveal blocks in position, with multi-line JSON", () => {
    const md = [
      "## One",
      "Before",
      "```steps",
      "{",
      '  "title": "T",',
      '  "frames": [',
      '    {"visual": "a\\nb", "caption": "first **bold**"},',
      '    {"visual": "c", "caption": "second"}',
      "  ]",
      "}",
      "```",
      "```reveal",
      '{"prompt": "P", "answer": "It is **3**"}',
      "```",
      "```js",
      "const x = 1;",
      "```",
    ].join("\n");
    const [step] = parseLessonSteps(md, f);
    expect(step.blocks.map((b) => b.kind)).toEqual(["html", "steps", "reveal", "html"]);
    expect(step.blocks[1]).toMatchObject({ steps: { title: "T", frames: [{ visual: "a\nb", caption: "first <strong>bold</strong>" }, { visual: "c" }] } });
    expect(step.blocks[2]).toMatchObject({ reveal: { prompt: "P", answer: expect.stringContaining("<strong>3</strong>") } });
    expect(JSON.stringify(step.blocks[3])).toContain("const x = 1;");
  });

  it("throws naming the file on invalid steps and reveal blocks", () => {
    const wrap = (lang: string, json: string) => `## One\n\`\`\`${lang}\n${json}\n\`\`\``;
    const frame = (visual: string) => `{"visual": ${JSON.stringify(visual)}, "caption": "c"}`;
    const steps = (...frames: string[]) => wrap("steps", `{"title": "T", "frames": [${frames.join(",")}]}`);
    expect(() => parseLessonSteps(wrap("steps", "{nope"), f)).toThrow(/x\.md.*JSON/);
    expect(() => parseLessonSteps(wrap("steps", '{"frames": []}'), f)).toThrow(/x\.md.*title/);
    expect(() => parseLessonSteps(steps(frame("a")), f)).toThrow(/x\.md.*frames/);
    expect(() => parseLessonSteps(steps(...Array(9).fill(frame("a"))), f)).toThrow(/x\.md.*frames/);
    expect(() => parseLessonSteps(steps(frame("a"), '{"visual": "a"}'), f)).toThrow(/x\.md.*caption/);
    expect(() => parseLessonSteps(steps(frame("a"), '{"caption": "a"}'), f)).toThrow(/x\.md.*visual/);
    expect(() => parseLessonSteps(steps(frame("a"), frame(Array(13).fill("x").join("\n"))), f)).toThrow(/x\.md.*lines/);
    expect(() => parseLessonSteps(steps(frame("a"), frame("x".repeat(57))), f)).toThrow(/x\.md.*chars/);
    expect(() => parseLessonSteps(steps(frame("a"), frame("x".repeat(56))), f)).not.toThrow();
    expect(() => parseLessonSteps(wrap("reveal", "{nope"), f)).toThrow(/x\.md.*JSON/);
    expect(() => parseLessonSteps(wrap("reveal", '{"answer": "a"}'), f)).toThrow(/x\.md.*prompt/);
    expect(() => parseLessonSteps(wrap("reveal", '{"prompt": "p"}'), f)).toThrow(/x\.md.*answer/);
  });
});

describe("curriculum file", () => {
  const root = path.resolve(import.meta.dirname, "..", "content");
  const curriculum = JSON.parse(fs.readFileSync(path.join(root, "curriculum.json"), "utf8")) as Curriculum;
  const listed = curriculum.tracks.flatMap((t) => t.stages.flatMap((s) => s.topics.map((topic) => `${t.domain}/${topic}`)));

  it("lists no topic twice", () => {
    expect(listed.filter((k, i) => listed.indexOf(k) !== i)).toEqual([]);
  });

  it("lists every lesson, and every listed topic has a lesson", () => {
    const lessons = DOMAINS.flatMap((d) =>
      fs
        .readdirSync(path.join(root, "lessons", d))
        .filter((n) => n.endsWith(".md"))
        .map((n) => `${d}/${n.replace(/\.md$/, "")}`),
    );
    expect(lessons.filter((k) => !listed.includes(k))).toEqual([]);
    expect(listed.filter((k) => !lessons.includes(k))).toEqual([]);
  });
});
