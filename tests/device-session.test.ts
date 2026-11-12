import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/idb";
import {
  LEGACY_SESSION_KEY,
  LEGACY_TOKEN_KEY,
  enrollDevice,
  forgetDevice,
  restoreDevice,
  updateDeviceToken,
  upgradeLegacySession,
  type DeviceRecord,
} from "@/lib/device-session";
import { createLoginVault, exportKey, login, seal } from "@/lib/vault";

const ITER = 1000;
const NOW = Date.parse("2026-11-13T00:00:00Z");
const DAY = 86_400_000;

let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("per-device session", () => {
  it("enrolls with a non-extractable key and restores the sealed token", async () => {
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const store = new MemoryStore<DeviceRecord>();
    await enrollDevice(store, vault, "github_pat_x", true, NOW);
    const record = (await store.get("current"))!;
    expect(record.key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", record.key)).rejects.toThrow();
    expect(JSON.stringify(record.token)).not.toContain("github_pat_x");
    expect(await restoreDevice(store, vault, NOW + DAY)).toEqual({ token: "github_pat_x", shared: true });
  });

  it("never stores the password-derived key", async () => {
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const passwordKey = (await login(vault, "bhargav", "pass-one-123456"))!;
    const store = new MemoryStore<DeviceRecord>();
    await enrollDevice(store, vault, "t", false, NOW);
    const record = (await store.get("current"))!;
    expect(record.key).not.toBe(passwordKey);
    expect(JSON.stringify(Object.keys(record).sort())).toBe(JSON.stringify(["expiresAt", "key", "shared", "token", "vaultCheck"]));
  });

  it("expires after 30 days", async () => {
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const store = new MemoryStore<DeviceRecord>();
    await enrollDevice(store, vault, "t", false, NOW);
    expect(await restoreDevice(store, vault, NOW + 29 * DAY)).not.toBeNull();
    expect(await restoreDevice(store, vault, NOW + 31 * DAY)).toBeNull();
  });

  it("a password reset (new vault) signs the device out", async () => {
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const reset = await createLoginVault("bhargav", "pass-two-123456", ITER);
    const store = new MemoryStore<DeviceRecord>();
    await enrollDevice(store, vault, "t", false, NOW);
    expect(await restoreDevice(store, reset, NOW)).toBeNull();
  });

  it("updates or clears the token, and forgets on sign-out", async () => {
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const store = new MemoryStore<DeviceRecord>();
    await enrollDevice(store, vault, null, false, NOW);
    await updateDeviceToken(store, "new-token", true);
    expect(await restoreDevice(store, vault, NOW)).toEqual({ token: "new-token", shared: true });
    await updateDeviceToken(store, null, false);
    expect(await restoreDevice(store, vault, NOW)).toEqual({ token: null, shared: false });
    await forgetDevice(store);
    expect(await restoreDevice(store, vault, NOW)).toBeNull();
  });
});

describe("upgrade from a V1 session", () => {
  /** Writes a V1 session (raw key + sealed token) to localStorage and returns its vault. */
  async function legacy(expiresAt = NOW + DAY) {
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    const key = (await login(vault, "bhargav", "pass-one-123456"))!;
    storage.set(LEGACY_SESSION_KEY, JSON.stringify({ key: await exportKey(key), expiresAt }));
    storage.set(LEGACY_TOKEN_KEY, JSON.stringify(await seal(key, "github_pat_legacy")));
    return vault;
  }

  it("enrolls the device with the old token and deletes the raw key", async () => {
    const vault = await legacy();
    const store = new MemoryStore<DeviceRecord>();
    expect(await upgradeLegacySession(store, vault, NOW)).toEqual({ token: "github_pat_legacy", shared: false });
    expect(storage.has(LEGACY_SESSION_KEY)).toBe(false);
    expect(storage.has(LEGACY_TOKEN_KEY)).toBe(false);
    expect(await restoreDevice(store, vault, NOW)).toEqual({ token: "github_pat_legacy", shared: false });
  });

  it("an expired or foreign V1 session is removed, not upgraded", async () => {
    const vault = await legacy(NOW - 1);
    const store = new MemoryStore<DeviceRecord>();
    expect(await upgradeLegacySession(store, vault, NOW)).toBeNull();
    expect(storage.size).toBe(0);

    await legacy();
    const other = await createLoginVault("bhargav", "pass-two-123456", ITER);
    expect(await upgradeLegacySession(store, other, NOW)).toBeNull();
    expect(storage.size).toBe(0);
    expect(await store.get("current")).toBeUndefined();
  });

  it("does nothing without a V1 session", async () => {
    const vault = await createLoginVault("bhargav", "pass-one-123456", ITER);
    expect(await upgradeLegacySession(new MemoryStore<DeviceRecord>(), vault, NOW)).toBeNull();
  });
});
