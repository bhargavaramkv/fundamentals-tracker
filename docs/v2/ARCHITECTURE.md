# Fundamentals V2 architecture

Status: V2 is complete on the `v2/complete` branch, pending merge to `main`. The V1 app is tagged `v1-legacy`.
Product decisions: owner-approved on 2026-11-12, based on the V2 audit (kept outside the repo).
Related: [data-contracts.md](data-contracts.md) (JSON shapes), [recovery.md](recovery.md), [handwriting-spike.md](handwriting-spike.md).

## Product shape

- **Journal** is the main workflow. A session records what you studied, from any source, on your own terms.
- **Lessons** are no longer the centre. They stay as optional resources, reached from Knowledge.
- **Tabs:** Today · Journal · Knowledge · Coding, plus Settings. Today is journal-first. The UI is dark-first, with navy and blue accents.
- **Mentor page** (`/mentor/`) is a read-only view of reviews, pending requests, weekly reports and the V1 archive. Today and Knowledge link to it; it is not in the tab bar. There is no in-app chat and no API billing. The app only builds prompts ("Review now", "Discuss") for you to copy into Claude Code.
- **Reviews** use an asynchronous queue. A Claude Code routine writes them (`docs/review-routine.md`), by default the next morning.

## Principles

1. **Facts are append-only events.** Interpretations (reviews, evidence, levels) live in separate files and are written only through validators.
2. **One writer per path** (table below). Routines write only through `scripts/*` validators.
3. **Local-first.** Every change lands in IndexedDB before any network call.
4. **Never silently discard data.** Unknown event kinds are preserved. A remote file with unreadable events is never overwritten without a backup.

## Data repo layout and ownership

The private repo `bhargavaramkv/fundamentals-tracker-data`, branch `main`.

| Path | Written by | How |
|---|---|---|
| `journal/sessions/YYYY/MM/<id>.json` | browser | per-file sync |
| `journal/requests/<sessionId>/<requestId>.json` | browser | create-only |
| `journal/conflicts/<sessionId>/<sha>.json` | browser | create-only backup made by "Keep both and repair" |
| `progress.json` | browser | `lib/storage.ts` (unchanged from V1) |
| `journal/reviews/<sessionId>/<requestId>.json` | review routine | `npm run journal-review -- commit` |
| `journal/review-failures/<requestId>.json` | review routine | `npm run journal-review -- fail` |
| `journal/weekly/<YYYY>-W<ww>.json` | weekly routine | `npm run weekly -- commit` |
| `knowledge/evidence.json` | migration script | `npm run knowledge-migrate -- commit` |
| `mentor/coding.json` | daily routine | `npm run coding-review -- commit` |
| `learner/profile.json` | daily routine | `npm run learner` |
| `leetcode/**` | data repo workflow | `leetcode-pull.yml` |
| `archive/mentor-v1/**` | static copy of the V1 mentor | no longer written |

Rules:

- Routines never write `journal/sessions/**`, `journal/requests/**` or `journal/conflicts/**`. The browser never writes reviews, weekly reports or knowledge.
- Scripts publish through `lib/data-publish.ts`. It refuses if the app repo has changes, or if the data repo has changes outside the files the script wrote. Then it commits, rebases and pushes (up to 4 attempts).
- Review evidence is not stored separately. It is derived from the review files when read (`reviewEvidence` in `lib/knowledge/levels.ts`).

## Journal data (`lib/journal/types.ts`, `lib/journal/events.ts`)

- **Session file:** one per session, at `journal/sessions/YYYY/MM/<id>.json` (year and month in UTC from `createdAt`). It holds a header and an `events` array.
  - The header is `id`, `createdAt`, `device`, `subject`, `source`, `objective`. The stored header is never rewritten; a `meta` event changes it (below).
