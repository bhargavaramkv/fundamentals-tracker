import { expect, type Page } from "@playwright/test";

/** Passes the app's length check (20+ characters). It is never sent anywhere: mockGitHub answers every request. */
export const FIXTURE_TOKEN = "github_pat_FIXTURE_synthetic_0000000000";

/**
 * Turns on sync through the real Settings screen ("Test & enable sync"), so the app runs in synced mode. Call after
 * signing in and after mockGitHub(). Leaves the page on /settings/ with the sync notice showing; the device keeps the
 * token, so later page.goto() calls stay synced.
 */
export async function enableSync(page: Page, token: string = FIXTURE_TOKEN): Promise<void> {
  await page.goto("/settings/");
  await page.getByLabel("Token", { exact: true }).fill(token);
  await page.getByRole("button", { name: "Test & enable sync" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Sync enabled|Sync works/ })).toBeVisible({ timeout: 30_000 });
}
