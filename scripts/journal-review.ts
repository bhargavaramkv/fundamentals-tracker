/**
 * The session review routine's deterministic steps (docs/review-routine.md).
 *
 *   npm run --silent journal-review -- pending --data <data repo>
 *   npm run --silent journal-review -- context <requestId> --data <data repo>
 *   npm run --silent journal-review -- commit  <requestId> <review.json> --data <data repo>
 *   npm run --silent journal-review -- fail    <requestId> <message> --data <data repo>
 *
 * commit and fail write only under journal/reviews/ and journal/review-failures/ and publish with one git commit.
 * Exit code 2 means the review was rejected and nothing changed.
 */
import fs from "node:fs";
import { publish, need, positionals } from "../lib/data-publish";
import { buildReviewContext } from "../lib/review/context";
import { commitReview, findPending, recordFailure } from "../lib/review/data";

function pending() {
  console.log(JSON.stringify(findPending(need("data")), null, 1));
}

async function context() {
  const [id] = positionals();
  if (!id) throw new Error("usage: context <requestId>");
  console.log(JSON.stringify(await buildReviewContext(need("data"), id), null, 1));
}

async function commit() {
  const [id, file] = positionals();
  if (!id || !file) throw new Error("usage: commit <requestId> <review.json>");
  const dataDir = need("data");
  const result = await commitReview(dataDir, id, JSON.parse(fs.readFileSync(file, "utf8")) as unknown);
  if (result.status === "rejected") {
    console.error(`Review rejected. Nothing was written.\n${result.errors.map((e) => `- ${e}`).join("\n")}`);
    process.exit(2);
  }
  if (result.status === "written") publish(dataDir, [result.path], `review ${id}`);
  console.log(JSON.stringify({ status: result.status, path: result.path }));
}

function fail() {
  const [id, ...message] = positionals();
  if (!id || message.length === 0) throw new Error("usage: fail <requestId> <message>");
  const dataDir = need("data");
  const rel = recordFailure(dataDir, id, message.join(" "));
  publish(dataDir, [rel], `review failure ${id}`);
  console.log(JSON.stringify({ status: "recorded", path: rel }));
}

const commands: Record<string, () => void | Promise<void>> = { pending, context, commit, fail };
const command = commands[process.argv[2] ?? ""];
if (!command) {
  console.error(`Unknown command. Use one of: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}
Promise.resolve(command()).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
