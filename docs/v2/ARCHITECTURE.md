# Fundamentals V2 architecture

Status: Phase 0 and Phase 1, on the `rewrite/v2` branch. The V1 app is tagged `v1-legacy`.
Product decisions: owner-approved on 2026-11-12, based on the V2 audit (kept outside the repo).

## Product shape

- **Journal** is the main workflow. A session records what you studied, from any source, on your own terms.
- **Lessons** are no longer the centre. They stay as optional resources, reached from Knowledge.
- **Tabs:** Today (overview) · Journal · Knowledge · Coding. The UI is dark-first, with navy and blue accents.
- **Mentor** will be a Claude Code session attached to the data repo, not an in-app chat. There is no API billing.
- **Reviews** use an asynchronous queue. The default is a review the next morning, from the daily routine. "Review now" will open a Claude Code session; it is not built yet.

## Principles

1. **Facts are append-only events.** Interpretations (reviews, evidence, levels) live in separate files and are written only through validators.
2. **One writer per path:**
   - The browser writes `journal/**` and `progress.json`.
   - Claude writes only through `scripts/*` validators.
3. **Local-first.** Every change lands in IndexedDB before any network call.
4. **Never silently discard data.** Unknown event kinds are preserved. A remote file with unreadable events is never overwritten.

## Journal data (`lib/journal/types.ts`, `lib/journal/events.ts`)

- **Session file:** one per session, at `journal/sessions/YYYY/MM/<id>.json` (year and month in UTC from `createdAt`). It holds an immutable header and an `events` array.
  - The header is `id`, `createdAt`, `device`, `subject`, `source`, `objective`.
- **Event kinds:** `start`, `pause`, `resume`, `topic`, `note`, `difficulty`, `bookmark`, `end`, `edit`, `discard`.
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
  - **Topics:** distinct, case-insensitive, after edits.
  - **Reflections:** every non-empty `end` answer (learned, difficult, unclear) is kept. If two devices both ended the session, both reflections are shown.
- **Review request:** `journal/requests/<sessionId>/<requestId>.json` holds `{ v, id, sessionId, requestedAt, device, inputHash }`.
  - `inputHash` is the sha256 of the session's canonical JSON (`sessionHash`). It ignores key order and event storage order.
  - The request is created when a session ends, and it is create-only (immutable).
  - The future review engine treats a request as pending until a review with that `requestId` exists. It must refuse to review if the session no longer hashes to `inputHash`, because events arrived later; that needs a new request.

## Local persistence (`lib/idb.ts`, `lib/journal/local.ts`)

IndexedDB database `ft-journal`, with these stores:

| Store | Key | Value |
|---|---|---|
| `sessions` | session id | `{ session: JournalSession, remoteSha: string \| null, path: string }` |
| `requests` | request id | `{ request: ReviewRequest, uploaded: boolean }` |
| `outbox` | `session:<id>` or `request:<id>` | `{ key, kind, refId, queuedAt, attempts, nextAttemptAt, lastError?, conflict? }` |
| `meta` | string | device id, last pull time |

- `localStorage` keeps only small flags. Session data never goes there.
- **No IndexedDB:** if it is unavailable (some private modes), the journal runs on an in-memory store and the UI says that data will be lost on refresh. Sync still pushes immediately.

## Per-file sync (`lib/journal/remote.ts`, `lib/journal/sync.ts`)

**Remote:** the private data repo `bhargavaramkv/fundamentals-tracker-data`, branch `main`, through the GitHub REST API with the existing sync token (Contents read/write).

- **Listing:**
  - `GET /git/ref/heads/main` gives the commit, which gives the tree.
  - `GET /git/trees/<tree>?recursive=1` gives every `journal/sessions/**` and `journal/requests/**` path with its blob sha.
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

**Rate use:** about 2 requests per pull plus 2 per changed session. GitHub allows 5,000 requests/hour per token and limits content-creating requests to roughly 80/min. Debouncing keeps writes to about one commit per session per burst.

`progress.json` sync (`lib/storage.ts`) is unchanged.

## Security (Phase 0)

**Findings carried over from the audit:**

