import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { parseLessonSteps, readingMinutes } from "./lesson-steps";
import type { Resource } from "./resources";
import { DOMAINS, type Domain, type Curriculum, type FunFact, type FunStory, type Lesson, type Question, type TopicMeta, type TopicWorkspace, type WorkspaceSummary } from "./types";
import { validateQuestions } from "./validate";

// Content is read at build time only (static export), so plain sync fs is fine.
const CONTENT_DIR = path.join(process.cwd(), "content");

let questionCache: Question[] | null = null;

export function getAllQuestions(): Question[] {
  if (questionCache) return questionCache;
  const all = DOMAINS.flatMap((domain) => {
    const file = path.join(CONTENT_DIR, "questions", `${domain}.json`);
    return JSON.parse(fs.readFileSync(file, "utf8")) as unknown[];
  });
  const result = validateQuestions(all);
  if (result.errors.length > 0) {
    throw new Error(`Invalid question content:\n${result.errors.join("\n")}`);
  }
  questionCache = result.questions;
  return questionCache;
}

function lessonPath(domain: Domain, topic: string): string {
  return path.join(CONTENT_DIR, "lessons", domain, `${topic}.md`);
}

export function getAllTopics(): TopicMeta[] {
  return DOMAINS.flatMap((domain) => {
    const dir = path.join(CONTENT_DIR, "lessons", domain);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => {
        const topic = f.replace(/\.md$/, "");
        const { data, content } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
        return {
          domain,
          topic,
          title: String(data.title ?? topic),
          summary: String(data.summary ?? ""),
          minutes: readingMinutes(content),
        };
      });
  });
}

export function getLesson(domain: Domain, topic: string): Lesson | null {
  const file = lessonPath(domain, topic);
  if (!fs.existsSync(file)) return null;
  const { data, content: raw } = matter(fs.readFileSync(file, "utf8"));
  // Site-absolute links in lessons (`](/learn/...)`) need the GitHub Pages base path.
  const content = raw.replace(/\]\(\/(?!\/)/g, `](${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
  // Lessons are trusted, repo-owned markdown, so rendering to HTML is safe here.
  const html = marked.parse(content, { async: false });
  return {
    domain,
    topic,
    title: String(data.title ?? topic),
    summary: String(data.summary ?? ""),
    minutes: readingMinutes(content),
    html,
    steps: parseLessonSteps(content, `content/lessons/${domain}/${topic}.md`),
  };
}

/** The course order from content/curriculum.json. Topics without a lesson file yet are skipped. */
export function getCurriculum(): Curriculum {
  const raw = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "curriculum.json"), "utf8")) as Curriculum;
  return {
    tracks: raw.tracks.map((t) => ({
      ...t,
      stages: t.stages
        .map((s) => ({ ...s, topics: s.topics.filter((topic) => fs.existsSync(lessonPath(t.domain, topic))) }))
        .filter((s) => s.topics.length > 0),
    })),
  };
}

/** The resource registry, in the order it's written. See lib/resources.ts for the rules. */
export function getResources(): Resource[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "resources", "registry.json"), "utf8")) as Resource[];
}

/** Exercises, practical work and path order per topic, keyed by `domain/topic`. */
export function getWorkspaces(): Record<string, TopicWorkspace> {
  const out: Record<string, TopicWorkspace> = {};
  for (const domain of DOMAINS) {
    const raw = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "workspaces", `${domain}.json`), "utf8")) as Record<string, TopicWorkspace>;
    for (const [topic, w] of Object.entries(raw)) out[`${domain}/${topic}`] = w;
  }
  return out;
}

/** Just what progress needs per topic, so client components do not carry every prompt and answer. */
export function getWorkspaceSummaries(): Record<string, WorkspaceSummary> {
  return Object.fromEntries(
    Object.entries(getWorkspaces()).map(([key, w]) => [
      key,
      { order: w.order, exercises: w.exercises.map((e) => ({ id: e.id })), practical: w.practical.map((p) => ({ id: p.id })) },
    ]),
  );
}

export function getFunStories(): FunStory[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "fun", "stories.json"), "utf8")) as FunStory[];
}

export function getFunFacts(): FunFact[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "fun", "facts.json"), "utf8")) as FunFact[];
}
