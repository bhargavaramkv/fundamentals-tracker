import { marked } from "marked";
import type { LessonStep, QuickCheck, StepBlock } from "./types";

function parseCheck(raw: string, file: string): QuickCheck {
  let c: unknown;
  try {
    c = JSON.parse(raw);
  } catch {
    throw new Error(`${file}: invalid JSON in a check block`);
  }
  const x = c as Partial<QuickCheck> | null;
  const fail = (why: string) => new Error(`${file}: bad check block (${why})`);
  if (!x || typeof x.prompt !== "string" || !x.prompt) throw fail("missing prompt");
  if (!Array.isArray(x.options) || x.options.length < 2 || !x.options.every((o) => typeof o === "string")) throw fail("needs at least 2 string options");
  if (!Number.isInteger(x.answer) || (x.answer as number) < 0 || (x.answer as number) >= x.options.length) throw fail("answer is not a valid option index");
  if (typeof x.explanation !== "string" || !x.explanation) throw fail("missing explanation");
  return { prompt: x.prompt, options: x.options, answer: x.answer as number, explanation: x.explanation };
}

/**
 * Splits lesson markdown into steps on `## ` headings and pulls ```check blocks out in place.
 * Text before the first heading becomes an intro block on step 1. Throws (naming `file`) on an invalid check.
 */
export function parseLessonSteps(markdown: string, file: string): LessonStep[] {
  const steps: LessonStep[] = [];
  let title: string | null = null;
  let blocks: StepBlock[] = [];
  let buf: string[] = [];
  let fence: { marker: string; check: boolean; lines: string[] } | null = null;

  const flush = () => {
    const text = buf.join("\n").trim();
    buf = [];
    if (text) blocks.push({ kind: "html", html: marked.parse(text, { async: false }) });
  };
  const endStep = () => {
    flush();
    if (title !== null || blocks.length > 0) steps.push({ title: title ?? "Overview", blocks });
    blocks = [];
  };

  for (const line of markdown.split(/\r?\n/)) {
    if (fence) {
      if (line.trim().startsWith(fence.marker)) {
        if (fence.check) {
          flush();
          blocks.push({ kind: "check", check: parseCheck(fence.lines.join("\n"), file) });
        } else buf.push(...fence.lines, line);
        fence = null;
      } else fence.lines.push(line);
      continue;
    }
    const open = /^\s*(```+|~~~+)\s*(\w*)/.exec(line);
    if (open) {
      const check = open[2] === "check";
      fence = { marker: open[1], check, lines: check ? [] : [line] };
      continue;
    }
    const heading = /^## (.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      // Text before the first heading stays on step 1 as its intro.
      if (title !== null) endStep();
      title = heading[1];
      continue;
    }
    buf.push(line);
  }
  if (fence) throw new Error(`${file}: unclosed code fence`);
  endStep();
  return steps;
}

/** Reading time in whole minutes, at 200 words a minute. */
export function readingMinutes(markdown: string): number {
  const words = markdown.replace(/```check[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
