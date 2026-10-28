import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyToken } from "@/lib/auth";

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe("verifyToken", () => {
  it("unlocks only when the token can read the private data repo", async () => {
    mockFetch(async () => new Response(JSON.stringify({ private: true }), { status: 200 }));
    expect(await verifyToken("t")).toEqual({ ok: true });
  });

  it("refuses to unlock against a public data repo, since any token could read it", async () => {
    mockFetch(async () => new Response(JSON.stringify({ private: false }), { status: 200 }));
    expect(await verifyToken("t")).toMatchObject({ ok: false, reason: "not-private" });
  });

  it.each([
    [401, "invalid"],
    [403, "no-access"],
    [404, "no-access"],
    [500, "error"],
  ])("maps HTTP %i to %s", async (status, reason) => {
    mockFetch(async () => new Response("{}", { status }));
    expect(await verifyToken("t")).toMatchObject({ ok: false, reason });
  });

  it("reports offline when GitHub is unreachable", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await verifyToken("t")).toMatchObject({ ok: false, reason: "offline" });
  });

  it("always checks the build-time data repo", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ private: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await verifyToken("t");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      "https://api.github.com/repos/bhargavaramkv/fundamentals-tracker-data",
    );
  });
});
