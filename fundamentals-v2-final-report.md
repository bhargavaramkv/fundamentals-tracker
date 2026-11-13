# Fundamentals V2: final report

Written 2026-11-13, about 00:10 IST, by the supervising Opus session (conversation 5c48c512-6e38-44ec-9089-6651e5d84f73). The details are in `progress.md` (state) and `execution-log.md` (history).

## A. Outcome
V2 is complete and live. PR #53 was merged as `e4d9a34`, and Pages deploy run 43281085732 succeeded. A follow-up docs PR records the routine schedule.

The routines are reconfigured. Session reviews run with Sonnet at 06:15 IST. The daily Opus run at 06:47 IST does the coding review, plus weekly coaching on Mondays.

## B. What was built
- **Journal:**
  - Edit notes and session details, with the original kept viewable.
  - Conflict inspection and "keep both and repair", with a create-only backup to `journal/conflicts/<id>/<sha>.json`.
  - Sync status with retry and "Sync now".
  - Subject and source filters, search, and discarded sessions.
  - Immersive active session (sticky controls on mobile).
  - Photos stored locally only: WebP or JPEG, at most 2000 px, EXIF stripped. Upload is off.
- **Today:** journal-first. It shows the current session card, recent activity, this week's activity and the mentor slot.
- **Review engine:** `npm run journal-review`.
  - Validated evidence: real event ids and exact quotes.
  - Idempotent, with a failure log.
  - Delayed-check `verifies`, which is the only route to Retained.
- **Weekly coaching:** `npm run weekly`, with a sufficiency gate of at least 3 weeks with at least 3 sessions each. Below that it produces an activity summary only.
- **Knowledge:**
  - Levels Exposed → Understood → Applied → Retained, computed when read. MCQ answers count as weak evidence only. A contradiction flags the concept for reassessment and erases nothing.
  - Migration: committed to the data repo as `c204ec3`, 65 historical weak items. A re-run made no changes.
- **Mentor in context:**
  - Review panel in the ended-session detail, with "Review now" and "Discuss" copy prompts.
  - A Today slot.
  - Rebuilt Knowledge page: search, filters, "why this level" and due checks.
  - A `/mentor/` page with weekly reports and the V1 archive, rendered with safe markdown and no raw HTML.
- **Redesign:** midnight navy `#070b14`, electric blue `#3b9bff` and restrained cyan, in Geist. Motion respects reduced-motion settings. The logo (`BrandMark.tsx`, favicon) is unchanged (verified with `git diff`).
- **Fix:** the `progress.json` sync race now has a regression test.

## C. Architecture decisions
See `progress.md`, "Architecture decisions", and `docs/v2/ARCHITECTURE.md`. Correction to decision 4: the browser also writes `journal/conflicts/**`, as create-only backups.

## D. Data and migration
- No user data was deleted or overwritten.
- `knowledge/evidence.json` is append-only.
- The ids are `mig:mcq:<answerId>` and `mig:mentor:<id>`.
- Skipped: 27 archived answers and 28 duplicate archive entries, plus 1 that was left uncertain.
- The IndexedDB `ft-journal` database moved from v1 to v2 and only adds stores. The upgrade is unit-tested with a fake database; the e2e tests cover fresh databases only.

## E. Testing
- **`npm run check`:** passes, with 323/323 unit tests, lint, typecheck and build.
- **Playwright:** 125/125 locally with the throwaway vault, and green in CI.
- **Screenshots:** 54, at 375, 390, 768, 1280, 1600 and 1920. They are saved in `../fundamentals-v2-screenshots/final/`, outside the repo. I inspected the key screens; that review led to one fix: Today now shows "Open session" while a session is running.
- **Not tested for real:**
  - Two-device sync against GitHub. It is simulated in unit tests; the e2e only proves that separate devices stay independent.
  - Conflict UI against a real conflict.
  - Populated review and weekly states, because no real reviews exist yet.
  - Real camera capture.

## F. Security
- No `dangerouslySetInnerHTML` anywhere.
- The markdown renderer outputs no links.
- The CSP allows self plus the GitHub API only.
- The mentor remote only reads (GET).
- No secrets are in the diff.
- The device key is non-extractable.
- No Anthropic API billing was added. Routines run on the subscription.

## G. Routines (P5)
| Routine | Model | Schedule | Scope | Verified |
|---|---|---|---|---|
| Fundamentals session reviews (`trig_018R59EQ9LLo3Ujh7sH5R42Y`) | Sonnet | 06:15 IST daily | `docs/review-routine.md` | Config confirmed. Manual run `cse_018WzAxEUfnNfHEwDKxpgwEj` succeeded: "pending: []", nothing to review. The commit path has not run in production yet. |
| Fundamentals tracker · daily run (`trig_01Nh3VTuUaKUPrwv3qmzcJ7G`) | Opus | 06:47 IST daily | Coding review, plus weekly coaching on Mondays. Lesson steps retired. | Config confirmed. First run after the change: 2026-11-13 06:47 IST (not yet observed). |

