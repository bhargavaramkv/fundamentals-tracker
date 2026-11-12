# Fundamentals V2: implementation progress

Source of truth for the V2 completion brief (received 2026-11-12, about 23:05 IST). Read this file and `execution-log.md` completely before resuming.

- **Current phase:** P1 (engine and redesign in parallel)
- **Current branch:** `v2/complete` (from `main` @ ddf0be1)
- **Latest verified commit:** ddf0be1 (main, deployed)
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
- [~] Knowledge migration script (b4be8b0). Dry run: 65 items (38 MCQ answers plus 27 mentor entries, all weak/historical); 27 archived answers skipped; 28 duplicate archive entries; 1 left uncertain. Commit to the data repo still to do, after the merge.
- [x] Routine docs plus the CLAUDE.md ownership rules (03d6804)

### P2: Design system and shell (Sonnet)
- [ ] Tokens, typography, motion, reduced motion
- [ ] Sidebar, mobile nav, headers, buttons, inputs, empty, loading and error states, toasts
- [ ] Logo preserved exactly (`components/BrandMark.tsx` untouched)
- [ ] Today rebuilt journal-first (no lesson cards, no quiz coach card)
- [ ] Coding restyled, with functionality intact

### P3: Journal completion (Sonnet)
- [ ] Note editing (edit events)
- [ ] Session metadata editing (meta event)
- [ ] Conflict inspection and resolution (backup, then merge)
- [ ] Better sync status, retry
- [ ] Subject and source filters, search
- [ ] Immersive active session, mobile first
- [ ] Photo attachments (capture, compression, EXIF strip, local persistence; upload off)

### P4: Mentor, Knowledge and reviews in the app (Sonnet)
- [ ] Reviews in session detail and Today, "Review now" and "Discuss" copy prompts
- [ ] Weekly report view
- [ ] Knowledge page: search, filters, levels, evidence, why, due for verification
- [ ] Mentor V1 archive history view

### P5: Routines (Opus)
- [ ] Repurpose the Sonnet trigger for session reviews
- [ ] Update the Opus daily routine: coding review plus weekly; remove lesson generation
- [ ] Verify with `get`

### P6: Docs and cleanup
- [ ] README, CLAUDE.md, ARCHITECTURE, data contracts, recovery docs
- [x] Remote branch audit (Haiku), re-verified by Opus. Deleted 7 branches with 0 unique patches and no open PR: chore/remove-news, chore/reset-password, claude/cool-ramanujan-0fb8ks, fix/radar-sources, revamp-ui, routine/2026-10-29, routine/2026-11-07. Kept: claude/nice-faraday-hhxp4b, design/ux-hld-lld-revamp, feature/tech-radar (unique patches), claude/reset-login-password, claude/youthful-mendel-m471i0 (unique work), leetcode-data and radar-data (automation data branches), main, routine-state, rewrite/v2, v2/*. The v1-legacy tag is intact.

### P7: QA and release
- [ ] Full unit, e2e and build; widths 375, 390, 768, 1280, 1600, 1920; screenshots inspected
- [ ] Security review of the diff
- [ ] PR, CI, merge, deploy, smoke test, rollback path
- [ ] `fundamentals-v2-final-report.md`

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
- `GitHubStore.fetchRemote` reads the sha and the content separately (P1 fix).

## External blockers
- `fundamentals-tracker-media` doesn't exist. Creating it, and a fine-grained token for it, needs the owner (see final report).
- The 5 real handwriting photos haven't been supplied.
- Token narrowing and rotation need owner approval.

## Next action
Finish the baseline, then launch the P1 engine agent (worktree) and the P2 design agent.
