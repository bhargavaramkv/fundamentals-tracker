import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { DOMAINS, type Domain, type Lesson, type Question, type TopicMeta } from "./types";
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
