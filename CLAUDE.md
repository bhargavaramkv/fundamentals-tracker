# Fundamentals

Static Next.js app (GitHub Pages) for the owner's engineering-fundamentals practice.
Design and reasoning: `docs/design/V4.md` (current), `docs/design/V3.md` and `docs/design/REDESIGN.md` (history). Course order: `content/curriculum.json`.
Read `AGENTS.md` (Next.js version notes) before changing code.

- **Coding review:** the nightly routine follows `docs/coding-routine.md`. No API keys, API billing or gateways: it runs only on
  the owner's Claude subscription. It writes to the data repo only through `npm run coding-review`, only `mentor/coding.json`.
- **LeetCode history:** the data repo's `leetcode-pull.yml` is the only other automation that may write there, only under `leetcode/`
  (`scripts/leetcode-history.ts`). It holds the owner's code, so it must never reach this public repo or its branches.
- **Daily run:** follow `docs/daily-routine.md` exactly. It's the source of truth for
  analysis, PRs and the `routine-state` marker.
- **Progress data:** the daily run has the private data repo attached and reads
  `../fundamentals-tracker-data/progress.json` directly.
  The daily routine never touches `progress.json`; it writes only `learner/profile.json`, via `npm run learner`.
- **Sources:** never add a link to `content/resources/registry.json` without fetching it (`npm run resources:verify`).
- **Checks:** `npm run check` (lint, typecheck, tests, build) before every commit.
- **Never:** push to `main` from the routine, delete question or exercise IDs, or (from the
  routine) touch `lib/login-vault.json`, `vault/`, `lib/auth.ts`, `lib/vault.ts`. Interactive Claude Code
  sessions have full authority and may change and merge these via PR; see `docs/pr-policy.md`.
- Answers before `CONTENT_EPOCH` (lib/progress.ts) are archived and not counted.
- Keep chat output short: the owner pays for tokens.
- **End to end:** in an interactive session, take work through `npm run check`, PR, merge on green CI, and confirm the Pages
  deploy of the latest `main` succeeded.
