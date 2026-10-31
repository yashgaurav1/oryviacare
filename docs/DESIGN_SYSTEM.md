# Design system

Tokens: `apps/web/src/app/globals.css` (`:root` + Tailwind `@theme`). Fonts: Playfair Display (display headings), Jost (body/UI), both via `next/font`.

| Token | Value | Use |
| --- | --- | --- |
| canvas | `#F7F4EC` | Page background |
| surface | `#FFFFFF` | Cards, forms, tables |
| ink | `#14201A` | Text |
| ink-muted | `#5D6660` | Secondary text |
| primary | `#173F35` | Primary actions (white text) |
| teal | `#274C4F` | Links, eyebrows |
| gold | `#C9A24B` | Decoration only — never body text |
| success / warning / error / info | `#1F6B45` / `#7A5410` / `#A3261B` / `#1F4F73` on tinted backgrounds | Status, always with text |
| focus | `#1F6FB2`, 3 px outline | `:focus-visible` |

Contrast (WCAG 2.x relative luminance, computed 2026-10-31): ink/canvas 15.3:1; muted/canvas 5.4:1; muted/surface 5.9:1; white/primary 11.7:1; teal/canvas 8.6:1; warning/warning-bg 6.0:1; error/error-bg 6.3:1. Gold/canvas is 2.2:1, so gold is decoration only. These are token-pair calculations, not an accessibility audit.

Components: `.btn` (primary/secondary/ghost/danger, 44 px min height), `.input`, `.label`, `.field-error`, `.card`, `.glass` (navigation, summaries, workspace sidebars only), `Banner`, `Field`, `Price`, `StockBadge`, `AddToCart`, `ProductCard`, `OrderTimeline`, `Pending`, `ReasonAction`.

Motion: one hero rise + slow float, card lift on pointer devices only, all disabled under `prefers-reduced-motion`. No WebGL, no 360° views, no before/after sliders (no authentic assets exist).

Brand mark: typographic "ORYVIA" (D-011). Component gallery page: not built yet.
