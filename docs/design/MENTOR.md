# Autonomous mentor

Fundamentals is the interface to an engineering mentor that runs on the owner's Claude subscription, with no API billing or new infrastructure. This takes precedence over `REDESIGN.md` wherever they conflict, and it replaces the Cloudflare Worker and API design in the earlier proposal.

## How it works

```text
Answers, exercises, coding (progress.json)      ┐
Answers written in the app (mentor/submissions) ├─ private data repo ─► nightly routine ─► validator ─► mentor/ ─► site
Mentor sessions (mentor/conversations)          ┘
```

The cycle runs interaction, evidence, nightly analysis, profile update, plan update, dashboard, next-day learning.

| Part | What it is | Cost |
|---|---|---|
| Nightly analysis | One Claude Code routine, 1:00 AM Asia/Kolkata, following `docs/mentor-routine.md` | Claude subscription usage |
| Storage and sync | `mentor/` in the private data repo, reached with the existing sync token | Free |
| Site | The existing static export on GitHub Pages | Free |
| Conversation | Claude Code sessions on claude.ai, opened from the site | Claude subscription usage |

## Claude proposes, code decides

Claude only writes a proposal to a temp file. `npm run mentor -- commit` validates it (`lib/mentor/validate.ts`) and is the only thing that persists anything:

- It writes only under `mentor/`, and refuses to publish if the app repo or anything else in the data repo changed.
- Evidence is append-only. Each learner state is a new versioned file.
- `mentor/current.json` moves in the same commit as its state, so the site never sees a half-finished one.
- A rejected or failed run leaves the state and pointer as they were.

The site renders validated fields only, so Claude can change the plan without any code changing and without being able to change the code.

### Rules code enforces

- A quote must appear word for word in the learner's own text, so the mentor's own words don't count.
- Reading can't support a skill, and self-graded exercises don't count as proof.
- A level moves at most 1 per night and only with evidence from that night.
- A rise needs evidence from 2+ separate sessions. A fall needs 2+ contradictions.
- A first level above 1 needs more proof the higher it claims, so one good diagnostic can set a baseline but one answer can't.
- Skills can't be dropped or returned to untested.
- A plan has 1 primary and at most 2 supporting activities, each with a reason citing evidence or stating that none exists yet.
- Resources must come from the verified registry.
- Every submission gets feedback, and feedback can only be about real submissions.

## Learner model

Each skill has four separate dimensions: concept, problem solving, reasoning and practical. Each has a level, a confidence and its evidence. `null` means untested and is never the same as a low level. This is how the system tells knowing a concept apart from being able to apply it.

The 27 answers from before the question rewrite (`CONTENT_EPOCH`) stay in `progress.json` and appear in the packet as context. They can't be cited as evidence.

## Files

All under `mentor/` in the data repo.

| Path | Written by | Notes |
|---|---|---|
| `current.json` | Routine | Points to the last valid state |
| `status.json` | Routine | Last run, last success, nights in a row, missed dates |
| `states/<date>.json` | Routine | One version per analysed night |
| `evidence/<YYYY-MM>.jsonl` | Routine | Append-only |
| `processed.json` | Routine | Interaction keys already analysed |
| `runs/<runId>.json` | Routine | Execution history |
| `reports/<date>.md` | Routine | The night's validation report |
| `questions.json` | Routine | Generated practice questions. Append-only, immutable, validated by `lib/mentor/questions.ts`; the site merges them into Practice and topic pages |
| `submissions/<id>.json` | Site | Answers written in the app |
| `conversations/<id>.json` | Mentor session | Saved by the session itself |

Processed ids are used instead of a timestamp watermark, so an answer that syncs late from another device is still picked up.

## Reliability

| Situation | What happens |
|---|---|
| Already succeeded for this date | Stops without using any more of the allowance on analysis |
| No new interactions | Records `no-new-evidence`, and nothing about the learner changes |
| Validation fails twice, or a step breaks | Records `failed` with the reason and keeps the last valid state |
| Usage limit reached, outage or GitHub disconnected | No session runs, so nothing can report it. The next run and the site both notice the gap (`missedDates`, "No run reported") |
| Plan over 3 days old | Home falls back to the rule-based dashboard and says why |

Extra usage must stay off at claude.ai/settings/usage. When it's off and the limit is reached, Anthropic's docs say runs are rejected until the window resets. The routine has no API key and can't enable it.

## The five-night gate

The mentor runs alongside the existing system at `/mentor/`. `MentorStatus.primaryEligible` becomes true after 5 nights in a row of scheduled, successful runs with at least 1 real analysis. The site then shows the mentor as the home page, with no deploy needed. Daytime test runs don't count.

A run that finds no new work still counts as a success, because the process worked. The "at least one real analysis" condition stops five empty nights from passing the gate.

The daily reader and writer routines stay on until then. Retiring them is a separate step afterwards.

## Conversation: what's possible without API billing

An in-app chat with Claude isn't possible without separately billed API access, and subscription login can't be embedded in a website. So the site offers:

1. **Answer in the app.** A written answer is saved to the data repo and graded overnight. It costs no extra, and feedback arrives the next morning.
2. **Hand off to Claude Code on the web.** A button opens `claude.ai/code` with the prompt and data repo prefilled, signed in with the owner's own account. The data repo's `CLAUDE.md` makes that session the mentor: it reads the learner state, teaches, and saves the transcript for that night's analysis.

Limitations:

- Live discussion happens on claude.ai, not inside the site.
- The prefilled prompt needs one press of enter.
- A session must save its own transcript. If one is abandoned before saving, that part isn't analysed.
- Sessions and the routine share the subscription's usage limits.

## Limits to keep in mind

- Routines are a research preview, so behaviour and limits may change.
- The launch announcement gives Pro 5 routine runs a day. The current docs list no daily cap. The account already has 4 scheduled runs a day (daily reader, daily writer and 2 job digest runs), so this makes 5.
- A run can't detect its own quota failure, because no session starts.
- Grading is Claude's judgement. The validator stops unsupported claims, not every wrong opinion, so the evidence is shown for checking.
