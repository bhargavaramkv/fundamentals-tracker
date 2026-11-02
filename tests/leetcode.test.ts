import { describe, expect, it } from "vitest";
import { importRecords, isLeetCodeFeed, patternsFromTags, planImport, type LeetCodeFeed } from "@/lib/leetcode";
import { emptyProgress, recordCodingAttempt, recordCodingProblem } from "@/lib/progress";
import { nextRevisitDays } from "@/lib/coding";

const feed: LeetCodeFeed = {
  version: 1,
  username: "someone",
  syncedAt: "2026-11-01T00:00:00.000Z",
  items: [
    { slug: "two-sum", title: "Two Sum", number: 1, difficulty: "easy", tags: ["array", "hash-table"], solvedAt: "2026-10-30T10:00:00.000Z" },
    { slug: "lru-cache", title: "LRU Cache", number: 146, difficulty: "medium", tags: ["hash-table", "linked-list", "design"], solvedAt: "2026-10-31T10:00:00.000Z" },
  ],
};

describe("leetcode import", () => {
  it("validates the feed shape", () => {
    expect(isLeetCodeFeed(feed)).toBe(true);
    expect(isLeetCodeFeed({ ...feed, items: [{ ...feed.items[0], slug: "../x" }] })).toBe(false);
    expect(isLeetCodeFeed({ ...feed, version: 2 })).toBe(false);
    expect(isLeetCodeFeed(null)).toBe(false);
  });

  it("maps tags to patterns, dropping unknown ones and duplicates", () => {
    expect(patternsFromTags(["array", "hash-table", "design"])).toEqual(["arrays-hashing"]);
  });

  it("imports only problems with no attempts and not removed", () => {
    expect(planImport(emptyProgress(), feed).map((i) => i.slug)).toEqual(["two-sum", "lru-cache"]);

    const { problem, attempt } = importRecords(feed.items[0], undefined, "2026-11-01T00:00:00.000Z");
    let data = recordCodingAttempt(recordCodingProblem(emptyProgress(), problem), attempt);
    expect(planImport(data, feed).map((i) => i.slug)).toEqual(["lru-cache"]);

    const removed = importRecords(feed.items[1], undefined, "2026-11-01T00:00:00.000Z").problem;
    data = recordCodingProblem(data, { ...removed, deletedAt: "2026-11-01T01:00:00.000Z" });
    expect(planImport(data, feed)).toEqual([]);
  });

  it("imports as solved with help, so it comes back in 7 days", () => {
    const { problem, attempt } = importRecords(feed.items[0], undefined, "2026-11-01T00:00:00.000Z");
    expect(problem.id).toBe("lc-two-sum");
    expect(problem.patterns).toEqual(["arrays-hashing"]);
    expect(attempt.at).toBe(feed.items[0].solvedAt);
    expect(nextRevisitDays([attempt])).toBe(7);
  });
});
