# Fundamentals V2: implementation progress

Source of truth for the V2 completion brief (received 2026-11-12, about 23:05 IST). Read this file and `execution-log.md` completely before resuming.

- **Current phase:** release done (main e4d9a34 deployed); routine verification run and final report remaining
- **Current branch:** `docs/routines` (docs follow-up); main e4d9a34
- **Latest verified commit:** 4d9fdab on v2/complete (engine merged into P2; `npm run check` 271/271 green). main ddf0be1 is deployed.
- **Last test results:** see the Baseline section
- **Manual recovery command:** `Continue Fundamentals V2 from progress.md. Read execution-log.md, verify the latest checkpoint and continue with the next unfinished task.`

Markers: `[ ]` not started, `[~]` in progress, `[x]` implemented **and verified**, `[!]` blocked (reason given).

## Architecture decisions (Opus)
1. **Reviews**
   - Path: `journal/reviews/<sessionId>/<requestId>.json` in the data repo.
   - Writes go only through `npm run journal-review -- commit` and are validated:
     - Every evidence ref must be a real event id in that session.
     - Quotes must be exact substrings of that event's text.
     - The schema is checked.
   - Idempotent: if a review for that `requestId` already exists, the commit does nothing.
   - A request is complete once its review file exists. Requests stay immutable, so there is no mutable request state.
   - Failures are appended to `journal/review-failures/<requestId>.json`. The request stays pending and is retried on the next run.
2. **Weekly coaching**
   - Path: `journal/weekly/<YYYY>-W<ww>.json`, written via `npm run weekly -- commit`.
   - The script decides sufficiency deterministically: at least 3 weeks, each with at least 3 sessions.
   - When evidence is insufficient, the validator rejects pattern or trend claims and allows an activity summary only.
3. **Knowledge**
   - Evidence: an append-only `knowledge/evidence.json`. Migrated items have ids `mig:<kind>:<sourceId>`.
   - Review evidence lives inside the review files.
   - Levels are computed when read, by the pure function `lib/knowledge/levels.ts`. The source records are never modified.
4. **Routine ownership**
   - The browser writes only `journal/sessions/**` and `journal/requests/**`.
   - Routines write `journal/reviews/**`, `journal/review-failures/**`, `journal/weekly/**`, `knowledge/**`, `mentor/coding.json` and `learner/profile.json`, and only through scripts.
5. **Model split**
   - Session reviews: Sonnet routine (the disabled Sonnet trigger, repurposed).
   - Coding review and weekly coaching: the existing Opus daily routine.
   - Lesson-generation steps are removed from the routine.
6. **Edits**
   - Note edits use the existing `edit` event, and the original stays in the log.
   - Session metadata uses a new `meta` event, latest wins.
   - Older clients keep unknown events as unknown.
7. **Conflicts**
   - Before any overwrite, the GitHub copy is saved to `journal/conflicts/<sessionId>/<sha>.json`.
   - Both versions can be inspected, and the only surviving copy is never overwritten.
8. **Photos**
   - Stored in IndexedDB as an `attach` event plus a blob store, as WebP at 2000px long edge, with a JPEG fallback.
   - EXIF is stripped by re-encoding through a canvas.
   - Upload stays off until the media repo, a least-privilege token and the 5-photo evaluation exist.

## Checklist

### P0: Setup and audit
- [x] Execution files created
- [x] Baseline on main (ddf0be1): `npm run check` passes (219/219 unit tests, lint, typecheck, build). `npx playwright test` with the throwaway vault: 73/73 pass.
- [x] Audit: one active Opus daily routine (06:47 IST: coding review plus lesson tailoring); a disabled Sonnet trigger trig_018R59EQ9LLo3Ujh7sH5R42Y (app and data repos attached) to repurpose; the media repo doesn't exist; the logo is the `BrandMark.tsx` text wordmark plus `app/favicon.ico`.

### P1: Engine (Sonnet, worktree `ft-engine`, branch v2/engine; Opus reviewed)
- [x] `progress.json` sync race fix plus regression test (8e71bf7; 4 tests, 2 of them failed before the fix)
- [x] Review engine: `npm run journal-review` (pending, context, commit, fail), validator (real event ids, exact quotes), idempotent commit, failure log (6ea4c0c). Opus added `verifies`, a validated delayed-check route to Retained (2cb777d, d9a7a56).
- [x] Weekly: `npm run weekly` with the sufficiency gate (3 weeks × 3 sessions), validator (fe9f644)
- [x] Knowledge levels and contradictions (04fcc5b)
- [x] Knowledge migration script (b4be8b0), COMMITTED to the data repo as c204ec3 (`knowledge/evidence.json`, 65 items). A re-run reported `unchanged` (idempotency verified). Dry run: 65 items (38 MCQ answers plus 27 mentor entries, all weak/historical); 27 archived answers skipped; 28 duplicate archive entries; 1 left uncertain.
- [x] Routine docs plus the CLAUDE.md ownership rules (03d6804)

