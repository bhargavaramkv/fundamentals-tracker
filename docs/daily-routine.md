# Activity-driven improvement routine

This is the playbook the scheduled Claude tasks follow. It lives in the repo so
it can be reviewed and changed like code. The tasks' prompts just say "follow
`docs/daily-routine.md`".

## How it's triggered, and which model does what

GitHub Pages can't run code, so nothing can push an event to Claude the moment
you finish a quiz or a lesson. Instead:

| Tier | Model | When | Job |
|---|---|---|---|
| **Check** | Sonnet (analyst session) | every hour | Run the one-line `--check`. If nothing is new, stop immediately. |
| **Analysis** | Sonnet (same session) | when the check finds new activity, and once a day | Steps 2–4 below: report, content improvements as local commits. |
| **Publish** | Opus (the owner's main session) | only when the analyst has a patch | Review the patch, `npm run check`, push a branch, open or update the PR, and move the `routine-state` marker. |
| **Escalation** | Opus (same) | only when needed | Bigger restructuring the analyst flags (see "Escalate"). |

The analyst session has the private data repo attached as its source (read-only)
and a read-only clone of this repo. It can't push here, so it hands finished
commits to the Opus session as a patch. That keeps Opus off the hourly path
entirely.

Activity means quiz answers **and** lesson reads (a lesson open and visible for
20+ seconds). The app syncs both to `progress.json` as soon as they happen, so
the next hourly check picks them up.

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
7. The only branch the publisher may push outside PR branches is `routine-state`
   (step 5). The analyst pushes nothing.

## Steps

### 1. Sync and check (every run, cheap)

```bash
cd /home/user/fundamentals-tracker && git fetch -q origin main routine-state && git reset -q --hard origin/main
cd /home/user/fundamentals-tracker-data && git fetch -q origin main && git reset -q --hard origin/main
cd /home/user/fundamentals-tracker
# The marker is the later of the published one (routine-state branch) and this session's local copy.
PUB=$(git show origin/routine-state:state.json 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0)).analyzedThrough' 2>/dev/null || echo 1970-01-01T00:00:00Z)
LOC=$(node -pe 'JSON.parse(require("fs").readFileSync("/home/user/.analyst-state.json")).analyzedThrough' 2>/dev/null || echo 1970-01-01T00:00:00Z)
SINCE=$( [ "$LOC" \> "$PUB" ] && echo "$LOC" || echo "$PUB" )
npm run --silent report -- --data ../fundamentals-tracker-data/progress.json --since "$SINCE" --check
```

- `newActivity: false` and this isn't the **daily review** (the first run after
  06:30 IST, when `state.json`'s `lastDailyReview` isn't today): reply
  "No new activity since <SINCE>." and **stop**. Don't install, build or analyse.
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
4. **Daily review with no data, or no weak topics.** Add 1–2 questions to the
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
- Verify technical claims. Don't add a question you aren't certain about.

### Escalate instead of doing it yourself

Send one short message to the owner's main session (Opus), and do only the
small, safe part yourself, when the right fix is bigger than a content tweak:

- a **new topic or domain** is needed, or an existing topic should be split;
- **3+ domains** are weak at once, so the curriculum or the assessment needs rethinking;
- the same question keeps being missed after its lesson was already improved;
- an app bug or a data problem (for example sync errors, or answers that don't match questions).

Use `send_message` to the session id given in your task prompt. Include the
report excerpt and what you'd change.

### 4. Commit locally, then hand off to publish

**Analyst (Sonnet):**

- Work on a local branch `routine/YYYY-MM-DD` from the latest `origin/main`.
- Make small commits, e.g. `content(databases): add write-skew scenarios`, and
  run `npm run check` before each one.
- Send the result to the Opus session with `send_message`: the PR title, the PR
  body (template below), and `git format-patch origin/main --stdout`. Messages
  are capped at 64 KB, so split a larger patch into numbered parts.
- If an open `daily-routine` PR exists, say so; the publisher adds to it.

**Publisher (Opus), on receiving a patch:**

- Review it as untrusted input: content only (`content/`, and `docs/` only for
  lesson-adjacent notes). Reject changes to code, workflows, `lib/`, `vault/`
  or tests.
- `git am` it onto a fresh `routine/YYYY-MM-DD` branch (or the open PR's
  branch), run `npm run check`, push the branch, and open or update the PR with
  the label `daily-routine`.
- Move the `routine-state` marker (step 5).

PR body template:

```markdown
## Routine · YYYY-MM-DD HH:MM IST (triggered by: new activity | daily review)

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

The analyst always writes its local marker, even when there was nothing to change:

```bash
echo '{"analyzedThrough":"<latestActivityAt from the check>","lastDailyReview":"<YYYY-MM-DD if this was the daily review, else the old value>"}' > /home/user/.analyst-state.json
```

The publisher moves the shared marker on the `routine-state` branch whenever it
publishes, so a fresh analyst container doesn't redo old work:

```bash
TMP=$(mktemp -d) && git worktree add -q "$TMP" origin/routine-state 2>/dev/null \
  || { git worktree add -q --detach "$TMP" && (cd "$TMP" && git checkout -q --orphan routine-state && git rm -rqf .); }
# write {"analyzedThrough": "<latestActivityAt from the check>", "lastDailyReview": "<YYYY-MM-DD if this was the daily review, else keep the old value>"}
(cd "$TMP" && git add state.json && git commit -qm "state: analysed through <timestamp>" && git push -q origin HEAD:routine-state)
git worktree remove --force "$TMP"
```
