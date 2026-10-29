# Fundamentals Tracker redesign handoff

This branch contains the updated design specifications for the **Developer Playground × Skill Quest** redesign.

## Start here
1. Read [UX/UI LLD v2](./UX-UI-LLD-v2.md).
2. Read [HLD v2](./HLD-v2.md).
3. Audit the existing repository and its current behavior before changing code.
4. Implement the shared design system first, then dashboard and learning flows in phases.
5. Read [IMPLEMENTATION-NOTES](./IMPLEMENTATION-NOTES.md): decisions where the spec conflicted with the code.

## Key visual requirements
- Preserve the exact existing Fundamentals. logo/wordmark and broadly retain the current header.
- Use a cinematic connected skill path with real interactive nodes.
- Use a custom angular/chamfered primary action. No generic gradient-pill buttons.
- Use whitespace and typography instead of nested card grids.
- Keep motion subtle, purposeful, and reduced-motion aware.

## Non-negotiable compatibility
Do not silently change scoring, recommendations, spaced repetition, progress schema, authentication, backup/restore semantics, lesson tracking, or sync. Preserve GitHub Pages static export. Never replace real values with mock data to imitate a screenshot.

## Visual references
The generated dashboard and all-pages reference images were provided in the conversation package. Treat them as art direction, not pixel-perfect UI or a source of real copy/data. The written LLD and HLD are authoritative.

## Implementation workflow
- Inspect current file contracts and run the existing checks first.
- Implement incrementally and test each critical flow.
- If the existing implementation conflicts with a requirement, preserve current behavior and document the conflict instead of silently removing it.
- Finish with lint/type checks/tests/build and manual desktop/tablet/mobile verification.
