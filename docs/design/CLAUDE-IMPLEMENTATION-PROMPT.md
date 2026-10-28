# Claude Code implementation brief — Fundamentals Tracker redesign

You are implementing the visual redesign described by:
- `docs/design/UX-UI-LLD-v2.md`
- `docs/design/HLD-v2.md`

## Required workflow
1. Audit the current repository and read both documents completely before editing.
2. Inspect current route structure, component contracts, design tokens, state ownership, tests, and GitHub Pages static-export configuration.
3. Record baseline checks and identify any conflict between current behavior and the design docs.
4. Implement in phases: shared tokens/components/shell first, dashboard second, learning flows third, secondary pages fourth, then accessibility and regression QA.
5. Work on this branch: `design/ux-hld-lld-revamp`. Do not commit to `main`, do not merge, and do not open a PR unless explicitly asked.
6. Keep working through all phases and checks where possible. If blocked, document the exact blocker and continue with independent safe work.

## Non-negotiable constraints
- Preserve the exact existing Fundamentals. logo/wordmark and broadly preserve the current header/navigation.
- Preserve existing routes, scoring, recommendation ranking, spaced repetition, progress schema, authentication flow, lesson tracking, backup/restore merge semantics, sync behavior, and daily Fun Corner rotation.
- Keep GitHub Pages static export working. Do not add server-only routes, server actions, or runtime requirements without explicit approval.
- Never use mock/fake values to make the dashboard look complete. All visible progress and recommendations must derive from existing app data.
- Use the custom angular/chamfered primary action described in the LLD. Do not use generic blue-purple gradient-pill buttons.
- Use the skill-quest illustration as a visual motif, but implement nodes, labels, progress, and links as actual accessible UI. Never bake interactive content into a raster image.
- Keep motion purposeful, lightweight, and respectful of `prefers-reduced-motion`.
- Do not delete existing features simply because they are not visible in a mockup.

## Validation
- Run the repository's documented check command (including `npm run check` if present), lint, TypeScript, tests, and production static build.
- Verify dashboard, assessment start/session/results, adaptive practice, quiz feedback, lesson tracking, news links, Fun Corner, settings, backup/restore, and sync behavior.
- Check mobile, tablet, and desktop widths; keyboard focus; reduced motion; and contrast in light/dark themes.
- Check GitHub Pages base-path routing and asset URLs.
- Review the diff for unrelated changes, fake data, dead code, and accidental changes to domain logic.
- Commit incremental, descriptive changes on this branch and report commits, tests, and any remaining blockers at the end.

The written LLD and HLD are authoritative. Visual mockups are art direction only and may contain inaccurate tiny text or illustrative data.