1. The raw password-derived AES key was stored in `localStorage` for 30 days.
2. There was no Content Security Policy.
3. The sync token is sealed in the **public** app repo (`vault/sync-token.json`), and the token needs Contents write on that public repo.
4. The login vault (salt and check) is public, so offline guessing depends only on password strength.

**Implemented here (application-side, no credential change):**

- **Per-device enrollment** (`lib/auth.ts`):
  - On a password sign-in, the password-derived key decrypts the shared sealed token, as before.
  - The device then creates its **own non-extractable AES-GCM key** in IndexedDB (`ft-secure`), re-seals the sync token under it, and stores a session record `{ vaultCheck, expiresAt }`.
  - The password-derived key is never persisted. It is held only in memory for that tab, because publishing a new token needs it.
  - **Restore:** load the device key and require `vaultCheck` to equal the current vault's `check`, so a password reset signs every device out, as before. The record must also not be expired (30 days). Then unseal the token.
  - **Other devices:** each device enrolls separately by signing in with the password. A device key never leaves its browser.
  - **Legacy upgrade:** an existing `ft.session.v1` raw key is used once to enroll the device, then it and `ft.syncToken.v1` are deleted. You are not signed out.
  - **Without IndexedDB:** nothing is persisted; you sign in each visit.
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

**Not changed. These need your approval (they affect credentials or access):**

- Stop the browser writing the sealed token to the public app repo, and narrow the PAT to the data (and later media) repo only.
- Rotate the PAT once the above is done. A **release blocker before photo uploads.**

**Remaining risks:**

- Code running in the page (XSS) can still use the token while the app is open. Non-extractable keys only stop it being copied off the device.
- The sealed token in the public repo is only as strong as the password.

## Media repository (design only, Phase 3)

- **Repo:** `bhargavaramkv/fundamentals-tracker-media` (private), with paths `attachments/YYYY/MM/<sessionId>/<attachmentId>.webp`. Metadata stays in the session file as an `attachment` event, which is a future kind preserved by older clients.
- **Client:** capture → canvas re-encode (WebP, falling back to JPEG; long edge 2000 px; this strips EXIF and GPS) → IndexedDB blob → outbox upload (`PUT /contents`, create-only, path contains a content hash).
- **Daily routine:** it attaches the media repo only when a pending request has attachments.
- **Gates before building:**
  1. The handwriting spike (`docs/v2/handwriting-spike.md`).
  2. The token narrowing and rotation above.
  3. Your approval to create the repo and widen the PAT to it.

## Evidence migration plan (design only, Phase 5)

- **Ledger:** `knowledge/evidence/YYYY-MM.jsonl`, append-only. Each record carries `source` (kind and id), `writtenBy` (`migration` | `rule` | `claude`), `confidence` and `migratedFrom`.
- **Historical multiple-choice answers:**
  - Imported as `level: "exposed"`, or `"understood"` only with `strength: "weak"`.
  - They are never `independent`, never `retained`, and keep their original `answeredAt`, question id and `timeMs`.
  - Answers under 3 s are imported as `exposed` only (likely guesses).
  - Answers before `CONTENT_EPOCH` are not imported.
- **Legacy `mentor/evidence/*.jsonl`:** imported with `writtenBy: "claude"` and `migratedFrom: "mentor-v1"`, keeping its own strength.
- **LeetCode:** an accepted submission becomes `applied` evidence for concepts mapped from its tags. "Accepted on first try, 7 or more days after earlier evidence" can count toward `retained`.
- **Idempotent:** every migrated record id is derived from its source (`mig:<kind>:<sourceId>`). Re-running skips existing ids. A dry run prints counts before writing.
- **Levels** are cumulative (Exposed → Understood → Applied → Retained). They are derived by fixed rules, never assigned by AI. A `contradicts` record newer than the supporting evidence marks the concept "needs reassessment"; nothing is deleted.

## Legacy Mentor data

The V1 nightly mentor (removed in #35) left `mentor/{states,runs,reports,evidence,questions.json,processed.json,status.json,current.json}` in the data repo.

- Copies are kept under `archive/mentor-v1/` with a README. The originals are untouched.
- `mentor/coding.json` is live and still used by Coding.

## What is not built yet

- The review engine (Phase 4), knowledge model (5), weekly review (6), Mentor transcripts (7) and photos (3).
