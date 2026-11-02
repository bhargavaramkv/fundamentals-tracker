/**
 * Pulls your complete LeetCode history into the private data repo. Run nightly by .github/workflows/leetcode-pull.yml
 * in that repo, with your session in its secrets. Never run this against the public repo: the output holds your code.
 *
 *   LEETCODE_SESSION=... LEETCODE_CSRF=... npm run --silent leetcode-history -- --data <data repo>
 *
 * Only new submissions are fetched. leetcode/extra-slugs.json lists problems LeetCode's progress list leaves out.
 */
import fs from "node:fs";
import path from "node:path";
import { isLeetCodeStore, type LeetCodePullStatus, type LeetCodeStore, type LeetCodeSubmission } from "../lib/leetcode-history";

const GAP_MS = 1500; // Faster than this gets throttled.
const session = process.env.LEETCODE_SESSION;
const csrf = process.env.LEETCODE_CSRF;
const dataIdx = process.argv.indexOf("--data");
if (dataIdx < 0 || !process.argv[dataIdx + 1]) throw new Error("--data is required");
if (!session || !csrf) throw new Error("LEETCODE_SESSION and LEETCODE_CSRF are required");
const dir = path.join(process.argv[dataIdx + 1], "leetcode");
const storeFile = path.join(dir, "submissions.json");

class SignedOut extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    await sleep(GAP_MS);
    const res = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      headers: { cookie: `LEETCODE_SESSION=${session}; csrftoken=${csrf}`, "x-csrftoken": csrf!, referer: "https://leetcode.com/", "content-type": "application/json", "user-agent": "fundamentals-tracker leetcode-history" },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
    if (json?.data && !json.errors?.length) return json.data;
    if (attempt >= 3) throw new Error(`LeetCode answered ${res.status}: ${json?.errors?.[0]?.message ?? "no data"}`);
    await sleep(attempt * 20000);
  }
}

interface ProgressItem { titleSlug: string; lastSubmittedAt: string | null }
async function attemptedProblems(): Promise<ProgressItem[]> {
  const items: ProgressItem[] = [];
  for (let skip = 0; ; skip += 50) {
    const d = await gql<{ userProgressQuestionList: { totalNum: number; questions: ProgressItem[] } }>(
      "query($f:UserProgressQuestionListInput){userProgressQuestionList(filters:$f){totalNum questions{titleSlug lastSubmittedAt}}}",
      { f: { skip, limit: 50 } },
    );
    items.push(...d.userProgressQuestionList.questions);
    if (!d.userProgressQuestionList.questions.length || items.length >= d.userProgressQuestionList.totalNum) return items;
  }
}

interface ListItem { id: string; title: string; statusDisplay: string; lang: string; timestamp: string }
async function submissionsOf(slug: string): Promise<ListItem[]> {
  const all: ListItem[] = [];
  let key: string | null = null;
  for (let offset = 0; ; offset += 20) {
    const d: { questionSubmissionList: { lastKey: string | null; hasNext: boolean; submissions: ListItem[] } } = await gql(
      "query($o:Int!,$l:Int!,$k:String,$s:String!){questionSubmissionList(offset:$o,limit:$l,lastKey:$k,questionSlug:$s){lastKey hasNext submissions{id title statusDisplay lang timestamp}}}",
      { o: offset, l: 20, k: key, s: slug },
    );
    all.push(...d.questionSubmissionList.submissions);
    if (!d.questionSubmissionList.hasNext) return all;
    key = d.questionSubmissionList.lastKey;
  }
}

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}

function save(store: LeetCodeStore, status: Omit<LeetCodePullStatus, "at" | "total">) {
  fs.mkdirSync(dir, { recursive: true });
  store.submissions.sort((a, b) => a.timestamp - b.timestamp);
  fs.writeFileSync(storeFile, `${JSON.stringify(store, null, 1)}\n`);
  const full: LeetCodePullStatus = { ...status, at: new Date().toISOString(), total: store.submissions.length };
  fs.writeFileSync(path.join(dir, "status.json"), `${JSON.stringify(full, null, 1)}\n`);
}

