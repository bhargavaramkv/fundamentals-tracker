/**
 * Password-derived keys for the static-site login. The repo stores only a salt
 * and an AES-GCM ciphertext of a marker; a key derived from the right
 * username + password is the only thing that decrypts it. Works in browsers
 * and Node (both expose WebCrypto as globalThis.crypto).
 */

export interface LoginVault {
  v: 1;
  username: string;
  iterations: number;
  salt: string;
  iv: string;
  check: string;
}

export interface Sealed {
  iv: string;
  data: string;
}

const MARKER = "fundamentals-tracker:unlocked";
export const PBKDF2_ITERATIONS = 600_000;

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function deriveKey(username: string, password: string, salt: string, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${normalizeUsername(username)}\n${password}`),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function seal(key: CryptoKey, plaintext: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { iv: b64(iv), data: b64(new Uint8Array(data)) };
}

/** Returns null when the key is wrong or the data was tampered with (GCM authentication fails). */
export async function unseal(key: CryptoKey, sealed: Sealed): Promise<string | null> {
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) }, key, unb64(sealed.data));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export async function createLoginVault(username: string, password: string, iterations = PBKDF2_ITERATIONS): Promise<LoginVault> {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(username, password, salt, iterations);
  const { iv, data } = await seal(key, MARKER);
  return { v: 1, username: normalizeUsername(username), iterations, salt, iv, check: data };
}

/** Resolves to the session key when the credentials are right, otherwise null. */
export async function login(vault: LoginVault, username: string, password: string): Promise<CryptoKey | null> {
  if (normalizeUsername(username) !== vault.username) return null;
  const key = await deriveKey(username, password, vault.salt, vault.iterations);
  return (await keyMatches(vault, key)) ? key : null;
}

export async function keyMatches(vault: LoginVault, key: CryptoKey): Promise<boolean> {
  return (await unseal(key, { iv: vault.iv, data: vault.check })) === MARKER;
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return b64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

export async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", unb64(raw), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}
