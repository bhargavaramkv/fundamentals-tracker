import {
  DIMENSIONS,
  MENTOR_SCHEMA,
  type Dimension,
  type EvidenceItem,
  type LearnerState,
  type Level,
  type LevelChange,
  type MentorActivity,
  type MentorPacket,
  type NewInteractions,
  type Proposal,
  type ProposedEvidence,
} from "./types";

/**
 * The rules Claude can't talk its way past. A proposal either passes all of them or nothing is persisted.
 * The site's learner state only ever comes through here.
 */
const MAX_ACTIVITY_MINUTES = 120;
const MAX_SUPPORTING = 2;
const SLUG = /^[a-z0-9][a-z0-9/_-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const isStr = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
const isList = (x: unknown): x is unknown[] => Array.isArray(x);

export interface SourceInfo {
  kind: ProposedEvidence["source"]["kind"];
  sessionKey: string;
  occurredAt: string;
  /** Text a quote must come from. Null when the source has no written work. */
  text: string | null;
}

/** Everything tonight's evidence may cite, keyed by kind:id. */
export function sourcesOf(n: NewInteractions): Map<string, SourceInfo> {
  const map = new Map<string, SourceInfo>();
  for (const a of n.answers) map.set(`answer:${a.id}`, { kind: "answer", sessionKey: `session:${a.sessionId}`, occurredAt: a.answeredAt, text: null });
  for (const a of n.activities) map.set(`activity:${a.id}`, { kind: "activity", sessionKey: `activity:${a.id}`, occurredAt: a.at, text: a.note ?? null });
  for (const a of n.coding) map.set(`coding:${a.id}`, { kind: "coding", sessionKey: `coding:${a.id}`, occurredAt: a.at, text: a.notes ?? null });
  for (const r of n.reads) map.set(`read:${r.id}`, { kind: "read", sessionKey: `read:${r.id}`, occurredAt: r.openedAt, text: null });
  for (const s of n.submissions) map.set(`submission:${s.id}`, { kind: "submission", sessionKey: `submission:${s.id}`, occurredAt: s.submittedAt, text: s.answer });
  for (const c of n.conversations) {
    map.set(`conversation:${c.id}`, {
      kind: "conversation",
      sessionKey: `conversation:${c.id}`,
      occurredAt: c.updatedAt,
      // Only the learner's own words can demonstrate anything.
      text: c.turns.filter((t) => t.role === "learner").map((t) => t.text).join("\n"),
    });
  }
  return map;
}

function checkActivity(a: MentorActivity | undefined, where: string, known: Set<string>, resourceIds: ReadonlySet<string>, skills: Set<string>, errors: string[]) {
  const add = (m: string) => errors.push(`${where}: ${m}`);
  if (!a || typeof a !== "object") return add("is missing");
  for (const k of ["id", "kind", "title", "objective", "why", "exercise"] as const) if (!isStr(a[k])) add(`${k} is required`);
  if (!["dialogue", "explain-back", "code-problem", "quiz", "practical", "revision"].includes(a.kind)) add(`unknown kind ${String(a.kind)}`);
  if (!isList(a.skillIds) || a.skillIds.length === 0) add("needs at least one skill");
  else for (const s of a.skillIds) if (!skills.has(s)) add(`unknown skill ${s}`);
  if (!isList(a.expectedOutcomes) || a.expectedOutcomes.length === 0) add("needs expected outcomes");
  if (!isList(a.rubric) || a.rubric.length === 0) add("needs a rubric");
  if (typeof a.minutes !== "number" || a.minutes <= 0 || a.minutes > MAX_ACTIVITY_MINUTES) add(`minutes must be 1-${MAX_ACTIVITY_MINUTES}`);
  if (!isList(a.whyEvidenceIds)) add("whyEvidenceIds is required");
  else {
    if (a.whyEvidenceIds.length === 0 && a.noEvidenceYet !== true) add("a reason must cite evidence or set noEvidenceYet");
    if (a.whyEvidenceIds.length > 0 && a.noEvidenceYet === true) add("can't cite evidence and set noEvidenceYet");
    for (const id of a.whyEvidenceIds) if (!known.has(id)) add(`cites unknown evidence ${id}`);
  }
  if (!isList(a.resources)) add("resources is required");
  else for (const r of a.resources) {
    if (!r || !resourceIds.has(r.id)) add(`resource ${String(r?.id)} isn't in the registry`);
    else if (!isStr(r.why)) add(`resource ${r.id} needs a reason`);
  }
}

const emptyLevel = { level: null as Level | null };

/** What changed between two versions, worked out here so a change can't go unreported. */
export function levelChanges(prev: LearnerState | null, next: Pick<Proposal["profile"], "skills">): LevelChange[] {
  const out: LevelChange[] = [];
  for (const s of next.skills) {
    const before = prev?.profile.skills.find((x) => x.id === s.id);
    for (const d of DIMENSIONS) {
      const from = before?.dimensions[d]?.level ?? null;
      const to = s.dimensions[d]?.level ?? null;
      if (from !== to) out.push({ skillId: s.id, dimension: d, from, to, evidenceIds: s.dimensions[d]?.evidenceIds ?? [] });
    }
  }
  return out;
}

function checkLevelRules(p: Proposal, packet: MentorPacket, prev: LearnerState | null, tonight: EvidenceItem[], history: EvidenceItem[], errors: string[]) {
  const all = [...history, ...tonight];
  const byId = new Map(all.map((e) => [e.id, e]));
  const tonightIds = new Set(tonight.map((e) => e.id));

  for (const skill of p.profile.skills) {
    const before = prev?.profile.skills.find((x) => x.id === skill.id);
    for (const d of DIMENSIONS) {
      const st = skill.dimensions?.[d];
      const where = `skill ${skill.id} ${d}`;
      if (!st) {
        errors.push(`${where}: missing`);
        continue;
      }
      if (st.level !== null && ![0, 1, 2, 3, 4].includes(st.level)) errors.push(`${where}: level must be 0-4 or null`);
      if (!["low", "medium", "high"].includes(st.confidence)) errors.push(`${where}: unknown confidence`);
      if (!isList(st.evidenceIds)) {
        errors.push(`${where}: evidenceIds is required`);
        continue;
      }
      if (st.level !== null && st.evidenceIds.length === 0) errors.push(`${where}: a level needs supporting evidence`);

      const cited: EvidenceItem[] = [];
      for (const id of st.evidenceIds) {
        const e = byId.get(id);
        if (!e) errors.push(`${where}: unknown evidence ${id}`);
        else if (e.skillId !== skill.id || e.dimension !== d) errors.push(`${where}: evidence ${id} is about ${e.skillId} ${e.dimension}`);
        else cited.push(e);
      }

      const from = (before?.dimensions[d] ?? emptyLevel).level;
      const to = st.level;
      const supports = cited.filter((e) => e.direction === "supports");
      const contradicts = cited.filter((e) => e.direction === "contradicts");
      const days = new Set(cited.map((e) => e.occurredAt.slice(0, 10)));

      // Self-grading and reading alone can't establish that something is known.
      const retrieved = supports.filter((e) => e.source.kind !== "read" && e.source.kind !== "activity");
      if (st.confidence === "high" && (supports.length + contradicts.length < 3 || days.size < 2)) errors.push(`${where}: high confidence needs 3+ evidence items over 2+ days`);

      if (from === to) continue;
      if (to === null) {
        errors.push(`${where}: can't go from tested to untested`);
        continue;
      }
      if (!cited.some((e) => tonightIds.has(e.id))) errors.push(`${where}: a level change needs evidence from tonight`);

      if (from === null) {
        // A first assessment. Stronger claims need more independent proof.
        if (to >= 2 && retrieved.length < 2) errors.push(`${where}: a first level of ${to} needs 2+ pieces of independent reasoning or retrieval`);
        if (to >= 3 && !retrieved.some((e) => e.strength === "strong")) errors.push(`${where}: a first level of ${to} needs strong evidence`);
        if (to >= 3 && new Set(retrieved.map((e) => e.quote ?? e.id)).size < 3) errors.push(`${where}: a first level of ${to} needs 3+ distinct demonstrations`);
        if (to === 4 && days.size < 2) errors.push(`${where}: applying independently needs evidence from 2+ days`);
      } else if (to > from) {
        if (to - from > 1) errors.push(`${where}: a level can rise by 1 per night (${from} to ${to})`);
        if (new Set(retrieved.map((e) => e.sessionKey)).size < 2) errors.push(`${where}: a rise needs supporting evidence from 2+ separate sessions`);
        if (!retrieved.some((e) => e.strength !== "weak")) errors.push(`${where}: a rise needs more than weak evidence`);
        if (to === 4 && days.size < 2) errors.push(`${where}: applying independently needs evidence from 2+ days`);
      } else {
        if (from - to > 1) errors.push(`${where}: a level can fall by 1 per night (${from} to ${to})`);
        if (contradicts.length < 2) errors.push(`${where}: a fall needs 2+ contradicting pieces of evidence`);
      }
    }
  }

  if (prev) {
    const nextIds = new Set(p.profile.skills.map((s) => s.id));
    for (const s of prev.profile.skills) if (!nextIds.has(s.id)) errors.push(`skill ${s.id}: history can't be dropped`);
  }

  const hasNew = Object.values(packet.newInteractions).some((l) => (l as unknown[]).length > 0);
  if (!hasNew && p.evidence.length > 0) errors.push("evidence was proposed with no new interactions");
}

export interface ValidationContext {
  packet: MentorPacket;
  previous: LearnerState | null;
  history: EvidenceItem[];
  resourceIds: ReadonlySet<string>;
}

export interface ValidationResult {
  errors: string[];
  /** The rules that ran, for the night's report. */
  checks: string[];
  evidence: EvidenceItem[];
}

export const CHECK_NAMES = [
  "The proposal matches tonight's date and input",
  "Every quote appears word for word in the learner's own work",
  "Reading is never counted as supporting evidence",
  "Level changes follow the evidence rules",
  "No skill or history was dropped",
  "The plan has one primary objective and at most two supporting activities",
  "Every recommendation cites evidence or says none exists yet",
  "Every resource comes from the verified registry",
];

export function validateProposal(raw: unknown, ctx: ValidationContext): ValidationResult {
  const errors: string[] = [];
  const result = (evidence: EvidenceItem[] = []): ValidationResult => ({ errors, checks: errors.length === 0 ? CHECK_NAMES : [], evidence });
  const p = raw as Proposal;
  const { packet, previous, history, resourceIds } = ctx;

  if (!p || typeof p !== "object") {
    errors.push("the proposal isn't an object");
    return result();
  }
  if (p.schema !== MENTOR_SCHEMA) errors.push(`schema must be ${MENTOR_SCHEMA}`);
  if (p.forDate !== packet.forDate) errors.push(`forDate must be ${packet.forDate}`);
  if (p.inputHash !== packet.inputHash) errors.push("inputHash doesn't match tonight's packet");
  if (!p.analysis || !isStr(p.analysis.summary) || !isStr(p.analysis.decisionRationale)) errors.push("analysis needs a summary and a decision rationale");
  if (p.analysis && (!isList(p.analysis.improved) || !isList(p.analysis.regressed))) errors.push("analysis needs improved and regressed lists");
  if (!p.profile || !isList(p.profile.skills) || !isList(p.profile.misconceptions) || !isList(p.profile.strengths) || !isList(p.profile.weaknesses) || !isList(p.profile.longTermObjectives)) {
    errors.push("profile is incomplete");
    return result();
  }
  if (!p.roadmap || !isList(p.roadmap.items) || !isList(p.roadmap.changes)) errors.push("roadmap is incomplete");
  if (!p.plan) {
    errors.push("plan is missing");
    return result();
  }
  if (!isList(p.evidence)) {
    errors.push("evidence must be a list");
    return result();
  }
  if (!isList(p.feedback)) errors.push("feedback must be a list");

  // Evidence
  const sources = sourcesOf(packet.newInteractions);
  const historyIds = new Set(history.map((e) => e.id));
  const seen = new Set<string>();
  const tonight: EvidenceItem[] = [];
  p.evidence.forEach((e, i) => {
    const where = `evidence ${e?.id ?? i}`;
    const add = (m: string) => errors.push(`${where}: ${m}`);
    if (!e || !isStr(e.id) || !SLUG.test(e.id)) return add("needs a lowercase id");
    if (seen.has(e.id) || historyIds.has(e.id)) add("id is already used");
    seen.add(e.id);
    if (!isStr(e.skillId)) add("skillId is required");
    if (!DIMENSIONS.includes(e.dimension as Dimension)) add(`unknown dimension ${String(e.dimension)}`);
    if (!["supports", "contradicts", "neutral"].includes(e.direction)) add(`unknown direction ${String(e.direction)}`);
    if (!["weak", "moderate", "strong"].includes(e.strength)) add(`unknown strength ${String(e.strength)}`);
    if (!isStr(e.note)) add("needs a note");
    const src = e.source ? sources.get(`${e.source.kind}:${e.source.id}`) : undefined;
    if (!src) return add(`source ${e.source?.kind}:${e.source?.id} isn't among tonight's new interactions`);
    if (e.source.kind === "read" && e.direction === "supports") add("reading a lesson can't support a skill");
    if (e.source.kind === "submission" || e.source.kind === "conversation") {
      if (!isStr(e.quote)) add("written work needs a verbatim quote");
    }
    if (isStr(e.quote) && (src.text === null || !norm(src.text).includes(norm(e.quote)))) add("the quote isn't word for word in the learner's own text");
    tonight.push({ ...e, forDate: packet.forDate, sessionKey: src.sessionKey, occurredAt: src.occurredAt });
  });

  // Profile
  // Only assessed skills are listed; the catalogue covers what a plan may aim at before anything is known.
  const assessed = new Set<string>();
  for (const s of p.profile.skills) {
    if (!s || !isStr(s.id) || !SLUG.test(s.id) || !isStr(s.title)) {
      errors.push(`skill ${String(s?.id)}: needs a slug id and a title`);
      continue;
    }
    if (assessed.has(s.id)) errors.push(`skill ${s.id}: duplicated`);
    assessed.add(s.id);
    if (s.nextRevisionAt !== null && !(isStr(s.nextRevisionAt) && DATE.test(s.nextRevisionAt))) errors.push(`skill ${s.id}: nextRevisionAt must be YYYY-MM-DD or null`);
  }
  const skillIds = new Set([...assessed, ...packet.skillCatalogue.map((s) => s.id)]);
  for (const e of tonight) if (!skillIds.has(e.skillId)) errors.push(`evidence ${e.id}: unknown skill ${e.skillId}`);
  checkLevelRules(p, packet, previous, tonight, history, errors);

  const known = new Set([...history.map((e) => e.id), ...tonight.map((e) => e.id)]);
  for (const list of [p.profile.strengths, p.profile.weaknesses]) {
    for (const a of list) {
      if (!a || !skillIds.has(a.skillId)) errors.push(`assessment for unknown skill ${String(a?.skillId)}`);
      else if (!isStr(a.note)) errors.push(`assessment for ${a.skillId}: needs a note`);
      else if (!isList(a.evidenceIds) || a.evidenceIds.length === 0) errors.push(`assessment for ${a.skillId}: a strength or weakness needs evidence`);
      else for (const id of a.evidenceIds) if (!known.has(id)) errors.push(`assessment for ${a.skillId}: unknown evidence ${id}`);
    }
  }
  for (const m of p.profile.misconceptions) {
    if (!m || !isStr(m.id) || !isStr(m.description) || !skillIds.has(m.skillId)) errors.push(`misconception ${String(m?.id)}: incomplete`);
    else if (!isList(m.evidenceIds) || m.evidenceIds.length === 0) errors.push(`misconception ${m.id}: needs evidence`);
    else for (const id of m.evidenceIds) if (!known.has(id)) errors.push(`misconception ${m.id}: unknown evidence ${id}`);
  }

  // Plan
  if (p.plan.forDate !== packet.forDate) errors.push(`plan.forDate must be ${packet.forDate}`);
  if (!isList(p.plan.supporting)) errors.push("plan.supporting must be a list");
  else if (p.plan.supporting.length > MAX_SUPPORTING) errors.push(`at most ${MAX_SUPPORTING} supporting activities`);
  checkActivity(p.plan.primary, "plan.primary", known, resourceIds, skillIds, errors);
  if (isList(p.plan.supporting)) p.plan.supporting.forEach((a, i) => checkActivity(a, `plan.supporting[${i}]`, known, resourceIds, skillIds, errors));
  if (!isList(p.plan.revision)) errors.push("plan.revision must be a list");
  else for (const r of p.plan.revision) {
    if (!r || !skillIds.has(r.skillId) || !isStr(r.why) || !DATE.test(String(r.due))) errors.push(`revision for ${String(r?.skillId)}: needs a known skill, a reason and a date`);
  }

  // Feedback can only be about work that actually arrived tonight.
  if (isList(p.feedback)) {
    const submissions = new Set(packet.newInteractions.submissions.map((s) => s.id));
    for (const f of p.feedback) {
      if (!f || !submissions.has(f.submissionId)) errors.push(`feedback for unknown submission ${String(f?.submissionId)}`);
      else if (!isStr(f.feedback) || !["strong", "partial", "weak"].includes(f.verdict)) errors.push(`feedback for ${f.submissionId}: incomplete`);
    }
    for (const id of submissions) if (!p.feedback.some((f) => f?.submissionId === id)) errors.push(`submission ${id} has no feedback`);
  }

  return result(tonight);
}
