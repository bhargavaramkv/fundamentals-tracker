import { describe, expect, it } from "vitest";
import { createSession, makeEvent } from "@/lib/journal/events";
import { EMPTY_FILTER, dateGroup, filterHistory, groupByDate, historyItems, subjectsOf } from "@/lib/journal/history";
import type { SessionRecord } from "@/lib/journal/local";
import { describeSync, type QueueInfo } from "@/lib/journal/status";
import type { SourceKind } from "@/lib/journal/types";

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 18, 15, 0, 0).getTime(); // local time, so the day buckets don't depend on the machine's zone

function rec(subject: string, kind: SourceKind, startedAt: number, opts: { notes?: string[]; objective?: string; end?: boolean; discard?: boolean } = {}): SessionRecord {
  const session = createSession({ subject, source: { kind }, objective: opts.objective, device: "d" }, startedAt);
  (opts.notes ?? []).forEach((text, i) => session.events.push(makeEvent({ kind: "note", text }, "d", startedAt + 1000 * (i + 1))));
  if (opts.end !== false) session.events.push(makeEvent({ kind: "end" }, "d", startedAt + 60_000));
  if (opts.discard) session.events.push(makeEvent({ kind: "discard" }, "d", startedAt + 70_000));
  return { session, remoteSha: null, path: "" };
}

const records = [
  rec("HLD", "book", NOW - 2 * 3_600_000, { notes: ["Consistent hashing ring"], objective: "sharding" }),
  rec("DSA", "leetcode", NOW - 3 * DAY, { notes: ["two pointers"] }),
  rec("HLD", "video", NOW - 20 * DAY, { notes: ["cache stampede"] }),
  rec("Gone", "other", NOW - 1 * DAY, { discard: true }),
  rec("Running", "docs", NOW - 1000, { end: false }),
];
const items = historyItems(records);

describe("history filtering", () => {
  it("excludes running sessions from history", () => {
    expect(items.map((i) => i.derived.subject)).toEqual(["HLD", "DSA", "HLD", "Gone"]);
  });
  it("hides discarded sessions unless asked", () => {
    expect(filterHistory(items, EMPTY_FILTER)).toHaveLength(3);
    expect(filterHistory(items, { ...EMPTY_FILTER, showDiscarded: true })).toHaveLength(4);
  });
  it("filters by subject (case-insensitive) and source", () => {
    expect(filterHistory(items, { ...EMPTY_FILTER, subject: "hld" })).toHaveLength(2);
    expect(filterHistory(items, { ...EMPTY_FILTER, source: "video" })).toHaveLength(1);
    expect(filterHistory(items, { ...EMPTY_FILTER, subject: "HLD", source: "book" })).toHaveLength(1);
  });
  it("searches subject, objective and notes, all terms required", () => {
    expect(filterHistory(items, { ...EMPTY_FILTER, query: "sharding" })).toHaveLength(1);
    expect(filterHistory(items, { ...EMPTY_FILTER, query: "POINTERS" })).toHaveLength(1);
    expect(filterHistory(items, { ...EMPTY_FILTER, query: "cache stampede" })).toHaveLength(1);
    expect(filterHistory(items, { ...EMPTY_FILTER, query: "cache pointers" })).toHaveLength(0);
    expect(filterHistory(items, { ...EMPTY_FILTER, query: "hld" })).toHaveLength(2);
  });
  it("uses the derived subject and edited notes", () => {
    const r = rec("HLD", "book", NOW - 5000, { notes: ["old text"] });
    const note = r.session.events.find((e) => e.kind === "note")!;
    r.session.events.push(makeEvent({ kind: "edit", target: note.id, text: "new text" }, "d", NOW));
    r.session.events.push(makeEvent({ kind: "meta", subject: "Renamed" }, "d", NOW + 1));
    const [i] = historyItems([r]);
    expect(filterHistory([i], { ...EMPTY_FILTER, query: "new text" })).toHaveLength(1);
    expect(filterHistory([i], { ...EMPTY_FILTER, query: "old text" })).toHaveLength(0);
    expect(filterHistory([i], { ...EMPTY_FILTER, subject: "Renamed" })).toHaveLength(1);
    expect(subjectsOf([i])).toEqual(["Renamed"]);
  });
  it("lists distinct subjects once", () => {
    expect(subjectsOf(items)).toEqual(["DSA", "Gone", "HLD"]);
  });
});

describe("date groups", () => {
  it("buckets by calendar day", () => {
    expect(dateGroup(new Date(2026, 10, 18, 0, 5).toISOString(), NOW)).toBe("Today");
    expect(dateGroup(new Date(2026, 10, 17, 23, 55).toISOString(), NOW)).toBe("This week");
    expect(dateGroup(new Date(2026, 10, 12, 9).toISOString(), NOW)).toBe("This week");
    expect(dateGroup(new Date(2026, 10, 11, 9).toISOString(), NOW)).toBe("Earlier");
  });
  it("groups in order and drops empty groups", () => {
    expect(groupByDate(filterHistory(items, EMPTY_FILTER), NOW).map((g) => [g.label, g.items.length])).toEqual([
      ["Today", 1],
      ["This week", 1],
      ["Earlier", 1],
    ]);
    expect(groupByDate([], NOW)).toEqual([]);
  });
});

describe("describeSync", () => {
  const idle: QueueInfo = { queued: 0, nextAttemptAt: null, conflicts: 0 };
  const base = { hasToken: true, online: true, state: { state: "idle" as const, lastSyncedAt: "2026-11-18T10:00:00Z" }, queue: idle };
  it("reports each state", () => {
    expect(describeSync({ ...base, hasToken: false }).kind).toBe("local");
    expect(describeSync(base).kind).toBe("synced");
    expect(describeSync({ ...base, state: { state: "syncing" } }).kind).toBe("saving");
    expect(describeSync({ ...base, queue: { ...idle, queued: 2 } })).toMatchObject({ kind: "saving", label: "2 changes waiting to sync" });
    expect(describeSync({ ...base, state: { state: "error", message: "boom" } })).toMatchObject({ kind: "error", label: "Sync problem: boom" });
    const retry = describeSync({ ...base, state: { state: "error", message: "Failed to fetch" }, queue: { ...idle, queued: 1, nextAttemptAt: NOW } });
    expect(retry.kind).toBe("retrying");
    expect(retry.label).toContain("Failed to fetch");
  });
  it("offline shows the queued count and beats saving and retry", () => {
    expect(describeSync({ ...base, online: false, state: { state: "syncing" }, queue: { ...idle, queued: 1, nextAttemptAt: NOW } })).toEqual({
      kind: "offline",
      label: "Offline. 1 change queued; they sync when you are back online.",
    });
  });
  it("conflict beats everything except having no token", () => {
    expect(describeSync({ ...base, online: false, queue: { ...idle, conflicts: 2 } }).kind).toBe("conflict");
  });
});
