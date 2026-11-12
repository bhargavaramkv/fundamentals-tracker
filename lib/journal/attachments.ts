/**
 * Photo attachments (V2 phase P3): compress in the browser, keep the blob in IndexedDB, record an `attach` event.
 * The pure parts (sizing, format choice, quality stepping) are separate from the browser parts so they can be tested.
 */

/**
 * Upload to the private media repo is NOT implemented. Photos stay on this device. The design (repo, paths, token
 * narrowing and the gates before building) is in docs/v2/ARCHITECTURE.md, "Media repository". Do not flip this
 * without meeting those gates.
 */
export const MEDIA_UPLOAD_ENABLED = false;

export const UPLOAD_STATUS_TEXT = "Saved on this device. Upload to the private media repo is not enabled yet.";

export const MAX_LONG_EDGE = 2000;
/** Aim for 150-350 KB: step the quality down only while the result is larger than this. */
export const TARGET_MAX_BYTES = 350 * 1024;
export const QUALITIES = [0.8, 0.7, 0.6] as const;

/** Output size with the long edge capped at `max`, keeping the aspect ratio. Never upscales; never returns 0. */
export function fitDimensions(width: number, height: number, max: number = MAX_LONG_EDGE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (!(long > 0)) return { width: 1, height: 1 };
  const scale = long > max ? max / long : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type ImageFormat = { mime: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" };

/**
 * Canvas.toBlob silently falls back to PNG when the browser can't encode the requested type (old Safari and WebP).
 * Only a real WebP result is accepted as WebP; anything else means "use JPEG instead".
 */
export function chooseFormat(encodedMime: string | null | undefined): ImageFormat {
  return encodedMime === "image/webp" ? { mime: "image/webp", ext: "webp" } : { mime: "image/jpeg", ext: "jpg" };
}

export type Encode = (mime: ImageFormat["mime"], quality: number) => Promise<Blob | null>;

/**
 * Encodes with WebP at q0.8 (JPEG if the browser can't do WebP), then steps the quality down to 0.6 while the result
 * is over the target size. Returns the smallest-quality attempt reached, which may still be over target for big scenes.
 */
export async function encodeAdaptive(encode: Encode): Promise<Blob> {
  let blob = await encode("image/webp", QUALITIES[0]);
  let format = chooseFormat(blob?.type);
  if (!blob || format.mime !== "image/webp") {
    format = chooseFormat(null);
    blob = await encode(format.mime, QUALITIES[0]);
  }
  for (const q of QUALITIES.slice(1)) {
    if (!blob || blob.size <= TARGET_MAX_BYTES) break;
    blob = (await encode(format.mime, q)) ?? blob;
  }
  if (!blob) throw new Error("This browser could not encode the photo");
  return blob;
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw new Error("This file is not an image the browser can read", { cause: e });
  }
  // Modern browsers apply EXIF orientation to <img> by default.
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

/**
 * Decodes (respecting EXIF orientation), scales to a 2000 px long edge and re-encodes.
 * Drawing to a canvas and re-encoding drops all metadata: EXIF, GPS position and camera details do not survive.
 */
export async function compressImage(file: Blob): Promise<CompressedImage> {
  const img = await decode(file);
  try {
    const { width, height } = fitDimensions(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot process images");
    ctx.drawImage(img.source, 0, 0, width, height);
    const blob = await encodeAdaptive((mime, q) => new Promise((resolve) => canvas.toBlob(resolve, mime, q)));
    return { blob, width, height };
  } finally {
    img.release();
  }
}

/** sha256 hex of a blob's bytes. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}
