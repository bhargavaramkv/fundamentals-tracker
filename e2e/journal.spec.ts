import { expect, test } from "./auth";

test("journal: start, note, pause, resume, reload, end, history", async ({ page }) => {
  await page.goto("/journal/");
  await page.getByLabel("Subject").fill("HLD");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();

  await page.getByLabel("Add to session").fill("Caches need invalidation");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("region", { name: "Timeline" }).getByText("Caches need invalidation")).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("Paused", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("Running")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText("Caches need invalidation")).toBeVisible();

  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByLabel("What I learned").fill("Write-through vs write-back");
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByText("Review queued for tomorrow morning")).toBeVisible();

  const history = page.getByRole("region", { name: "History" });
  await expect(history.getByText("HLD")).toBeVisible();
  await history.getByRole("link", { name: /HLD/ }).click();
  await expect(page.getByText("Write-through vs write-back")).toBeVisible();
});
