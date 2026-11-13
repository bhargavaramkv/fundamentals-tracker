/**
 * SYNTHETIC DATA. Everything in this file is invented for design screenshots and tests. None of it is the owner's
 * real study history, LeetCode record or code. Every id starts with `fixture-`.
 *
 * buildDataRepo() returns the files of an in-memory stand-in for the private data repo (fundamentals-tracker-data):
 * journal sessions, review requests, reviews, one review failure, a weekly report, knowledge evidence, LeetCode
 * submissions and the nightly coding review, progress.json and the mentor-v1 archive.
 *
 * Shapes follow the real types, and the same validators the review routines use are run on the output
 * (validateReview, validateWeekly, validateCodingReview), so the build throws if any file would be rejected.
 * Dates are relative to `now`, so the data always looks recent. See github-mock.ts to serve it.
 */
import { createReviewRequest, deriveSession, sessionHash, sessionPath, requestPath } from "../../lib/journal/events";
import type { JournalSession, ReviewRequest, SessionEvent, SessionSource } from "../../lib/journal/types";
import { normalizeConcept, reviewEvidence } from "../../lib/knowledge/levels";
import type { Evidence, EvidenceFile } from "../../lib/knowledge/types";
import {
  buildCodingAnalysis,
  buildCodingPacket,
  computeCodingStats,
  validateCodingReview,
  type CodingReview,
  type LeetCodeStore,
  type LeetCodeSubmission,
} from "../../lib/leetcode-history";
import { REVIEW_VERSION, reviewPath, type EvidenceRef, type Finding, type MissingConcept, type SessionReview } from "../../lib/review/types";
import { validateReview } from "../../lib/review/validate";
import { isoWeekOf, previousCompleteWeek, sufficiencyFor, validateWeekly, weekStartMs, weeklyActivity, weeklyPath, type WeeklyCite, type WeeklyFinding, type WeeklyReport } from "../../lib/review/weekly";
import { FIXED_NOW, seededProgress } from "../fixture";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const DEVICE = "fixture-device";
const MODEL = "fixture-reviewer";
const iso = (ms: number) => new Date(ms).toISOString();

export interface DataRepo {
  /** The "now" the data is relative to. */
  now: number;
  /** repo path -> file text. */
  files: Record<string, string>;
  /** What was generated, for assertions and for choosing screenshots. */
  summary: {
    sessions: { id: string; subject: string; status: "reviewed" | "pending" | "pending-with-failure" }[];
    weekly: { week: string; sufficiency: "coaching" | "activity-only" };
    concepts: string[];
    leetcodeProblems: number;
  };
}

/* ------------------------------------------------------------------------------------------------------------- */
/* Journal sessions                                                                                               */
/* ------------------------------------------------------------------------------------------------------------- */

interface SessionSpec {
  key: string;
  subject: string;
  source: SessionSource;
  objective: string;
  startMs: number;
  minutes: number;
  /** Minutes into the session at which a 4 minute pause starts. */
  pauseAt?: number;
  topics: string[];
  notes: string[];
  difficulties: string[];
  bookmarks: { label: string; atMin: number }[];
  end: { learned?: string; difficult?: string; unclear?: string };
}

interface Built {
  session: JournalSession;
  /** selector (t0, n1, d0, b0, end) -> event id */
  ids: Record<string, string>;
  endMs: number;
}

function buildSession(s: SessionSpec): Built {
  const id = `fixture-${s.key}`;
  const ids: Record<string, string> = {};
  const timed: { t: number; sel: string; ev: (eid: string, at: string) => SessionEvent }[] = [];
  s.topics.forEach((text, i) => timed.push({ t: 1 + i * 0.5, sel: `t${i}`, ev: (eid, at) => ({ id: eid, at, device: DEVICE, kind: "topic", text }) }));
  // Notes and difficulties alternate: each difficulty follows a note, spread across the session.
  const body: { sel: string; ev: (eid: string, at: string) => SessionEvent }[] = [];
  const dEvery = Math.max(1, Math.floor(s.notes.length / (s.difficulties.length + 1)));
  let d = 0;
  s.notes.forEach((text, i) => {
    body.push({ sel: `n${i}`, ev: (eid, at) => ({ id: eid, at, device: DEVICE, kind: "note", text }) });
    if (d < s.difficulties.length && (i + 1) % dEvery === 0) {
      const dText = s.difficulties[d];
      body.push({ sel: `d${d}`, ev: (eid, at) => ({ id: eid, at, device: DEVICE, kind: "difficulty", text: dText }) });
      d++;
    }
  });
  while (d < s.difficulties.length) {
    const dText = s.difficulties[d];
    body.push({ sel: `d${d}`, ev: (eid, at) => ({ id: eid, at, device: DEVICE, kind: "difficulty", text: dText }) });
    d++;
  }
  const first = 2 + (s.topics.length - 1) * 0.5;
  const span = s.minutes - 3 - first;
  body.forEach((b, i) => timed.push({ t: first + (span * (i + 0.5)) / body.length, ...b }));
  const pausedBefore = (t: number) => (s.pauseAt !== undefined && t >= s.pauseAt + 4 ? 4 : 0);
  s.bookmarks.forEach((b, i) =>
    timed.push({ t: b.atMin, sel: `b${i}`, ev: (eid, at) => ({ id: eid, at, device: DEVICE, kind: "bookmark", label: b.label, activeMs: Math.round((b.atMin - pausedBefore(b.atMin)) * MIN) }) }),
  );
  if (s.pauseAt !== undefined) {
    for (const x of timed) if (x.t >= s.pauseAt && x.t < s.pauseAt + 4) x.t += 4;
  }
  timed.sort((a, b) => a.t - b.t);

  const events: SessionEvent[] = [];
  let n = 0;
  const push = (t: number, sel: string | null, make: (eid: string, at: string) => SessionEvent) => {
    const eid = `fixture-${s.key}-e${String(n++).padStart(2, "0")}`;
    if (sel) ids[sel] = eid;
    events.push(make(eid, iso(s.startMs + Math.round(t * MIN))));
  };
  push(0, null, (eid, at) => ({ id: eid, at, device: DEVICE, kind: "start" }));
  const pauseEvents = s.pauseAt !== undefined;
  let pausePushed = false;
  for (const x of timed) {
    if (pauseEvents && !pausePushed && x.t >= s.pauseAt!) {
      push(s.pauseAt!, null, (eid, at) => ({ id: eid, at, device: DEVICE, kind: "pause" }));
      push(s.pauseAt! + 4, null, (eid, at) => ({ id: eid, at, device: DEVICE, kind: "resume" }));
      pausePushed = true;
    }
    push(x.t, x.sel, x.ev);
  }
  push(s.minutes, "end", (eid, at) => ({ id: eid, at, device: DEVICE, kind: "end", ...s.end }));

  const session: JournalSession = { v: 1, id, createdAt: iso(s.startMs), device: DEVICE, subject: s.subject, source: s.source, objective: s.objective, events };
  return { session, ids, endMs: s.startMs + s.minutes * MIN };
}

/* ------------------------------------------------------------------------------------------------------------- */
/* Reviews                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------- */

