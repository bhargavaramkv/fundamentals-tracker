# Visual audit: ddf0be1 (original) vs a7ecac3 (current)

The audit compares the original build (`ddf0be1`) with the current one (`a7ecac3`).
- **Data:** both builds were captured with the same synthetic data (`e2e/fixtures/`, synced mode, mocked GitHub).
- **Screenshots:** 375, 768, 1280 and 1600 wide, full page. They are in `../fundamentals-v2-screenshots/audit/{old,current}/<screen>-<width>.png`, outside the repo.
- **Review:** Opus reviewed them at 1280. Mobile was checked for structure only.

## Overall verdict
**Shell:** the current build is the same as the original.
- A 240 px sidebar with 4 items, and a footer containing only a sync dot and a settings icon.
- A plain top bar plus a 4-item tab bar on mobile.
- No atmosphere, and Mentor is only reachable through text links.

**Palette:** practically identical.

**Every screen** has the same problems:
- Content is either a single stack of identical rounded boxes or plain text lists.
- No focal point.
- Weak hierarchy: H1 at 32 px, then body text.
- Status is shown as small text.
- About 40% of the width at 1600 is empty.

## Today
- **Original:** "Good morning!", a start-session card with recent subjects, a lesson card (Big-O), a review card, and a streak card. V1 features.
- **Current:** a small "Ready when you are" strip; recent activity as a plain table; a week chart; a long left-ruled Mentor text block (queued, latest review, weekly, due) that becomes the bulk of the page.
- **Weak points:**
  - There is no hero, so the page doesn't say where you left off; it says "Start a session" even when the last session was an hour ago.
  - Mentor information is a wall of text at the bottom.
  - The week chart is the only visual.
- **Structural change:**
  - A command-centre composition: a hero for "Continue where you left off" (or the running session), with this week's ring.
  - A right column with the week chart and the knowledge level bar.
  - A Mentor insight panel with an accent headline, plus a "Next up" stepper (finish session, review 06:15, weekly on Monday, verification due).
  - Recent activity with status pills, and a "Due for verification" list.
- **Must keep:** session start/resume, recent sessions linking to the detail, mentor links, the queued-review count, and the empty and no-sync states.

## Journal
- **Original and current:** almost identical.
  - A "Start a session" form fills the left half when idle, leaving about 60% of the page empty below it.
  - History is a narrow right rail of stacked rounded cards.
  - The current build adds search and two selects.
  - The session detail is a separate page with a card-per-event timeline.
- **Weak points:**
  - It's a CRUD form plus a list.
  - Reading a past session means leaving the list.
  - Notes are rendered as boxed cards, not as a document.
  - Every history item is a separate card with a status chip, which makes it noisy.
- **Structural change:**
  - A three-pane workspace: a session list with search, chips and grouping, plus "New session".
  - The selected session shown as a document, with a mono time gutter, prose notes, inline topic chips, amber difficulty callouts and bookmarks with times.
  - A context pane with stats, review status, understood and incomplete findings with quotes, verification questions and "Discuss".
  - New session becomes a compact composer in the centre pane, not a full-page form.
  - The active session shows a timer ring and composer in the centre. On mobile it uses full-screen focus mode.
- **Must keep:**
  - Session start/pause/resume/end, the end-of-session "What I learned" reflection, note/topic/difficulty/bookmark entries, edit with the original kept.
  - Metadata edit, discard, photos, sync status and Sync now, the conflict panel, filters, search, show discarded, the review panel, and every accessible name the e2e tests use.

## Knowledge
- **Current:** a flat list of 35+ identical full-width rows with tiny 4-dash meters, a filter row and a legend at the bottom. Its length dominates the page.
- **Weak points:**
  - No overview: you can't see strengths and weaknesses at a glance.
  - Grouping by subject is lost.
  - Reassess and Due badges are tiny.
- **Structural change:**
  - A summary hero: level distribution (the 4-level bar and counts), "needs attention" (reassess and due), and per-subject mastery bars.
  - Concepts grouped by subject in compact multi-column groups, with clear level glyphs.
  - Selecting a concept opens a detail drawer or panel with "why this level", the evidence list with source and strength, and history.
- **Must keep:** search, subject and level filters, the reassess and due filters, the why/evidence content, and the explanation of levels.

## Coding
- **Current:** strong content, but presented as a long two-column text document. Numbers are plain text, and the "Last 12 problems" squares are the only visual.
- **Weak points:** no identity, the headline isn't framed, the stats don't read as stats, and the sections run together.
- **Structural change:**
  - A header band with Claude's read as the hero (headline, trend pill), and a stat strip (solved, first-try, tries per solve, active days) with mono numerals.
  - A pattern map (weakest topics as horizontal meters, plus never-passed problems).
  - A recent-problems strip.
  - "Do next" and "Work on" as numbered action cards, and habits as callouts.
  - The detailed sections (problem by problem, hardest, edge cases, full reasoning) stay as an accordion.
- **Must keep:** all coding-review content, links to the problems, the expandable details, and the empty and no-sync states.

## Mentor
- **Current:** the weekly report is a single long box, with all sections as uppercase labels and paragraphs. Recent reviews are a plain list, then the V1 archive.
- **Weak points:** it's a document dump. Weekly priorities don't stand out, and the reviews can't be scanned.
- **Structural change:**
  - Week selector and header.
  - Priorities as the hero.
  - Improved, weak, misunderstandings, revisit and learn-next as a compact two-column grid of labelled groups with session links.
  - Follow-up on earlier recommendations as a checklist with followed yes/no/unclear.
  - Reviews as a timeline list with subject chips, linking to the session.
  - The V1 archive stays collapsed at the end.
- **Must keep:** the activity-only treatment, the safe markdown archive, and the links to sessions.

## Settings
- **Current:** a single column of text-heavy sections (Storage, Sync, Backup, Account), with long paragraphs and full-width inputs. Untouched since V1.
- **Structural change:**
  - A sectioned utility page: a left section index (Account, Sync and data, Backup, About) on desktop.
  - Each section is a panel with a short description, a status row (sync state, last sync, repo) and actions aligned right.
  - Long explanations are tucked into "Learn more".
- **Must keep:** token setup and test, the shared-token password, export and import, sign out, and every e2e label.

## Shell
- Desktop sidebar: wordmark, 4 primary items with a glowing active indicator, and a utility zone at the bottom with Mentor, Settings and a sync card.
- Tablet: a 72 px icon rail.
- Mobile: a top bar with Mentor and Settings icons, and the bottom tab bar.
- Atmosphere: the horizon arc on Today, and a thin horizon rule on secondary pages.
