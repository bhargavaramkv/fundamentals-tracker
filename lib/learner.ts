/**
 * What the app has learned about the owner (learner/profile.json in the private data repo). Written nightly by the
 * daily routine through scripts/learner-profile.ts; read by the Today page and the coach panel.
 */
export interface LearnerProfile {
  updatedAt: string;
  /** Latest activity this profile covers. */
  analysedThrough: string;
  /** One plain sentence for the Today page: where you are and what matters now. */
  headline: string;
  patterns: { label: string; note: string }[];
  interests: string[];
  strengths: string[];
  struggles: { topic: string; misconception: string }[];
  nextUp: { topic: string; why: string }[];
  /** Lesson changes made for the learner, newest first. */
  adaptations: { date: string; topic: string; change: string; why: string }[];
  notes: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isIso = (v: unknown) => isStr(v) && !Number.isNaN(Date.parse(v));

export function validateLearnerProfile(p: unknown, lessonKeys: Set<string>): string[] {
  if (!isObj(p)) return ["profile must be an object"];
  const errors: string[] = [];
  if (!isIso(p.updatedAt)) errors.push("updatedAt must be an ISO date string");
  if (!isIso(p.analysedThrough)) errors.push("analysedThrough must be an ISO date string");
  if (!isStr(p.headline) || p.headline.length > 200) errors.push("headline must be a non-empty string of at most 200 characters");
  if (typeof p.notes !== "string" || p.notes.length > 4000) errors.push("notes must be a string of at most 4000 characters");

  const list = (name: string, min: number, max: number, item: (v: unknown, at: string) => void) => {
    const v = p[name];
    if (!Array.isArray(v) || v.length < min || v.length > max) {
      errors.push(`${name} must be a list of ${min} to ${max} items`);
      return;
    }
    v.forEach((x, i) => item(x, `${name}[${i}]`));
  };
  const key = (v: unknown, at: string) => {
    if (!isStr(v) || !lessonKeys.has(v)) errors.push(`${at} is not an existing lesson key: ${String(v)}`);
  };

  list("patterns", 1, 6, (x, at) => {
    if (!isObj(x) || !isStr(x.label) || !isStr(x.note)) errors.push(`${at} needs label and note`);
  });
  list("interests", 0, 6, (x, at) => {
    if (!isStr(x)) errors.push(`${at} must be a non-empty string`);
  });
  list("strengths", 0, 6, (x, at) => {
    if (!isStr(x)) errors.push(`${at} must be a non-empty string`);
  });
  list("struggles", 0, 6, (x, at) => {
    if (!isObj(x) || !isStr(x.misconception)) return void errors.push(`${at} needs topic and misconception`);
    key(x.topic, `${at}.topic`);
  });
  list("nextUp", 0, 3, (x, at) => {
    if (!isObj(x) || !isStr(x.why) || x.why.length > 160) return void errors.push(`${at} needs topic and a why of at most 160 characters`);
    key(x.topic, `${at}.topic`);
  });
  if (Array.isArray(p.nextUp)) {
    const topics = p.nextUp.map((x) => (isObj(x) ? x.topic : null));
    if (new Set(topics).size !== topics.length) errors.push("nextUp has duplicate topics");
  }
  list("adaptations", 0, 20, (x, at) => {
    if (!isObj(x) || typeof x.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !isStr(x.change) || !isStr(x.why)) {
      return void errors.push(`${at} needs date (YYYY-MM-DD), topic, change and why`);
    }
    key(x.topic, `${at}.topic`);
  });
  if (Array.isArray(p.adaptations)) {
    const dates = p.adaptations.map((x) => (isObj(x) && typeof x.date === "string" ? x.date : ""));
    if (dates.some((d, i) => i > 0 && d > dates[i - 1])) errors.push("adaptations must be newest first");
  }
  return errors;
}
