# Pull request policy

Applies to `main`, which deploys to GitHub Pages on every push.

## Rules

1. **No direct pushes to `main`.** Every change, from the owner, Claude Code or
   the daily routine, goes through a pull request.
2. **CI must pass.** The `check` job in `.github/workflows/ci.yml` (lint,
   typecheck, tests, build) is a required status check.
3. **No required approvals.** The owner, Claude Code and the daily routine all
   act as the same GitHub account (`bhargavaramkv`), and GitHub does not let an
   author approve their own PR, so a required review would block every PR.
   Passing CI is the gate instead.
4. **Either the owner or Claude Code may merge** a PR whose CI is green.
5. **No force-pushes or deletion of `main`.**
6. Prefer **squash merge** for feature and fix PRs. A regular merge is fine for
   the daily-routine PRs.

## Claude Code's authority

The owner has given Claude Code full authority over this project (decision of
2026-11-05). In an interactive Claude Code session, Claude Code may open and
merge PRs on its own judgment, including PRs that change `.github/workflows/`,
`vault/`, `lib/login-vault.json` or the sync/auth code (`lib/auth.ts`,
`lib/vault.ts`, `lib/storage.ts`). It still goes through a PR, never a direct
push to `main`.

- Never merge a PR with failing or pending required checks.
- The unattended daily routine does **not** inherit this: it opens PRs but does
  not merge, and does not touch the files listed above.

## Setup (once, in GitHub)

Settings changes cannot be made from Claude Code's cloud environment, so the
owner applies them:

1. Settings → Rules → Rulesets → New ruleset → **Import a ruleset** →
   choose `.github/rulesets/main.json`. It requires a PR and the `check` status
   check, blocks force-push and deletion, and lets repository admins bypass
   only through a PR.
2. Settings → General → Pull Requests → enable **Allow auto-merge** and
   **Automatically delete head branches**.
