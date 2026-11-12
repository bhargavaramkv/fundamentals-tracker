import { describe, expect, it } from "vitest";
import { formatClock, formatSpan } from "@/lib/journal/format";
import { createSession, makeEvent } from "@/lib/journal/events";
import type { SessionRecord } from "@/lib/journal/local";
import { lastSource, recentSubjects, topicSummary } from "@/lib/journal/summary";

const T = Date.parse("2026-11-12T10:00:00Z");
function rec(subject: string, kind: "book" | "video", at: number, topics: string[] = [], discard = false): SessionRecord {
  const session = createSession({ subject, source: { kind }, device: "d" }, at);
  session.events.push(...topics.map((text, i) => makeEvent({ kind: "topic", text }, "d", at + 1000 * (i + 1))));
  if (discard) session.events.push(makeEvent({ kind: "discard" }, "d", at + 9000));
  return { session, remoteSha: null, path: "" };
}

describe("journal summaries", () => {
  const records = [rec("HLD", "video", T + 3000, ["Caching"]), rec("hld", "book", T + 2000, ["caching", "Sharding"]), rec("Gone", "book", T + 1000, [], true)];

  it("suggests distinct, non-discarded subjects newest first", () => {
    expect(recentSubjects(records)).toEqual(["HLD"]);
  });

  it("defaults the source to the newest session's", () => {
    expect(lastSource(records)).toBe("video");
    expect(lastSource([])).toBe("other");
  });

  it("counts each topic once per session, skipping discarded ones", () => {
    const s = topicSummary(records);
    expect(s.find((t) => t.topic === "Caching")?.sessions).toBe(2);
    expect(s.find((t) => t.topic === "HLD")?.sessions).toBe(2);
    expect(s.find((t) => t.topic === "Sharding")?.sessions).toBe(1);
    expect(s.some((t) => t.topic === "Gone")).toBe(false);
  });
});

describe("duration formats", () => {
  it("formats the clock and spans", () => {
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("0:00:00");
    expect(formatSpan(30_000)).toBe("30s");
    expect(formatSpan(12 * 60_000)).toBe("12m");
    expect(formatSpan(65 * 60_000)).toBe("1h 05m");
  });
});

describe("journal summaries with meta events", () => {
  it("uses the subject and source from meta events", () => {
    const r = rec("HLD", "video", T + 5000, ["Caching"]);
    r.session.events.push(makeEvent({ kind: "meta", subject: "Databases", source: { kind: "book" } }, "d", T + 6000));
    expect(recentSubjects([r])).toEqual(["Databases"]);
    expect(lastSource([r])).toBe("book");
    expect(topicSummary([r]).map((t) => t.topic).sort()).toEqual(["Caching", "Databases"]);
  });
});
