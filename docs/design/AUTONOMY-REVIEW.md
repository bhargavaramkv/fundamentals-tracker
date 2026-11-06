# Autonomy review (2026-11-05)

An audit of what Fundamentals actually does today, why it still needs the owner to drive it, and the plan to make it run
itself. Everything below was checked against the code, the live data repo, the scheduled routines' run logs and GitHub
Actions history on 2026-11-05, not taken from the docs.

## 1. Current-state architecture

```text
Browser (static Next.js on GitHub Pages)
  localStorage ──merge──► fundamentals-tracker-data/progress.json   (fine-grained PAT, encrypted in vault/)
  reads mentor/current.json + state, mentor/coding.json             (same PAT)

Claude Code routines (owner's subscription, no API key)
  01:00 IST  nightly mentor   collect ► Claude writes proposal ► validator ► mentor/ in data repo   WORKS
  06:47 IST  daily run        analyse progress ► content PR to app repo ► routine-state marker       BROKEN (no repos attached)

GitHub Actions
  data repo   leetcode-pull.yml   LeetCode submissions (with code) ► leetcode/                       WORKS
  app repo    radar.yml (4×/day)  RSS/KEV ingest ► radar-data branch ► redeploy                     WORKS, AI step never runs (no key)
  app repo    leetcode-sync.yml   public profile ► leetcode-data branch                             WORKS, now redundant with leetcode-pull
```

Two "brains" decide what to do next and don't talk to each other:

| | Rule-based engine | Nightly mentor |
|---|---|---|
| Code | `lib/recommend.ts`, `lib/today.ts`, `lib/proficiency.ts`, `lib/srs.ts` | `lib/mentor/*`, `docs/mentor-routine.md` |
| Runs | In the browser, every page load | Once a night |
| Skill model | Topic score + 4 proficiency tracks | 4 dimensions × level 0-4 with cited evidence |
| Controls | Home (until the mentor passes its 5-night gate), Practice, Learn | `/mentor/` page only |
| Content it can use | The 72 static questions | Free-text activities; it can't add a single question |

## 2. Feature audit

| Feature | Status | Evidence |
|---|---|---|
| Quiz, assessment, per-question Leitner SRS | Working | 50 answers synced; `reviews` rebuilt on merge |
| Cross-device sync to the private data repo | Working | Commits from the browser on 10-28 and 11-05 |
| Content epoch (archived pre-rewrite answers) | Working | 27 archived answers excluded everywhere |
| Nightly mentor: collect / validate / commit / status | Working, but has never analysed anything | 5 runs: 1 bootstrap, 4 `no-new-evidence`. First real evidence (23 answers) arrived 2026-11-05 |
| Mentor plan | Misleading | Has said "talk to Claude on claude.ai for a diagnostic" since 2026-11-01; nothing in the app acts on it |
| Mentor 5-night gate for the home page | Working as designed | 4 of 5 nights, 0 analysed; tonight can pass it |
| Nightly LeetCode review (`mentor/coding.json`) | Working, genuinely useful | Real, specific review of 189 submissions |
| Daily content routine (questions and lessons via PR) | Broken | Routine `Fundamentals tracker · daily run` has no repositories attached; 2026-11-05 run found an empty `/home/user`. Last real review 2026-11-02 |
| Content PRs | Ineffective | PR #1 (3 good questions + an outbox section) has been open since 10-29. Content only arrives if the owner merges |
| Question bank | Too small to adapt | 72 questions, 3-4 per topic. Today's assessment re-served the same system-design questions as 10-28; a 10-question practice round exhausts a topic |
| Adaptive difficulty | Nominal | Easy-first ordering exists, but with ~1 question per difficulty per topic there's nothing to adapt between |
| "Answer in the app" submissions | Working, unused | 0 submissions |
| Mentor conversations on claude.ai | Working, unused | 0 conversations; needs the owner to open claude.ai and press enter |
| Exercises, practical self-ratings, manual coding log | Unused | `activities` 0, `codingProblems` 0; superseded by the LeetCode pull |
| Tech Radar ingest and ranking | Working | 4×/day, recent runs green |
| Tech Radar "AI analysis" | Never runs | No `ANTHROPIC_API_KEY` secret (correctly, given the no-API-billing rule), yet the workflow input defaults to `analyze: true` |
| Retention measurement | Missing | Nothing measures recall after a delay; "progress" is accuracy and counts |

## 3. Gaps

**Product**

1. The only actor that can create learning material (the daily routine) is broken, and even when it worked its output
   waited for a human merge. So the system can *decide* but can't *prepare*.
2. The mentor's plan isn't connected to the app. Practice ignores it, Home ignores it until the gate passes, and its
   first and only plan required leaving the app.
3. With 3-4 questions per topic, spaced repetition re-asks the same item and "avoid repeating without purpose" is
   impossible. Repeats also inflate scores (the answer is remembered, not understood).
4. No retention signal, so "am I improving?" can't be answered.
5. 6 of today's 23 counted answers took under 1.5 s. They're kept (never fabricate or drop data) and the packet already
   flags them as `fastAnswers`, but the UI doesn't discourage click-through.

**Technical**

1. Content is build-time only (`lib/content.ts`), so new questions need a commit to `main` plus a deploy.
2. Two skill models (proficiency tracks vs mentor dimensions) can disagree on screen.
3. Two LeetCode pipelines (`leetcode-sync.yml` here, `leetcode-pull.yml` in the data repo).
4. Routine failures that happen before a session starts can't report themselves (documented; `missedDates` covers it).
5. A routine misconfiguration (no repos attached) only surfaced as a phone notification.

## 4. Answers to the critical questions

