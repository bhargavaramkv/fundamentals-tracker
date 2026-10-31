# Fundamentals Tracker — UX/UI Low-Level Design (LLD) v2.0

**Status:** Proposed implementation specification  
**Repository:** `bhargavaramkv/fundamentals-tracker`  
**Platform:** Responsive web application  
**Stack:** Next.js, React, TypeScript, Tailwind CSS  
**Deployment:** GitHub Pages static export  
**Design direction:** Developer Playground × Skill Quest

> The written requirements are authoritative. Generated screenshots are art-direction references, not pixel-perfect source files. Inspect current component contracts before implementation.

## 1. Purpose and non-goals

Refresh the product’s visual identity, page hierarchy, responsive behavior, and interaction quality while preserving existing behavior.

This is primarily a presentation-layer redesign. Do not redesign scoring algorithms, spaced repetition, recommendation ranking, progress schema, authentication cryptography, backup merge behavior, or daily content rotation as part of the visual work.

### Principles
- Action first: make the next useful learning step obvious.
- Progress with evidence: distinguish measured performance from confidence and sample size.
- Calm density: use whitespace and typography before adding another card.
- Purposeful play: the skill path is the memorable motif; the rest stays a serious developer tool.
- Truthful state: no fake metrics, fabricated stories, or false sync confirmations.
- Accessibility by default: keyboard support, reduced motion, contrast, and semantic status.

## 2. Visual direction

Combine the precision and clarity of a modern developer tool with a subtle skill-quest journey.

### Preserve
- The existing **Fundamentals.** logo/wordmark exactly.
- The existing horizontal header/navigation structure, with restrained refinements.
- Existing domain identity and learning behavior.
- GitHub Pages static deployment.

### Change
- Rework dashboard hierarchy around a cinematic skill path.
- Use a distinctive angular/chamfered primary CTA rather than generic gradient-pill buttons.
- Reduce repeated cards, nested panels, excessive borders, and decorative glow.
- Add subtle, purposeful micro-interactions and clear loading/empty/error states.

### Avoid
- Blue-purple gradient pill buttons.
- Glassmorphism and excessive rounded-card grids.
- Constant pulsing, floating blobs, or motion with no meaning.
- Decorative charts, invented values, fake progress, or fake news.
- Baking UI labels, values, or interactive elements into a raster image.

## 3. Design tokens

Centralize tokens in `app/globals.css`; do not scatter hardcoded colors.

| Token | Proposed dark direction | Purpose |
|---|---|---|
| Background | `#080D12` / `#0B1118` | Main canvas |
| Surface | `#0D151D` / `#101A24` | Selective grouping |
| Border | `#1D2A36` | Hairline boundaries |
| Primary accent | `#168BFF` or current accent after contrast testing | Links, focus, primary action |
| DSA | Blue | Domain identity |
| OOP/design | Orange | Domain identity |
| Databases | Green/teal | Domain identity |
| System design | Amber | Domain identity |
| Web/networking | Pink/violet | Domain identity |

Preserve the existing light theme and its semantic tokens. Do not create light mode by mechanically inverting dark colors. Validate WCAG contrast in both themes.

### Typography and layout
- Continue using the existing Geist Sans and Geist Mono setup.
- Desktop page title: 30–34px; section heading: 20–24px; body: 14–16px; metadata: 12–13px.
- Use the existing four-pixel spacing scale.
- Content width target: approximately 1120–1200px.
- Radius: controls 6–8px; surfaces 10–12px; feature surfaces up to 14px.
- Use borders and shadows only where they clarify grouping or elevation.

## 4. Buttons and controls

Use a small, shared variant set.

| Variant | Style | Use |
|---|---|---|
| Primary | Custom angular/chamfered outline or restrained solid accent; compact icon/arrow; no gradient | Start assessment, start practice, submit |
| Secondary | Quiet outline, neutral surface, or icon + label | Browse lessons, review topic |
| Ghost/inline | Text link with restrained hover and visible focus | See all, back, contextual links |
| Icon button | Compact neutral control with accessible name | Bookmark, close, chart options |
| Danger | Restrained semantic error color | Reset progress or consequential actions |

