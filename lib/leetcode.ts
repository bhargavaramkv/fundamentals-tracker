import type { CodingAttempt, CodingDifficulty, CodingProblem, ProgressData } from "./types";

/**
 * The public, secret-free file the leetcode-sync workflow writes to the `leetcode-data` branch (leetcode.json).
 * It holds accepted solves only: LeetCode's public profile data has no hints, notes or timings, so the outcome is
 * set when you import.
 */
export interface LeetCodeFeedItem {
  slug: string;
  title: string;
  number?: number;
  difficulty: CodingDifficulty;
  /** LeetCode topic tag slugs, e.g. "hash-table". */
  tags: string[];
  /** When it was first accepted, as far as the sync has seen. */
  solvedAt: string;
}

export interface LeetCodeFeed {
  version: 1;
  username: string;
  syncedAt: string;
  items: LeetCodeFeedItem[];
}

export function isLeetCodeFeed(raw: unknown): raw is LeetCodeFeed {
  const f = raw as Partial<LeetCodeFeed> | null;
  return (
    !!f &&
    f.version === 1 &&
    typeof f.syncedAt === "string" &&
    Array.isArray(f.items) &&
    f.items.every(
      (i) =>
        typeof i?.slug === "string" &&
        /^[a-z0-9-]+$/.test(i.slug) &&
        typeof i.title === "string" &&
        typeof i.solvedAt === "string" &&
        ["easy", "medium", "hard"].includes(i.difficulty) &&
        Array.isArray(i.tags),
    )
  );
}

const TAG_PATTERNS: Record<string, string> = {
  array: "arrays-hashing",
  "hash-table": "arrays-hashing",
  "two-pointers": "two-pointers",
  "sliding-window": "sliding-window",
  "binary-search": "binary-search",
  stack: "stack",
  "monotonic-stack": "stack",
  "linked-list": "linked-list",
  tree: "trees",
  "binary-tree": "trees",
  "binary-search-tree": "trees",
  graph: "graphs",
  "breadth-first-search": "graphs",
  "depth-first-search": "graphs",
  "topological-sort": "graphs",
  "union-find": "graphs",
  "heap-priority-queue": "heap",
  backtracking: "backtracking",
  "dynamic-programming": "dynamic-programming",
  greedy: "greedy",
  "bit-manipulation": "bit-manipulation",
  database: "sql",
  concurrency: "concurrency",
};

export const patternsFromTags = (tags: string[]): string[] => [...new Set(tags.map((t) => TAG_PATTERNS[t]).filter((p): p is string => !!p))];

/**
 * Solves worth importing: problems you have no attempts at and haven't removed. Anything already logged by hand is left
 * alone, so an import never duplicates or overrides your own record.
 */
export function planImport(data: ProgressData, feed: LeetCodeFeed): LeetCodeFeedItem[] {
  const known = new Map(data.codingProblems.map((p) => [p.id, p]));
  const attempted = new Set(data.codingAttempts.map((a) => a.problemId));
  return feed.items.filter((i) => {
    const id = `lc-${i.slug}`;
    return !attempted.has(id) && !known.get(id)?.deletedAt;
  });
}

/**
 * LeetCode can't say whether you needed a hint, so imports are "solved with help": it comes back for review in 7 days
 * instead of 14, the safer way to be wrong. Log another attempt to correct it.
 */
export function importRecords(item: LeetCodeFeedItem, existing: CodingProblem | undefined, now: string): { problem: CodingProblem; attempt: CodingAttempt } {
  const id = `lc-${item.slug}`;
  return {
    problem: {
      id,
      title: existing?.title ?? item.title,
      url: `https://leetcode.com/problems/${item.slug}/`,
      number: existing?.number ?? item.number,
      difficulty: item.difficulty,
      patterns: [...new Set([...(existing?.patterns ?? []), ...patternsFromTags(item.tags)])],
      notes: existing?.notes ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
    attempt: {
      id: `lcs-${item.slug}`,
      problemId: id,
      at: item.solvedAt,
      outcome: "solved-with-help",
      notes: 'Imported from LeetCode. If you solved it unaided, log another attempt as "Solved unaided".',
    },
  };
}