type Ref = [selector: string, quote?: string];
interface F {
  concept: string;
  text: string;
  ev: Ref[];
  /** Answers verification question `q` of the earlier review made for session `of`. */
  verifies?: { of: string; q: number };
}
interface M extends F {
  question: string;
}
interface ReviewSpec {
  summary: string;
  understood: F[];
  mis?: F[];
  inc?: F[];
  missing: M[];
  eq: { level: SessionReview["explanationQuality"]["level"]; note: string; ev: Ref[] };
  obs: F[];
  improvements: string[];
  next: string[];
  vq: { concept: string; question: string }[];
}

function refs(b: Built, list: Ref[]): EvidenceRef[] {
  return list.map(([sel, quote]) => {
    const eventId = b.ids[sel];
    if (!eventId) throw new Error(`fixture: unknown event selector ${sel} in ${b.session.id}`);
    return { eventId, ...(quote ? { quote } : {}) };
  });
}

function makeReview(b: Built, req: ReviewRequest, r: ReviewSpec, createdAt: number, prior: Map<string, SessionReview>, builtByKey: Map<string, Built>): SessionReview {
  const finding = (f: F): Finding => {
    let verifies: Finding["verifies"];
    if (f.verifies) {
      const earlier = prior.get(builtByKey.get(f.verifies.of)!.session.id);
      if (!earlier) throw new Error(`fixture: no earlier review for ${f.verifies.of}`);
      verifies = { requestId: earlier.id, question: earlier.verificationQuestions[f.verifies.q].question };
    }
    return { concept: f.concept, text: f.text, evidence: refs(b, f.ev), ...(verifies ? { verifies } : {}) };
  };
  const missing = (m: M): MissingConcept => ({ ...finding(m), question: m.question });
  return {
    v: REVIEW_VERSION,
    id: req.id,
    sessionId: req.sessionId,
    inputHash: req.inputHash,
    createdAt: iso(createdAt),
    model: MODEL,
    summary: r.summary,
    understood: r.understood.map(finding),
    misunderstandings: (r.mis ?? []).map(finding),
    incomplete: (r.inc ?? []).map(finding),
    unsupportedClaims: [],
    missingConcepts: r.missing.map(missing),
    explanationQuality: { level: r.eq.level, note: r.eq.note, evidence: refs(b, r.eq.ev) },
    learningBehaviour: { observations: r.obs.map(finding), improvements: r.improvements },
    nextSteps: r.next,
    verificationQuestions: r.vq,
    insufficientEvidence: false,
  };
}

/* ------------------------------------------------------------------------------------------------------------- */
/* Session and review content                                                                                     */
/* ------------------------------------------------------------------------------------------------------------- */

const book = (title: string): SessionSource => ({ kind: "book", title });
const course = (title: string): SessionSource => ({ kind: "course", title });

/** Start of day `day` (0 = Monday) of ISO week `week`, plus a clock time, in Asia/Kolkata. */
function at(week: string, day: number, hh: number, mm = 0): number {
  return weekStartMs(week)! + day * DAY + (hh * 60 + mm) * MIN;
}

interface Entry {
  spec: SessionSpec;
  /** Absent for the two sessions whose review has not arrived. */
  review?: ReviewSpec;
  failure?: string;
}