### P2: Design system and shell (Sonnet; commits 1a82e36, 4707da3, 31676cf; Opus visual check done)
- [x] Tokens (#070b14 base, #3b9bff accent), Geist/Geist Mono, @layer components, motion with reduced-motion off
- [x] Shell: sidebar, tab bar, sync dot, empty states, skeleton, toast CSS
- [x] Logo preserved (BrandMark.tsx and favicon unchanged; verify with `git diff ddf0be1 -- components/BrandMark.tsx app/favicon.ico` at release)
- [x] Today journal-first: session card, recent activity, this-week bars (lib/today.ts, 6 tests); no streak, quiz or lesson cards
- [~] Coding inherits the new tokens; a detailed restyle isn't done (functionality untouched)

### P3: Journal completion (Sonnet; db5401c, a8b6d04; merged 501ab7b)
- [x] Note editing (edit events)
- [x] Session metadata editing (meta event)
- [x] Conflict inspection and resolution (backup, then merge)
- [x] Better sync status, retry
- [x] Subject and source filters, search
- [x] Immersive active session, mobile first
- [x] Photo attachments (capture, compression, EXIF strip, local persistence; upload off)

### P4: Mentor, Knowledge and reviews in the app (Sonnet; cbbabb5, 6120b0b; panel mounted by Opus 6b8ca57)
- [x] Reviews in session detail and Today, "Review now" and "Discuss" copy prompts
- [x] Weekly report view
- [x] Knowledge page: search, filters, levels, evidence, why, due for verification
- [x] Mentor V1 archive history view

### P5: Routines (Opus)
- [x] Repurposed the Sonnet trigger trig_018R59EQ9LLo3Ujh7sH5R42Y as "Fundamentals session reviews", 06:15 IST, enabled (the update response confirms the stored config)
- [x] Opus daily trig_01Nh3VTuUaKUPrwv3qmzcJ7G: coding review plus Monday weekly; lesson tailoring, learner profile and PR steps retired
- [x] Config verified. Manual run cse_018WzAxEUfnNfHEwDKxpgwEj succeeded (pending: [], nothing written)

### P6: Docs and cleanup
- [x] README, CLAUDE.md, ARCHITECTURE, data contracts, recovery docs (Sonnet, a3288ff)
- [x] Remote branch audit (Haiku), re-verified by Opus. Deleted 7 branches with 0 unique patches and no open PR: chore/remove-news, chore/reset-password, claude/cool-ramanujan-0fb8ks, fix/radar-sources, revamp-ui, routine/2026-10-29, routine/2026-11-07. Kept: claude/nice-faraday-hhxp4b, design/ux-hld-lld-revamp, feature/tech-radar (unique patches), claude/reset-login-password, claude/youthful-mendel-m471i0 (unique work), leetcode-data and radar-data (automation data branches), main, routine-state, rewrite/v2, v2/*. The v1-legacy tag is intact.

### P7: QA and release
- [x] Full unit (323/323), e2e (125/125) and build; 54 screenshots at 375/390/768/1280/1600/1920 captured, key ones inspected (in `../fundamentals-v2-screenshots/final/`, outside the repo). Fix: Today's button reads "Open session" while running.
- [x] Security review of the diff: no dangerouslySetInnerHTML, the markdown renderer emits no links, CSP unchanged (self + GitHub API), no secrets, mentor remote GET-only, logo unchanged since ddf0be1
- [x] PR #53: CI green (check, layout), merged e4d9a34, Pages deploy 43281085732 succeeded. Smoke test: 6 routes return 200, CSP present, new bundle live. Rollback: `git revert -m 1 e4d9a34` on main (v1-legacy tag intact)
- [x] `fundamentals-v2-final-report.md`

## Baseline
On main ddf0be1, at 2026-11-12 23:13 IST: 219/219 unit tests, 73/73 e2e tests, and the build all pass.

## Files changed
(updated per checkpoint)

## Assumptions
- `progress.md` and `execution-log.md` live in the public app repo. They hold no secrets or personal learning content.
- "Root of the application workspace" means the root of the app repo.

## Notes
- Turbopack `next build` fails inside worktrees that use a node_modules junction (it resolves outside the root). Build verification is done in the main checkout only.
- Before `git worktree remove`, ALWAYS `unlink node_modules` first: removing the worktree could follow the junction.

## Known defects
- (fixed in P1) `GitHubStore.fetchRemote` read the sha and the content separately.
- (fixed in 6b8ca57) Today.tsx missed meta renames.
- Decision 4 correction: the browser also writes `journal/conflicts/**` (create-only backups before a repair), and `progress.json`.
- Settings "Storage" counts V1 practice sessions, not journal sessions (the wording is ambiguous; left as is).
- The populated mentor/review UI states are covered only by unit tests (no real reviews exist yet).
- The IndexedDB v1→v2 upgrade is unit-tested with a fake database only (fake-indexeddb isn't installed); the e2e covers a fresh database only.

## External blockers
- `fundamentals-tracker-media` doesn't exist. Creating it, and a fine-grained token for it, needs the owner (see final report).
- The 5 real handwriting photos haven't been supplied.
- Token narrowing and rotation need owner approval.

## Next action
Finish the baseline, then launch the P1 engine agent (worktree) and the P2 design agent.
