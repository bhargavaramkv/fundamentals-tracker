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