function entries(now: number): Entry[] {
  const thisWeek = isoWeekOf(now);
  const w = (back: number) => {
    let wk = thisWeek;
    for (let i = 0; i < back; i++) wk = previousCompleteWeek(weekStartMs(wk)! + HOUR);
    return wk;
  };
  const w1 = w(1), w2 = w(2), w3 = w(3);
  return [
    {
      spec: {
        key: "s1", subject: "HLD", source: book("Designing Data-Intensive Applications"), objective: "Understand how a partitioned cache decides where a key lives",
        startMs: at(w3, 1, 20), minutes: 50, pauseAt: 25,
        topics: ["Consistent hashing", "Cache invalidation"],
        notes: [
          "A plain hash(key) % N mapping reshuffles almost every key when N changes, which empties the cache on every scale event.",
          "Consistent hashing places servers and keys on a ring; a key belongs to the first server clockwise from its hash.",
          "Adding a server only moves the keys between it and its predecessor, roughly 1/N of all keys.",
          "Virtual nodes give each server many points on the ring so load evens out and a failed node's keys spread across many neighbours.",
          "TTL expiry is simple but serves stale data; explicit invalidation on write is fresher but needs every writer to know about the cache.",
        ],
        difficulties: ["Not sure how replica placement works when two virtual nodes of the same server are adjacent."],
        bookmarks: [{ label: "Ring diagram, chapter 6", atMin: 20 }],
        end: { learned: "Consistent hashing limits remapping to about 1/N of keys when a node joins or leaves.", difficult: "Replica placement with virtual nodes.", unclear: "How clients learn about ring changes without a central coordinator." },
      },
      review: {
        summary: "A solid first pass on consistent hashing: the problem with modulo hashing, the ring and virtual nodes are explained correctly. Cache invalidation stayed at the definition level, and replica placement is an open question the notes flag honestly.",
        understood: [
          { concept: "Consistent hashing", text: "Explains why modulo hashing remaps nearly every key on a resize and how a ring limits movement to about 1/N of keys.", ev: [["n0", "reshuffles almost every key"], ["n2", "roughly 1/N of all keys"]] },
          { concept: "Virtual nodes", text: "States what virtual nodes are for: even load, and a failed node's keys spreading over many neighbours.", ev: [["n3", "load evens out"]] },
        ],
        inc: [{ concept: "Cache invalidation", text: "Names TTL and explicit invalidation and their trade-off, but does not cover lost invalidation messages or cache stampedes.", ev: [["n4"]] }],
        missing: [{ concept: "Replica placement on a ring", text: "Replication across distinct physical servers was raised as a difficulty but not worked through.", ev: [["d0"]], question: "On a ring with virtual nodes, how do you pick N replicas so they land on distinct physical servers?" }],
        eq: { level: "clear", note: "Each claim follows from the previous one and uses the right terms.", ev: [["n1", "first server clockwise"]] },
        obs: [{ concept: "Asking open questions", text: "Records the replica placement gap as a difficulty instead of skipping past it.", ev: [["d0"]] }],
        improvements: ["Work one example with real numbers instead of describing the ring in words."],
        next: ["Read how Dynamo builds a preference list on the ring.", "Work an example of adding a node to a 4-server ring."],
        vq: [{ concept: "Consistent hashing", question: "A cache cluster of 8 nodes adds a ninth. What fraction of keys move under modulo hashing versus consistent hashing, and why?" }],
      },
    },
    {
      spec: {
        key: "s2", subject: "DSA", source: { kind: "leetcode" }, objective: "Recognise when binary search applies beyond sorted arrays",
        startMs: at(w3, 3, 19, 30), minutes: 45,
        topics: ["Binary search on answer", "Two pointers"],
        notes: [
          "Binary search works whenever a yes/no check is monotonic: once true for some value it stays true for all larger values.",
          "Koko eating bananas: search the speed k from 1 to max(piles), check feasibility in O(n), total O(n log m).",
          "Two pointers on a sorted array: move the left pointer when the sum is too small, the right when it is too large.",
          "Container with most water: always move the pointer at the shorter wall since the area is capped by it.",
        ],
        difficulties: ["Off by one on the upper bound; I kept returning mid instead of lo."],
        bookmarks: [{ label: "Template: lo < hi, mid = lo + (hi - lo) / 2", atMin: 15 }],
        end: { learned: "The monotonic check is what makes binary search apply.", difficult: "Choosing between lo < hi and lo <= hi loop conditions." },
      },
      review: {
        summary: "The monotonic-check idea is stated precisely and applied to a concrete problem with the right complexity. Two pointers is described as a procedure without the argument for why it is safe to discard a pointer.",
        understood: [{ concept: "Binary search on answer", text: "Identifies monotonic feasibility as the condition and applies it to a concrete problem with the correct complexity.", ev: [["n0", "monotonic"], ["n1", "O(n log m)"]] }],
        inc: [{ concept: "Two pointers", text: "Gives the move rule but not why discarding the taller wall can never lose the best answer.", ev: [["n3", "capped by it"]] }],
        missing: [{ concept: "Loop invariants for binary search", text: "The off-by-one bug points at an unstated invariant.", ev: [["d0"]], question: "Why does lo < hi with hi = mid terminate, while lo <= hi with hi = mid can loop forever?" }],
        eq: { level: "partial", note: "The core idea is clear; the termination argument is asserted rather than explained.", ev: [["n0"]] },
        obs: [{ concept: "Recording the bug", text: "Writes down the exact mistake (returning mid instead of lo), which makes it checkable next time.", ev: [["d0", "returning mid instead of lo"]] }],
        improvements: ["Write the invariant as a comment above every binary search loop."],
        next: ["Redo the problem from a blank file using the written invariant."],
        vq: [{ concept: "Binary search on answer", question: "What property of the feasibility check must hold for binary search on the answer to be valid?" }],
      },
    },
    {
      spec: {
        key: "s3", subject: "Databases", source: course("CMU Intro to Database Systems"), objective: "Explain why indexes speed reads and what they cost on writes",
        startMs: at(w3, 5, 11), minutes: 55, pauseAt: 30,
        topics: ["B-tree indexes", "Isolation levels"],
        notes: [
          "A B+tree keeps keys sorted in wide nodes so a lookup touches only height-many pages, usually 3 to 4 for millions of rows.",
          "Range scans are cheap because leaves are linked; a hash index cannot do them.",
          "Every index must be updated on insert, so each extra index adds write cost and storage.",
          "Read committed means a transaction only sees committed data, but two reads of the same row can differ.",
          "Repeatable read fixes that by pinning a snapshot, and serializable also stops phantom rows.",
        ],
        difficulties: ["Phantoms versus non-repeatable reads still blur together for me."],
        bookmarks: [],
        end: { learned: "Index cost model: faster reads, slower writes, more disk.", difficult: "Telling phantoms from non-repeatable reads.", unclear: "Whether snapshot isolation is the same as repeatable read." },
      },
      review: {
        summary: "Clear, correct notes on B+tree lookups and the write cost of indexes. Read committed and repeatable read are described correctly; the difference between phantoms and non-repeatable reads is the live gap.",
        understood: [
          { concept: "B-tree indexes", text: "Explains lookup cost through tree height, range scans through linked leaves and the write cost of maintaining each index.", ev: [["n0", "height-many pages"], ["n2", "each extra index adds write cost"]] },
          { concept: "Isolation levels", text: "Correctly says read committed allows two reads of a row to differ and that repeatable read pins a snapshot.", ev: [["n3", "two reads of the same row can differ"], ["n4", "pinning a snapshot"]] },
        ],
        inc: [{ concept: "Phantom reads", text: "Names phantoms but does not say which isolation level permits them or give an example.", ev: [["n4", "phantom rows"]] }],
        missing: [{ concept: "Snapshot isolation", text: "Raised as unclear in the reflection.", ev: [["end", "snapshot isolation"]], question: "Is snapshot isolation the same as repeatable read, and which anomaly does it still allow?" }],
        eq: { level: "clear", note: "Short, precise statements with the cost of each choice attached.", ev: [["n1", "leaves are linked"]] },
        obs: [{ concept: "Naming the confusion", text: "States exactly which two ideas blur together, which is the right starting point for a fix.", ev: [["d0"]] }],
        improvements: ["Draw a two-transaction schedule for each anomaly."],
        next: ["Write one schedule showing a non-repeatable read and one showing a phantom."],
        vq: [{ concept: "Isolation levels", question: "Give an example schedule that shows a non-repeatable read, and say which isolation level prevents it." }],
      },
    },
    {
      spec: {
        key: "s4", subject: "OS", source: book("Operating Systems: Three Easy Pieces"), objective: "Compare scheduling policies by turnaround and response time",
        startMs: at(w2, 0, 20), minutes: 50,
        topics: ["Process scheduling", "Context switching"],
        notes: [
          "FIFO suffers from the convoy effect: one long job at the front makes every short job wait.",
          "Shortest job first minimises average turnaround if all jobs arrive together, but needs to know run lengths in advance.",
          "Round robin with a small time slice improves response time but raises turnaround, and each switch costs a context switch.",
          "A context switch saves registers and the program counter into the process control block and loads the next one.",
          "MLFQ approximates SJF without knowing lengths by demoting jobs that use their whole slice.",
        ],
        difficulties: ["Cannot yet explain why MLFQ needs a periodic priority boost."],
        bookmarks: [{ label: "Turnaround vs response time table", atMin: 18 }],
        end: { learned: "Scheduling is a trade between turnaround and response time.", difficult: "Why MLFQ needs the priority boost.", unclear: "Whether the TLB is flushed on every context switch." },
      },
      review: {
        summary: "Good comparison of FIFO, SJF and round robin on the right criteria. The context switch description is accurate. MLFQ is described only up to demotion.",
        understood: [
          { concept: "Process scheduling", text: "Compares FIFO, SJF and round robin on turnaround and response time and names the trade-off between them.", ev: [["n0", "convoy effect"], ["n2", "raises turnaround"]] },
          { concept: "Context switching", text: "Lists what is saved and restored in a switch and that it has a cost.", ev: [["n3", "process control block"]] },
        ],
        inc: [{ concept: "MLFQ", text: "Describes demotion but not starvation or the boost that prevents it.", ev: [["n4"]] }],
        missing: [{ concept: "TLB behaviour on context switch", text: "Raised as unclear; not worked through.", ev: [["end", "TLB"]], question: "What happens to TLB entries on a context switch, and how do address-space IDs change the cost?" }],
        eq: { level: "clear", note: "Policies are compared on explicit criteria rather than listed.", ev: [["n1", "needs to know run lengths in advance"]] },
        obs: [{ concept: "Using a table", text: "Bookmarks the turnaround versus response time table to return to.", ev: [["b0"]] }],
        improvements: ["After each policy, state one workload where it is the worst choice."],
        next: ["Read the MLFQ chapter's section on priority boost and gaming the scheduler."],
        vq: [{ concept: "Process scheduling", question: "Which scheduling policy would you choose for an interactive desktop, and why does the time slice length matter?" }],
      },
    },
    {
      spec: {
        key: "s5", subject: "LLD", source: { kind: "atlas" }, objective: "Apply the observer pattern and dependency inversion to a notification system",
        startMs: at(w2, 2, 20, 30), minutes: 45,
        topics: ["Observer pattern", "Dependency inversion"],
        notes: [
          "Observer: the subject keeps a list of listeners and calls notify() on each when its state changes; subject and listeners only know an interface.",
          "Dependency inversion means high-level policy depends on an abstraction that the low-level detail also implements.",
          "OrderService should take a Notifier interface in its constructor instead of newing up EmailSender.",
          "Dependency inversion and dependency injection are the same thing, both are just passing objects in the constructor.",
        ],
        difficulties: ["Unsure how to unsubscribe safely while the subject is mid-notification."],
        bookmarks: [],
        end: { learned: "Interfaces at the boundary keep the policy code testable.", difficult: "Unsubscribing during notify.", unclear: "Push versus pull observers." },
      },
      review: {
        summary: "The observer mechanics are right. The notes then equate dependency inversion with dependency injection, which blurs a principle with one technique for applying it.",
        understood: [{ concept: "Observer pattern", text: "Describes the subject, the listener list and notify, and that both sides depend only on an interface.", ev: [["n0", "keeps a list of listeners"]] }],
        mis: [{ concept: "Dependency inversion", text: "Says inversion and injection are the same thing. Inversion is about who owns the abstraction; injection is one way to supply the dependency.", ev: [["n3", "are the same thing"]] }],
        missing: [{ concept: "Safe unsubscribe during notify", text: "Raised as a difficulty.", ev: [["d0"]], question: "How would you let a listener unsubscribe inside its own callback without corrupting the iteration?" }],
        eq: { level: "partial", note: "Mechanics are explained well; one conceptual claim is wrong.", ev: [["n2", "instead of newing up EmailSender"]] },
        obs: [{ concept: "Concrete example", text: "Anchors the principle in a concrete class (OrderService) rather than staying abstract.", ev: [["n2"]] }],
        improvements: ["When two terms feel like synonyms, write one sentence that says how they differ."],
        next: ["Write a small example that follows dependency inversion without any injection framework."],
        vq: [{ concept: "Dependency inversion", question: "Name a design that uses dependency injection but still violates dependency inversion." }],
      },
    },
    {
      spec: {
        key: "s6", subject: "HLD", source: { kind: "video", title: "Design a rate limiter" }, objective: "Compare rate limiting algorithms and place the limiter",
        startMs: at(w2, 6, 10), minutes: 60, pauseAt: 35,
        topics: ["Rate limiting", "Token bucket"],
        notes: [
          "Token bucket: a bucket holds up to B tokens, refills at R per second, and each request spends one token; bursts up to B are allowed.",
          "Leaky bucket smooths output to a constant rate, so it queues bursts instead of allowing them.",
          "A fixed window counter lets a client send twice the limit across a window boundary.",
          "Sliding window log is exact but stores a timestamp per request; sliding window counter approximates it with two counters.",
          "In a distributed setup the counters live in Redis and the check plus increment must be atomic, for example with a Lua script.",
        ],
        difficulties: ["Clock skew between limiter nodes. Not sure how much it matters."],
        bookmarks: [{ label: "Redis Lua script for the bucket", atMin: 45 }],
        end: { learned: "Token bucket is the default choice when bursts are acceptable.", difficult: "Reasoning about clock skew.", unclear: "Where to put the limiter: gateway or service." },
      },
      review: {
        summary: "Strong coverage of the main algorithms with their failure modes (window boundary burst, log memory). The distributed part names the right tool but not the clock problem.",
        understood: [
          { concept: "Token bucket", text: "Explains capacity, refill rate and how a burst up to the capacity is allowed.", ev: [["n0", "refills at R per second"]] },
          { concept: "Rate limiting algorithms", text: "Compares fixed window, sliding log and sliding counter by their error and memory cost.", ev: [["n2", "twice the limit"], ["n3", "approximates it with two counters"]] },
        ],
        inc: [{ concept: "Distributed rate limiting", text: "States that the check and increment must be atomic but not what happens when limiter nodes disagree on time.", ev: [["n4", "must be atomic"]] }],
        missing: [{ concept: "Clock skew in distributed limiters", text: "Raised as a difficulty.", ev: [["d0"]], question: "Why does using the Redis server's clock avoid skew between limiter nodes, and what does it cost?" }],
        eq: { level: "clear", note: "Each algorithm is paired with the problem it solves.", ev: [["n1", "queues bursts"]] },
        obs: [{ concept: "Saving a snippet", text: "Bookmarks the Lua script to study again.", ev: [["b0"]] }],
        improvements: ["Estimate the memory of the sliding log for 1M users at 100 requests per minute."],
        next: ["Decide gateway versus service placement and write the reason in one paragraph."],
        vq: [{ concept: "Token bucket", question: "A bucket has capacity 10 and refills 2 tokens per second. What is the most requests it can allow in the first 5 seconds?" }],
      },
    },
    {
      spec: {
        key: "s7", subject: "DSA", source: { kind: "leetcode" }, objective: "Implement an O(1) LRU cache",
        startMs: at(w1, 1, 20), minutes: 55,
        topics: ["LRU cache", "Hash map with doubly linked list"],
        notes: [
          "LRU needs O(1) get and put, so a hash map from key to node plus a doubly linked list ordered by recency.",
          "On get, move the node to the head; on put, insert at the head and evict the tail when over capacity.",
          "Sentinel head and tail nodes remove every null check from the insert and unlink code.",
          "Python's OrderedDict.move_to_end does the same job, but the interviewer wants the list written out.",
        ],
        difficulties: ["Forgot to delete the evicted key from the map, so the first submission returned stale values."],
        bookmarks: [{ label: "Final solution passing 22/22", atMin: 42 }],
        end: { learned: "Sentinels make linked list code short and safe.", difficult: "Keeping the map and the list consistent on eviction." },
      },
      review: {
        summary: "The data structure choice is justified from the O(1) requirement, and the eviction bug is understood as a map/list consistency problem.",
        understood: [
          { concept: "LRU cache", text: "Derives the hash map plus doubly linked list design from the O(1) requirement and describes get, put and eviction correctly.", ev: [["n0", "hash map from key to node"], ["n1", "evict the tail"]] },
          { concept: "Sentinel nodes", text: "Says what sentinels remove: null checks in insert and unlink.", ev: [["n2", "every null check"]] },
        ],
        missing: [{ concept: "LFU cache", text: "A natural extension that was not discussed.", ev: [], question: "How would the design change for an LFU cache while keeping O(1) operations?" }],
        eq: { level: "clear", note: "The design follows from the requirement rather than being recalled.", ev: [["n0"]] },
        obs: [{ concept: "Debugging", text: "Names the cause of the first failure (stale map entry) and not just the symptom.", ev: [["d0", "returned stale values"]] }],
        improvements: ["Add a test for the eviction path before submitting."],
        next: ["Implement the LFU variant."],
        vq: [{ concept: "LRU cache", question: "Why does the LRU cache need a doubly linked list rather than a singly linked one?" }],
      },
    },
    {
      spec: {
        key: "s8", subject: "Databases", source: course("CMU Intro to Database Systems"), objective: "Revisit isolation levels through MVCC",
        startMs: at(w1, 3, 20), minutes: 50, pauseAt: 28,
        topics: ["Isolation levels", "MVCC"],
        notes: [
          "MVCC keeps several versions of each row, so readers never block writers and writers never block readers.",
          "Each transaction reads the version that was committed when its snapshot was taken.",
          "Repeatable read always prevents phantom reads, in every database.",
          "Write skew can still happen under snapshot isolation when two transactions read overlapping rows and write different ones.",
        ],
        difficulties: ["I still cannot say how vacuum decides a row version is dead."],
        bookmarks: [],
        end: { learned: "Snapshots explain why readers do not block.", difficult: "Vacuum and dead tuples.", unclear: "Which databases implement repeatable read as snapshot isolation." },
      },
      review: {
        summary: "MVCC and write skew are explained correctly. One statement overgeneralises: the SQL standard allows phantoms at repeatable read, and whether they occur is implementation specific.",
        understood: [
          { concept: "MVCC", text: "Explains versioned rows, snapshot reads and why readers and writers do not block each other.", ev: [["n0", "readers never block writers"], ["n1", "version that was committed"]] },
          { concept: "Write skew", text: "Describes the anomaly precisely: overlapping reads, disjoint writes.", ev: [["n3", "write different ones"]] },
        ],
        mis: [{ concept: "Isolation levels", text: "Claims repeatable read always prevents phantoms. The standard permits them at that level; PostgreSQL's snapshots do prevent them, but the guarantee is not universal.", ev: [["n2", "always prevents phantom reads"]] }],
        missing: [{ concept: "Vacuum and dead tuples", text: "Raised as a difficulty.", ev: [["d0"]], question: "How does the database decide that an old row version can be removed?" }],
        eq: { level: "partial", note: "Mostly precise, with one universal claim that does not hold.", ev: [["n1"]] },
        obs: [{ concept: "Revisiting a topic", text: "Returns to isolation levels a week later and connects them to MVCC.", ev: [["t0"]] }],
        improvements: ["Check universal words (always, never, every) against the standard before writing them down."],
        next: ["Compare what repeatable read allows in the SQL standard, PostgreSQL and MySQL InnoDB."],
        vq: [{ concept: "Isolation levels", question: "Which anomalies does the SQL standard allow at repeatable read, and how does PostgreSQL differ?" }],
      },
    },
    {
      spec: {
        key: "s9", subject: "HLD", source: book("Designing Data-Intensive Applications"), objective: "Answer the open question on replica placement",
        startMs: at(w1, 5, 11), minutes: 45,
        topics: ["Consistent hashing", "Replica placement"],
        notes: [
          "To place N replicas on a ring, walk clockwise from the key's position and take the next N distinct physical servers, skipping virtual nodes of a server already chosen.",
          "Going from 8 to 9 nodes, modulo hashing moves about 8/9 of keys, while consistent hashing moves about 1/9.",
          "Dynamo stores a preference list of the first N distinct nodes and uses a sloppy quorum when some are down.",
        ],
        difficulties: [],
        bookmarks: [],
        end: { learned: "Skipping virtual nodes of an already chosen server is what guarantees distinct replicas.", unclear: "How hinted handoff is repaired later." },
      },
      review: {
        summary: "Answers the earlier open question correctly and, unprompted, gives the numbers for the ring versus modulo comparison. Hinted handoff is the next gap.",
        understood: [
          { concept: "Consistent hashing", text: "Answers the earlier verification question: modulo hashing moves about 8/9 of keys going from 8 to 9 nodes, the ring about 1/9.", ev: [["n1", "about 1/9"]], verifies: { of: "s1", q: 0 } },
          { concept: "Replica placement on a ring", text: "Describes the clockwise walk that skips virtual nodes of an already chosen server.", ev: [["n0", "next N distinct physical servers"]] },
        ],
        inc: [{ concept: "Sloppy quorum", text: "Mentions it without saying what is traded away.", ev: [["n2", "sloppy quorum"]] }],
        missing: [{ concept: "Hinted handoff", text: "Raised as unclear.", ev: [["end", "hinted handoff"]], question: "What repairs data written to a stand-in node once the real owner returns?" }],
        eq: { level: "clear", note: "Gives the procedure and the numbers, unprompted.", ev: [["n1"]] },
        obs: [{ concept: "Closing the loop", text: "Comes back to an open question from two weeks earlier and answers it.", ev: [["t1"]] }],
        improvements: ["Keep a list of open questions at the top of the next session."],
        next: ["Read about hinted handoff and anti-entropy repair."],
        vq: [{ concept: "Replica placement on a ring", question: "With 3 replicas, 5 physical servers and 100 virtual nodes each, why must the walk skip repeats of a server?" }],
      },
    },
    {
      spec: {
        key: "s10", subject: "OS", source: { kind: "atlas" }, objective: "Follow a virtual address through translation",
        startMs: now - 28 * HOUR, minutes: 40,
        topics: ["Virtual memory", "Paging"],
        notes: [
          "Virtual memory gives each process its own address space; the MMU translates virtual pages to physical frames using a page table.",
          "A TLB caches recent translations; a miss walks the page table, which is why locality matters.",
          "Multi-level page tables save memory because unused regions of the address space have no second-level tables.",
        ],
        difficulties: ["Page fault handling order: trap, find a frame, read from disk, update the table, restart. Unsure where the replacement policy runs."],
        bookmarks: [],
        end: { learned: "Translation is cached, so locality decides speed." },
      },
      failure: "Reviewer timed out after 600 seconds (attempt 1 of 3); will retry on the next run.",
    },
    {
      spec: {
        key: "s11", subject: "LLD", source: { kind: "atlas" }, objective: "Model a vending machine with the state pattern",
        startMs: now - 4 * HOUR, minutes: 35,
        topics: ["State pattern"],
        notes: [
          "State pattern moves each state's behaviour into its own class so the context delegates instead of switching on an enum.",
          "Vending machine: NoCoin, HasCoin, Dispensing and SoldOut states each handle insertCoin and turnCrank differently.",
          "Transitions are triggered by the state object setting the context's next state.",
        ],
        difficulties: ["Not sure when a plain enum with a switch is simpler."],
        bookmarks: [],
        end: { learned: "Each state class owns its transitions." },
      },
    },
  ];
}

