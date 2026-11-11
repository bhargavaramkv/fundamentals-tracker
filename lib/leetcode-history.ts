/**
 * Your complete LeetCode history, pulled nightly into the private data repo (leetcode/submissions.json), and the
 * analysis built on it. It holds your code, so it must never be written to the public repo or its branches.
 */
export interface LeetCodeSubmission {
  id: string;
  title: string;
  slug: string;
  number: string | null;
  difficulty: string | null;
  tags: string[];
  status: string;
  lang: string;
  /** Unix seconds. */
  timestamp: number;
  code: string;
  runtimeDisplay?: string | null;
  memoryDisplay?: string | null;
  runtimePercentile?: number | null;
  memoryPercentile?: number | null;
  lastTestcase?: string | null;
  codeOutput?: string | null;
  expectedOutput?: string | null;
  totalCorrect?: number | null;
  totalTestcases?: number | null;
  runtimeError?: string | null;
  compileError?: string | null;
  notes?: string | null;
}

export interface LeetCodeStore {
  version: 1;
  username: string;
  submissions: LeetCodeSubmission[];
}

export interface LeetCodePullStatus {
  ok: boolean;
  at: string;
  total: number;
  reason?: "signed-out" | "error";
  message: string;
}

export function isLeetCodeStore(raw: unknown): raw is LeetCodeStore {
  const s = raw as Partial<LeetCodeStore> | null;
  return !!s && s.version === 1 && Array.isArray(s.submissions) && s.submissions.every((x) => typeof x?.id === "string" && typeof x.slug === "string" && typeof x.status === "string" && typeof x.timestamp === "number");
}

/** Submits closer together than this count as one sitting. */
const SITTING_GAP_SECONDS = 90 * 60;

export interface CodingStats {
  total: number;
  accepted: number;
  problems: number;
  failures: { status: string; count: number }[];
  quarters: { quarter: string; problems: number; firstTry: number; avgAttempts: number | null }[];
  topics: { tag: string; problems: number; attemptsPerProblem: number; failureRate: number }[];
  difficulty: { difficulty: string; problems: number; failureRate: number }[];
  /** Attempts and failures stop at the first accept; `later` counts submissions after it (re-solves, other languages). */
  hardest: { slug: string; title: string; attempts: number; acceptedOnTry: number | null; failures: { status: string; count: number }[]; later: number; minutesToAccept: number | null }[];
  errors: { message: string; count: number }[];
  nearMisses: { slug: string; title: string; passed: number; of: number; failedOn: string; at: number }[];
  recent: { count: number; runtimePercentile: number; memoryPercentile: number } | null;
  lastSubmittedAt: number | null;
  solved: number;
  /** Problems with no accepted submission, most recently tried first. */
  unsolved: { slug: string; title: string; attempts: number; lastAt: number }[];
  /** The last 10 problems you started, against the 10 before them. `previous` is null until there are 20. */
  form: { last: FormWindow; previous: FormWindow | null };
  /** The last 12 problems you started, oldest first. */
  lately: { slug: string; title: string; acceptedOnTry: number | null; attempts: number }[];
  languages: { lang: string; count: number }[];
  /** Distinct UTC days with a submission (YYYY-MM-DD), the last 60, oldest first. */
  activeDates: string[];
}

export interface FormWindow {
  problems: number;
  /** Solved on the first submission. */
  firstTry: number;
  /** Mean tries to first accept, over the problems solved. */
  avgTries: number | null;
}

/** One problem's whole history, small enough to give the nightly review for every problem you've touched. */
export interface ProblemSummary {
  slug: string;
  title: string;
  difficulty: string | null;
  tags: string[];
  langs: string[];
  attempts: number;
  /** One code per submission, oldest first: AC, WA, RE, TLE, CE, MLE, or the raw status. */
  history: string[];
  acceptedOnTry: number | null;
  /** Unix seconds. */
  firstAt: number;
  lastAt: number;
  /** Runs of submits less than 90 minutes apart. Three sittings means you came back twice. */
  sittings: number;
  minutesToAccept: number | null;
}

