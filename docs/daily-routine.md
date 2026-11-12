# Daily improvement routine

This is the playbook the scheduled Claude task follows. It lives in the repo so
it can be reviewed and changed like code.

## When it runs

One scheduled chat (the **daily run**, Opus, 06:50 IST). It has both this repo and
the private data repo attached, so it reads `progress.json` directly from
`../fundamentals-tracker-data/progress.json`.

Each run covers everything since the previous analysis: quiz answers **and**
lesson reads (a lesson open and visible for 20+ seconds).

## Hard rules

1. **Never push to `main`.** All content changes go through a pull request.
2. **Never modify or delete progress data.** Never touch `progress.json` in the data repo
   (`bhargavaramkv/fundamentals-tracker-data`). The only thing the routine may write there is
   `learner/profile.json`, and only via `npm run --silent learner -- commit --data ... --proposal ...`
   (never git directly).
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
   (step 6).

## Steps

### 1. Sync and check

```bash
cd /home/user/fundamentals-tracker && git fetch -q origin main routine-state && git checkout -q main && git reset -q --hard origin/main
# progress.json is read straight from the attached data repo (../fundamentals-tracker-data/progress.json).
cd /home/user/fundamentals-tracker
SINCE=$(git show origin/routine-state:state.json 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0)).analyzedThrough' 2>/dev/null || echo 1970-01-01T00:00:00Z)
npm run --silent report -- --data ../fundamentals-tracker-data/progress.json --since "$SINCE" --check
```

- `newActivity: false` and fewer than 2 days since the last activity: move the
  marker (step 6) and finish with one line.
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

### 3. Update the learner profile

The app keeps what it has learned about the owner in `learner/profile.json` (schema: `lib/learner.ts`).
Read the previous one, then write a full updated profile:

```bash
npm run --silent learner -- show --data ../fundamentals-tracker-data
# write the full updated profile to /tmp/profile.json, then:
npm run --silent learner -- commit --data ../fundamentals-tracker-data --proposal /tmp/profile.json
```

- Combine the previous profile with the report: answer times, reads vs answers, which tracks and topics the
  owner picks voluntarily, time of day of activity, accuracy after reading, quick guesses, "I don't know" use,
  and LeetCode tags from `mentor/coding.json` for interests.
- Keep what still holds. Be evidence-based and never flatter.
- `nextUp` is the 1-3 lessons that best fit right now: struggles first, then interests, then path order.
- Exit code 2 means the profile was rejected; fix the listed errors and retry.

### 4. Decide what to improve (keep it small)

Use the profile: prioritise its `struggles`; frame examples around its `interests` and the owner's stack (C#/.NET,
Angular, TypeScript, MongoDB, Kubernetes); favour the formats its `patterns` say work (` ```steps ` visuals,
` ```reveal `, ` ```check ` blocks, see existing lessons). Every lesson change gets an `adaptations` entry
(newest first) in the profile, so commit the profile again after the lesson work.

Improve lessons, explanations and questions. Work on at most **3 topics** per run, in this priority order:

1. **Repeatedly missed questions** (missed 2+ times). Look at the wrong picks:
   they show the misconception. Sharpen the explanation so it addresses that
   misconception directly, and add a short section to the topic's lesson that
   covers it.
2. **Weak topics.** Improve the lesson where the misses suggest a gap: a
   scenario, a code snippet, "what breaks if…".
3. **Lessons read but then still missed.** The lesson isn't landing. Rewrite
   the section that covers the missed concept.
4. **No new data, or no weak topics.** Deepen the lesson with the least depth,
   or make no change. Stay at interview and real-work level for a full-stack
   C#/.NET, Angular, TypeScript, MongoDB and Kubernetes engineer.

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

### 5. Branch, commit, PR

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
- explanations improved: … (question ids)

**Next focus:** …
```

- If there is truly nothing meaningful to change, don't open a PR. End the
  run with the report summary instead.
- **Merging:** when the PR changes only `content/**` and the CI `check` is green, the routine merges it itself
  (regular merge) so lessons reach the owner without them doing anything. Otherwise leave it open and say why in
  the summary.
- **Always end the run with a short chat summary for the owner**: practice
  status and the PR link. That message is how the owner is kept posted.

### 6. Record what was analysed

Always, even when no PR was needed, move the marker on the `routine-state`
branch so the same activity isn't analysed twice:

```bash
TMP=$(mktemp -d) && git worktree add -q --detach "$TMP" origin/routine-state
# write {"analyzedThrough": "<latestActivityAt from the check>", "lastDailyReview": "<YYYY-MM-DD>"} to "$TMP/state.json"
(cd "$TMP" && git add state.json && git commit -qm "state: analysed through <timestamp>" && git push -q origin HEAD:routine-state)
git worktree remove --force "$TMP"
```
