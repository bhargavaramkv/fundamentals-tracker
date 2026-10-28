# Daily improvement routine

This is the playbook the scheduled Claude task follows. It lives in the repo so
it can be reviewed and changed like code.

## When it runs

Once a day at **06:47 IST**, in the owner's main Claude chat (one chat, no
separate analyst). Each run covers everything since the previous analysis:
quiz answers **and** lesson reads (a lesson open and visible for 20+ seconds).
Content only reaches the site when the owner merges the PR, so a daily cadence
loses nothing compared with running more often.

## Hard rules

1. **Never push to `main`.** All content changes go through a pull request.
2. **Never modify or delete progress data.** The data repo
   (`bhargavaramkv/fundamentals-tracker-data`) is read-only for this routine.
   Don't push to it, open PRs against it, or rewrite it.
3. **Never delete or renumber existing question IDs.** Answers in the progress
   file reference them. To fix a broken question, edit its wording or
   explanation. If the change alters what the question tests, add a new question
   with a new ID instead.
4. **No secrets in the repo.** Access comes from the session's GitHub
   connection, not from tokens in files.
5. **Never modify `lib/login-vault.json`, `vault/`** or anything under
   `lib/auth.ts` / `lib/vault.ts`. The login and sync credentials are the owner's to change.
6. `npm run check` (lint, typecheck, tests, build) must pass before every commit.
7. The only branch the routine may push outside PR branches is `routine-state`
   (step 5).

## Steps

### 1. Sync and check

```bash
cd /home/user/fundamentals-tracker && git fetch -q origin main routine-state && git checkout -q main && git reset -q --hard origin/main
cd /home/user/fundamentals-tracker-data && git fetch -q origin main && git reset -q --hard origin/main
cd /home/user/fundamentals-tracker
SINCE=$(git show origin/routine-state:state.json 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0)).analyzedThrough' 2>/dev/null || echo 1970-01-01T00:00:00Z)
npm run --silent report -- --data ../fundamentals-tracker-data/progress.json --since "$SINCE" --check
```

- `newActivity: false` and fewer than 2 days since the last activity: move the
  marker (step 5) and finish with one line.
- `newActivity: false` and 2+ days inactive: make one small improvement and open
  a PR whose summary leads with a nudge.
- Otherwise continue. Run `npm ci` only if `node_modules` is missing or
  `package-lock.json` changed.

### 2. Analyse

```bash
npm run --silent report -- --data ../fundamentals-tracker-data/progress.json --since "$SINCE"
npm run --silent report -- --data ../fundamentals-tracker-data/progress.json --since "$SINCE" --json
```

The report covers practice and reading in the last 24h, days since last
activity, weak topics, repeatedly missed questions (with the wrong options that
were picked), untested topics, reviews due, and exactly what's new since the
last analysis. Look closely at the new answers: wrong picks reveal the
misconception, and very fast answers (under ~5s) suggest guessing.

### 3. Decide what to improve (keep it small)

Work on at most **3 topics** per run, in this priority order:

1. **Repeatedly missed questions** (missed 2+ times). Look at the wrong picks:
   they show the misconception. Sharpen the explanation so it addresses that
   misconception directly, and add a short section to the topic's lesson that
   covers it.
2. **Weak topics.** Add 2–3 new questions per topic that approach the concept
   from a different angle (a scenario, a code snippet, "what breaks if…"), with
   mixed difficulty. Improve the lesson where the misses suggest a gap.
3. **Lessons read but then still missed.** The lesson isn't landing. Rewrite
   the section that covers the missed concept.
4. **No new data, or no weak topics.** Add 1–2 questions to the
   topic with the fewest questions, or deepen a lesson. Stay at interview and
   real-work level for a full-stack C#/.NET, Angular, TypeScript, MongoDB and
   Kubernetes engineer.

Content conventions:

- Questions live in `content/questions/<domain>.json`, with the next free ID
  `<domain>-<topic>-<n>`. Write 4 options, one clearly correct, with plausible
  distractors. **No length tell:** every distractor must be as specific and as
  long as the correct answer, and the correct one should often not be the
  longest. `tests/content.test.ts` fails the build if a pattern appears.
  Explanations say why the answer is right *and* why the tempting wrong answer
  is wrong.
- Lessons live in `content/lessons/<domain>/<topic>.md`, with quoted `title`
  and `summary` frontmatter. Keep them short and scannable: tables, small code
  samples, "when it breaks".
- A new topic needs a lesson and at least 3 questions (the tests enforce this).
- **Reordering or rewriting options of an existing question** breaks old answers'
  `selected` indexes. Before changing them, snapshot the current option sets into
  `content/questions/legacy/<date>.json` (`replacedAt` + `options`), as was done
  on 2026-10-28. Always read misses from the report's `misses` list, never from
  raw `selected` indexes.
- Verify technical claims. Don't add a question you aren't certain about.

### 4. Branch, commit, PR

- If an open PR with the `daily-routine` label exists, add commits to its
  branch and update its description instead of opening another.
- Otherwise create `routine/YYYY-MM-DD` from the latest `origin/main`.
- Make small commits, e.g. `content(databases): add write-skew scenarios`, and
  run `npm run check` before each one.
- Push the branch and open the PR (REST API) with the label `daily-routine`.
- If the right fix is bigger than a content tweak (a new topic or domain, 3+
  weak domains at once, a lesson that still isn't landing, an app or data bug),
  do the small safe part in the PR and describe the larger change in the
  summary for the owner to approve.

PR body template:

```markdown
## Daily routine · YYYY-MM-DD

**Activity:** practiced in last 24h: yes/no · read: N lessons · last active: … · streak: …

> Nudge (only if 2+ days inactive): …

**What's new since last analysis:** answers, sessions, lessons read

**What I saw:** weak topics, repeated misses, and the misconception each one suggests

**What changed:**
- lessons: …
- questions: +N (ids …), explanations improved: …

**Next focus:** …
```

- If there is truly nothing meaningful to change, don't open a PR. End the
  run with the report summary instead.

### 5. Record what was analysed

Always, even when no PR was needed, move the marker on the `routine-state`
branch so the same activity isn't analysed twice:

```bash
TMP=$(mktemp -d) && git worktree add -q --detach "$TMP" origin/routine-state
# write {"analyzedThrough": "<latestActivityAt from the check>", "lastDailyReview": "<YYYY-MM-DD>"} to "$TMP/state.json"
(cd "$TMP" && git add state.json && git commit -qm "state: analysed through <timestamp>" && git push -q origin HEAD:routine-state)
git worktree remove --force "$TMP"
```
