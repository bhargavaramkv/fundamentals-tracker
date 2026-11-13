# Concept B: Horizon

Editorial, focus-first, no sidebar, no card walls. Typography and whitespace carry the design; the only atmosphere is one luminous cyan/blue horizon line under the top bar and a faint dot grid fading out from the top.

Files: `today.html`, `journal.html`, `journal-detail.html`, `journal-active.html`, shared `b.css`. Screenshots are in `shots/` (`*-1440.png` viewport, `*-1440-full.png` full page, `*-390.png` full page, `*-390-vp.png` mobile viewport, which shows the floating bottom nav in its real position). Static HTML, Geist and Geist Mono from Google Fonts, inline SVG icons only.

## Philosophy
Pages read as a narrative, not a dashboard. One idea per horizontal band, separated by hairlines and large gaps. Colour is rationed: cyan marks "now" and mentor voice, blue marks actions, amber/red/green appear only as status.

## Navigation and hierarchy
- Slim 56px top bar, max width 1120: wordmark (exact BrandMark: Geist semibold, tight tracking, accent dot), centred segmented control (Today, Journal, Knowledge, Coding) with a sliding pill, and utilities on the right: search (command-K), sync dot, Mentor (sparkle), Settings (gear). Mentor and Settings are never tabs.
- Mobile: top bar shrinks to wordmark plus icons; the segmented control becomes a floating bottom pill bar.
- Focus mode (active session) replaces navigation with wordmark, a running-timer pill and End.

## Composition
**Today**: mono date eyebrow, 64px headline (counts + mentor's one-line take in cyan), the "Now" band (subject and objective, big mono timer or last-session line, Start/Resume), the week ribbon (7 columns, dots sized by minutes with subject initials, today marked by the horizon colour, total at right), two borderless text columns (Needs attention with status glyphs; Recently with a mono date gutter), a mentor pull-quote with cyan rule and links, and a one-sentence knowledge summary with an inline four-level meter. Mobile: stacks; the ribbon becomes a 7-dot strip.

**Journal**: large title, underline search, subject text tabs, sessions as a table of contents with a sticky mono date gutter per day. Right side shows minutes, topics, review status (reviewed, queued, failed). Hover (shown on the first row) reveals a preview line.

**Session detail**: 720px reading document: topics as small-caps markers, notes as prose, difficulties with an amber margin rule, bookmarks as time-stamp chips, and the review as margin annotations in the right gutter, aligned to the notes they reference (understood, misconception, missing concept). Below 1180px the annotations collapse inline under their note. Ends with "What I learned" and the review summary, next steps and Discuss / Review now links.

**Active session**: centred writing canvas, continuous entries, large borderless composer fixed at the bottom with a text-style kind switch (Note, Topic, Difficulty, Bookmark) and photo glyph; history is a left slide-over drawer, shown closed as a small handle.

## Differences from the current UI
No sidebar or tab chrome; one primary column; the week and review state are expressed as prose and a ribbon rather than panels; the journal is an index document rather than a list of cards; reviews live beside the notes they judge.

## How the rest would follow
- **Knowledge**: a long document per subject; concepts as rows with an inline four-segment level bar, needs-reassessment and due-for-verification glyphs, evidence expanding inline (source, strength).
- **Coding**: same index pattern as Journal (date gutter, problem in large type, difficulty and pattern tags at right) with the nightly review as a pull-quote plus observations.
- **Mentor**: opens as a right-side reading sheet from the sparkle button (latest review, weekly coaching in "coaching" or "activity only" form).
- **Settings**: a centred single-column page of text sections with underline fields; no sidebar.

## Known weaknesses
- The segmented control is exactly four items wide; a badge for "attention" counts is not designed.
- Active-session mobile has no visible history drawer handle (hidden to protect the canvas).
- Margin annotations use fixed offsets in the mockup; a real build needs measured alignment and collision handling.
- Geist loads from Google Fonts; offline it falls back to system sans.
