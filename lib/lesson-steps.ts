import { marked } from "marked";
import type { LessonStep, QuickCheck, Reveal, StepBlock, StepThrough } from "./types";

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

function parseJson(raw: string, file: string, kind: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${file}: invalid JSON in a ${kind} block`);
  }
}

const MAX_VISUAL_LINES = 12;
const MAX_VISUAL_COLS = 56;

function parseSteps(raw: string, file: string): StepThrough {
  const x = parseJson(raw, file, "steps") as { title?: unknown; frames?: unknown } | null;
  const fail = (why: string) => new Error(`${file}: bad steps block (${why})`);
  if (!x || typeof x.title !== "string" || !x.title) throw fail("missing title");
  if (!Array.isArray(x.frames) || x.frames.length < 2 || x.frames.length > 8) throw fail("needs 2 to 8 frames");
  const frames = x.frames.map((f: { visual?: unknown; caption?: unknown } | null, i) => {
    if (!f || typeof f.visual !== "string" || !f.visual) throw fail(`frame ${i + 1} is missing visual`);
    if (typeof f.caption !== "string" || !f.caption) throw fail(`frame ${i + 1} is missing caption`);
    const rows = f.visual.split("\n");
    if (rows.length > MAX_VISUAL_LINES) throw fail(`frame ${i + 1} visual has more than ${MAX_VISUAL_LINES} lines`);
    if (rows.some((r) => r.length > MAX_VISUAL_COLS)) throw fail(`frame ${i + 1} visual has a line over ${MAX_VISUAL_COLS} chars`);
    return { visual: f.visual, caption: marked.parseInline(f.caption, { async: false }) };
  });
  return { title: x.title, frames };
}

function parseReveal(raw: string, file: string): Reveal {
  const x = parseJson(raw, file, "reveal") as Partial<Reveal> | null;
  const fail = (why: string) => new Error(`${file}: bad reveal block (${why})`);
  if (!x || typeof x.prompt !== "string" || !x.prompt) throw fail("missing prompt");
  if (typeof x.answer !== "string" || !x.answer) throw fail("missing answer");
  return { prompt: x.prompt, answer: marked.parse(x.answer, { async: false }) };
}

/**
 * Splits lesson markdown into steps on `## ` headings and pulls ```check, ```steps and ```reveal blocks out in place.
 * Text before the first heading becomes an intro block on step 1. Throws (naming `file`) on an invalid block.
 */
export function parseLessonSteps(markdown: string, file: string): LessonStep[] {
  const steps: LessonStep[] = [];
  let title: string | null = null;
  let blocks: StepBlock[] = [];
  let buf: string[] = [];
  let fence: { marker: string; kind: "check" | "steps" | "reveal" | null; lines: string[] } | null = null;

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
        if (fence.kind) {
          flush();
          const raw = fence.lines.join("\n");
          if (fence.kind === "check") blocks.push({ kind: "check", check: parseCheck(raw, file) });
          else if (fence.kind === "steps") blocks.push({ kind: "steps", steps: parseSteps(raw, file) });
          else blocks.push({ kind: "reveal", reveal: parseReveal(raw, file) });
        } else buf.push(...fence.lines, line);
        fence = null;
      } else fence.lines.push(line);
      continue;
    }
    const open = /^\s*(```+|~~~+)\s*(\w*)/.exec(line);
    if (open) {
      const kind = open[2] === "check" || open[2] === "steps" || open[2] === "reveal" ? open[2] : null;
      fence = { marker: open[1], kind, lines: kind ? [] : [line] };
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
  const words = markdown.replace(/```(?:check|steps|reveal)[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
