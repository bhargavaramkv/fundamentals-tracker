import { describe, expect, it } from "vitest";
import { MEDIA_UPLOAD_ENABLED, MAX_LONG_EDGE, TARGET_MAX_BYTES, chooseFormat, encodeAdaptive, fitDimensions, sha256Hex, type Encode } from "@/lib/journal/attachments";
import { createMissingStores } from "@/lib/idb";
import { JOURNAL_STORES, memoryJournalLocal } from "@/lib/journal/local";

/** Synthetic: a blob of `size` zero bytes with the given type. Not a real image. */
const fake = (type: string, size: number) => new Blob([new Uint8Array(size)], { type });

describe("photo sizing", () => {
  it("caps the long edge at 2000 and keeps the aspect ratio", () => {
    expect(fitDimensions(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitDimensions(3000, 4000)).toEqual({ width: 1500, height: 2000 });
    expect(fitDimensions(4001, 1)).toEqual({ width: MAX_LONG_EDGE, height: 1 });
  });
  it("never upscales and never returns zero", () => {
    expect(fitDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitDimensions(0, 0)).toEqual({ width: 1, height: 1 });
    expect(fitDimensions(20000, 3).height).toBe(1);
  });
});

describe("format choice", () => {
  it("accepts WebP only when the browser really produced WebP", () => {
    expect(chooseFormat("image/webp")).toEqual({ mime: "image/webp", ext: "webp" });
    expect(chooseFormat("image/png")).toEqual({ mime: "image/jpeg", ext: "jpg" }); // old Safari answers a WebP request with PNG
    expect(chooseFormat(null)).toEqual({ mime: "image/jpeg", ext: "jpg" });
  });
});

describe("encodeAdaptive", () => {
  const run = (sizes: Record<string, number>, webp = true) => {
    const calls: string[] = [];
    const encode: Encode = async (mime, q) => {
      calls.push(`${mime}@${q}`);
      const type = mime === "image/webp" && !webp ? "image/png" : mime;
      return fake(type, sizes[String(q)] ?? 1);
    };
    return { calls, result: encodeAdaptive(encode) };
  };

  it("keeps WebP q0.8 when it is already small enough", async () => {
    const { calls, result } = run({ "0.8": 200_000 });
    expect((await result).type).toBe("image/webp");
    expect(calls).toEqual(["image/webp@0.8"]);
  });
  it("steps the quality down while over target, and stops at 0.6", async () => {
    const { calls, result } = run({ "0.8": TARGET_MAX_BYTES + 1, "0.7": TARGET_MAX_BYTES + 1, "0.6": TARGET_MAX_BYTES + 1 });
    expect((await result).size).toBe(TARGET_MAX_BYTES + 1);
    expect(calls).toEqual(["image/webp@0.8", "image/webp@0.7", "image/webp@0.6"]);
  });
  it("stops stepping once under target", async () => {
    const { calls, result } = run({ "0.8": TARGET_MAX_BYTES + 1, "0.7": 100 });
    await result;
    expect(calls).toEqual(["image/webp@0.8", "image/webp@0.7"]);
  });
  it("falls back to JPEG when the browser cannot encode WebP", async () => {
    const { calls, result } = run({ "0.8": 100 }, false);
    expect((await result).type).toBe("image/jpeg");
    expect(calls).toEqual(["image/webp@0.8", "image/jpeg@0.8"]);
  });
  it("throws when nothing can be encoded", async () => {
    await expect(encodeAdaptive(async () => null)).rejects.toThrow(/could not encode/);
  });
});

describe("hashing and the upload gate", () => {
  it("sha256Hex matches the known digest of 'abc'", async () => {
    expect(await sha256Hex(new Blob(["abc"]))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("upload is off", () => {
    expect(MEDIA_UPLOAD_ENABLED).toBe(false);
  });
});

describe("attachment storage", () => {
  it("the journal has an attachments store, and the upgrade only adds missing stores", () => {
    expect(JOURNAL_STORES).toEqual(["sessions", "requests", "outbox", "meta", "attachments"]);
    // A version-1 database already has four stores with user data in them: only `attachments` may be created.
    const existing = new Set(["sessions", "requests", "outbox", "meta"]);
    const creates: string[] = [];
    const db = { objectStoreNames: { contains: (n: string) => existing.has(n) }, createObjectStore: (n: string) => void creates.push(n) } as unknown as IDBDatabase;
    expect(createMissingStores(db, JOURNAL_STORES)).toEqual(["attachments"]);
    expect(creates).toEqual(["attachments"]);
    expect(createMissingStores(db, [])).toEqual([]);
  });

  it("stores a synthetic blob with its metadata and reads it back", async () => {
    const local = memoryJournalLocal();
    const blob = fake("image/webp", 10);
    await local.attachments.put("a1", { id: "a1", sessionId: "s", blob, mime: "image/webp", width: 1, height: 1, bytes: 10, sha256: "x", createdAt: "2026-11-13T00:00:00Z" });
    expect((await local.attachments.get("a1"))?.blob.size).toBe(10);
  });
});
