# AETHER — Phase I Interface Design Notes

The Phase I interface is styled as a **print ledger**: the visual language of
documents, ledgers, and quiet operations software rather than a chatbot.
Every default that reads as "AI product" was deliberately removed.

## What was removed (and why)

| AI-product cliché        | Phase I replacement                                    |
| ------------------------ | ------------------------------------------------------ |
| Blue/purple gradients   | Warm ivory paper `#f4f2ea` + racing green `#1e5a43`    |
| Inter / Space Grotesk    | Libre Franklin (UI) · Source Serif 4 (display) · IBM Plex Mono (data) |
| Glassmorphism, glow      | Flat surfaces, 1px hairlines, 2–3px radii              |
| Emoji icons everywhere   | Square status markers, small-caps mono labels, plain text |
| Bouncing dots, pulses    | One thin indeterminate progress rule (CI-pipeline style) |
| Chat bubbles             | Correspondence thread: `YOU` / `AETHER` labels + timestamps |
| Card grids with pills    | A dense ledger table with hairline rows                |
| Gradient wordmark        | Serif wordmark on a warm charcoal rail                 |

## Palette

| Token           | Value     | Use                                        |
| --------------- | --------- | ------------------------------------------ |
| `--paper`       | `#f4f2ea` | App background (warm ivory)                |
| `--paper-raised`| `#fbfaf5` | Panels, inputs, tables                     |
| `--paper-inset` | `#ebe8dc` | User replies, code blocks                  |
| `--ink`         | `#26231a` | Primary text                               |
| `--accent`      | `#1e5a43` | Racing green — active states, links, DONE  |
| `--amber`       | `#8f6a1f` | In-progress / warnings / HIGH priority     |
| `--red`         | `#96382a` | Errors / URGENT / cancelled                |
| `--slate`       | `#5b6a63` | UNDERSTAND state / MEDIUM priority         |
| `--sidebar-bg`  | `#22201a` | Warm charcoal navigation rail              |

No pure white, no pure black, no saturation above ~35% on UI chrome.

## Typography

- **Display** — Source Serif 4: page titles, wordmark, empty-state headlines.
- **UI** — Libre Franklin: body text, task titles, nav.
- **Data** — IBM Plex Mono, uppercase, `0.10–0.16em` tracking: labels,
  timestamps, latencies, token counts, priorities, tabular figures everywhere
  (`font-variant-numeric: tabular-nums`).

## Component conventions

- **Sidebar** — charcoal rail; dossier numbering (`01 — Conversation`), serif
  wordmark, system status footer with build information.
- **Conversation** — thread, not bubbles. User replies sit in a bordered
  inset block, right-aligned; assistant replies are plain document text.
  Trace access is an underlined mono text action.
- **Trace** — vertical rail with square state markers, one muted colour per
  state (slate → green → ochre → sienna), `KEY value` mono tags instead of
  emoji chips.
- **Tasks** — ledger table: status square, title + description, priority
  swatch, due date, status. Hover is a background change only — no lift,
  no scale, no shadow.
- **Motion** — one duration (120ms), one easing, background/opacity/color
  only. Nothing bounces, pulses, or floats.

## Reviewing without a backend

```bash
node packages/web/dev-mock-api.mjs   # sample data on :3001
pnpm --filter @aether/web dev        # UI on :5173, /api proxied
```
