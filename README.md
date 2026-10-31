# Fundamentals Tracker

A private, adaptive tracker for software-engineering fundamentals at interview and
real-work level: DSA, OOP and design principles, databases, system design, and
web/networking. It finds weak areas from your answers and keeps practice focused
on them. A daily Claude routine also improves the lessons and questions based on
where you keep failing.

**Live site:** https://bhargavaramkv.github.io/fundamentals-tracker/

## Access control

The site opens on a **username + password** sign-in screen. GitHub Pages can't
run a server, so the check is built so the password does real cryptographic work
rather than being a string compared in JavaScript:

- `lib/login-vault.json` holds only a random salt and an AES-GCM ciphertext of a
  marker. Signing in derives a key from `username + password` with PBKDF2-SHA256
  (600,000 iterations), and only the right pair decrypts the marker. The password
  is never stored anywhere.
- You stay signed in for 30 days per device. The saved session is the derived
  key, and it's re-checked against the vault on every load, so a forged session
  doesn't unlock anything.
- The GitHub sync token is stored **encrypted with that key**, both in the browser
  and as one account-wide copy in `vault/sync-token.json`. Without the password
  it's an opaque blob, and after **Settings → Sign out** nothing usable is left
  in the browser.
- Pages are marked `noindex`.

**Changing the password:** `LOGIN_USERNAME=bhargav LOGIN_PASSWORD='new-pass' npm run set-password`
(or `npm run set-password -- --generate` for a random one), then commit
`lib/login-vault.json`. Devices that were signed in are signed out, and the
shared sync token must be pasted once more (it was encrypted with the old password).

**What this protects:** your progress data (it also needs the sync token, which
GitHub enforces) and the app UI. The lesson and question text is open source in
this public repo and ships in the static bundle, so treat content as public.

## Features

- **Assessment:** 60 questions (12 per domain, 4 topics × 3 difficulties). Domains
  are interleaved and difficulty ramps up, so a partial run still gives a signal.
  Option order is shuffled per session.
- **Skill profile:** per-domain and per-topic scores (recency-weighted with a
  21-day half-life, harder questions weighted more), a confidence level based on
  evidence and topic coverage, and weak-topic detection (2+ answers and
  either < 60% or 2+ misses in the last 5). Topics missed with less evidence show
  up as "shaky".
- **Dashboard:** strengths vs gaps, score per session over time (chart and table),
  streak, last-active date, and a nudge after 2+ inactive days.
- **Adaptive practice:** 10-question rounds built from due spaced-repetition
  reviews, then weak and shaky topics (round-robin), then untested topics, then
  whatever you saw least recently.
- **Spaced repetition:** every missed question enters a Leitner deck
  (4h → 1d → 3d → 7d → 14d → 30d). A miss resets it to the first box.
- **Tech Radar:** a daily, automatically discovered feed of important developments
  across AI, developer tools, cloud and databases, security, hardware and research,
  from 43 official blogs, release feeds, advisories, research feeds and publications.
  Stories are deduplicated, ranked (with the reasons shown) and, for the strongest
  ones, explained by Claude through the fundamentals behind them, with source facts,
  company claims and AI analysis kept apart. Includes a daily briefing, filters,
  search, bookmarks, read tracking, a weekly roundup and a monthly archive. See
  [docs/tech-radar.md](docs/tech-radar.md).
- **Fun corner:** for low-motivation days: real bug stories (Knight Capital,
  Cloudflare's regex outage, left-pad…), quick facts, and a 5-question warm-up.
- **Lessons:** short markdown guides in `content/lessons/<domain>/<topic>.md`,
  each linked to a focused drill.
- **Answer log:** every answer is stored with its timestamp, question, topic,
  difficulty, correctness, the option picked, and time taken. Lesson reads
  (20+ seconds visible) are logged too.

## Architecture

```
app/                 Next.js App Router pages (statically exported)
components/          Client components (quiz, dashboard, chart, settings)
content/questions/   Question bank, one JSON file per domain
content/lessons/     Markdown lessons, one per topic
lib/storage.ts       ProgressStore interface + LocalStore + GitHubStore
lib/profile.ts       Scoring, confidence, weak/strong detection
lib/srs.ts           Spaced repetition
lib/recommend.ts     Focus topics + adaptive practice set
lib/progress.ts      Append-only merge, session recording
scripts/progress-report.ts   Analysis used by the daily routine
docs/daily-routine.md        Playbook the scheduled task follows
```

### Why there's no backend or MongoDB

The site is deployed to **GitHub Pages**, which only serves static files: no API
routes and no server-side database connections. So:

- The app is a static export (`output: "export"`). Content is compiled in at
  build time.
- Progress lives in **localStorage**, behind the `ProgressStore` interface in
  `lib/storage.ts`.
- **Optional sync** mirrors progress to `progress.json` in a **private** repo,
  `bhargavaramkv/fundamentals-tracker-data`, through the GitHub REST API. That
  gives you multi-device use and lets the daily routine read your data.
  Merges are append-only unions by answer ID, so no device or merge can delete
  history.

If you later want MongoDB, add a `MongoStore` that implements `ProgressStore`
against a small API hosted elsewhere (Vercel, Azure Functions). The UI won't
need changes.

## Local setup

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules) |
| `npm run typecheck` | Generates route types, then runs strict `tsc` |
| `npm test` | Vitest: engine logic + content integrity (IDs, lessons, ≥3 questions/topic) |
| `npm run build` | Static export to `out/` |
| `npm run check` | All of the above; run before every commit |
| `npm run report -- --data <progress.json>` | Markdown progress report (`--json` for JSON) |
| `npm run set-password` | Regenerate `lib/login-vault.json` (see Access control) |

