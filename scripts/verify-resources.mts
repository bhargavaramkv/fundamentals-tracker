/**
 * Checks that every link in the resource registry still works, and records the date it was confirmed.
 *
 *   npm run resources:verify            # report only; exit 1 if any link is broken
 *   npm run resources:verify -- --write # also stamp verifiedAt on the links that passed
 *
 * A site that refuses automated requests (401, 403, 429) is reported as "blocked". It keeps its old date rather than
 * being stamped: a date in the registry always means the page was actually fetched. Check blocked links by hand.
 */
import fs from "node:fs";
import path from "node:path";
import type { Resource } from "../lib/resources";

const file = path.resolve(import.meta.dirname, "../content/resources/registry.json");
const write = process.argv.includes("--write");
const today = new Date().toISOString().slice(0, 10);

type Result = { resource: Resource; state: "ok" | "blocked" | "broken"; detail: string; title: string };

function pageTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 90) : "";
}

async function check(resource: Resource): Promise<Result> {
  try {
    const res = await fetch(resource.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FundamentalsLinkCheck/1.0; +https://github.com/bhargavaramkv/fundamentals-tracker)", Accept: "text/html,*/*;q=0.5" },
    });
    const moved = res.url !== resource.url ? ` -> ${res.url}` : "";
    if (res.ok) return { resource, state: "ok", detail: `${res.status}${moved}`, title: pageTitle(await res.text()) };
    if ([401, 403, 429].includes(res.status)) return { resource, state: "blocked", detail: `${res.status}`, title: "" };
    return { resource, state: "broken", detail: `${res.status}${moved}`, title: "" };
  } catch (err) {
    return { resource, state: "broken", detail: (err as Error).message, title: "" };
  }
}

const resources = JSON.parse(fs.readFileSync(file, "utf8")) as Resource[];
const results: Result[] = [];
const queue = [...resources];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) results.push(await check(r));
  }),
);

for (const r of results.sort((a, b) => a.state.localeCompare(b.state) || a.resource.id.localeCompare(b.resource.id))) {
  console.log(`${r.state.padEnd(8)}${r.resource.id.padEnd(28)}${r.detail}${r.title ? ` | ${r.title}` : ""}`);
}
const count = (s: Result["state"]) => results.filter((r) => r.state === s).length;
console.log(`\n${count("ok")} ok, ${count("blocked")} blocked, ${count("broken")} broken`);

if (write) {
  const passed = new Set(results.filter((r) => r.state === "ok").map((r) => r.resource.id));
  const next = resources.map((r) => (passed.has(r.id) ? { ...r, verifiedAt: today } : r));
  const lines = next.map((r) => `  ${JSON.stringify(r)}`).join(",\n");
  fs.writeFileSync(file, `[\n${lines}\n]\n`);
  console.log(`stamped ${passed.size} links as verified on ${today}`);
}
process.exit(count("broken") > 0 ? 1 : 0);