- **Event kinds:** `start`, `pause`, `resume`, `topic`, `note`, `difficulty`, `bookmark`, `end`, `edit`, `discard`, `meta`, `attach`.
- **Event ids:** `newId()` gives 9 base-36 time characters followed by 12 random characters. Ids are unique and sort by time.
- **Order:** events are ordered by `(at, id)`.
- **Merge (`mergeSessions`):** the union of events by id.
  - It is commutative, associative and idempotent, and tested for all three.
  - Two copies of the same session always converge, in any order.
- **Derivation (`deriveSession`).** Nothing below is stored:
  - **Timer:** control events are replayed in order.
    - `start`/`resume` opens an interval.
    - `pause`/`end` closes all open intervals.
    - Active time is the **union** of the intervals, so two devices running at once count once.
    - The latest `end` ends the session. An earlier `end` (another device) acts as a pause.
  - **Status:** `discarded` if any `discard` exists; otherwise `ended`, `paused` or `active`.
  - **Edits:** an `edit` replaces a topic, note, difficulty or bookmark text. The latest edit wins. The original text stays in the log, and empty text hides the item.
  - **Meta:** a `meta` event sets `subject`, `objective` and/or `source`. Per field, the latest event wins. An empty subject is ignored; an empty objective clears it.
  - **Attachments:** an `attach` event records a photo's metadata (id, mime, size, sha256). The image is not in the session file.
  - **Topics:** distinct, case-insensitive, after edits.
  - **Reflections:** every non-empty `end` answer (learned, difficult, unclear) is kept. If two devices both ended the session, both reflections are shown.
- **Review request:** `journal/requests/<sessionId>/<requestId>.json` holds `{ v, id, sessionId, requestedAt, device, inputHash }`.
  - `inputHash` is the sha256 of the session's canonical JSON (`sessionHash`). It ignores key order and event storage order.
  - The request is created when a session ends, and it is create-only (immutable).
  - A request is pending until a review with that `requestId` exists (see Review engine).
  - If the session no longer hashes to `inputHash` at review time, the review is still written but carries `sessionChangedSinceRequest: true`. Later events need a new request, which is created when the session is ended again.

## Local persistence (`lib/idb.ts`, `lib/journal/local.ts`)

IndexedDB database `ft-journal` (version 2), with these stores:

| Store | Key | Value |
|---|---|---|
| `sessions` | session id | `{ session: JournalSession, remoteSha: string \| null, path: string }` |
| `requests` | request id | `{ request: ReviewRequest, uploaded: boolean }` |
| `outbox` | `session:<id>` or `request:<id>` | `{ key, kind, refId, queuedAt, attempts, nextAttemptAt, lastError?, conflict? }` |
| `meta` | string | device id, last pull time |
| `attachments` | attachment id | `{ id, sessionId, blob, mime, width, height, bytes, sha256, name?, createdAt }` |

- Version 2 added `attachments`. The upgrade only creates the missing store, so sessions and the outbox are kept.
- `localStorage` keeps only small flags. Session data never goes there.
- **No IndexedDB:** if it is unavailable (some private modes), the journal runs on an in-memory store and the UI says that data will be lost on refresh. Sync still pushes immediately.

## Per-file sync (`lib/journal/remote.ts`, `lib/journal/sync.ts`)

**Remote:** the data repo, through the GitHub REST API with the existing sync token (Contents read/write).

- **Listing:**
  - `GET /git/ref/heads/main` gives the commit, which gives the tree.
  - `GET /git/trees/<tree>?recursive=1` gives every path under `journal/` with its blob sha.
  - That is two requests per pull, whatever the number of sessions.
- **Read:** `GET /contents/<path>` with the raw media type, plus the sha from the listing.
- **Write:** `PUT /contents/<path>` with `sha` when the file exists. That is one commit per file write.

**Push (outbox, oldest first):**

