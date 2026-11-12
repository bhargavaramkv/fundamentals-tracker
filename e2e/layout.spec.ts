import type { Page } from "@playwright/test";
import { expect, test } from "./auth";
import { FIXED_NOW, PROGRESS_KEY, seededProgress } from "./fixture";

const PAGES = ["/", "/journal/", "/knowledge/", "/learn/", "/practice/", "/learn/dsa/big-o-basics/", "/coding/", "/settings/"];
const DESKTOP_WIDTHS = [1280, 1600, 1920];
const PHONE = { width: 375, height: 812 };
// Phone 390 and tablet 768 check overflow only (below lg there is no sidebar to centre against).
const SMALL_VIEWPORTS = [
  { name: "phone", ...PHONE },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
];
// Measured on the good layout the gaps differ by under 1px (subpixel rounding); 2px allows for that
// while any real lopsidedness (e.g. a missing mx-auto, hundreds of px) fails by a wide margin.
const TOLERANCE_PX = 2;
// "empty" = fresh browser; "seeded" = realistic progress in localStorage and a fixed clock.
const DATA_STATES = ["empty", "seeded"] as const;
type DataState = (typeof DATA_STATES)[number];

async function prepare(page: Page, state: DataState) {
  if (state === "seeded") {
    await page.clock.setFixedTime(FIXED_NOW);
    // Only seed when nothing is stored yet, so answers made during a test aren't overwritten on navigation.
    await page.addInitScript(
      ([key, json]) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, json);
      },
      [PROGRESS_KEY, JSON.stringify(seededProgress())],
    );
  }
}

async function settle(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("main")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    // The region right of the sidebar is main's parent column.
    const region = main.parentElement!.getBoundingClientRect();
    // Visible content block: union of everything rendered inside main (main column plus right rail).
    let left = Infinity;
    let right = -Infinity;
    for (const el of main.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    }
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, regionLeft: region.left, regionRight: region.right, left, right };
  });
}

async function check(page: Page, info: import("@playwright/test").TestInfo, label: string, width: number, balance: boolean) {
  const m = await measure(page);
  const leftGap = m.left - m.regionLeft;
  const rightGap = m.regionRight - m.right;
  const skew = leftGap - rightGap;
  info.annotations.push({ type: "balance", description: `left gap ${leftGap.toFixed(1)}px, right gap ${rightGap.toFixed(1)}px, skew ${skew.toFixed(1)}px` });
  console.log(`BALANCE ${label} @${width}: left=${leftGap.toFixed(1)} right=${rightGap.toFixed(1)} skew=${skew.toFixed(1)} scrollW=${m.scrollWidth}`);
  await page.screenshot({ path: info.outputPath(`${label.replace(/[^\w-]+/g, "_")}-${width}.png`), fullPage: true });
  expect(m.scrollWidth, "horizontal overflow").toBeLessThanOrEqual(m.innerWidth);
  if (balance) expect(Math.abs(skew), `content block is off-centre by ${skew.toFixed(1)}px`).toBeLessThanOrEqual(TOLERANCE_PX);
}

for (const state of DATA_STATES) {
  for (const width of DESKTOP_WIDTHS) {
    for (const route of PAGES) {
      test(`${state}: ${route} at ${width}px is balanced`, async ({ page }, info) => {
        await prepare(page, state);
        await page.setViewportSize({ width, height: 900 });
        await settle(page, route);
        await check(page, info, `${state}${route}`, width, true);
      });
    }
    test(`${state}: quiz in progress at ${width}px is balanced`, async ({ page }, info) => {
      await prepare(page, state);
      await page.setViewportSize({ width, height: 900 });
      await settle(page, "/practice/");
      await page.getByRole("button", { name: /^Start/ }).click();
      await expect(page.locator("main ol button.option").first()).toBeVisible();
      await check(page, info, `${state}-quiz`, width, true);
    });
  }

  // Phone and tablet: no sidebar, so only horizontal overflow is checked.
  for (const vp of SMALL_VIEWPORTS) {
    for (const route of PAGES) {
      test(`${state}: ${route} at ${vp.name} width ${vp.width} has no horizontal overflow`, async ({ page }, info) => {
        await prepare(page, state);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await settle(page, route);
        await check(page, info, `${state}${route}`, vp.width, false);
      });
    }
    test(`${state}: quiz in progress at ${vp.name} width ${vp.width} has no horizontal overflow`, async ({ page }, info) => {
      await prepare(page, state);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await settle(page, "/practice/");
      await page.getByRole("button", { name: /^Start/ }).click();
      await expect(page.locator("main ol button.option").first()).toBeVisible();
      await check(page, info, `${state}-quiz`, vp.width, false);
    });
  }
}
