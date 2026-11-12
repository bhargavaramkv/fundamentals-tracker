import { IdbStore, idbAvailable, type KeyValueStore } from "./idb";
import { importKey, keyMatches, seal, unseal, type LoginVault, type Sealed } from "./vault";

/**
 * Per-device sign-in. A password sign-in enrolls this browser: it gets its own random AES key, created
 * non-extractable so script can use it but never read it out, and the sync token is re-sealed under that key. The
 * password-derived key is never stored. Each device enrolls on its own; a device key never leaves its browser.
 *
 * The record also remembers the vault's `check`, so resetting the password (a new vault) signs every device out.
 */

export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;
const RECORD = "current";

export interface DeviceRecord {
  key: CryptoKey;
  /** The login vault's `check` at enrollment. */
  vaultCheck: string;
  expiresAt: number;
  /** Sync token sealed under `key`. */
  token: Sealed | null;
  /** Whether the token came from (or was saved to) the account-wide copy. */
  shared: boolean;
}

export type DeviceStore = KeyValueStore<DeviceRecord>;

/** IndexedDB store for the device record, or null when IndexedDB is unavailable (then nothing is persisted). */
export async function openDeviceStore(): Promise<DeviceStore | null> {
  return (await idbAvailable()) ? new IdbStore<DeviceRecord>("ft-secure", "device", ["device"]) : null;
}

export interface DeviceSession {
  token: string | null;
  shared: boolean;
}

export async function enrollDevice(store: DeviceStore, vault: LoginVault, token: string | null, shared: boolean, now = Date.now()): Promise<void> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await store.put(RECORD, { key, vaultCheck: vault.check, expiresAt: now + SESSION_DAYS * DAY_MS, token: token ? await seal(key, token) : null, shared });
}

/** This device's session, or null when there is none, it expired, or the password has been reset since. */
export async function restoreDevice(store: DeviceStore, vault: LoginVault, now = Date.now()): Promise<DeviceSession | null> {
  try {
    const r = await store.get(RECORD);
    if (!r || now > r.expiresAt || r.vaultCheck !== vault.check) return null;
    return { token: r.token ? await unseal(r.key, r.token) : null, shared: r.shared };
  } catch {
    return null;
  }
}

/** Replaces the sealed token, keeping the enrollment and its expiry. */
export async function updateDeviceToken(store: DeviceStore, token: string | null, shared: boolean): Promise<void> {
  const r = await store.get(RECORD);
  if (!r) return;
  await store.put(RECORD, { ...r, token: token ? await seal(r.key, token) : null, shared });
}

export async function forgetDevice(store: DeviceStore): Promise<void> {
  await store.delete(RECORD);
}

/** V1 kept the raw password-derived key and the sealed token in localStorage. */
export const LEGACY_SESSION_KEY = "ft.session.v1";
export const LEGACY_TOKEN_KEY = "ft.syncToken.v1";

/**
 * One-time upgrade from a V1 session: if the stored raw key is still valid, enroll this device with the token it
 * unseals. The raw key and the old sealed token are removed from localStorage either way.
 */
export async function upgradeLegacySession(store: DeviceStore, vault: LoginVault, now = Date.now()): Promise<DeviceSession | null> {
  let rawSession: string | null = null;
  let rawToken: string | null = null;
  try {
    rawSession = window.localStorage.getItem(LEGACY_SESSION_KEY);
    rawToken = window.localStorage.getItem(LEGACY_TOKEN_KEY);
  } catch {
    return null;
  }
  if (!rawSession) return null;
  try {
    const session = JSON.parse(rawSession) as { key: string; expiresAt: number };
    if (now > session.expiresAt) return null;
    const key = await importKey(session.key);
    if (!(await keyMatches(vault, key))) return null;
    const token = rawToken ? await unseal(key, JSON.parse(rawToken) as Sealed) : null;
    await enrollDevice(store, vault, token, false, now);
    return { token, shared: false };
  } catch {
    return null;
  } finally {
    try {
      window.localStorage.removeItem(LEGACY_SESSION_KEY);
      window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      // Nothing more to clean up.
    }
  }
}

/** Removes any V1 credentials left in localStorage (used on sign-out and when there is no IndexedDB). */
export function clearLegacySession(): void {
  try {
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage unavailable.
  }
}