**Signature CTA:** slightly chamfered edge, transparent/dark fill, bright blue stroke, compact icon, concise label, and a 2–3px arrow shift on hover. Use only for the dominant action in a major region. The secondary action should be a quiet text/icon link. Inputs should remain simple rectangular controls; do not apply decorative cutouts to everything.

All variants require hover, focus, active, disabled, and loading states where applicable. Focus must remain visible.

## 5. Application shell and navigation

- Desktop: preserve the current horizontal header and exact brand mark.
- Active route: thin underline/accent rule rather than a large filled capsule.
- Keep local-only/sync status low-emphasis; detailed sync information belongs in Settings.
- Mobile: bottom navigation for Dashboard, Practice, Assessment, Lessons, and News; place Fun Corner and Settings in secondary navigation.
- Respect static export/base-path routing.
- Browser back/forward must work. Returning from a lesson/story must not unexpectedly reset a session.
- Warn before abandoning an active assessment when necessary.

## 6. Dashboard

**Route:** `/`

The dashboard is the signature screen. Use a two-part hero: copy/action on the left and a cinematic skill journey on the right. Under it, show a single skill-path strip, then at most three lower content regions. On mobile, place the illustration below the copy and collapse the path into compact topic rows.

### Hierarchy
1. Greeting, concise headline, short value proposition.
2. One dominant action: Start assessment or Continue practice, based on real state.
3. One secondary action: Browse lessons or View skill profile.
4. Five-domain skill journey connected toward a goal marker.
5. Compact topic progress with evidence/confidence where available.
6. One recommended task with an actual reason from the recommendation engine.
7. One compact progress chart and two useful metrics.
8. Two or three real technical-news headlines, secondary to practice.

Do not make every section a bordered card. Use spacing and typography to create hierarchy.

### Dashboard states
- **First visit/no answers:** explain the baseline assessment; show question count only if known; one Start assessment CTA; hide empty charts and fake zero KPIs.
- **Returning learner:** show evidence-backed progress and the next useful action.
- **Loading:** lightweight skeletons or concise loading labels; no flash of an empty state.
- **Failure:** visible explanation and retry; do not misrepresent failure as zero progress.
- **No news:** hide the region or show a truthful empty state.
- **Reduced motion:** static skill path, no pulsing/entrance animation.

## 7. Page-level UX

### 7.1 Authentication
Centered narrow form with exact brand mark, username, password visibility toggle, and one primary action. Enter submits. Preserve username after failure but not the password. Associate errors with fields. Keep the current auth mechanism unless a separate security change is approved. Static-site gating is not server-enforced authorization.

### 7.2 Practice directory
Show a recommended session first, followed by clean topic/problem rows. Use search and filters only where useful for the existing content volume. Each recommendation reason must come from the actual engine. Keep warm-up low-pressure.

### 7.3 Assessment introduction
Explain baseline purpose, question count, covered topics, and duration only when supported by reliable data. One Start action. Previous attempts appear as a compact list with date, score, accuracy, and view action.

### 7.4 Active assessment
One question at a time, visible question count/progress, domain/difficulty, answer options, Previous/Next. Preserve answers during navigation; warn before abandoning; prevent duplicate submissions. Do not reveal correctness early when the mode measures unaided performance.

### 7.5 Assessment results
Lead with overall result, then domain performance, confidence/evidence, strengths, and weak areas. Link weak topics directly to practice/lessons. Explain that a baseline is not a definitive measure of engineering ability.

### 7.6 Quiz/practice session
Focused reading column, answer options with explicit default/hover/focus/selected/correct/incorrect/disabled states, concise feedback, related lesson link, and previous/next. Preserve session state. On persistence failure, retain in-memory state where possible and offer retry.

### 7.7 Lessons directory
Group topics by domain. Use compact topic rows, descriptions, question counts, and progress only when supported by evidence. Search is optional and justified by content size. Distinguish untested/in-progress/reviewed with text or icon as well as color.

### 7.8 Lesson reader
Breadcrumb, topic title, readable content width, consistent headings, syntax-appropriate code blocks, responsive tables, and a focused **Practice this topic** action. Preserve existing visibility/duration requirements for lesson-read tracking.