## Environment variables

See `.env.example`. There are **no secrets**:

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | set by the deploy workflow | `/fundamentals-tracker` on Pages; empty locally |
| `NEXT_PUBLIC_DATA_OWNER` / `NEXT_PUBLIC_DATA_REPO` | optional build-time override | private repo that stores progress (defaults: `bhargavaramkv` / `fundamentals-tracker-data`) |

Neither the password nor the sync token is an environment variable. The password
exists only as the PBKDF2 vault in `lib/login-vault.json`. The sync token is
pasted into Settings, stored encrypted in that browser, and only ever sent to
`api.github.com`.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`.
`ci.yml` runs lint, typecheck, tests and build on PRs.

One-time setup: **Settings → Pages → Source: GitHub Actions**. Pages on a free
plan requires the repo to be public. The code and lessons hold nothing private;
your progress lives in the separate private data repo.

## Enabling progress sync

Sync is set up **once for your account**, not per device. It lets the daily
routine read your results and keeps every device in step.

1. Create a fine-grained token at
   https://github.com/settings/personal-access-tokens/new:
   - Repository access: **only** `fundamentals-tracker-data` **and** `fundamentals-tracker`
   - Permissions: **Contents: Read and write** (Metadata: read-only is added automatically)
   - Expiration: 90 days or more
2. Sign in, open **Settings → Sync to GitHub**, paste it, and click **Test & enable sync**.

The app commits the token to `vault/sync-token.json` in this repo, **encrypted
with your password-derived key** (AES-256-GCM, PBKDF2-SHA256 600k). Every device
you sign in on downloads and decrypts it, so you never paste it again. When it
expires, paste a new one once and every device picks it up. **Turn off sync**
removes the shared copy. Changes under `vault/` don't trigger a rebuild.

**Trade-off:** the encrypted file is public, so its safety rests on the password.
Keep a long random password (the generated one has ~116 bits of entropy). With
a weak password the token, which can write to both repos, could be brute-forced
offline.

If the token can only access the data repo, sync still works on that device,
and Settings tells you to add `fundamentals-tracker` to the token's access.

## Daily improvement routine

Once a day at **06:47 IST**, Claude reviews your progress and improves the
content, following `docs/daily-routine.md`, in a single chat:

1. Reads `progress.json` from the private data repo (read-only) and runs
   `npm run report -- --since <last analysis>`. That covers answers, the options
   you picked when wrong, time per answer, and lessons you read.
2. Improves the lessons and explanations behind your misses and adds questions
   for weak topics (at most 3 topics per run).
3. Runs `npm run check`, pushes a `routine/YYYY-MM-DD` branch, and opens a PR
   labelled `daily-routine` with a summary, plus a nudge if you've been
   inactive for 2+ days.
4. Moves the "analysed up to" marker on the `routine-state` branch so nothing
   is analysed twice.

It never pushes to `main`, never writes to the data repo, and never deletes
question IDs that your history references. Answers from before the 2026-10-28
question rewrite are archived: kept in the file, but not counted.

**How it reads your data without secrets in the repo:** the routine runs in a
Claude Code cloud session that uses your account's GitHub connection, which
grants repo access per session and is never written to this repo.

## Editing content

- Questions: `content/questions/<domain>.json`. Never reuse or delete an existing
  `id`, because progress references it. `npm test` validates shape, uniqueness,
  answer indexes and lesson coverage.
- Lessons: `content/lessons/<domain>/<topic>.md`, with quoted `title` and
  `summary` frontmatter. A new topic needs a lesson and at least 3 questions.
