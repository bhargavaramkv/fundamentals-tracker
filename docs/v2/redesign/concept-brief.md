# Redesign concepts: shared brief (Opus)

Two structurally different directions for the Fundamentals V2 redesign. Each is rendered as static HTML mockups of **Today** and **Journal** at desktop (1440×900) and mobile (390×844). The mockups are for selection only. They don't ship.

## Shared constraints (both concepts)
- **Logo, exact:** the wordmark is the text `Fundamentals` followed by a `.` in the accent colour.
  - Geist, semibold, tight tracking.
  - It is `components/BrandMark.tsx`; copy it exactly.
  - No icon mark: the "F" glyph in the reference images is a placeholder and must NOT appear.
- **Palette:**
  - Midnight navy: base about `#05080f` to `#070b14`, surfaces about `#0b1220` to `#0e1628`.
  - Electric blue `#3b9bff` as the primary accent.
  - Cyan `#22d3ee` as the restrained secondary accent.
  - Status: green `#34d399`, amber `#fbbf24`, red `#f87171`.
  - Never purple.
- **Type:** Geist and Geist Mono, from Google Fonts in the mockups. Large, confident display sizes, a clear hierarchy, generous spacing.
- **Atmosphere:** subtle sci-fi.
  - Achieve it with CSS and SVG only (radial light, a horizon arc, faint grid or noise, soft glows on key elements only). No raster images or photos. No mountains, because no images are allowed.
  - No glassmorphism everywhere, no glowing borders on everything, no generic SaaS card walls.
- **Navigation:** the primary destinations are exactly Today, Journal, Knowledge and Coding. Mentor and Settings are utility or contextual, never a fifth primary tab.
- **Real data only:** the content must be things the app actually has.
  - **Journal sessions:**
    - Fields: subject, source (Book, Course, Video, Article, Practice, Other), optional objective, active time, start date and status (active, paused, ended, discarded).
    - Events: note, topic, difficulty, bookmark (with an optional label and a timestamp in the session), photo, and a "What I learned" summary at the end.
    - Edits keep the original.
    - Sync status per session: on this device, synced, saving, conflict.
  - **Session review** (written each morning at 06:15 by a routine), with these fields:
    - summary
    - understood (with quotes from your notes)
    - incomplete
    - misconceptions
    - missing concepts (as questions)
    - next steps
    - verification questions
    - model
    - It also has "Review now" and "Discuss" buttons that copy a prompt for Claude Code.
  - A review can be "queued" or "failed".
  - **Weekly coaching** runs on Mondays. It is either "coaching" (enough evidence) or "activity only" (limited data). Fields: priorities, improved, weak, revisit, learn next.
  - **Knowledge:** concepts per subject with level Exposed → Understood → Applied → Retained, a "needs reassessment" flag, "due for verification", and an evidence list with source and strength.
  - **Coding:** LeetCode problems solved, with difficulty, tags or patterns, date, plus a nightly AI coding review with a headline and observations.
  - **Don't invent:** no streaks, no XP, no goals or targets the user never set (no "today's focus 45 min"), no avatars.
- **Fixed copy:** use plausible engineering subjects (HLD caching, consistent hashing, LLD rate limiter, DSA graphs, OS scheduling, DB indexes). Put a small "Concept mockup" label in a corner.

## Deliverables per concept (in `docs/v2/redesign/concepts/<a|b>/`)
- `today.html`, `journal.html` (responsive: the same file renders desktop and mobile), plus `journal-active.html` (a session in progress).
- `shots/`: PNGs of each page at 1440×900 and 390×844, captured with Playwright (chromium, `deviceScaleFactor: 1`; full page for mobile).
- `README.md`: philosophy, navigation and component hierarchy, how Today and Journal are composed, major differences from the current UI, and how Knowledge, Coding, Mentor and Settings would follow.
