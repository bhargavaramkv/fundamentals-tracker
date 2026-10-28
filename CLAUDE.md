# Fundamentals tracker

Static Next.js app (GitHub Pages) for the owner's engineering-fundamentals practice.
Read `AGENTS.md` (Next.js version notes) before changing code.

- **Daily run:** follow `docs/daily-routine.md` exactly. It's the source of truth for
  analysis, tech news, PRs and the `routine-state` marker.
- **Progress data:** private repo `bhargavaramkv/fundamentals-tracker-data`
  (`progress.json`). Read-only, never write to it. Clone it to `../fundamentals-tracker-data`.
- **Checks:** `npm run check` (lint, typecheck, tests, build) before every commit.
- **Never:** push to `main` from the routine, delete question IDs, or touch
  `lib/login-vault.json`, `vault/`, `lib/auth.ts`, `lib/vault.ts`.
- Answers before `CONTENT_EPOCH` (lib/progress.ts) are archived and not counted.
- Keep chat output short: the owner pays for tokens.
