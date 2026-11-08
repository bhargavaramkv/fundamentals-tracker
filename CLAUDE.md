# Fundamentals

Static Next.js app (GitHub Pages) for the owner's engineering-fundamentals practice.
Design and reasoning: `docs/design/REDESIGN.md`.
Read `AGENTS.md` (Next.js version notes) before changing code.

- **Mentor:** the nightly routine follows `docs/mentor-routine.md`; design in `docs/design/MENTOR.md`. No API keys, API billing or
  gateways: it runs only on the owner's Claude subscription. It writes to the data repo only through `npm run mentor`, only under
  `mentor/`.
- **LeetCode history:** the data repo's `leetcode-pull.yml` is the only other automation that may write there, only under `leetcode/`
  (`scripts/leetcode-history.ts`). It holds the owner's code, so it must never reach this public repo or its branches.
- **Daily run:** follow `docs/daily-routine.md` exactly. It's the source of truth for
  analysis, PRs and the `routine-state` marker. News is the automated Tech Radar (no hand-written news).
- **Progress data:** the daily reader chat (which has the private data repo) sends
  `progress.json` as a `PROGRESS` message; decode it to `../fundamentals-tracker-data/progress.json`.
  The daily routine never writes to the data repo.
- **Sources:** never add a link to `content/resources/registry.json` without fetching it (`npm run resources:verify`).
- **Tech Radar:** pipeline in `lib/radar/` + `scripts/radar.ts`, scheduled by `.github/workflows/radar.yml`;
  data lives on the `radar-data` branch (never commit `content/radar/` to `main`). See `docs/tech-radar.md`.
- **Checks:** `npm run check` (lint, typecheck, tests, build) before every commit.
- **Never:** push to `main` from the routine, delete question or exercise IDs, or (from the
  routine) touch `lib/login-vault.json`, `vault/`, `lib/auth.ts`, `lib/vault.ts`. Interactive Claude Code
  sessions have full authority and may change and merge these via PR; see `docs/pr-policy.md`.
- Answers before `CONTENT_EPOCH` (lib/progress.ts) are archived and not counted.
- Keep chat output short: the owner pays for tokens.
- **End to end:** in an interactive session, take work through `npm run check`, PR, merge on green CI, and confirm the Pages
  deploy of the latest `main` succeeded.
