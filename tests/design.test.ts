import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.resolve(import.meta.dirname, "..", "app", "globals.css"), "utf8");

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)")));
const dark = tokens(css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf("@theme inline")));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme meets WCAG AA", (_, t) => {
  it.each(["text", "text-2", "text-3", "accent-text", "good", "bad", "warn"])("%s is readable on every background", (name) => {
    for (const bg of ["bg", "surface", "surface-2"]) {
      expect(contrast(t[name], t[bg]), `${name} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("status colours are readable on their own tints", () => {
    expect(contrast(t.good, t["good-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.bad, t["bad-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.warn, t["warn-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it("primary button text is readable, including on hover", () => {
    expect(contrast(t["accent-ink"], t.button)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["accent-ink"], t["button-hover"])).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus outline stands out from the page", () => {
    expect(contrast(t.accent, t.bg)).toBeGreaterThanOrEqual(3);
  });
});

describe("design rules", () => {
  it("keeps the brand accent: the wordmark's dot doesn't change colour", () => {
    expect(light.accent).toBe("#2a78d6");
    expect(dark.accent).toBe("#3b9bff");
  });

  it("avoids glassmorphism and decorative gradients", () => {
    expect(css).not.toMatch(/backdrop-filter/);
    expect(css).not.toMatch(/linear-gradient|radial-gradient/);
  });

  it("the dark definitions agree between the media query and data-theme", () => {
    const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf(':root[data-theme="dark"]'));
    expect(tokens(media)).toEqual(dark);
  });
});