const failed = (s: LeetCodeSubmission) => s.status !== "Accepted";

function countBy<T>(items: T[], key: (t: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);
}

/** First submit of the sitting that got accepted, to that accept. Time before the first submit isn't recorded anywhere. */
function minutesToAccept(subs: LeetCodeSubmission[]): number | null {
  let start = 0;
  let prev: number | null = null;
  for (const s of subs) {
    if (prev === null || s.timestamp - prev > SITTING_GAP_SECONDS) start = s.timestamp;
    prev = s.timestamp;
    if (!failed(s)) return Math.round((s.timestamp - start) / 60);
  }
  return null;
}

/** The try number that first passed, or null if it never did. */
function tryOf(l: LeetCodeSubmission[]): number | null {
  const i = l.findIndex((s) => !failed(s));
  return i < 0 ? null : i + 1;
}

const STATUS_CODE: Record<string, string> = { Accepted: "AC", "Wrong Answer": "WA", "Runtime Error": "RE", "Time Limit Exceeded": "TLE", "Compile Error": "CE", "Memory Limit Exceeded": "MLE" };

/** Submissions grouped by problem, the problem you started first coming first, each list oldest first. */
function groupByProblem(input: LeetCodeSubmission[]): LeetCodeSubmission[][] {
  const byProblem = new Map<string, LeetCodeSubmission[]>();
  for (const s of [...input].sort((a, b) => a.timestamp - b.timestamp)) byProblem.set(s.slug, [...(byProblem.get(s.slug) ?? []), s]);
  return [...byProblem.values()];
}

function summarize(l: LeetCodeSubmission[]): ProblemSummary {
  return {
    slug: l[0].slug,
    title: l[0].title,
    difficulty: l[0].difficulty,
    tags: l[0].tags ?? [],
    langs: [...new Set(l.map((s) => s.lang))],
    attempts: l.length,
    history: l.map((s) => STATUS_CODE[s.status] ?? s.status),
    acceptedOnTry: tryOf(l),
    firstAt: l[0].timestamp,
    lastAt: l[l.length - 1].timestamp,
    sittings: 1 + l.slice(1).filter((s, i) => s.timestamp - l[i].timestamp > SITTING_GAP_SECONDS).length,
    minutesToAccept: minutesToAccept(l),
  };
}

export function summarizeProblems(input: LeetCodeSubmission[]): ProblemSummary[] {
  return groupByProblem(input).map(summarize);
}

function formWindow(ls: LeetCodeSubmission[][]): FormWindow {
  const tries = ls.map(tryOf).filter((t): t is number => t !== null);
  return { problems: ls.length, firstTry: tries.filter((t) => t === 1).length, avgTries: tries.length ? tries.reduce((a, b) => a + b, 0) / tries.length : null };
}

const FORM_SIZE = 10;
const LATELY_SIZE = 12;