1. **Why does it feel manual?** The planner had no hands. The nightly mentor had nothing to analyse, its plan pointed
   off-site, the content generator was broken, and its output waited for a merge. What the app could serve on its own
   was a fixed bank of 72 questions you'd mostly already seen.
2. **Incomplete, misleading or ineffective:** the daily run (broken), the content PR loop (stalls), the mentor
   diagnostic plan (off-site), Radar's analysis toggle (never runs), the exercise and coding logs (unused), and adaptive
   difficulty (not enough items to adapt).
3. **What blocks autonomy:** learning material can only change through `main`. Fix that and the rest follows.
4. **Ideal workflow:** you open the site (or don't) → Home shows today's set, already prepared → you answer, 15-30 min →
   answers sync → 01:00 the mentor grades, updates the profile with cited evidence, writes fresh targeted questions into
   the data repo, picks tomorrow's focus → the morning page shows what changed and why. You never pick a topic.
5. **Daily, nightly, continuous:**
   - Continuous, in the browser, deterministic: SRS due items, practice set selection, difficulty step, retention stats.
   - Nightly, in the Claude routine: grading, evidence, profile, misconceptions, roadmap, question generation, LeetCode review.
   - Daily, in Actions: LeetCode pull, Radar ingest. No second Claude routine is needed.
6. **Persistent understanding:** keep the existing evidence log + versioned learner states (append-only, validator-gated).
   That design is sound; it just never had data. The generated question bank becomes part of that state.
7. **Measuring real improvement:** deterministic, from answers only: (a) delayed recall, meaning accuracy on items
   answered again 3+ days after a previous attempt; (b) first-sight accuracy on never-seen questions per topic over
   time (fresh generated items make this meaningful); (c) mentor dimension levels, which only move on cited evidence
   from 2+ sessions; (d) LeetCode first-try acceptance in the `form` window.
8. **Cheapest architecture:** what exists. Static Pages + private data repo + one nightly subscription routine +
   Actions. No Worker, no database, no API key. Question generation adds output tokens to a run that already happens.

## 5. Proposed architecture

```text
             ┌──────────────── browser (continuous, deterministic) ────────────────┐
answers ───► │ progress.json ◄─ sync ─► data repo                                   │
             │ question pool = static bank (72) ∪ mentor/questions.json (generated)  │
             │ practice set = due reviews ► weak/shaky topics (unseen first) ► rest   │
             └───────────────────────────────────────────────────────────────────────┘
                                         │ nightly 01:00 IST
                                         ▼
             collect packet (+ question-bank coverage per skill)
             ► Claude: grade, evidence, profile, plan, and up to 12 new questions on tonight's gaps
             ► validator (existing rules + question rules: shape, 4 options, length tell, unique id/prompt, known topic)
             ► append to mentor/questions.json (immutable, append-only) + new state
             ► site picks the questions up on next load, no deploy
```

Rules for generated questions:

- Immutable once published. A fix is a new id. Old answers keep pointing at the text they were given (`selectedText`).
- Only real topics, exactly 4 options, explanation required, no length tell, no duplicate prompt.
- Every question states why it was written (`why`), citing evidence ids when they exist.
- They're scored like any other answer, so a bad question shows up as a repeated miss with odd picks, and the mentor sees it.

## 6. Roadmap

| Phase | What | Why first | Size |
|---|---|---|---|
| 0 | Re-attach both repos to the daily-run routine; merge the PR #1 content | Restores what's documented, costs nothing | S, done in this session |
| 1 | Nightly generated questions in the data repo, served by Practice, Today and topic workspaces without a deploy | Gives the planner hands: the core autonomy gap | M, this session |
| 2 | Retention metrics (delayed recall, first-sight accuracy) on Home and Learn | Answers "am I improving?" with real numbers | S-M |
| 3 | Make the mentor plan drive Practice: a "today's set" chosen from its focus skills | One brain instead of two | M |
| 4 | Retire the daily content routine once Phase 1 has run for a week; drop `leetcode-sync.yml` if `leetcode-pull` covers the Coding page; default Radar `analyze` to off | Fewer moving parts, less quota | S |
| 5 | Slow-answer nudge: answers under 2 s ask "sure?" (not blocked) | Data quality | S |

## 7. Cost

No new money. Everything runs on the existing Claude subscription and free GitHub Actions/Pages.

- The nightly run already happens. Generating up to 12 questions adds roughly 4-8k output tokens to it, about the size of
  the existing coding review. No extra routine runs.
- Phase 4 removes a daily Opus/Sonnet routine run, which saves more subscription usage than Phase 1 adds.
- The site reads one more small JSON file per load with the existing token.

## 8. Files

| Phase | Files |
|---|---|
| 1 | `lib/mentor/questions.ts` (new: types, validation, merge), `lib/mentor/types.ts` (proposal field, prompt version), `lib/mentor/run.ts` (keep questions out of the state), `lib/mentor/packet.ts` (bank coverage fact), `scripts/mentor.ts` (load + append), `lib/mentor/client.ts` + `components/useQuestionPool.ts` (load in browser), `components/PracticeRunner.tsx`, `components/Dashboard.tsx`, `components/TopicWorkspaceView.tsx`, `docs/mentor-routine.md`, `tests/mentor-questions.test.ts` |
| 2 | `lib/retention.ts` (new), `components/Dashboard.tsx`, `components/LearningPath.tsx` |
| 3 | `lib/recommend.ts` (`buildPracticeSet` takes focus skills), `components/mentor/MentorPage.tsx` |
| 4 | routine config, `.github/workflows/leetcode-sync.yml`, `.github/workflows/radar.yml`, `docs/daily-routine.md` |