1. **Session:**
   - Fetch the remote file. A 404 means new.
   - If the remote file fails `parseSession`, or has rejected events, mark the entry `conflict` and **stop**: never overwrite it. The UI shows "needs attention"; the local copy is intact.
   - Otherwise merge local and remote. If the merged copy covers the remote and equals the remote, skip the write; otherwise PUT with the remote sha.
   - On 409/422 (another device wrote in between), refetch, re-merge and retry, up to 3 times per attempt.
   - On success, store the merged copy and the new `remoteSha` locally, merging again with any events added during the push. Then remove the outbox entry.
2. **Request:** PUT without a sha (create-only).
   - A 422 means it already exists: fetch it, and if identical, mark it uploaded. If different, mark a `conflict` and never overwrite.
3. **Failure** (network, 5xx, 401/403):
   - `attempts++`, and `nextAttemptAt = now + min(5 s × 2^attempts, 10 min)`; record `lastError`.
   - A 401/403 also raises a sync-level error ("token rejected").

**Pull:**

- List the remote paths. For each session path whose blob sha differs from the local `remoteSha`, fetch it, parse it, and merge it into the local copy.
- If the merged copy has events the remote lacks, enqueue a push.
- Unknown remote sessions are added locally, which is how cross-device recovery works.
- Unparseable remote files are skipped and reported. They are never deleted.

**Triggers:**

- Any local change: debounced 1.5 s.
- App start and window `online`.
- Tab becomes visible: pull. Tab hidden: flush the push.
- Every 60 s while a session is active.
- Only one sync runs at a time.

**Per-record status:**

| Status | Meaning |
|---|---|
| `local` | No token |
| `pending` | Outbox entry, not attempted |
| `syncing` | In flight |
| `synced` | No outbox entry and `remoteSha` set |
| `retrying` | Has `lastError`; next attempt scheduled |
| `conflict` | Needs attention |

**Conflicts:**

- A conflict entry is never retried automatically and the local copy stays intact.
- The session detail screen can inspect both copies (read-only), **retry** (clear the flag, re-read and re-merge), or **Keep both and repair**. Repair runs in a fixed order:
  1. Copy the current GitHub file byte for byte to `journal/conflicts/<sessionId>/<remoteSha>.json` (create-only). If this fails, nothing else is written.
  2. Overwrite the original with local events plus every parseable remote event, guarded by the sha just read. If this fails, the backup stays and the conflict stays flagged.
- The backup is written by the browser, so `journal/conflicts/**` is browser-owned.

**Rate use:** about 2 requests per pull plus 2 per changed session. GitHub allows 5,000 requests/hour per token and limits content-creating requests to roughly 80/min. Debouncing keeps writes to about one commit per session per burst.

`progress.json` sync (`lib/storage.ts`) is unchanged from V1.

## Photos

- **What exists:** a photo is captured or picked, re-encoded through a canvas (WebP with a JPEG fallback, long edge 2000 px, quality stepped from 0.8 down to 0.6 toward 350 KB; this strips EXIF and GPS), and stored as a blob in the IndexedDB `attachments` store. An `attach` event in the session records its metadata.
- **Local only.** `MEDIA_UPLOAD_ENABLED` is `false` in `lib/journal/attachments.ts`, and the UI says "Saved on this device". The blob is the only copy, is never deleted automatically, and does not reach other devices.
- **Upload stays off until all of these exist:**
  1. The private media repo `bhargavaramkv/fundamentals-tracker-media` (it does not exist yet).
  2. A least-privilege fine-grained token for it (the sync token narrowed and rotated; see Security).
  3. Secure device authentication for the upload path.
  4. A tested upload (create-only, content-hash path such as `attachments/YYYY/MM/<sessionId>/<attachmentId>.webp`).
  5. The 5-photo handwriting evaluation in [handwriting-spike.md](handwriting-spike.md). It has not been run.

## Review engine (`lib/review/*`, `scripts/journal-review.ts`)

