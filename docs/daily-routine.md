# Daily improvement routine

This is the playbook the scheduled Claude task follows once a day. It is kept in
the repo so it can be reviewed and changed like code. The scheduled task's
prompt just says "follow `docs/daily-routine.md`".

## Hard rules

1. **Never push to `main`.** All changes go through a pull request.
2. **Never modify or delete progress data.** The data repo
   (`bhargavaramkv/fundamentals-tracker-data`) is read-only for this routine.
   Don't push to it, open PRs against it, or rewrite it.
3. **Never delete or renumber existing question IDs.** Answers in the progress
   file reference them. To fix a broken question, edit its wording or
   explanation. If the change alters what the question tests, add a new question
   with a new ID instead.
4. **No secrets in the repo.** Access comes from the session's GitHub
   connection, not from tokens in files.
5. `npm run check` (lint, typecheck, tests, build) must pass before every commit.

## Steps

### 1. Get the repos

- Attach `bhargavaramkv/fundamentals-tracker` with push access and
  `bhargavaramkv/fundamentals-tracker-data` with read access, then clone both.
- If the data repo or `progress.json` doesn't exist yet, continue with empty
  progress. The report handles that.

### 2. Analyse progress

```bash
npm ci
npm run --silent report -- --data ../fundamentals-tracker-data/progress.json
npm run --silent report -- --data ../fundamentals-tracker-data/progress.json --json
```

The report says whether there was practice in the last 24h, days since last
activity, weak topics, repeatedly missed questions (with the wrong options that
were picked), untested topics and reviews due.

### 3. Decide what to improve (keep it small)

Work on at most **3 topics** per run, in this priority order:

1. **Repeatedly missed questions** (missed 2+ times). Look at the wrong picks:
   they show the misconception. Sharpen the explanation so it addresses that
   misconception directly, and add a short section to the topic's lesson that
   covers it.
2. **Weak topics.** Add 2–3 new questions per topic that approach the concept
   from a different angle (a scenario, a code snippet, "what breaks if…"), with
   mixed difficulty. Improve the lesson where the misses suggest a gap.
3. **No data, or no weak topics.** Add 1–2 questions to the topic with the
   fewest questions, or deepen a lesson. Stay at interview and real-work
   level for a full-stack C#/.NET, Angular, TypeScript, MongoDB and Kubernetes
   engineer.

Content conventions:

- Keep the app's tone: Marvel / J.A.R.V.I.S. flavour in UI copy and PR summaries,
  but lessons, questions and explanations stay plain and technically precise.
- Questions live in `content/questions/<domain>.json`, with the next free ID
  `<domain>-<topic>-<n>`. Write 4 options, one clearly correct, with plausible
  distractors. Explanations say why the answer is right *and* why the tempting
  wrong answer is wrong.
- Lessons live in `content/lessons/<domain>/<topic>.md`, with quoted `title`
  and `summary` frontmatter. Keep them short and scannable: tables, small code
  samples, "when it breaks".
- A new topic needs a lesson and at least 3 questions (the tests enforce this).
- Verify technical claims. Don't add a question you aren't certain about.

### 4. Branch, commit, PR

- If an open PR with the `daily-routine` label already exists, add commits to
  its branch and update its description instead of opening another.
- Otherwise create `routine/YYYY-MM-DD` from the latest `main`.
- Make small commits, e.g. `content(databases): add write-skew scenarios`.
- Run `npm run check` before each commit.
- Open the PR with the label `daily-routine` (create the label if it's
  missing), using this body:

```markdown
## Daily routine · YYYY-MM-DD

**Activity:** practiced in last 24h: yes/no · last active: … · streak: …

> J.A.R.V.I.S. nudge (only if 2+ days inactive), in the app's Marvel / J.A.R.V.I.S. voice: …

**What I saw:** weak topics, repeated misses, and the misconception each one suggests

**What changed:**
- lessons: …
- questions: +N (ids …), explanations improved: …

**Next focus:** …
```

- If there is truly nothing meaningful to change, don't open a PR. End the
  run with the report summary instead.
