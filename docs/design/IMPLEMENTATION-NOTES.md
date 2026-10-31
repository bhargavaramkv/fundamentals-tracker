# Redesign implementation notes

Decisions made while implementing LLD/HLD v2 where the spec conflicted with the code or left a gap.
The rule applied each time: preserve current behavior and data, and document the gap.

## Conflicts resolved
| Spec | Code reality | Decision |
|---|---|---|
| LLD 7.4: Previous/Next, editable answers, correctness hidden until the end | Assessment reused practice behavior: immediate feedback, one locked answer | **Implemented (owner-approved).** Assessment only: no feedback until results, Previous/Next (← key), answers changeable. Stored records are unchanged in shape: one `AnswerLog` per answered question holding the final choice; `timeMs` = time on that question across visits up to the final choice. Practice is unchanged. |
| LLD 6: dashboard failure state + retry | `GitHubStore.load()` already falls back to the local copy and never throws | No provider change. A failed remote read shows local data; a failed save shows "Sync error" in the header and Settings (existing). |
| LLD 6: skill path "connected toward a goal marker" | Domains have no order or unlock sequence | Nodes follow content order and are all open. Each node links to that domain in Lessons and shows its real score, confidence, answers and topics, or "not tried". The goal marker is the engine's next recommended topic (or the baseline assessment on first visit). |
| LLD 7.12: confirm destructive progress reset | No reset feature exists | Nothing added. Settings shows the live sync state. |
| LLD 5: Fun Corner + Settings in secondary navigation | Fun Corner had no nav link | Desktop: added to the header nav. Phones: bottom bar = Home, Practice, Assess, Lessons, News; Fun Corner and Settings are header icons (the Settings icon turns red on sync error). |
| HLD 5: cinematic mountain/hiker artwork | Asset is not in the repo | No raster used. A faint SVG ridgeline rising to the goal sits behind the skill path (sm+), and the hero gets a CSS dot grid. A real artwork file can replace the ridge later. |
| LLD 7.2/7.7: search and filters | About 68 questions, 20 topics, 2 stories | Not added; the content volume doesn't justify them. |

## What changed
- **Tokens** (`app/globals.css`): dark theme moved to the blue-black palette from the LLD. Light theme is unchanged. New `--accent-text` for accent-coloured text that passes AA in both themes. Dark domain colours were re-tuned for the new background.
- **Buttons**: the primary button is now the chamfered outline (two clipped pseudo-layers, so the focus outline isn't clipped) with a 3px arrow shift on hover. The secondary button is a quiet outline. No gradients.
- **Surfaces**: cards are mostly replaced by `section-head` hairline headings. New classes: `eyebrow`, `tag` (status = text + colour) and `hero-grid`. There is one global `:focus-visible` style.
- **Shell**: content width 1152px (`max-w-6xl`). The active route is shown by an underline instead of a pill.
- **Dashboard**: hero, then the skill path strip, then a two-column layout: focus list and chart on the left; gaps, strengths and news on the right. Shape skeleton while loading. All values come from `recommend()` and `computeActivity()`.
- **Assessment**: list of previous attempts (from existing sessions). The results page states that a baseline is not a verdict. Each review item links to "drill".
- **Quiz**: focused 3xl column, option states with ✓/✗ text, `role="status"` feedback. While answers are unsaved, reload/close and in-app link clicks ask for confirmation.
- **Lessons**: hairline rows grouped by domain with `#domain` anchors, a breadcrumb, and a "Practice this topic" link at the end.
- **News**: an editorial list. External source links are labelled for screen readers.
- **Login**: show/hide password, the rejected password is cleared, and the error is tied to the fields.

## Untouched by design
`lib/recommend.ts`, `lib/profile.ts`, `lib/srs.ts`, `lib/storage.ts`, `lib/progress.ts`, `ProgressProvider`, `lib/auth.ts`, `lib/vault.ts`, `lib/login-vault.json`, routes and content. The BrandMark component is unchanged; in dark mode its dot uses the re-tuned accent (#3987e5 → #3b9bff).

## Open follow-ups
- Browser back/forward during a running round isn't intercepted (links, reload and tab close are).
- Swap the SVG ridge for commissioned artwork if one is produced.
