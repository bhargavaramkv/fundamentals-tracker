import { expect, test as setup } from "@playwright/test";
import { E2E_PASSWORD, E2E_USERNAME } from "./credentials";

setup("sign in", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill(E2E_USERNAME);
  await page.locator("input[autocomplete=current-password]").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("main")).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/state.json" });
});