/* ------------------------------------------------------------------------------------------------------------- */
/* LeetCode                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------- */

const STATUS: Record<string, string> = { AC: "Accepted", WA: "Wrong Answer", TLE: "Time Limit Exceeded", RE: "Runtime Error", CE: "Compile Error" };

interface Prob {
  slug: string;
  title: string;
  number: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  tries: string[];
  lang?: string;
  /** Index of the first try made the next day. */
  nextDayFrom?: number;
}

const PROBLEMS: Prob[] = [
  { slug: "two-sum", title: "Two Sum", number: "1", difficulty: "Easy", tags: ["Array", "Hash Table"], tries: ["AC"] },
  { slug: "valid-parentheses", title: "Valid Parentheses", number: "20", difficulty: "Easy", tags: ["String", "Stack"], tries: ["AC"] },
  { slug: "merge-two-sorted-lists", title: "Merge Two Sorted Lists", number: "21", difficulty: "Easy", tags: ["Linked List", "Recursion"], tries: ["AC"] },
  { slug: "best-time-to-buy-and-sell-stock", title: "Best Time to Buy and Sell Stock", number: "121", difficulty: "Easy", tags: ["Array", "Dynamic Programming"], tries: ["AC"] },
  { slug: "valid-anagram", title: "Valid Anagram", number: "242", difficulty: "Easy", tags: ["Hash Table", "String", "Sorting"], tries: ["AC"] },
  { slug: "binary-search", title: "Binary Search", number: "704", difficulty: "Easy", tags: ["Array", "Binary Search"], tries: ["WA", "AC"] },
  { slug: "climbing-stairs", title: "Climbing Stairs", number: "70", difficulty: "Easy", tags: ["Math", "Dynamic Programming"], tries: ["AC"] },
  { slug: "maximum-subarray", title: "Maximum Subarray", number: "53", difficulty: "Medium", tags: ["Array", "Dynamic Programming", "Divide and Conquer"], tries: ["WA", "AC"] },
  { slug: "3sum", title: "3Sum", number: "15", difficulty: "Medium", tags: ["Array", "Two Pointers", "Sorting"], tries: ["WA", "WA", "TLE", "AC"], nextDayFrom: 3 },
  { slug: "container-with-most-water", title: "Container With Most Water", number: "11", difficulty: "Medium", tags: ["Array", "Two Pointers", "Greedy"], tries: ["WA", "AC"] },
  { slug: "group-anagrams", title: "Group Anagrams", number: "49", difficulty: "Medium", tags: ["Array", "Hash Table", "String", "Sorting"], tries: ["AC"] },
  { slug: "product-of-array-except-self", title: "Product of Array Except Self", number: "238", difficulty: "Medium", tags: ["Array", "Prefix Sum"], tries: ["RE", "AC"] },
  { slug: "longest-substring-without-repeating-characters", title: "Longest Substring Without Repeating Characters", number: "3", difficulty: "Medium", tags: ["Hash Table", "String", "Sliding Window"], tries: ["WA", "WA", "AC"] },
  { slug: "number-of-islands", title: "Number of Islands", number: "200", difficulty: "Medium", tags: ["Array", "Depth-First Search", "Breadth-First Search", "Matrix"], tries: ["AC"] },
  { slug: "course-schedule", title: "Course Schedule", number: "207", difficulty: "Medium", tags: ["Depth-First Search", "Breadth-First Search", "Graph", "Topological Sort"], tries: ["WA", "TLE", "AC"], nextDayFrom: 2 },
  { slug: "lru-cache", title: "LRU Cache", number: "146", difficulty: "Medium", tags: ["Hash Table", "Linked List", "Design", "Doubly-Linked List"], tries: ["WA", "AC"] },
  { slug: "coin-change", title: "Coin Change", number: "322", difficulty: "Medium", tags: ["Array", "Dynamic Programming", "Breadth-First Search"], tries: ["WA", "WA", "TLE"], nextDayFrom: 2 },
  { slug: "binary-tree-level-order-traversal", title: "Binary Tree Level Order Traversal", number: "102", difficulty: "Medium", tags: ["Tree", "Breadth-First Search", "Binary Tree"], tries: ["AC"] },
  { slug: "validate-binary-search-tree", title: "Validate Binary Search Tree", number: "98", difficulty: "Medium", tags: ["Tree", "Depth-First Search", "Binary Search Tree"], tries: ["WA", "AC"] },
  { slug: "kth-largest-element-in-an-array", title: "Kth Largest Element in an Array", number: "215", difficulty: "Medium", tags: ["Array", "Sorting", "Heap (Priority Queue)"], tries: ["AC"] },
  { slug: "top-k-frequent-elements", title: "Top K Frequent Elements", number: "347", difficulty: "Medium", tags: ["Array", "Hash Table", "Heap (Priority Queue)"], tries: ["AC"] },
  { slug: "merge-intervals", title: "Merge Intervals", number: "56", difficulty: "Medium", tags: ["Array", "Sorting"], tries: ["CE", "AC"] },
  { slug: "word-search", title: "Word Search", number: "79", difficulty: "Medium", tags: ["Array", "Backtracking", "Matrix"], tries: ["WA", "TLE", "WA"], nextDayFrom: 2 },
  { slug: "trapping-rain-water", title: "Trapping Rain Water", number: "42", difficulty: "Hard", tags: ["Array", "Two Pointers", "Dynamic Programming", "Stack"], tries: ["WA", "WA", "WA", "AC"], nextDayFrom: 3 },
  { slug: "median-of-two-sorted-arrays", title: "Median of Two Sorted Arrays", number: "4", difficulty: "Hard", tags: ["Array", "Binary Search", "Divide and Conquer"], tries: ["WA", "RE"] },
];

