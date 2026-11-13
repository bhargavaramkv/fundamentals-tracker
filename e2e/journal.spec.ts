import { deflateSync } from "node:zlib";
import type { Page } from "@playwright/test";
import { expect, test } from "./auth";
import { E2E_PASSWORD, E2E_USERNAME } from "./credentials";

const subjectField = (page: Page) => page.getByLabel(/^Subject/);
const timeline = (page: Page) => page.getByRole("region", { name: "Timeline" });

/** SYNTHETIC test image: an 8x8 solid-colour PNG built in memory. It is not a photo of anything. */
function syntheticPng(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const size = 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: size }, () => Buffer.from([40, 120, 220])))]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Starts a session, adds one note, ends it. Leaves the page on the journal home with the session in History. */
async function runSession(page: Page, subject: string, note: string, source?: string) {
  await page.goto("/journal/");
  await subjectField(page).fill(subject);
  if (source) await page.getByLabel(/^Source/).selectOption(source);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByLabel("Add to session").fill(note);
  await page.getByLabel("Add to session").press("Enter");
  await expect(timeline(page).getByText(note)).toBeVisible();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByRole("region", { name: "History" }).getByRole("link", { name: new RegExp(subject) })).toBeVisible();
}

test("journal: start, note, pause, resume, reload, end, history", async ({ page }) => {
  await page.goto("/journal/");
  await subjectField(page).fill("HLD");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  // The history rail is gone while a session runs.
  await expect(page.getByRole("region", { name: "History" })).toHaveCount(0);

  await page.getByLabel("Add to session").fill("Caches need invalidation");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(timeline(page).getByText("Caches need invalidation")).toBeVisible();
  // Typing right after adding must not be wiped when the save finishes.
  await page.getByLabel("Add to session").fill("TTL vs explicit purge");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Add to session").fill("Stampede on expiry");
  await expect(timeline(page).getByText("TTL vs explicit purge")).toBeVisible();
  await expect(page.getByLabel("Add to session")).toHaveValue("Stampede on expiry");

  // Enter adds; Shift+Enter makes a new line.
  await page.getByLabel("Add to session").press("Shift+Enter");
  await page.getByLabel("Add to session").pressSequentially("second line");
  await expect(page.getByLabel("Add to session")).toHaveValue("Stampede on expiry\nsecond line");
  await page.getByLabel("Add to session").press("Enter");
  await expect(timeline(page).getByText("second line")).toBeVisible();

  // A topic chip changes what the next entry is.
  await page.getByRole("button", { name: "Topic", exact: true }).click();
  await page.getByLabel("Add to session").fill("Cache invalidation");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(timeline(page).getByText("Topic", { exact: true })).toBeVisible();

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
  await expect(history.getByRole("link", { name: /HLD/ })).toBeVisible();
  await history.getByRole("link", { name: /HLD/ }).click();
  await expect(page.getByText("Write-through vs write-back")).toBeVisible();
});

test("journal: edit a note and the session details, keeping the original", async ({ page }) => {
  await runSession(page, "Networks", "TCP is conectionless");
  await page.getByRole("region", { name: "History" }).getByRole("link", { name: /Networks/ }).click();

  const item = timeline(page).getByRole("listitem").filter({ hasText: "TCP is conectionless" });
  await item.getByRole("button", { name: "Edit note" }).click();
  // The row no longer matches its old text while the editor is open, so find it by the editor.
  const editor = timeline(page).getByRole("listitem").filter({ has: page.getByLabel("Edit text") });
  await editor.getByLabel("Edit text").fill("TCP is connection-oriented");
  await editor.getByRole("button", { name: "Save" }).click();

  const edited = timeline(page).getByRole("listitem").filter({ hasText: "TCP is connection-oriented" });
  await expect(edited.getByText("edited", { exact: true })).toBeVisible();
  await edited.getByRole("button", { name: "Show original" }).click();
  await expect(edited.getByLabel("Original text")).toHaveText("TCP is conectionless");

  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByRole("form", { name: "Edit details" }).getByLabel("Subject").fill("Computer networks");
  await page.getByRole("form", { name: "Edit details" }).getByLabel("Objective").fill("Transport layer");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Computer networks");
  await expect(page.getByText("Objective: Transport layer")).toBeVisible();

  // The edits are events, so they survive a reload and show up in History under the new subject.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Computer networks");
  await expect(timeline(page).getByText("TCP is connection-oriented")).toBeVisible();
  await expect(page.getByRole("region", { name: "History" }).getByRole("link", { name: /Computer networks/ })).toBeVisible();
});

