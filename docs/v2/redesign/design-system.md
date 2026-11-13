# Fundamentals design system (V2 redesign)

The source of truth for implementation is concept A (`concepts/a/style.css`), with the adjustments in `selection.md`. The tokens live in `app/globals.css`. The UI is dark only: the app already forces `data-theme="dark"`, and the light tokens are left as they are, unused.

## Colour
| Token | Value | Use |
|---|---|---|
| `--bg` | `#05080f` | page |
| `--bg-2` | `#070b14` | sidebar, pane backgrounds |
| `--surface` | `#0b1220` | panels |
| `--surface-2` | `#0e1628` | raised and hover |
| `--surface-3` | `#131d33` | inputs, selected rows |
| `--line` / `--line-2` | `rgba(120,170,255,.10)` / `.18` | hairlines, focus-adjacent |
| `--accent` | `#3b9bff` | primary actions, active nav, data |
| `--cyan` | `#22d3ee` | secondary accent: eyebrows, highlights, topics (sparingly) |
| `--good` / `--warn` / `--bad` | `#34d399` / `#fbbf24` / `#f87171` | status only |
| `--ink` / `--ink-2` / `--muted` / `--dim` | `#e9f0ff` / `#b4c2dc` / `#7f90ae` / `#55627c` | text levels |

Never purple. Glow is used only on the primary CTA, the active nav indicator, the active ring and the live timer.

## Type (Geist, Geist Mono)
| Role | Size / weight / tracking |
|---|---|
| Display (page hero) | 44–56 px desktop, 32–36 px mobile; 700; -0.03em |
| H1 (page title) | 32 px; 650; -0.02em |
| H2 (panel title) | 18–20 px; 600 |
| Body | 15 px (UI) / 16–17 px (journal prose, line-height 1.6) |
| Label / eyebrow | 11–12 px, uppercase, +0.12em, cyan or muted |
| Numbers, times | Geist Mono, tabular |

## Space, shape, depth
- 8 px grid. Panel padding is 24–32 px on desktop and 20 px on mobile.
- Radii: panels 16 px, controls 12 px, chips and pills 999 px.
- Panels are `--surface` with a 1 px `--line` border and a top inner highlight `inset 0 1px 0 rgba(170,210,255,.07)`. There are no drop shadows except the CTA glow.
- Layout uses an asymmetric 12-column grid. Never a row of identical cards.

## Motion
- Durations: 120 ms (hover/press) and 200 ms (panel and tab changes), ease-out.
- The active timer ring has a slow ambient sweep, and the sync dot pulses while saving.
- `prefers-reduced-motion` turns off every non-essential animation.

## Icons
Inline SVG line icons in the lucide style: 1.75 stroke, 18–20 px, `currentColor`, from one `components/ui/icons.tsx`.

## Components (`components/ui/`)
- **Panel** (`variant: default | hero`): the hero variant carries the atmosphere.
- **Eyebrow**, **PageHeader** (eyebrow, title, subtitle and an optional horizon rule).
- **Button** (`primary | secondary | ghost | danger`, sizes md and lg).
- **StatusPill** (reviewed, queued, failed, device, synced, conflict, due, reassess).
- **Ring**: an SVG progress or ambient ring.
- **LevelBar**: the 4-level stacked bar plus legend.
- **Stepper**: the "Next up" timeline.
- **Icon** set.

## Shell
- **Desktop (≥1024):**
  - A 240 px sidebar with the wordmark (`BrandMark`, unchanged).
  - Four primary items. The active one is a filled pill with a 2 px glowing blue left bar.
  - A utility zone at the bottom: Mentor, Settings, and a sync card showing state and time.
- **Tablet (768–1023):** a 72 px icon rail with labels in tooltips, and the same utility zone as icons.
- **Mobile (<768):**
  - The top bar shows the wordmark plus Mentor and Settings icons.
  - The bottom tab bar has the four primary items.
  - The active session uses full-screen focus mode.
