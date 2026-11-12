import { expect, test } from "@playwright/test";

const PAGES = ["/", "/learn/", "/practice/", "/learn/dsa/big-o-basics/", "/coding/", "/settings/"];
const WIDTHS = [1280, 1600, 1920];
// Measured on the good layout the gaps differ by under 1px (subpixel rounding); 2px allows for that
// while any real lopsidedness (e.g. a missing mx-auto, hundreds of px) fails by a wide margin.
const TOLERANCE_PX = 2;

for (const width of WIDTHS) {
  for (const route of PAGES) {
    test(`${route} at ${width}px is balanced`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("networkidle");

      const m = await page.evaluate(() => {
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
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          regionLeft: region.left,
          regionRight: region.right,
          left,
          right,
        };
      });

      const leftGap = m.left - m.regionLeft;
      const rightGap = m.regionRight - m.right;
      const skew = leftGap - rightGap;
      info.annotations.push({ type: "balance", description: `left gap ${leftGap.toFixed(1)}px, right gap ${rightGap.toFixed(1)}px, skew ${skew.toFixed(1)}px` });
      console.log(`BALANCE ${route} @${width}: left=${leftGap.toFixed(1)} right=${rightGap.toFixed(1)} skew=${skew.toFixed(1)}`);

      await page.screenshot({ path: info.outputPath(`${route.replace(/\//g, "_") || "_"}-${width}.png`), fullPage: true });

      expect(m.scrollWidth, "horizontal overflow").toBeLessThanOrEqual(m.innerWidth);
      expect(Math.abs(skew), `content block is off-centre by ${skew.toFixed(1)}px`).toBeLessThanOrEqual(TOLERANCE_PX);
    });
  }
}