/** Small deterministic generator so the data is the same every run for a given `now`. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSubmissions(now: number): LeetCodeSubmission[] {
  const rand = rng(Math.floor(now / DAY));
  const out: LeetCodeSubmission[] = [];
  PROBLEMS.forEach((p, i) => {
    const daysAgo = 56 - i * 2.27;
    let t = now - daysAgo * DAY;
    p.tries.forEach((code, j) => {
      if (p.nextDayFrom === j) t += 19 * HOUR + rand() * 3 * HOUR;
      else if (j > 0) t += (4 + rand() * 11) * MIN;
      const accepted = code === "AC";
      const total = 40 + Math.floor(rand() * 60);
      const sub: LeetCodeSubmission = {
        id: `fixture-sub-${out.length + 1}`,
        title: p.title,
        slug: p.slug,
        number: p.number,
        difficulty: p.difficulty,
        tags: p.tags,
        status: STATUS[code],
        lang: p.lang ?? "python3",
        timestamp: Math.floor(t / 1000),
        code: `# SYNTHETIC fixture submission, not real code\nclass Solution:\n    def solve(self, *args):\n        pass  # ${p.slug} try ${j + 1}\n`,
      };
      if (accepted) {
        Object.assign(sub, {
          runtimeDisplay: `${20 + Math.floor(rand() * 120)} ms`,
          memoryDisplay: `${(14 + rand() * 8).toFixed(1)} MB`,
          runtimePercentile: Math.round((35 + rand() * 62) * 10) / 10,
          memoryPercentile: Math.round((30 + rand() * 60) * 10) / 10,
          totalCorrect: total,
          totalTestcases: total,
        });
      } else if (code === "WA") {
        Object.assign(sub, { totalCorrect: total - 1 - Math.floor(rand() * 4), totalTestcases: total, lastTestcase: "[2,7,11,15]\n9", codeOutput: "[1,0]", expectedOutput: "[0,1]" });
      } else if (code === "TLE") {
        Object.assign(sub, { totalCorrect: Math.floor(total * 0.8), totalTestcases: total, lastTestcase: "[0,0,0,0,0,0,0,0,0,0]" });
      } else if (code === "RE") {
        Object.assign(sub, { totalCorrect: Math.floor(total * 0.5), totalTestcases: total, runtimeError: "IndexError: list index out of range" });
      } else if (code === "CE") {
        Object.assign(sub, { compileError: "SyntaxError: invalid syntax" });
      }
      out.push(sub);
    });
  });
  return out;
}

function buildCodingReview(subs: LeetCodeSubmission[], now: number): CodingReview {
  const stats = computeCodingStats(subs);
  const fmt = (n: number | null) => (n === null ? "n/a" : n.toFixed(1));
  const last = stats.form.last;
  const prev = stats.form.previous;
  const improving = prev !== null && last.avgTries !== null && prev.avgTries !== null && last.avgTries < prev.avgTries;
  const lately = stats.lately.slice(-8);
  return {
    forDate: iso(now).slice(0, 10),
    headline: "Search and two-pointer problems are landing; dynamic programming and backtracking still take several tries.",
    trend: {
      direction: improving ? "improving" : "steady",
      note: `Your last ${last.problems} problems needed ${fmt(last.avgTries)} tries to first accept${prev ? `, against ${fmt(prev.avgTries)} for the ${prev.problems} before them` : ""}.`,
    },
    summary:
      `${stats.solved} of ${stats.problems} problems have an accepted submission. The ones that cost the most tries are the ones that need a state definition (coin change) or pruning (word search), where the first submission was a brute force that timed out. ` +
      "Array and two-pointer problems are mostly first or second try. The pattern across the wrong answers is boundary handling, not the algorithm.",
    focus: [
      { title: "Define the DP state before coding", why: "Coin change has three failed tries and no accept; each one changed the code without first writing what dp[i] means." },
      { title: "Check the boundaries on paper", why: "Most wrong answers on binary search, maximum subarray and trapping rain water passed all but the last few cases." },
    ],
    mistakes: [
      { pattern: "Off-by-one on loop bounds", detail: "Wrong answers that pass 90 percent of cases usually fail on a length 1 or empty input.", check: "Run the smallest and the largest input by hand before submitting.", problems: ["binary-search", "trapping-rain-water", "maximum-subarray"] },
      { pattern: "Brute force first, then time limit", detail: "The first accepted idea was O(n^2) or exponential, then replaced after a time limit error.", check: "State the target complexity from the constraints before choosing the approach.", problems: ["3sum", "course-schedule", "word-search"] },
    ],
    nextProblems: [
      { slug: "house-robber", title: "House Robber", why: "A one-dimensional DP where the state is easy to name; a warm-up for coin change." },
      { slug: "unique-paths", title: "Unique Paths", why: "Practises writing the DP table and its base row before the loop." },
      { slug: "subsets", title: "Subsets", why: "Backtracking with pruning, the weak point in word search." },
    ],
    reviews: lately.map((l) => ({
      slug: l.slug,
      title: l.title,
      verdict: l.acceptedOnTry === null || l.attempts >= 3 ? ("struggling" as const) : l.acceptedOnTry === 1 ? ("good" as const) : ("improve" as const),
      note: l.acceptedOnTry === null ? `${l.attempts} tries and no accepted submission yet.` : `Accepted on try ${l.acceptedOnTry} of ${l.attempts}.`,
    })),
  };
}

/* ------------------------------------------------------------------------------------------------------------- */
/* Assembly                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------- */

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

