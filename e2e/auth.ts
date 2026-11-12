import { expect, test as base } from "@playwright/test";
import { E2E_PASSWORD, E2E_USERNAME } from "./credentials";

export { expect };

/**
 * Every test signs in on its own page. The session lives in IndexedDB under a non-extractable device key, which
 * Playwright's storageState can't carry between contexts.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.goto("/");
    await page.getByLabel("Username").fill(E2E_USERNAME);
    await page.locator("input[autocomplete=current-password]").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("main")).toBeVisible();
    await provide(page);
  },
});