test("journal: history filters, search and discarded sessions", async ({ page }) => {
  await runSession(page, "Alpha", "zebra crossing");
  await runSession(page, "Beta", "giraffe necks", "book");
  const history = page.getByRole("region", { name: "History" });
  const links = history.getByRole("link");
  await expect(links).toHaveCount(2);
  await expect(history.getByRole("heading", { name: "Today" })).toBeVisible();

  await history.getByLabel("Filter by source").selectOption("book");
  await expect(links).toHaveCount(1);
  await expect(links.first()).toContainText("Beta");
  await history.getByLabel("Filter by source").selectOption("");

  await history.getByLabel("Filter by subject").selectOption("Alpha");
  await expect(links).toHaveCount(1);
  await expect(links.first()).toContainText("Alpha");
  await history.getByRole("button", { name: "Clear filters" }).click();

  await history.getByLabel("Search history").fill("giraffe");
  await expect(links).toHaveCount(1);
  await expect(links.first()).toContainText("Beta");
  await history.getByLabel("Search history").fill("no such words");
  await expect(history.getByText("Nothing matches.")).toBeVisible();
  await history.getByLabel("Search history").fill("");

  // Discard Alpha: it disappears from History until "Show discarded" is ticked.
  await links.filter({ hasText: "Alpha" }).click();
  await page.getByRole("button", { name: "Discard session" }).click();
  await page.getByRole("button", { name: "Confirm discard" }).click();
  await expect(links).toHaveCount(1);
  await history.getByLabel(/Show discarded/).check();
  await expect(links).toHaveCount(2);
});

test("journal: a photo is shown as a thumbnail, opens full size, and survives a reload", async ({ page }) => {
  await page.goto("/journal/");
  await subjectField(page).fill("Whiteboard");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();

  await page.getByLabel("Photo from gallery").setInputFiles({ name: "synthetic-test.png", mimeType: "image/png", buffer: syntheticPng() });
  const thumb = timeline(page).getByRole("button", { name: "Open Photo synthetic-test.png" });
  await expect(thumb).toBeVisible();
  await expect(page.getByText("Saved on this device. Upload to the private media repo is not enabled yet.")).toBeVisible();
  // The browser really decoded the stored blob.
  await expect(thumb.locator("img")).toHaveJSProperty("complete", true);
  expect(await thumb.locator("img").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(8);

  await page.reload();
  await expect(timeline(page).getByRole("button", { name: "Open Photo synthetic-test.png" })).toBeVisible();
  await expect(timeline(page).locator("img")).toHaveJSProperty("complete", true);

  await timeline(page).getByRole("button", { name: "Open Photo synthetic-test.png" }).click();
  await expect(page.getByRole("dialog", { name: "Photo viewer" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Photo viewer" })).toHaveCount(0);
});

test("journal: two devices (isolated browser contexts) keep separate local journals", async ({ browser, baseURL }) => {
  // Without a GitHub token nothing syncs, so this only proves the two contexts are independent devices. Cross-device
  // merging is covered by the unit tests against a fake remote (tests/journal-sync.test.ts), not here.
  const open = async () => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByLabel("Username").fill(E2E_USERNAME);
    await page.locator("input[autocomplete=current-password]").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("main")).toBeVisible();
    return { context, page };
  };
  const a = await open();
  const b = await open();
  await runSession(a.page, "Device A topic", "written on A");
  await b.page.goto("/journal/");
  await expect(b.page.getByRole("region", { name: "History" })).toContainText("No past sessions yet.");
  await expect(a.page.getByRole("region", { name: "History" }).getByRole("link", { name: /Device A topic/ })).toBeVisible();
  await a.context.close();
  await b.context.close();
});
