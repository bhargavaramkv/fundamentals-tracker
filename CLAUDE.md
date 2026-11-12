# Fundamentals

Static Next.js app (GitHub Pages) for the owner's engineering-fundamentals practice.
Design and reasoning: `docs/v2/ARCHITECTURE.md` (current), with `docs/v2/data-contracts.md` and `docs/v2/recovery.md`; `docs/design/V4.md`, `docs/design/V3.md` and `docs/design/REDESIGN.md` (history). Course order: `content/curriculum.json`.
Read `AGENTS.md` (Next.js version notes) before changing code.

- **Coding review:** the daily run follows `docs/coding-routine.md` first (step 0 of `docs/daily-routine.md`). No API keys, API billing or gateways: it runs only on
  the owner's Claude subscription. It writes to the data repo only through `npm run coding-review`, only `mentor/coding.json`.
- **LeetCode history:** the data repo's `leetcode-pull.yml` is the only other automation that may write there, only under `leetcode/`
  (`scripts/leetcode-history.ts`). It holds the owner's code, so it must never reach this public repo or its branches.
- **Daily run (V2):** coding review (`docs/coding-routine.md`), plus weekly coaching on Mondays (`docs/weekly-routine.md`).
  Session reviews run as a separate routine (`docs/review-routine.md`). The lesson-tailoring steps of `docs/daily-routine.md`
  (learner profile, lesson PRs, `routine-state` marker) are retired.
- **Progress data:** the daily run has the private data repo attached and reads
  `../fundamentals-tracker-data/progress.json` directly.
  The daily routine never touches `progress.json`; it writes only `learner/profile.json`, via `npm run learner`.
- **Journal (V2):** the browser writes `journal/sessions/**`, `journal/requests/**` and `journal/conflicts/**` in the data repo; the daily routine must never write there.
  The review routines (`docs/review-routine.md`, `docs/weekly-routine.md`) may write only `journal/reviews/**`, `journal/review-failures/**`,
  `journal/weekly/**` and `knowledge/**`, only through `npm run journal-review`, `weekly` and `knowledge-migrate`. They never write
  `journal/sessions/**`, `journal/requests/**` or `journal/conflicts/**`.
- **Sources:** never add a link to `content/resources/registry.json` without fetching it (`npm run resources:verify`).
- **Checks:** `npm run check` (lint, typecheck, tests, build) before every commit.
- **Never:** push to `main` from the routine, delete question or exercise IDs, or (from the
  routine) touch `lib/login-vault.json`, `vault/`, `lib/auth.ts`, `lib/vault.ts`. Interactive Claude Code
  sessions have full authority and may change and merge these via PR; see `docs/pr-policy.md`.
- Answers before `CONTENT_EPOCH` (lib/progress.ts) are archived and not counted.
- Keep chat output short: the owner pays for tokens.
- **End to end:** in an interactive session, take work through `npm run check`, PR, merge on green CI, and confirm the Pages
  deploy of the latest `main` succeeded.
