/**
 * Pulls your recent accepted LeetCode submissions from the public GraphQL endpoint (no cookie, no login) and merges
 * them into leetcode.json, which the workflow commits to the leetcode-data branch.
 *
 *   LEETCODE_USERNAME=name npm run leetcode-sync -- --out content/leetcode
 *
 * LeetCode only returns the latest ~20 accepted submissions, so history builds up from when this first runs.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isLeetCodeFeed, type LeetCodeFeed, type LeetCodeFeedItem } from "../lib/leetcode";

const ENDPOINT = "https://leetcode.com/graphql";

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", referer: "https://leetcode.com/", "user-agent": "fundamentals-tracker leetcode-sync" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`LeetCode answered ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length || !json.data) throw new Error(json.errors?.[0]?.message ?? "empty response");
  return json.data;
}

async function main() {
  const username = process.env.LEETCODE_USERNAME?.trim();
  const outIdx = process.argv.indexOf("--out");
  const out = outIdx > -1 ? process.argv[outIdx + 1] : "content/leetcode";
  if (!username) {
    console.log("LEETCODE_USERNAME is not set; nothing to sync.");
    return;
  }
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(username)) throw new Error("LEETCODE_USERNAME doesn't look like a LeetCode username");

  const file = join(out, "leetcode.json");
  let prior: LeetCodeFeed | null = null;
  try {
    const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (isLeetCodeFeed(raw) && raw.username === username) prior = raw;
  } catch {}
  const items = new Map<string, LeetCodeFeedItem>((prior?.items ?? []).map((i) => [i.slug, i]));

  const recent = await gql<{ recentAcSubmissionList: { titleSlug: string; title: string; timestamp: string }[] | null }>(
    "query($u:String!){recentAcSubmissionList(username:$u,limit:20){title titleSlug timestamp}}",
    { u: username },
  );
  const submissions = recent.recentAcSubmissionList;
  if (!submissions) throw new Error(`No public profile for "${username}"`);

  for (const s of submissions) {
    const solvedAt = new Date(Number(s.timestamp) * 1000).toISOString();
    const known = items.get(s.titleSlug);
    if (known) {
      if (solvedAt < known.solvedAt) known.solvedAt = solvedAt;
      continue;
    }
    const q = await gql<{ question: { questionFrontendId: string; difficulty: string; topicTags: { slug: string }[] } | null }>(
      "query($s:String!){question(titleSlug:$s){questionFrontendId difficulty topicTags{slug}}}",
      { s: s.titleSlug },
    );
    const difficulty = q.question?.difficulty?.toLowerCase();
    if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") continue;
    const number = Number(q.question?.questionFrontendId);
    items.set(s.titleSlug, {
      slug: s.titleSlug,
      title: s.title,
      ...(Number.isInteger(number) && number > 0 ? { number } : {}),
      difficulty,
      tags: q.question?.topicTags.map((t) => t.slug) ?? [],
      solvedAt,
    });
  }

  const feed: LeetCodeFeed = { version: 1, username, syncedAt: new Date().toISOString(), items: [...items.values()].sort((a, b) => b.solvedAt.localeCompare(a.solvedAt)) };
  mkdirSync(out, { recursive: true });
  writeFileSync(file, JSON.stringify(feed, null, 2) + "\n");
  console.log(`Synced ${feed.items.length} problems for ${username} (${submissions.length} recent accepted).`);
}

main().catch((e) => {
  console.error(`leetcode-sync failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
