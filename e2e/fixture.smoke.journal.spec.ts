import { expect, test } from "./auth";
import { buildDataRepo } from "./fixtures/data-repo";
import { enableSync } from "./fixtures/enable-sync";
import { mockGitHub } from "./fixtures/github-mock";

// Smoke test for the synthetic data-repo fixture: with sync "enabled" against a mocked GitHub, every page shows data.
test("synthetic data repo populates Today, Journal, Knowledge, Coding, Mentor and Settings", async ({ page }) => {
  const repo = await buildDataRepo();
  const mock = await mockGitHub(page, repo);
  await enableSync(page);
  expect(mock.writes.some((w) => w.endsWith(":progress.json"))).toBe(true);

  const wait = { timeout: 30_000 };

  await page.goto("/");
  await expect(page.getByRole("region", { name: "Mentor" })).toBeVisible(wait);
  await expect(page.getByText("Latest review")).toBeVisible(wait);
  await expect(page.getByText(/Weekly report/)).toBeVisible(wait);
  await expect(page.getByText(/reviews? queued/)).toBeVisible(wait);

  await page.goto("/journal/");
  const history = page.getByRole("region", { name: "History" });
  await expect(history.getByRole("link", { name: /LLD/ }).first()).toBeVisible(wait);
  for (const subject of ["HLD", "DSA", "OS", "Databases"]) await expect(history.getByRole("link", { name: new RegExp(subject) }).first()).toBeVisible(wait);

  await page.goto("/knowledge/");
  await expect(page.getByText("Consistent hashing").first()).toBeVisible(wait);
  for (const level of ["retained", "applied", "understood", "exposed"]) await expect(page.getByText(level, { exact: true }).first()).toBeVisible(wait);
  await expect(page.getByText("Reassess", { exact: true }).first()).toBeVisible(wait);

  await page.goto("/coding/");
  await expect(page.getByText("problems solved")).toBeVisible(wait);
  await expect(page.getByText(/Claude.s read/)).toBeVisible(wait);

  await page.goto("/mentor/");
  await expect(page.getByRole("heading", { name: repo.summary.weekly.week })).toBeVisible(wait);
  await expect(page.getByText("Coaching", { exact: true })).toBeVisible(wait);

  await page.goto("/settings/");
  await expect(page.getByRole("main").getByText("Synced", { exact: true })).toBeVisible(wait);
});
