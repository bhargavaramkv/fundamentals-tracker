import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { DOMAINS, type Domain, type FunFact, type FunStory, type Lesson, type NewsItem, type Question, type TopicMeta } from "./types";
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
        const { data } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
        return {
          domain,
          topic,
          title: String(data.title ?? topic),
          summary: String(data.summary ?? ""),
        };
      });
  });
}

export function getLesson(domain: Domain, topic: string): Lesson | null {
  const file = lessonPath(domain, topic);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  // Lessons are trusted, repo-owned markdown, so rendering to HTML is safe here.
  const html = marked.parse(content, { async: false });
  return {
    domain,
    topic,
    title: String(data.title ?? topic),
    summary: String(data.summary ?? ""),
    html,
  };
}

const NEWS_DIR = path.join(CONTENT_DIR, "news");

/** News stories, newest first. Slug is the file name without .md. */
export function getAllNews(): NewsItem[] {
  if (!fs.existsSync(NEWS_DIR)) return [];
  return fs
    .readdirSync(NEWS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(NEWS_DIR, f), "utf8"));
      return {
        slug: f.replace(/\.md$/, ""),
        title: String(data.title),
        date: String(data.date),
        updated: data.updated ? String(data.updated) : undefined,
        severity: data.severity === "critical" ? "critical" : "notable",
        tags: (data.tags as string[] | undefined) ?? [],
        relatesTo: (data.relatesTo as string[] | undefined) ?? [],
        summary: String(data.summary ?? ""),
        sources: (data.sources as NewsItem["sources"] | undefined) ?? [],
        check: data.check as NewsItem["check"],
        // Repo-owned markdown, same as lessons.
        html: marked.parse(content, { async: false }),
      } satisfies NewsItem;
    })
    .sort((a, b) => (b.updated ?? b.date).localeCompare(a.updated ?? a.date));
}

export function getFunStories(): FunStory[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "fun", "stories.json"), "utf8")) as FunStory[];
}

export function getFunFacts(): FunFact[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "fun", "facts.json"), "utf8")) as FunFact[];
}
