import { describe, expect, it } from "vitest";
import { isQuickMiss, QUICK_MISS_MS, READ_LOCK_MS } from "@/lib/answer-pace";

describe("answer pace", () => {
  it("flags only wrong answers under the threshold", () => {
    expect(isQuickMiss(QUICK_MISS_MS - 1, false)).toBe(true);
    expect(isQuickMiss(QUICK_MISS_MS, false)).toBe(false);
    expect(isQuickMiss(READ_LOCK_MS, true)).toBe(false);
  });
});