## H. Docs and cleanup
- **Docs:** `README.md`, `CLAUDE.md`, `docs/v2/ARCHITECTURE.md`, `docs/v2/data-contracts.md` and `docs/v2/recovery.md`.
- **Branches deleted:** 7, each with 0 unique patches and no open PR. The list is in `progress.md`.
- **Never touched:** the `v1-legacy` tag and data branches.

## I. Known issues
- The Settings "Storage" line counts V1 practice sessions, not journal sessions. The wording is ambiguous.
- Today's week bars scale to the week's maximum, so a few seconds of activity shows as a full bar.
- `lib/journal/types.ts` still calls `subject` "Immutable", but the `meta` event can override it.

## J. External blockers (owner action)
1. **Photo upload.**
   - Create the private repo `fundamentals-tracker-media`.
   - Create a fine-grained token scoped to that repo only, with Contents: Read and write.
   - Supply the 5 handwriting photos and their ground truth (`docs/v2/handwriting-spike.md`).
   - Until then, upload stays off.
2. **Token narrowing.** The sync token should cover only `fundamentals-tracker-data`, with Contents: Read and write. Settings still describes app-repo access. Rotate the token at github.com/settings/personal-access-tokens, then re-enter it in Settings.
3. **Real two-device test.** Sign in on phone and laptop, record a session on each, then edit the same session on both while offline and check the conflict panel.

## K. Rollback
`git revert -m 1 e4d9a34` on main, then push; Pages redeploys. The full V1 state is at the `v1-legacy` tag. The routines can be reverted to their earlier prompts, which are recorded in this conversation's transcript.

## L. Execution and usage
| Measure | Value |
|---|---|
| Execution sessions | 1 (conversation 5c48c512-6e38-44ec-9089-6651e5d84f73, compacted twice) |
| /loop iterations | 2 |
| Wake-ups scheduled | 3 (23:44, 00:00, 00:31 IST) |
| Wake-ups observed executing | 1 (00:00). 23:44 is unverified because notifications kept the session active. 00:31 is pending at the time of writing. |
| Usage-limit interruptions | 0 |
| Manual resumptions | 0 |
| Token totals for the supervising session | Unavailable |
| Commits on the release | 28 (76 files, +6967/−1123) |

## M. Agents
| Agent | Model | Task | Tokens / tool uses / time |
|---|---|---|---|
| Supervisor | opus | Architecture, reviews, delayed-check fix, migration commit, merges, QA, security, release, routines, report | Unavailable |
| P1 engine | sonnet | Review engine, weekly, knowledge levels and migration, sync race fix | Unavailable (two launches; the first got the wrong worktree and did no work) |
| P2 design | sonnet | Design system, shell, Today | Unavailable |
| P3 journal | sonnet | Journal completion | 194,493 / 71 / 17.8 min |
| P4 mentor | sonnet | Mentor data layer and UI, Knowledge rebuild, /mentor/ | 163,393 / 54 / 11.1 min |
| P6 docs | sonnet | Architecture, data contracts, recovery, README | 141,601 / 28 / 3.6 min |
| Branch audit | haiku | Read-only remote branch audit | Unavailable |
| Review routine (manual run) | sonnet | Verification run of the review routine | 25 s, 3 turns |

---

## Correction (appended 2026-11-13; the sections above are kept as originally written)
Sections A and B above call the release a "redesign" and describe a full UI/UX transformation. That is **inaccurate**.

- **What the release actually delivered:**
  - All the functional improvements in section B: journal completion, review engine, weekly coaching, knowledge levels, mentor UI, docs and routines.
  - Minor visual refinements:
    - Background `#0a1220` to `#070b14`, surfaces slightly darker. The accent `#3b9bff` is unchanged.
    - Geist instead of Nunito for headings.
    - Flat buttons.
    - A rebuilt Today content list.
- **What it did not deliver:** the intended full UI/UX redesign.
  - The shell, navigation, card-based composition, information hierarchy and palette are essentially those of `ddf0be1`.
  - Coding and Settings were not restyled at all.
- **Why:** the design brief given to the implementing agent asked for a token, typography and motion pass inside the existing structure. The Opus visual review checked screenshots for layout defects but never compared them against the previous version.
- **Deployment:** it was correct. Production serves the latest build, which was verified by checking the live CSS and JS and the response headers.
- **Status:** the genuine redesign is now tracked as **P-R (INCOMPLETE)** in `progress.md`.