- Routine steps: `docs/review-routine.md`. Commands: `pending`, `context <requestId>`, `commit <requestId> <file>`, `fail <requestId> <message>`.
- **Pending:** a request with no review file, oldest first. Requests for discarded or missing sessions are listed as `skipped`.
- **Validator** (`validateReview`): the schema; every evidence ref is a real event id of that session; every quote is an exact substring of that event's text after edits; `id`, `sessionId` and `inputHash` match the request; `understood` is empty when `insufficientEvidence` is true. Nothing is repaired or guessed. A rejected commit exits with code 2 and writes nothing.
- **Idempotent:** if a valid review for the request already exists, commit does nothing.
- **`verifies`:** an `understood` finding may name an earlier review and one of its verification questions. The commit is rejected unless that review exists, predates this request and asked exactly that question. It is the only source of delayed-check evidence.
- **Failures:** when validation errors persist, the routine appends `{at, error}` to `journal/review-failures/<requestId>.json`. The request stays pending and is retried on the next run.

## Weekly report (`lib/review/weekly.ts`, `scripts/weekly.ts`)

- One file per ISO week (Asia/Kolkata): `journal/weekly/<YYYY>-W<ww>.json`. Steps: `docs/weekly-routine.md`.
- **Sufficiency** is computed by the script, not by Claude. It is `coaching` only if each of the last 3 complete weeks has at least 3 ended sessions; otherwise `activity-only`.
- The validator checks that `week`, `sufficiency` and `activity` equal the computed values, and that every citation exists. In `activity-only` mode `improved`, `weak` and `repeatedMisunderstandings` must be empty, and `revisit` and `learnNext` must cite reviewed sessions.
- A different report for an existing week is refused unless `--replace` is passed.

## Knowledge levels (`lib/knowledge/*`, `scripts/knowledge-migrate.ts`)

- **Ledger:** `knowledge/evidence.json`, one file, append-only. Each item has a stable `id`, a normalised `concept`, `kind`, `signal`, `strength`, `at`, `source` and `historical`.
- **Levels are computed at read time** by `levelOf` and never stored: none, then Exposed → Understood → Applied → Retained (cumulative).
  - Exposed: any evidence.
  - Understood: a correct written explanation or review finding of moderate or strong strength. Multiple-choice answers alone never reach Understood.
  - Applied: Understood plus `practical` or `applied` evidence.
  - Retained: a correct `delayed-check` at least 7 days after the first Understood evidence.
- **Contradictions:** a moderate or strong `misconception` or `incorrect` item newer than the first Understood evidence sets `needsReassessment`. Nothing is deleted, and the level is not lowered by it.
- **Due for verification:** needs reassessment, or not yet Retained 7 days after Understood.
- **Migration** (`npm run knowledge-migrate`): imports MCQ answers from `progress.json` and V1 mentor evidence (`mentor/evidence`, `archive/mentor-v1/evidence`) as weak, historical items with ids `mig:mcq:<answerId>` and `mig:mentor:<entryId>`. Answers under 3 s or marked unsure become `exposed`. Answers before `CONTENT_EPOCH` are skipped. The default is a dry run; `commit` merges by id, so a re-run with unchanged sources writes nothing.
- **Review evidence** is derived at read time from review files (`rev:<requestId>:<n>`). Journal topics add weak exposure.

## Mentor UI (`lib/mentor/*`, `components/mentor/*`)

- **Read-only.** `GitHubMentorSource` makes GET requests only: the ref, the commit, the recursive tree and blobs by sha. Nothing in it writes to GitHub.
- **Cache:** IndexedDB database `ft-mentor`, keyed by blob sha. Only changed files are fetched. Offline, the last cached tree is used and the page says so.
- **Parsing:** every file is shape-checked (`lib/mentor/parse.ts`). Bad files are skipped and counted.
- **Markdown** (archived V1 reports): `lib/mentor/markdown.ts` builds a token tree (headings, lists, code, paragraphs, bold, inline code) and React renders the tokens. The mentor code has no `dangerouslySetInnerHTML`, so nothing is injected as markup.
- **Prompts** (`lib/mentor/prompts.ts`): "Review now" and "Discuss" only build text to copy.
- **Where it shows:** session detail (its review), the Today mentor slot, Knowledge (concepts, levels, evidence, why), and `/mentor/` (reviews, pending requests with failures, weekly reports, archive).