### 7.9 News directory
Editorial list rather than repeated promotional cards. Show relevant severity, date, headline, short summary, related topics, and source. Filters only if the story collection justifies them. Never fabricate stories.

### 7.10 News detail
Headline, incident metadata, summary, explanation, relevant fundamentals, source links, related lessons, self-check, and practice action. Clearly identify external links. Do not interrupt reading with unnecessary modals.

### 7.11 Fun Corner
Daily bug story, inline reveal, engineering lesson, quick fact, and five-question warm-up. Preserve existing daily rotation. Playful but not childish; no streak-loss pressure.

### 7.12 Settings
Group theme, sync, backup/restore, and session management. Show actual sync status. Never reveal the full token after submission. Explain import/merge behavior before proceeding and confirm destructive progress reset.

## 8. Motion and micro-interactions

| Interaction | Behavior |
|---|---|
| Skill node hover/focus | Lift 2px and strengthen accent ring; 140–180ms; keyboard equivalent |
| Skill path | Draw/fade a short segment once only when motion is allowed; never loop |
| Progress | 200–350ms transition; immediate final state for reduced motion |
| CTA | Arrow shifts 2–3px; restrained border/fill change |
| Disclosure | 160–220ms; essential content must not depend on hover |

Prefer CSS transform/opacity and lightweight SVG. Respect `prefers-reduced-motion`.

## 9. Responsive requirements

- **Under 640px:** single column, 16–20px page padding, bottom navigation, no horizontal page overflow, reachable quiz controls, practical 44×44px touch targets.
- **640–1023px:** use columns only where readable; preserve reading widths and chart labels.
- **1024px+:** constrain content to approximately 1120–1200px; use whitespace for hierarchy, not extra panels.
- Tables and code blocks may scroll within their own containers.
- No navigation or sticky controls may obscure focused content or the on-screen keyboard.

## 10. Accessibility

Target WCAG 2.2 AA:
- Keyboard-operable controls and visible focus.
- Semantic headings and landmarks.
- Accessible names for icon-only controls.
- Field errors associated with inputs.
- Important async states announced appropriately.
- Charts have textual summaries and accessible data representation where practical.
- Color is never the sole status indicator.
- Reduced-motion support and no essential hover-only content.
- Verify contrast in both light and dark themes.

## 11. Shared component inventory

| Component | Responsibility |
|---|---|
| `AppShell` / `Nav` | Responsive route-aware shell and navigation |
| `PageHeader` | One title, optional description and actions |
| `Button` | Primary/secondary/ghost/danger variants and states |
| `DomainMarker` / `SkillPath` | Domain identity, connected path, accessible fallback |
| `TopicProgress` / `Metric` | Evidence-backed performance and explicit labels |
| `QuestionOption` / `FeedbackPanel` | Accessible answer state and feedback |
| `ScoreChart` | Responsive chart and text/table summary |
| `EmptyState` / `LoadingState` / `InlineNotice` | Distinct loading, empty, error, success |
| `ConfirmDialog` / `SourceLink` | Safe destructive actions and clear external links |

Reuse current components when suitable; do not create duplicate abstractions unnecessarily.

## 12. Data integrity boundaries

Preserve existing:
- Progress IDs, timestamps, question/topic/domain identifiers, correctness, and duration.
- Session IDs, active session, current index, answers, completion and recovery behavior.
- Recommendation ranking/reasons and spaced-repetition scheduling.
- Skill profile calculations; distinguish score from confidence/sample size.
- Lesson tracking criteria.
- Append-only backup merge behavior.
- Authentication and sync behavior unless separately approved.
- Static GitHub Pages export.

Never show “saved” or “synced” until the existing persistence/sync contract confirms it.

## 13. UX acceptance criteria

- Logo/wordmark unchanged; header remains recognizable.
- No gradient-pill primary CTA; shared button variants used consistently.
- Dashboard has one dominant next action and no fake metrics.
- Skill path is readable without animation and works on mobile.
- Recommendations match the existing engine.
- Assessment/quiz answers persist across navigation; duplicate submission is prevented.
- Lessons, news, Fun Corner, sync, backup/restore and sign-out retain behavior.
- Loading, empty, failure, success, disabled and focus states are covered.
- Responsive, keyboard, contrast and reduced-motion checks pass.
