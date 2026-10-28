import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyToken } from "@/lib/auth";
import { createLoginVault, exportKey, importKey, keyMatches, login, seal, unseal } from "@/lib/vault";
import committedVault from "@/lib/login-vault.json";

// Low iteration count keeps tests fast; production vaults use 600k.
const ITER = 1000;

describe("login vault", () => {
  it("accepts the right credentials and rejects wrong ones", async () => {
    const vault = await createLoginVault("Bhargav", "correct horse battery", ITER);
    expect(vault.username).toBe("bhargav");
    expect(await login(vault, "bhargav", "correct horse battery")).not.toBeNull();
    expect(await login(vault, " BHARGAV ", "correct horse battery")).not.toBeNull();
    expect(await login(vault, "bhargav", "wrong password")).toBeNull();
    expect(await login(vault, "someone", "correct horse battery")).toBeNull();
  });

  it("never stores the password", async () => {
    const vault = await createLoginVault("bhargav", "super-secret-pass", ITER);
    expect(JSON.stringify(vault)).not.toContain("super-secret-pass");
  });

  it("restores a session from an exported key, and rejects a key for another vault", async () => {
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const other = await createLoginVault("bhargav", "pass-two-123456", ITER);
    const key = (await login(vault, "bhargav", "pass-one-123456"))!;
    const restored = await importKey(await exportKey(key));
    expect(await keyMatches(vault, restored)).toBe(true);
    expect(await keyMatches(other, restored)).toBe(false);
  });

  it("encrypts the sync token so it's unreadable without the key", async () => {
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const key = (await login(vault, "bhargav", "pass-one-123456"))!;
    const sealed = await seal(key, "github_pat_example");
    expect(JSON.stringify(sealed)).not.toContain("github_pat_example");
    expect(await unseal(key, sealed)).toBe("github_pat_example");
    const wrongKey = (await login(await createLoginVault("x", "another-pass-1", ITER), "x", "another-pass-1"))!;
    expect(await unseal(wrongKey, sealed)).toBeNull();
  });

  it("ships a committed vault with strong parameters and no plaintext secrets", () => {
    expect(committedVault.iterations).toBeGreaterThanOrEqual(600_000);
    expect(committedVault.username).toBe("bhargav");
    expect(Object.keys(committedVault).sort()).toEqual(["check", "iterations", "iv", "salt", "username", "v"]);
  });
});

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe("verifyToken (sync)", () => {
  it("accepts a token that can read the private data repo", async () => {
    mockFetch(async () => new Response(JSON.stringify({ private: true }), { status: 200 }));
    expect(await verifyToken("t")).toEqual({ ok: true });
  });

  it("refuses to sync into a public repo", async () => {
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
});

describe("account-wide sync token", () => {
  it("publishes a sealed token that only the right key can read back", async () => {
    const { publishSharedToken, fetchSharedToken } = await import("@/lib/auth");
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const key = (await login(vault, "bhargav", "pass-one-123456"))!;
    let stored: string | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          stored = atob(JSON.parse(String(init.body)).content);
          return new Response("{}", { status: 201 });
        }
        if (!stored) return new Response("{}", { status: 404 });
        return new Response(stored, { status: 200 });
      }),
    );

    expect(await publishSharedToken(key, "github_pat_shared_example")).toEqual({ ok: true });
    expect(stored).not.toContain("github_pat_shared_example");
    expect(await fetchSharedToken(key)).toBe("github_pat_shared_example");

    const otherKey = (await login(await createLoginVault("bhargav", "pass-two-123456", ITER), "bhargav", "pass-two-123456"))!;
    expect(await fetchSharedToken(otherKey)).toBeNull();
  });

  it("reports the status when the token can't write the app repo", async () => {
    const { publishSharedToken } = await import("@/lib/auth");
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const key = (await login(vault, "bhargav", "pass-one-123456"))!;
    mockFetch(async () => new Response("{}", { status: 403 }));
    expect(await publishSharedToken(key, "t")).toEqual({ ok: false, status: 403 });
  });

  it("returns null when there is no shared copy yet", async () => {
    const { fetchSharedToken } = await import("@/lib/auth");
    const key = (await login(await createLoginVault("b", "pass-one-123456", ITER), "b", "pass-one-123456"))!;
    mockFetch(async () => new Response("{}", { status: 404 }));
    expect(await fetchSharedToken(key)).toBeNull();
  });
});