async function main() {
  const prior = readJson<unknown>(storeFile);
  const store: LeetCodeStore = isLeetCodeStore(prior) ? prior : { version: 1, username: "", submissions: [] };
  const known = new Set(store.submissions.map((s) => s.id));
  let added = 0;
  try {
    const who = await gql<{ userStatus: { isSignedIn: boolean; username: string } }>("query{userStatus{isSignedIn username}}", {});
    if (!who.userStatus.isSignedIn) throw new SignedOut();
    store.username = who.userStatus.username;

    const progress = await attemptedProblems();
    const lastSeen = new Map<string, number>();
    for (const s of store.submissions) lastSeen.set(s.slug, Math.max(lastSeen.get(s.slug) ?? 0, s.timestamp));
    const inProgress = new Set(progress.map((p) => p.titleSlug));
    const changed = progress
      .filter((p) => !lastSeen.has(p.titleSlug) || !p.lastSubmittedAt || Date.parse(p.lastSubmittedAt) / 1000 > lastSeen.get(p.titleSlug)!)
      .map((p) => p.titleSlug);
    // These aren't in the progress list, so there's no last-submitted date to say whether they changed.
    const extras = [...(readJson<string[]>(path.join(dir, "extra-slugs.json")) ?? []), ...lastSeen.keys()].filter((s) => !inProgress.has(s));
    const meta = new Map(store.submissions.map((s) => [s.slug, { number: s.number, difficulty: s.difficulty, tags: s.tags }]));

    for (const slug of new Set([...changed, ...extras])) {
      const fresh = (await submissionsOf(slug)).filter((s) => !known.has(String(s.id)));
      if (!fresh.length) continue;
      if (!meta.has(slug)) {
        const q = await gql<{ question: { questionFrontendId: string; difficulty: string; topicTags: { slug: string }[] } | null }>(
          "query($s:String!){question(titleSlug:$s){questionFrontendId difficulty topicTags{slug}}}",
          { s: slug },
        );
        meta.set(slug, { number: q.question?.questionFrontendId ?? null, difficulty: q.question?.difficulty ?? null, tags: q.question?.topicTags.map((t) => t.slug) ?? [] });
      }
      for (const s of fresh) {
        const d = await gql<{ submissionDetails: Partial<LeetCodeSubmission> | null }>(
          "query($id:Int!){submissionDetails(submissionId:$id){code runtimeDisplay memoryDisplay runtimePercentile memoryPercentile lastTestcase codeOutput expectedOutput totalCorrect totalTestcases runtimeError compileError notes}}",
          { id: Number(s.id) },
        );
        store.submissions.push({
          ...d.submissionDetails,
          id: String(s.id), title: s.title, slug, status: s.statusDisplay, lang: s.lang, timestamp: Number(s.timestamp),
          code: d.submissionDetails?.code ?? "", ...meta.get(slug)!,
        });
        known.add(String(s.id));
        added++;
      }
    }
    save(store, { ok: true, message: `Added ${added} new submissions` });
    console.log(JSON.stringify({ ok: true, added, total: store.submissions.length, problems: new Set(store.submissions.map((s) => s.slug)).size }));
  } catch (err) {
    // Keep whatever was fetched: the next run carries on from it.
    const signedOut = err instanceof SignedOut;
    const message = signedOut ? "LeetCode session expired: update the LEETCODE_SESSION and LEETCODE_CSRF secrets" : err instanceof Error ? err.message : "Pull failed";
    save(store, { ok: false, reason: signedOut ? "signed-out" : "error", message });
    console.error(JSON.stringify({ ok: false, added, message }));
    process.exitCode = 1;
  }
}

void main();
