# Fundamentals

Static Next.js app (GitHub Pages) for the owner's engineering-fundamentals practice.
Design and reasoning: `docs/design/REDESIGN.md`.
Read `AGENTS.md` (Next.js version notes) before changing code.

- **Mentor:** the nightly routine follows `docs/mentor-routine.md`; design in `docs/design/MENTOR.md`. No API keys, API billing or
  gateways: it runs only on the owner's Claude subscription. It's the only automation that may write to the data repo, and only
  through `npm run mentor`, only under `mentor/`.
- **Daily run:** follow `docs/daily-routine.md` exactly. It's the source of truth for
  analysis, PRs and the `routine-state` marker. News is the automated Tech Radar (no hand-written news).
- **Progress data:** the daily reader chat (which has the private data repo) sends
  `progress.json` as a `PROGRESS` message; decode it to `../fundamentals-tracker-data/progress.json`.
  The daily routine never writes to the data repo.
- **Sources:** never add a link to `content/resources/registry.json` without fetching it (`npm run resources:verify`).
- **Tech Radar:** pipeline in `lib/radar/` + `scripts/radar.ts`, scheduled by `.github/workflows/radar.yml`;
  data lives on the `radar-data` branch (never commit `content/radar/` to `main`). See `docs/tech-radar.md`.
- **Checks:** `npm run check` (lint, typecheck, tests, build) before every commit.
- **Never:** push to `main` from the routine, delete question or exercise IDs, or touch
  `lib/login-vault.json`, `vault/`, `lib/auth.ts`, `lib/vault.ts`.
- Answers before `CONTENT_EPOCH` (lib/progress.ts) are archived and not counted.
- Keep chat output short: the owner pays for tokens.