export function computeCodingStats(input: LeetCodeSubmission[]): CodingStats {
  const subs = [...input].sort((a, b) => a.timestamp - b.timestamp);
  const problems = groupByProblem(subs);

  const quarterMap = new Map<string, LeetCodeSubmission[][]>();
  for (const l of problems) {
    const d = new Date(l[0].timestamp * 1000);
    const q = `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    quarterMap.set(q, [...(quarterMap.get(q) ?? []), l]);
  }
  const quarters = [...quarterMap].sort(([a], [b]) => a.localeCompare(b)).map(([quarter, ls]) => {
    const tries = ls.map(tryOf);
    const solved = tries.filter((t): t is number => t !== null);
    return { quarter, problems: ls.length, firstTry: tries.filter((t) => t === 1).length, avgAttempts: solved.length ? solved.reduce((a, b) => a + b, 0) / solved.length : null };
  });

  const tagMap = new Map<string, { problems: Set<string>; n: number; fails: number }>();
  for (const s of subs) {
    for (const t of s.tags ?? []) {
      const v = tagMap.get(t) ?? { problems: new Set<string>(), n: 0, fails: 0 };
      v.problems.add(s.slug);
      v.n++;
      if (failed(s)) v.fails++;
      tagMap.set(t, v);
    }
  }
  const topics = [...tagMap]
    .filter(([, v]) => v.problems.size >= 2)
    .map(([tag, v]) => ({ tag, problems: v.problems.size, attemptsPerProblem: v.n / v.problems.size, failureRate: v.fails / v.n }))
    .sort((a, b) => b.failureRate - a.failureRate);

  const difficulty = ["Easy", "Medium", "Hard"].flatMap((d) => {
    const ds = subs.filter((s) => s.difficulty === d);
    return ds.length ? [{ difficulty: d, problems: new Set(ds.map((s) => s.slug)).size, failureRate: ds.filter(failed).length / ds.length }] : [];
  });

  const hardest = problems
    .filter((l) => l.some(failed))
    .map((l) => {
      const accepted = tryOf(l);
      const upToAccept = accepted === null ? l : l.slice(0, accepted);
      return { l, accepted, upToAccept, fails: upToAccept.filter(failed) };
    })
    .sort((a, b) => b.fails.length - a.fails.length)
    .slice(0, 10)
    .map(({ l, accepted, upToAccept, fails }) => ({
      slug: l[0].slug,
      title: l[0].title,
      attempts: upToAccept.length,
      acceptedOnTry: accepted,
      failures: countBy(fails, (s) => s.status).map((f) => ({ status: f.key, count: f.count })),
      later: l.length - upToAccept.length,
      minutesToAccept: minutesToAccept(l),
    }));

  const messages = subs.flatMap((s) => {
    const first = (s.runtimeError || s.compileError || "").trim().split("\n")[0];
    return first ? [first.slice(0, 100)] : [];
  });

  const seenMisses = new Set<string>();
  const nearMisses = subs
    .filter((s) => s.status === "Wrong Answer" && s.totalTestcases && (s.totalCorrect ?? 0) / s.totalTestcases >= 0.8)
    .reverse()
    .map((s) => ({ slug: s.slug, title: s.title, passed: s.totalCorrect ?? 0, of: s.totalTestcases ?? 0, failedOn: (s.lastTestcase ?? "").replaceAll("\n", " ").slice(0, 80), at: s.timestamp }))
    .filter((n) => {
      const key = `${n.slug}|${n.failedOn}`;
      if (seenMisses.has(key)) return false;
      seenMisses.add(key);
      return true;
    })
    .slice(0, 8);

  const ranked = subs.filter((s) => !failed(s) && typeof s.runtimePercentile === "number").slice(-10);
  const avg = (f: (s: LeetCodeSubmission) => number) => ranked.reduce((a, s) => a + f(s), 0) / ranked.length;

  return {
    total: subs.length,
    accepted: subs.length - subs.filter(failed).length,
    problems: problems.length,
    failures: countBy(subs.filter(failed), (s) => s.status).map((f) => ({ status: f.key, count: f.count })),
    quarters,
    topics,
    difficulty,
    hardest,
    errors: countBy(messages, (m) => m).slice(0, 6).map((e) => ({ message: e.key, count: e.count })),
    nearMisses,
    recent: ranked.length ? { count: ranked.length, runtimePercentile: avg((s) => s.runtimePercentile ?? 0), memoryPercentile: avg((s) => s.memoryPercentile ?? 0) } : null,
    lastSubmittedAt: subs.length ? subs[subs.length - 1].timestamp : null,
    solved: problems.filter((l) => tryOf(l) !== null).length,
    unsolved: problems
      .filter((l) => tryOf(l) === null)
      .map((l) => ({ slug: l[0].slug, title: l[0].title, attempts: l.length, lastAt: l[l.length - 1].timestamp }))
      .sort((a, b) => b.lastAt - a.lastAt),
    form: {
      last: formWindow(problems.slice(-FORM_SIZE)),
      previous: problems.length >= FORM_SIZE * 2 ? formWindow(problems.slice(-FORM_SIZE * 2, -FORM_SIZE)) : null,
    },
    lately: problems.slice(-LATELY_SIZE).map((l) => ({ slug: l[0].slug, title: l[0].title, acceptedOnTry: tryOf(l), attempts: l.length })),
    languages: countBy(subs, (s) => s.lang).map((l) => ({ lang: l.key, count: l.count })),
    activeDates: [...new Set(subs.map((s) => new Date(s.timestamp * 1000).toISOString().slice(0, 10)))].slice(-60),
  };
}

/** What the nightly routine writes after reading your code (mentor/coding.json). */
export interface CodingReview {
  forDate: string;
  /** The one sentence the page leads with: where you stand and what matters most now. */
  headline: string;
  /** Whether recent work is better or worse than earlier work, and the evidence for saying so. */
  trend: { direction: "improving" | "steady" | "slipping" | "unclear"; note: string };
  /** The full reasoning. The page shows it behind a fold. */
  summary: string;
  focus: { title: string; why: string }[];
  mistakes: { pattern: string; detail: string; check: string; problems: string[] }[];
  nextProblems: { slug: string; title: string; why: string }[];
  reviews: { slug: string; title: string; verdict: "good" | "improve" | "struggling"; note: string }[];
}

/** `headline` and `trend` are missing from reviews written before they existed. */
export interface CodingAnalysis extends Omit<CodingReview, "headline" | "trend">, Partial<Pick<CodingReview, "headline" | "trend">> {
  version: 1;
  generatedAt: string;
  /** Submissions already reviewed, so a night with nothing new does nothing. */
  reviewedIds: string[];
}

export interface CodingPacket {
  decision: "analyse" | "no-new";
  forDate: string;
  stats: CodingStats;
  /** Every problem's attempt history, most recently touched first, so a night's code can be read against the whole record. */
  problems: ProblemSummary[];
  /** Older problems left out of `problems` to keep the packet small. */
  problemsOmitted: number;
  /** The newest unreviewed submissions in full. Any older backlog comes up on later nights. */
  newSubmissions: LeetCodeSubmission[];
  unreviewedCount: number;
  previous: CodingAnalysis | null;
  knownSlugs: string[];
}

const MAX_REVIEWED_PER_NIGHT = 40;
const MAX_PROBLEMS_IN_PACKET = 150;
const TRENDS = ["improving", "steady", "slipping", "unclear"];

export function buildCodingPacket(submissions: LeetCodeSubmission[], previous: CodingAnalysis | null, forDate: string): CodingPacket {
  const reviewed = new Set(previous?.reviewedIds ?? []);
  const fresh = submissions.filter((s) => !reviewed.has(s.id)).sort((a, b) => a.timestamp - b.timestamp);
  const problems = summarizeProblems(submissions).sort((a, b) => b.lastAt - a.lastAt);
  return {
    decision: fresh.length ? "analyse" : "no-new",
    forDate,
    stats: computeCodingStats(submissions),
    problems: problems.slice(0, MAX_PROBLEMS_IN_PACKET),
    problemsOmitted: Math.max(0, problems.length - MAX_PROBLEMS_IN_PACKET),
    newSubmissions: fresh.slice(-MAX_REVIEWED_PER_NIGHT),
    unreviewedCount: fresh.length,
    previous,
    knownSlugs: [...new Set(submissions.map((s) => s.slug))],
  };
}

const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const SLUG = /^[a-z0-9-]+$/;

/** Rejects a review that cites problems you never attempted, so the page can't present made-up evidence. */
export function validateCodingReview(raw: unknown, packet: CodingPacket): string[] {
  const r = raw as Partial<CodingReview> | null;
  if (!r || typeof r !== "object") return ["Review isn't an object"];
  const errors: string[] = [];
  const known = new Set(packet.knownSlugs);
  const reviewable = new Set(packet.newSubmissions.map((s) => s.slug));
  if (r.forDate !== packet.forDate) errors.push(`forDate must be ${packet.forDate}`);
  if (!text(r.headline, 200)) errors.push("headline must be 1-200 characters");
  if (!r.trend || !TRENDS.includes(r.trend.direction) || !text(r.trend.note, 400)) errors.push(`trend needs a direction (${TRENDS.join(", ")}) and a note of 1-400 characters`);
  if (!text(r.summary, 1500)) errors.push("summary must be 1-1500 characters");
  if (!Array.isArray(r.focus) || r.focus.length < 1 || r.focus.length > 3) errors.push("focus must have 1-3 items");
  else r.focus.forEach((f, i) => { if (!text(f?.title, 120) || !text(f?.why, 500)) errors.push(`focus[${i}] needs title and why`); });
  if (!Array.isArray(r.mistakes) || r.mistakes.length > 6) errors.push("mistakes must have at most 6 items");
  else r.mistakes.forEach((m, i) => {
    if (!text(m?.pattern, 120) || !text(m?.detail, 600) || !text(m?.check, 300)) errors.push(`mistakes[${i}] needs pattern, detail and check`);
    if (!Array.isArray(m?.problems) || m.problems.length === 0) errors.push(`mistakes[${i}] must cite problems`);
    else m.problems.filter((p) => !known.has(p)).forEach((p) => errors.push(`mistakes[${i}] cites unknown problem ${p}`));
  });
  if (!Array.isArray(r.nextProblems) || r.nextProblems.length < 1 || r.nextProblems.length > 5) errors.push("nextProblems must have 1-5 items");
  else r.nextProblems.forEach((n, i) => { if (typeof n?.slug !== "string" || !SLUG.test(n.slug) || !text(n?.title, 120) || !text(n?.why, 300)) errors.push(`nextProblems[${i}] needs a valid slug, title and why`); });
  if (!Array.isArray(r.reviews)) errors.push("reviews must be a list");
  else r.reviews.forEach((v, i) => {
    if (!reviewable.has(v?.slug)) errors.push(`reviews[${i}] cites ${v?.slug}, which isn't in tonight's submissions`);
    if (!text(v?.title, 120) || !text(v?.note, 800) || !["good", "improve", "struggling"].includes(v?.verdict)) errors.push(`reviews[${i}] needs title, note and a valid verdict`);
  });
  return errors;
}

/** A newer review of a problem replaces the older one; problems not touched tonight keep theirs. */
export function buildCodingAnalysis(review: CodingReview, packet: CodingPacket, generatedAt: string): CodingAnalysis {
  const touched = new Set(review.reviews.map((r) => r.slug));
  return {
    ...review,
    version: 1,
    generatedAt,
    reviewedIds: [...(packet.previous?.reviewedIds ?? []), ...packet.newSubmissions.map((s) => s.id)],
    reviews: [...review.reviews, ...(packet.previous?.reviews ?? []).filter((r) => !touched.has(r.slug))],
  };
}

export function isCodingAnalysis(raw: unknown): raw is CodingAnalysis {
  const a = raw as Partial<CodingAnalysis> | null;
  return !!a && a.version === 1 && typeof a.summary === "string" && Array.isArray(a.focus) && Array.isArray(a.mistakes) && Array.isArray(a.nextProblems) && Array.isArray(a.reviews);
}

/** A short account of the LeetCode record for the learner mentor's nightly packet. Context for choosing priorities, not evidence of a skill level. */
export interface CodingContext {
  problems: number;
  solved: number;
  lastSubmittedAt: string | null;
  /** The last 10 problems started, as "6 of 10 solved first try". */
  recentForm: string;
  neverPassed: string[];
  review: { headline: string | null; trend: CodingReview["trend"] | null; focus: string[]; mistakes: string[] } | null;
}

export function codingContextOf(submissions: LeetCodeSubmission[], analysis: CodingAnalysis | null): CodingContext {
  const stats = computeCodingStats(submissions);
  const { last } = stats.form;
  return {
    problems: stats.problems,
    solved: stats.solved,
    lastSubmittedAt: stats.lastSubmittedAt === null ? null : new Date(stats.lastSubmittedAt * 1000).toISOString(),
    recentForm: `${last.firstTry} of ${last.problems} solved first try`,
    neverPassed: stats.unsolved.slice(0, 5).map((u) => u.title),
    review: analysis ? { headline: analysis.headline ?? null, trend: analysis.trend ?? null, focus: analysis.focus.map((f) => f.title), mistakes: analysis.mistakes.map((m) => m.pattern) } : null,
  };
}
