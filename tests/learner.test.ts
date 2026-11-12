import { describe, expect, it } from "vitest";
import { validateLearnerProfile, type LearnerProfile } from "@/lib/learner";

const keys = new Set(["system-design/caching", "databases/indexing", "dsa/graphs", "oop/solid"]);

const good = (): LearnerProfile => ({
  updatedAt: "2026-11-12T01:00:00Z",
  analysedThrough: "2026-11-11T20:00:00Z",
  headline: "You are steady on databases; caching misconceptions are next.",
  patterns: [{ label: "Evenings", note: "Most activity after 21:00." }],
  interests: ["Kubernetes, with evidence"],
  strengths: ["Indexing"],
  struggles: [{ topic: "system-design/caching", misconception: "Thinks TTL guarantees freshness." }],
  nextUp: [{ topic: "system-design/caching", why: "Missed twice." }],
  adaptations: [{ date: "2026-11-11", topic: "databases/indexing", change: "Added a steps visual.", why: "Read then missed." }],
  notes: "Longer reasoning.",
});

describe("validateLearnerProfile", () => {
  it("accepts a good profile", () => expect(validateLearnerProfile(good(), keys)).toEqual([]));
  it("rejects unknown lesson keys", () => {
    const p = good();
    p.nextUp = [{ topic: "nope/missing", why: "x" }];
    expect(validateLearnerProfile(p, keys).join()).toContain("nope/missing");
  });
  it("rejects an overlong headline", () => {
    const p = good();
    p.headline = "x".repeat(201);
    expect(validateLearnerProfile(p, keys).join()).toContain("headline");
  });
  it("rejects more than 3 nextUp", () => {
    const p = good();
    p.nextUp = ["system-design/caching", "databases/indexing", "dsa/graphs", "oop/solid"].map((topic) => ({ topic, why: "x" }));
    expect(validateLearnerProfile(p, keys).join()).toContain("nextUp");
  });
  it("rejects duplicate nextUp", () => {
    const p = good();
    p.nextUp = [p.nextUp[0], p.nextUp[0]];
    expect(validateLearnerProfile(p, keys).join()).toContain("duplicate");
  });
});
