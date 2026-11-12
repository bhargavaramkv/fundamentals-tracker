import { describe, expect, it } from "vitest";
import { createSession, makeEvent } from "@/lib/journal/events";
import { weekActivity } from "@/lib/today";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const MIN = 60_000;

function ended(startAt: number, endAt: number, extra: (s: ReturnType<typeof createSession>) => void = () => {}) {
  const s = createSession({ subject: "HLD", source: { kind: "book" }, device: "d" }, startAt);
  extra(s);
  s.events.push(makeEvent({ kind: "end" }, "d", endAt));
  return s;
}

describe("weekActivity", () => {
  const now = local(2026, 11, 12, 15);

  it("returns seven zeroed days, oldest first, when there are no sessions", () => {
    const week = weekActivity([], now);
    expect(week).toHaveLength(7);
    expect(week.every((d) => d.activeMs === 0)).toBe(true);
    expect(week[6].dayStart).toBe(local(2026, 11, 12));
    expect(week[0].dayStart).toBe(local(2026, 11, 6));
  });

  it("counts a session on its day", () => {
    const week = weekActivity([ended(local(2026, 11, 11, 9), local(2026, 11, 11, 9, 45))], now);
    expect(week[5].activeMs).toBe(45 * MIN);
    expect(week.reduce((n, d) => n + d.activeMs, 0)).toBe(45 * MIN);
  });

  it("excludes paused time", () => {
    const start = local(2026, 11, 12, 8);
    const s = ended(start, start + 60 * MIN, (x) => {
      x.events.push(makeEvent({ kind: "pause" }, "d", start + 20 * MIN), makeEvent({ kind: "resume" }, "d", start + 40 * MIN));
    });
    expect(weekActivity([s], now)[6].activeMs).toBe(40 * MIN);
  });

  it("splits a session that runs past midnight", () => {
    const week = weekActivity([ended(local(2026, 11, 11, 23, 30), local(2026, 11, 12, 0, 30))], now);
    expect(week[5].activeMs).toBe(30 * MIN);
    expect(week[6].activeMs).toBe(30 * MIN);
  });

  it("ignores discarded sessions and sessions older than the window", () => {
    const gone = ended(local(2026, 11, 12, 8), local(2026, 11, 12, 9), (x) => x.events.push(makeEvent({ kind: "discard" }, "d", local(2026, 11, 12, 9, 1))));
    const old = ended(local(2026, 11, 1, 8), local(2026, 11, 1, 9));
    expect(weekActivity([gone, old], now).every((d) => d.activeMs === 0)).toBe(true);
  });

  it("counts a running session up to now", () => {
    const s = createSession({ subject: "HLD", source: { kind: "book" }, device: "d" }, local(2026, 11, 12, 14));
    expect(weekActivity([s], now)[6].activeMs).toBe(60 * MIN);
  });
});
