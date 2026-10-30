# Fundamentals tracker

Static Next.js app (GitHub Pages) for the owner's engineering-fundamentals practice.
Read `AGENTS.md` (Next.js version notes) before changing code.

- **Daily run:** follow `docs/daily-routine.md` exactly. It's the source of truth for
  analysis, tech news, PRs and the `routine-state` marker.
- **Progress data:** the daily reader chat (which has the private data repo) sends
  `progress.json` as a `PROGRESS` message; decode it to `../fundamentals-tracker-data/progress.json`.
  Never write to the data repo.
- **Tech Radar:** pipeline in `lib/radar/` + `scripts/radar.ts`, scheduled by `.github/workflows/radar.yml`;
  data lives on the `radar-data` branch (never commit `content/radar/` to `main`). See `docs/tech-radar.md`.
- **Checks:** `npm run check` (lint, typecheck, tests, build) before every commit.
- **Never:** push to `main` from the routine, delete question IDs, or touch
  `lib/login-vault.json`, `vault/`, `lib/auth.ts`, `lib/vault.ts`.
- Answers before `CONTENT_EPOCH` (lib/progress.ts) are archived and not counted.
- Keep chat output short: the owner pays for tokens.