## Security

**Findings carried over from the audit:**

1. The raw password-derived AES key was stored in `localStorage` for 30 days.
2. There was no Content Security Policy.
3. The sync token is sealed in the **public** app repo (`vault/sync-token.json`), and the token needs Contents write on that public repo.
4. The login vault (salt and check) is public, so offline guessing depends only on password strength.

**Implemented (application-side, no credential change):**

- **Per-device enrollment** (`lib/auth.ts`, `lib/device-session.ts`):
  - On a password sign-in, the password-derived key decrypts the shared sealed token, as before.
  - The device then creates its **own non-extractable AES-GCM key** in IndexedDB (`ft-secure`), re-seals the sync token under it, and stores a session record `{ vaultCheck, expiresAt }`.
  - The password-derived key is never persisted. It is held only in memory for that tab, because publishing a new token needs it.
  - **Restore:** load the device key and require `vaultCheck` to equal the current vault's `check`, so a password reset signs every device out. The record must also not be expired (30 days). Then unseal the token.
  - **Other devices:** each device enrolls separately by signing in with the password. A device key never leaves its browser.
  - **Legacy upgrade:** an existing `ft.session.v1` raw key is used once to enroll the device, then it and `ft.syncToken.v1` are deleted. You are not signed out.
  - **Without IndexedDB:** nothing is persisted; you sign in each visit.
  - **Lost key:** if the browser clears site data, the device record is gone and you sign in again (see [recovery.md](recovery.md)).
  - **Changing the token after a restore:** saving it for all devices needs the password again (Settings asks).
- **CSP** (`<meta http-equiv="Content-Security-Policy">`, production builds only):
  - `default-src 'self'`
  - `connect-src 'self' https://api.github.com https://raw.githubusercontent.com`
  - `img-src 'self' data: blob:`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
  - Next's static export needs inline scripts and styles, so `script-src` and `style-src` include `'unsafe-inline'`. The main protection is `connect-src`: injected code can't send the token or data to another origin with fetch or XHR.
  - GitHub Pages can't set headers, so `frame-ancestors` is not available.
- **Defensive reads:** the browser shape-checks every file it reads from the data repo. Photos are re-encoded in the browser, which removes EXIF and GPS.

**Not changed. These need the owner's approval (they affect credentials or access):**

- Stop the browser writing the sealed token to the public app repo, and narrow the PAT to the data (and later media) repo only.
- Rotate the PAT once the above is done. A **blocker before photo uploads.**

**Remaining risks:**

- Code running in the page (XSS) can still use the token while the app is open. Non-extractable keys only stop it being copied off the device.
- The sealed token in the public repo is only as strong as the password.

## Legacy Mentor data

The V1 nightly mentor (removed in #35) left `mentor/{states,runs,reports,evidence,questions.json,processed.json,status.json,current.json}` in the data repo.

- Copies are kept under `archive/mentor-v1/` with a README. The originals are untouched. The Mentor page shows the archived reports.
- `mentor/coding.json` is live and still used by Coding.

## Routines (claude.ai, owner's subscription; no API billing)

- **Fundamentals session reviews** (Sonnet): daily at 06:15 IST, follows `docs/review-routine.md`.
- **Fundamentals tracker · daily run** (Opus): daily at 06:47 IST. Coding review (`docs/coding-routine.md`), plus weekly coaching on Mondays (`docs/weekly-routine.md`). Lesson tailoring, learner-profile updates and lesson PRs are retired.

## Not built

- Photo upload and the media repo (gated; see Photos).
- An in-app mentor chat. Discussion happens in Claude Code.
