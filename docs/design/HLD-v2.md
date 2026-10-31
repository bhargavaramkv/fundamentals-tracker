# Fundamentals Tracker — High-Level Design (HLD) v2.0

**Status:** Proposed implementation specification  
**Repository:** `bhargavaramkv/fundamentals-tracker`  
**Deployment:** GitHub Pages static export  
**Stack:** Next.js, React, TypeScript, Tailwind CSS

## 1. HLD objective and constraints

Treat the redesign primarily as a presentation and interaction-layer change. Preserve the existing architecture and business logic wherever possible.

| Constraint | Decision |
|---|---|
| Next.js, React, TypeScript, Tailwind | Continue using the current stack; no framework migration |
| GitHub Pages static deployment | Maintain static export and client-compatible routing; no new server-only routes/actions |
| Existing progress/recommendation logic | Consume current interfaces; do not duplicate calculations in components |
| Existing brand | Reuse the existing BrandMark without redrawing |
| Progress/sync | Keep current storage and sync behavior; UI reflects actual results |
| Performance | Prefer CSS/SVG; avoid a heavy animation dependency unless justified |

## 2. Logical architecture

```text
User
  |
  v
Next.js static-export application
  |
  +-- App shell / route navigation
  |     +-- BrandMark, Nav, responsive navigation
  |
  +-- Page composition
  |     +-- Dashboard
  |     +-- Practice / Quiz
  |     +-- Assessment / Results
  |     +-- Lessons / Lesson reader
  |     +-- News / Story detail
  |     +-- Fun Corner
  |     +-- Settings
  |
  +-- Shared UI system
  |     +-- Tokens, buttons, surfaces, domain markers
  |     +-- Skill path, progress, chart, feedback, empty/loading states
  |
  +-- Existing domain logic (preserve)
  |     +-- recommend.ts / profile.ts / srs.ts
  |     +-- Progress/session logic
  |
  +-- Existing state and persistence (preserve)
  |     +-- ProgressProvider
  |     +-- storage.ts / progress.ts
  |     +-- Backup/restore and sync integration
  |
  v
Browser runtime + static assets + GitHub Pages hosting
```

This is a logical boundary diagram, not a claim that every dependency has been verified. Inspect current imports/contracts before changing code.

## 3. Layer responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| Presentation components | Rendering, responsive layout, accessibility, visual states | Scoring/recommendation algorithms or persistence policy |
| Page composition | Route-level composition and UI coordination | Duplicated progress calculations |
| Domain logic | Recommendation, profile calculations, SRS, scoring | CSS/view-specific details |
| Progress provider | Shared progress state and transitions | Decorative copies of app state |
| Persistence layer | Existing records, merge behavior, storage result | UI success messaging without confirmed result |
| Sync/backup boundary | Existing operations, validation, error/result reporting | Secret exposure or false success |
| Static deployment | Exported routes/assets under base path | Server-only runtime assumptions |

## 4. State flow

```text
User action
  -> UI component emits intent
  -> existing page/session handler validates intent
  -> existing domain logic computes result (where applicable)
  -> shared progress state updates
  -> current persistence operation runs
  -> UI reflects confirmed success or actionable error
```

Do not show “saved” or “synced” until the current persistence contract confirms it. If persistence fails, retain in-memory session state where possible and provide retry.

## 5. Illustration and asset strategy

- Implement skill nodes as real SVG/CSS/HTML controls, not as a single flattened image.
- The cinematic mountain/hiker artwork may be a decorative background behind the interactive skill path.
- Scores, labels, news, links, and controls must be real DOM content, not baked into an image.
- Use a dark overlay/crop so hero copy remains readable.
- Provide a static fallback for reduced motion and narrow screens.
- Store optimized assets locally and confirm GitHub Pages base-path handling.
- Generated mockups contain illustrative text and are not exact production screenshots or real data.

## 6. Data and behavior compatibility

| Concern | Must preserve |
|---|---|
| Progress records | IDs, timestamps, question/topic/domain IDs, correctness and duration |
| Sessions | Active session, current index, answers, completion and recovery |
| Recommendations | Existing ranking and recommendation reasons |
| Skill profile | Existing calculations; distinguish score from confidence/sample size |
| Spaced repetition | Existing due-review scheduling |
| Lesson tracking | Existing visibility/duration rules |
| Backup/restore | Append-only merge and validation behavior |
| Sync/auth | No token exposure; existing flow unless separately approved |

## 7. Suggested file-change map

This map follows the existing LLD supplied for the project. Verify the repository before modifying files.

| Area | Likely files | Change intent |
|---|---|---|
| Tokens/typography | `app/globals.css` | Semantic tokens, variants, focus and motion |
| Shell/navigation | `app/layout.tsx`, `components/Nav.tsx`, `components/BrandMark.tsx` | Preserve logo; refine shell |
| Dashboard | `components/Dashboard.tsx` | Hero, skill path, next action, progress |
| Assessment | `app/assess/page.tsx`, `components/AssessRunner.tsx` | Visual refresh without changing logic |
| Practice/quiz | `app/practice/page.tsx`, `components/PracticeRunner.tsx`, `components/Quiz.tsx` | Focused practice and complete answer states |
| Progress | `components/ProgressRing.tsx`, `components/TopicScore.tsx`, `components/ScoreChart.tsx` | Consistent styles and accessible summaries |
| Lessons | `app/lessons/page.tsx`, `app/lessons/[domain]/[topic]/page.tsx` | Directory hierarchy and reading width |
| News/Fun | `app/news/page.tsx`, `app/news/[slug]/page.tsx`, `app/fun/page.tsx`, `components/FunCorner.tsx` | Editorial layout; preserve content/rotation |
| Settings | `app/settings/page.tsx`, `components/SettingsPanel.tsx` | Clear sync/backup states |
| Preserve logic | `components/ProgressProvider.tsx`, `lib/recommend.ts`, `lib/profile.ts`, `lib/srs.ts`, `lib/storage.ts`, `lib/progress.ts` | Avoid refactor unless verified necessary |

## 8. Performance and quality attributes

- **Performance:** small skeletons only for data that genuinely loads; lightweight CSS/SVG motion.
- **Accessibility:** WCAG 2.2 AA target; keyboard, contrast, reduced motion.
- **Resilience:** distinct loading, empty, failure and success states.
- **Maintainability:** centralized tokens/variants; no duplicated business logic.
- **Deployment:** static export and GitHub Pages base path remain valid.
- **Data integrity:** existing schema, session semantics, and merge behavior unchanged.

## 9. Implementation sequence

1. **Audit:** inspect repository, component contracts, tokens, build/export config, tests, and baseline screenshots.
2. **Foundation:** tokens, button variants, controls, shell/navigation, focus and motion.
3. **Dashboard:** hero, skill path, next-up recommendation, compact progress/news.
4. **Learning flows:** practice, assessment, quiz, results, lesson directory and reader.
5. **Secondary pages:** news, Fun Corner, settings, backup/sync states.
6. **QA:** responsive, keyboard, contrast, reduced motion, static build, GitHub Pages routes.

## 10. Definition of done

- Logo unchanged; current stack and static deployment retained.
- All current routes and business behaviors remain functional.
- No fake metrics, fabricated news, or false sync confirmations.
- No generic gradient-pill primary CTA.
- Responsive and accessibility acceptance criteria pass.
- ESLint, TypeScript, tests, production static build, and `npm run check` pass if present.
- Capture before/after screenshots at mobile, tablet, and desktop widths.
