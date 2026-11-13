# Stage B: concept evaluation and selection (Opus)

Mockups: `concepts/a/shots/`, `concepts/b/shots/`. Both were reviewed at 1440 and 390.

| Criterion | A, Mission Control | B, Horizon |
|---|---|---|
| Visual quality | Rich, atmospheric and polished. The horizon arc and glow on the hero and CTA give depth without noise. | Very elegant typography and calm, but the screens feel empty below the fold. The atmosphere is a single line. |
| Usability | Everything for the day sits on one screen. The three-pane Journal lets you browse and read without losing your place. | Strong focus mode for writing. Today needs scrolling to reach the things that need attention, and the Journal index-to-detail flow is a page swap. |
| Readability | Good. The Journal document column is about 500 px, which is a little narrow. | Excellent long-form reading at 720 px, with mono date gutters. |
| Hierarchy | Clear focal hero, then insight and next up, then lists. Panel sizes are asymmetric, which avoids a wall of cards. | Strongly typographic. The hierarchy relies on scale alone, so status and attention items are under-weighted. |
| Consistency | One panel language across screens. Extends naturally to Knowledge, Coding and Settings. | The editorial language is harder to apply to data-heavy Coding and Knowledge without inventing new patterns. |
| Fit with the brief and references | Matches the owner's reference images (command centre, three-part journal). | Structurally different from the references. |
| Feasibility | High. It maps onto existing data hooks (useJournal, useMentor, concepts, coding). The sidebar is kept but rebuilt. | Medium. Margin annotations need measured layout. The sliding segmented nav and ⌘K search are new features. |

**Choice: A**, adopting three strengths of B:
1. **Journal reading typography from B:** a mono time gutter, prose-sized notes (16–17 px, line-height 1.6) and a wider document column. The centre pane gets more width, and the context pane collapses below 1280.
2. **Focus mode from B for the active session on mobile:** a full-screen writing canvas, the timer in the top bar, and a borderless composer. On desktop the active session stays inside A's three-pane layout.
3. **B's horizon line:** a thin luminous rule under the page header on secondary screens (Knowledge, Coding, Mentor, Settings), so only Today carries the big arc.

**Corrections to A before building:**
- **Today's hero CTA:** "Resume" or "Start session" plus "Open journal". The "Edit objective" button is dropped from the hero; editing happens in the Journal.
- **Labels:** use "Latest review" wording, never a person's name or a day abbreviation that reads as a name ("Mon's review").
- **Knowledge counts** come from real concepts. When there is no data, the panel shows an honest empty state instead of zeros.
- **Active timer ring:** shows a slow ambient sweep, labelled ACTIVE TIME. It must not suggest a goal.
- **Mentor insight panel:** the empty right side gets the review's first verification question as a quiet secondary line, not decoration.
- **Real data only:** no invented goals, streaks or targets. Empty, loading and error states are designed for every panel.