export async function buildDataRepo(opts: { now?: number } = {}): Promise<DataRepo> {
  const now = opts.now ?? Date.now();
  const files: Record<string, string> = {};
  const summarySessions: DataRepo["summary"]["sessions"] = [];

  // Sessions, requests, reviews.
  const list = entries(now);
  const builtByKey = new Map<string, Built>();
  const built: Built[] = [];
  for (const e of list) {
    const b = buildSession(e.spec);
    builtByKey.set(e.spec.key, b);
    built.push(b);
    files[sessionPath(b.session)] = json(b.session);
  }
  const prior = new Map<string, SessionReview>();
  const reviews: SessionReview[] = [];
  const requests: ReviewRequest[] = [];
  for (const [i, e] of list.entries()) {
    const b = built[i];
    const n = e.spec.key.slice(1);
    const request = { ...(await createReviewRequest(b.session, DEVICE, b.endMs + 2 * MIN)), id: `fixture-req-${n}` };
    requests.push(request);
    files[requestPath(request)] = json(request);
    if (!e.review) {
      if (e.failure) files[`journal/review-failures/${request.id}.json`] = json([{ at: iso(b.endMs + 12 * MIN), error: e.failure }]);
      summarySessions.push({ id: b.session.id, subject: e.spec.subject, status: e.failure ? "pending-with-failure" : "pending" });
      continue;
    }
    const review = makeReview(b, request, e.review, b.endMs + 25 * MIN, prior, builtByKey);
    const { errors } = validateReview(review, { request, session: b.session, currentHash: await sessionHash(b.session), priorReviews: new Map([...prior.values()].map((r) => [r.id, r])) });
    if (errors.length > 0) throw new Error(`fixture review ${request.id} is invalid:\n${errors.join("\n")}`);
    prior.set(b.session.id, review);
    reviews.push(review);
    files[reviewPath(review)] = json(review);
    summarySessions.push({ id: b.session.id, subject: e.spec.subject, status: "reviewed" });
  }
  const sessions = built.map((b) => b.session);
  const sessionOf = new Map(sessions.map((s) => [s.id, s]));

  // Weekly report for the latest complete week. Activity and sufficiency are computed, not written by hand.
  const week = previousCompleteWeek(now);
  const sufficiency = sufficiencyFor(sessions, week, now);
  const activity = weeklyActivity(sessions, reviews, week, now);
  const cite = (key: string, sel?: string): WeeklyCite => {
    const b = builtByKey.get(key)!;
    return { sessionId: b.session.id, ...(sel ? { eventId: b.ids[sel] } : {}) };
  };
  const wf = (concept: string, text: string, evidence: WeeklyCite[]): WeeklyFinding => ({ concept, text, evidence });
  const coaching = sufficiency.sufficiency === "coaching";
  const weekly: WeeklyReport = {
    v: 1,
    week,
    createdAt: iso(Math.min(now - HOUR, weekStartMs(isoWeekOf(now))! + 8 * HOUR)),
    model: MODEL,
    sufficiency: sufficiency.sufficiency,
    activity,
    improved: coaching
      ? [
          wf("Consistent hashing", "Moved from an open question about replica placement in the first session to answering it, with numbers, in a later one.", [cite("s1", "d0"), cite("s9", "n0")]),
          wf("Binary search on answer", "Stated the monotonic-check condition precisely and applied it to a concrete problem.", [cite("s2", "n0")]),
        ]
      : [],
    weak: coaching ? [wf("Isolation levels", "Read committed and repeatable read were explained correctly, but a later session claimed repeatable read always prevents phantoms.", [cite("s3", "n4"), cite("s8", "n2")])] : [],
    repeatedMisunderstandings: coaching
      ? [wf("Stating a rule as universal", "Twice a general rule was written down as holding everywhere: dependency inversion equated with injection, and repeatable read said to always prevent phantoms.", [cite("s5", "n3"), cite("s8", "n2")])]
      : [],
    revisit: [wf("MLFQ", "Described up to demotion; starvation and the priority boost were not covered.", [cite("s4", "n4")])],
    learnNext: [wf("Hinted handoff", "Raised as unclear at the end of the latest HLD session.", [cite("s9", "end")]), wf("Vacuum and dead tuples", "Flagged as a difficulty in the MVCC session.", [cite("s8", "d0")])],
    priorities: ["Write a one-page comparison of isolation levels: the SQL standard against what PostgreSQL and MySQL actually do.", "Close the two open questions from the last HLD and Databases sessions before starting a new topic."],
    previousRecommendations: [
      { text: "Work an example of adding a node to a 4-server ring.", followed: "yes", evidence: [cite("s9", "n1")] },
      { text: "Redo the binary search problem from a blank file using the written invariant.", followed: "unclear", evidence: [] },
    ],
  };
  const weeklyCheck = validateWeekly(weekly, { week, sessions, reviews, nowMs: now });
  if (weeklyCheck.errors.length > 0) throw new Error(`fixture weekly report is invalid:\n${weeklyCheck.errors.join("\n")}`);
  files[weeklyPath(week)] = json(weekly);

  // Knowledge evidence: what the review routine would have accumulated, plus older pre-journal evidence.
  const items: Evidence[] = [];
  for (const r of reviews) items.push(...reviewEvidence(r, sessionOf.get(r.sessionId)!));
  const at7 = builtByKey.get("s7")!.endMs;
  const at2 = builtByKey.get("s2")!.endMs;
  const hist = (id: string, concept: string, subject: string, kind: Evidence["kind"], signal: Evidence["signal"], strength: Evidence["strength"], when: number, path: string, note?: string): Evidence => ({
    id: `fixture-ev-${id}`, concept: normalizeConcept(concept), label: concept, subject, kind, signal, strength, at: iso(when),
    source: { repo: "data", path, ref: `fixture-${id}` }, historical: path === "progress.json", ...(note ? { note } : {}),
  });
  items.push(
    hist("1", "Binary search", "DSA", "mcq-answer", "correct", "weak", now - 45 * DAY, "progress.json", "Answered a multiple-choice question."),
    hist("2", "TCP congestion control", "Networking", "mcq-answer", "correct", "weak", now - 44 * DAY, "progress.json", "Answered a multiple-choice question."),
    hist("3", "Heap property", "DSA", "written-explanation", "correct", "strong", now - 40 * DAY, "progress.json", "Explained sift-up and sift-down in an earlier exercise."),
    hist("4", "Hash table collisions", "DSA", "written-explanation", "correct", "strong", now - 38 * DAY, "progress.json", "Explained chaining and open addressing."),
    hist("5", "Hash table collisions", "DSA", "practical", "applied", "moderate", now - 30 * DAY, "leetcode/submissions.json", "Used a hash map to solve two-sum style problems."),
    hist("6", "Write-ahead logging", "Databases", "written-explanation", "correct", "strong", now - 35 * DAY, "progress.json", "Explained why the log is flushed before the data page."),
    hist("7", "Write-ahead logging", "Databases", "mcq-answer", "incorrect", "moderate", now - 20 * DAY, "progress.json", "Chose the wrong ordering of log flush and page write."),
    hist("8", "LRU cache", "DSA", "practical", "applied", "strong", at7 + DAY, "leetcode/submissions.json", "Accepted on the LeetCode LRU Cache problem."),
    hist("9", "Binary search on answer", "DSA", "practical", "applied", "moderate", at2 + 10 * DAY, "leetcode/submissions.json", "Applied to a feasibility search problem."),
  );
  const evidence: EvidenceFile = { v: 1, generatedBy: "fixture", items };
  files["knowledge/evidence.json"] = json(evidence);

  // LeetCode history and the nightly coding review.
  const subs = buildSubmissions(now);
  const store: LeetCodeStore = { version: 1, username: "fixture-user", submissions: subs };
  files["leetcode/submissions.json"] = json(store);
  files["leetcode/status.json"] = json({ ok: true, at: iso(now - 9 * HOUR), total: subs.length, message: `Pulled ${subs.length} submissions (synthetic)` });
  const forDate = iso(now).slice(0, 10);
  const codingReview = buildCodingReview(subs, now);
  const packet = buildCodingPacket(subs, null, forDate);
  const codingErrors = validateCodingReview(codingReview, packet);
  if (codingErrors.length > 0) throw new Error(`fixture coding review is invalid:\n${codingErrors.join("\n")}`);
  files["mentor/coding.json"] = json(buildCodingAnalysis(codingReview, packet, iso(now - 8 * HOUR)));

  // progress.json: the shared seeded progress, moved so it ends at `now`.
  const shift = now - Date.parse(FIXED_NOW);
  const mv = (s: string) => iso(Date.parse(s) + shift);
  const p = seededProgress();
  files["progress.json"] = json({
    ...p,
    updatedAt: iso(now),
    answers: p.answers.map((a) => ({ ...a, id: a.id.replace("e2e-", "fixture-"), sessionId: a.sessionId.replace("e2e-", "fixture-"), answeredAt: mv(a.answeredAt) })),
    sessions: p.sessions.map((s) => ({ ...s, id: s.id.replace("e2e-", "fixture-"), startedAt: mv(s.startedAt), finishedAt: mv(s.finishedAt) })),
    reads: p.reads.map((r) => ({ ...r, id: r.id.replace("e2e-", "fixture-"), openedAt: mv(r.openedAt) })),
  });

  // Archive of the V1 mentor reports.
  files["archive/mentor-v1/README.md"] = "# Mentor V1 archive (SYNTHETIC)\n\nReports written by the first mentor, kept for reference. This text is fixture data.\n";
  files[`archive/mentor-v1/reports/${iso(now - 24 * DAY).slice(0, 10)}.md`] =
    "# Daily report (SYNTHETIC)\n\n## What went well\n\n- Finished two DSA sessions.\n\n## Next\n\n- Revisit isolation levels.\n";

  return {
    now,
    files,
    summary: {
      sessions: summarySessions,
      weekly: { week, sufficiency: sufficiency.sufficiency },
      concepts: [...new Set(items.map((i) => i.concept))].sort(),
      leetcodeProblems: PROBLEMS.length,
    },
  };
}

/** Derived data the pages show, handy for assertions: the ended sessions' subjects, newest first. */
export function endedSubjects(repo: DataRepo): string[] {
  return Object.entries(repo.files)
    .filter(([p]) => p.startsWith("journal/sessions/"))
    .map(([, t]) => JSON.parse(t) as JournalSession)
    .map((s) => ({ s, d: deriveSession(s, repo.now) }))
    .filter((x) => x.d.status === "ended")
    .sort((a, b) => (b.d.endedAt ?? "").localeCompare(a.d.endedAt ?? ""))
    .map((x) => x.d.subject);
}
