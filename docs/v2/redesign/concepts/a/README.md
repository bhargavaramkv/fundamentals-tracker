# Concept A: Mission Control

Static mockups (`today.html`, `journal.html`, `journal-active.html`, shared `style.css`; open via file://). Screenshots in `shots/` at 1440x900 and 390 wide (full height). Extras: `today-full-desktop.png`, `journal-detail-mobile.png` (the detail half of Journal's list-to-detail flow, via `journal.html#detail`).

## Philosophy
A calm command centre. Deep midnight base, one luminous horizon arc behind the Today headline, hairline borders, and glow reserved for exactly two things: the primary call to action and the active progress ring. Everything else is quiet, so the one thing you can do next reads instantly. The sci-fi comes from atmosphere (arc, radial light, mono timers), never from decoration on every card.

## Navigation and hierarchy
- Left sidebar, 240px: wordmark (copied from `BrandMark`: Geist semibold, tight tracking, accent dot), then exactly four primary destinations (Today, Journal, Knowledge, Coding). Active item is a navy pill with a 2px electric-blue indicator and soft glow.
- Utility zone below a hairline: Mentor, Settings, and a compact sync card. Neither utility item is a fifth tab.
- Mobile: the sidebar becomes a bottom tab bar with the same four items; a top bar carries the wordmark plus Mentor and Settings icons. Active session hides the tab bar and uses a sticky Pause / End / Add note bar.

## Today
12-column asymmetric grid, three rows, deliberately unequal:
1. Hero session panel (8 cols): continue-where-you-left-off, subject, objective, meta (source, topics, active minutes), glowing Resume plus a quiet secondary, and a large ring for "this week" (131 min, 3 of 7 days; real data, no target). Beside it (4 cols): per-day minutes bars (today highlighted) and the Knowledge level stack (Retained / Applied / Understood / Exposed).
2. Mentor insight (7 cols): one-sentence headline from the latest review with a cyan accent phrase, two-line explanation, Discuss in Claude (copies prompt) and View review. Next up (5 cols): vertical stepper (today's session, review 06:15, Monday coaching, verification due).
3. Recent activity (7 cols, with status pills Reviewed / Review queued / On this device) and Due for verification (5 cols, including needs-reassessment).

No streaks, XP, invented goals or avatars.

## Journal
Three-pane workspace inside one rounded frame: list (300px: search, filter chips, New session, grouped Today / This week / Earlier, sync dots), document (timeline read like a document: faint time gutter, cyan topic tags, amber-edged difficulty callouts, bookmarks with session timestamp, photo, "What I learned" block) and context (stats, review status with model, Understood / Incomplete with quotes, verification questions, Discuss). Mobile is list then detail (context stacks under the document).

Active session: same frame, history pane dimmed, centre becomes the workspace: mono timer inside a thin cyan ring with halo, Running state, Pause / End, composer (Note, Topic, Difficulty, Bookmark chips; "Enter adds, Shift+Enter newline"; Camera and Library), newest-first live timeline. Right pane shows objective, topics so far and save state.

## Differences from the current UI
- A persistent app shell with a real sidebar, instead of page-by-page navigation.
- Today is a composed dashboard with one dominant action, not a list of equal cards.
- Journal reads like a document with a context rail, instead of stacked forms and cards.
- Weekly activity and knowledge become charts at a glance; sync state is always visible.
- A consistent atmosphere and type scale (display 52, h2 17-38, body 15, uppercase 11-12 labels).

## How the rest follows
- **Knowledge:** same three-pane pattern. Subject list left, concept document centre (level ladder Exposed to Retained, evidence list with source and strength), context right (due for verification, reassessment flag). The level stack from Today becomes the page header.
- **Coding:** left list of solved problems filtered by difficulty and pattern, centre problem detail, right the nightly AI review headline and observations; the ring/bars vocabulary shows solved per week.
- **Mentor:** opened from the utility zone as a two-pane view: Reviews / Weekly coaching list on the left, the selected review or coaching (priorities, improved, weak, revisit, learn next; "activity only" state) in the document pane; Review now / Discuss copy prompts.
- **Settings:** utility zone entry, a simple two-pane page (sections list, form pane) with sync status and conflicts at the top.
