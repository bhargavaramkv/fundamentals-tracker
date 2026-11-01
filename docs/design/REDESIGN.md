# Redesign: a learning platform, not a dashboard

The current design and its reasoning. This takes precedence over `HLD-v2.md` and `UX-UI-LLD-v2.md`, which are kept for history.

## Navigation

| Section | Route | What's there |
|---|---|---|
| Today | `/` | Daily plan, revision reminders, proficient topics, recent activity, three radar stories |
| Learning Path | `/learn/` | 20 topics in suggested order, with level and evidence per topic |
| Coding | `/coding/` | LeetCode history, notes, retry dates, weak patterns |
| Tech Radar | `/radar/` | Briefing, all stories, weekly roundup, monthly archive |

Practice and assessment moved into topic workspaces at `/learn/<domain>/<topic>/`, with four tabs (`?tab=`): Read, Practice, Exercises and Check.

These stay as secondary routes, reached from the sections above:

- `/practice/`: mixed review from Today's plan, plus the warm-up.
- `/assess/`: the cross-domain baseline.
- `/fun/`: the fun corner.
- `/settings/`: sync, backup and account.

Old links keep working. `/lessons/...` and `/practice/?topic=...` forward to the workspace in the browser, because a static export can't send server redirects.

## Learning model

### Evidence tracks

Four tracks are stored and shown separately (`lib/proficiency.ts`):

| Track | Comes from |
|---|---|
| Reading | Lesson time (20+ visible seconds, unchanged), and sources marked as read |
| Quizzes | Answers, with the existing recency and difficulty weighting |
| Exercises | Written retrieval prompts, self-graded against a model answer. The latest rating per exercise wins |
| Practical | Hands-on tasks with a note, or 2 unaided solves of coding problems mapped to the topic |

### Proficiency

Reading can't raise a level on its own.

| Level | Needs |
|---|---|
| Reading only | Any reading, no retrieval |
| Practising | Any quiz, exercise or practical evidence |
| Developing | 3+ answers at 60%+ |
| Proficient | 3+ distinct questions at 75%+, an interview-level question right, an exercise answered well |
| Mastered | 85%+, a hard question right, every exercise answered well, practical evidence, more than one day |

Each topic lists what's missing for the next level. Quiz scores decay with the existing 21-day half-life, so a level can drop.

### Spaced repetition

There are two schedules, doing different jobs:

- **Questions (`lib/srs.ts`, unchanged):** Leitner boxes that bring back what you got wrong.
- **Topics (`topicRevision`, new):** intervals of 1, 3, 7, 14, 30 and 60 days that bring back what you got right before it fades. A day at 70%+ moves up a step, but only once at least half the current interval has passed, so cramming doesn't help. A failed day moves back two steps. Reading never schedules or advances a revision.

The topic schedule is replayed from evidence on every read. Nothing is stored, so two devices can't disagree about it.

### Daily plan (`lib/today.ts`)

The plan is worked out from what was true at local midnight, so finishing a task marks it done instead of replacing it. Today's own records only decide what's done. It holds at most four tasks, in this order:

1. Questions due for review.
2. Topics due for revision.
3. The next step on the recommendation engine's top topic.
4. A coding problem due for a retry.

## Sources and provenance

- **Registry:** `content/resources/registry.json`. Each entry has a source type, publisher, URL, reliability tier and verification date. Validation is in `lib/resources.ts` and enforced by tests.
- **Tiers follow the source type and can't be overridden:**
  - Tier 1, authoritative: standards, official docs, university material.
  - Tier 2, established: books, established guides.
  - Tier 3, supplementary: blogs, videos.
- **A date means the page was fetched.** `npm run resources:verify` fetches every link and reports its title. `--write` stamps only those that loaded. Sites that refuse automated requests keep their old date. Links show "due for a re-check" after 180 days.
- **Nothing is written from memory.** Every entry was fetched and its page title reviewed before being added. One candidate that returned 404 was dropped rather than guessed at.
- **AI content is labelled wherever it appears:** lesson explanations, model answers, quiz explanations and radar analysis. Sources always come before the AI explanation.

Lessons, questions and exercises are AI-written and have not been checked line by line against the sources. The label says so.

## Coding: why tracking is manual

Tested on 2026-11-01. `POST https://leetcode.com/graphql` answered from a server, with no `Access-Control-Allow-Origin` header, and `OPTIONS` returned 405. So:

- A browser on GitHub Pages can't call it.
- It's undocumented, so it could change without notice.
- Full submission history needs the account's session cookie, which must never reach frontend code.
- A scheduled job could fetch the public "recent accepted" list, but that's a short unofficial list with no notes, no sign of whether help was used, and possible blocking.

Whether you solved a problem unaided is the most useful signal here, and only you can record it. So entry is manual and quick: paste a link or type a name. A link is stored only if you gave one; it's never guessed from a title.

## Data compatibility

`ProgressData` keeps `version: 1` and gains `activities`, `codingProblems` and `codingAttempts`.

- Old files load with those fields empty. Existing IDs, timestamps, sessions and reviews are untouched.
- `activities` and `codingAttempts` are append-only unions by id, like answers.
- `codingProblems` can be edited, so the newest `updatedAt` wins. Removal is a soft delete, so it survives a merge with a device that still has the problem. Problem ids come from the LeetCode slug, so adding one on two devices merges them.
- `lib/storage.ts`, `lib/auth.ts`, `lib/vault.ts` and the login vault weren't changed.

**During the first rollout:** a tab still running the old code doesn't know the new fields, and could drop them from the synced file when it saves. Reload open tabs after deploying. Another device's local copy merges the records back on its next save.

## Visual design

An editorial layout: a serif (Newsreader) for headlines, Geist for everything else, hairline rules instead of cards, and colour kept for links, primary actions and status.

- **Removed:** the dot grid, skill path, progress ring, chamfered button and emoji.
- **Kept:** the wordmark and its accent dot, exactly as they were.
- **Motion:** one short fade on page arrival and small hover changes. All of it is off under `prefers-reduced-motion`.
- **Accessibility:** `tests/design.test.ts` checks the tokens against WCAG AA in both themes, and fails on `backdrop-filter` or gradients. Status is always text as well as colour.

## Testing

- **Unit (`npm test`):** proficiency, revision scheduling, coding, the plan, merge compatibility with old files, registry rules, radar clustering and contrast.
- **Browser:** run during this work, not added to the repo, to avoid a new dependency. It ran against a throwaway static build under the Pages base path, with a test login and GitHub mocked. It covered sign-in, old-data loading, every section, backup and import, sync, sync failure, live feed and feed failure, old links, 320 to 1440px layouts and dark mode.
