# Soft Spark — logo (LOCKED · gold cream-card)
Aura · Cameron · **Mark + wordmark locked to Cameron’s JPEG** · 2026-09-16

**Name:** Soft Spark (two words in UI; `soft-spark` in code)  
**Tagline:** Your bot dates. You show up.

## Primary (ship this)
Cameron confirmed the **top** cream-card lockup in his reference is exactly Soft Spark. Production assets are **derived from** `logo/cameron-locked-lockup.jpeg` (raster crop/scale + mark isolation). Do **not** ship freehand twin-petal redraws that drift from that silhouette/color.

| Asset | Path | Notes |
|-------|------|-------|
| Locked reference JPEG | `logo/cameron-locked-lockup.jpeg` | Gold source — keep |
| Production wordmark PNG | `logo/png/soft-spark-wordmark-840.png` (+ `1680`) | **Gold raster** (scaled card) |
| Recommended wordmark | `logo/wordmark-recommended.png` | Same gold card |
| App icon / mark PNG | `logo/png/soft-spark-mark-*.png` | Gold mark on `#F7F1EA` |
| Mark drop-in | `logo/mark-a-ember.png` | 512 cream |
| Lockup PNG | `logo/png/soft-spark-lockup-1200.png` | Gold card + tagline |
| SVG set | `logo/svg/soft-spark-*.svg` | Best-effort vector approx |

## Alts (archive only — not primary)
- B Orbit — `logo/mark-b-orbit.png`
- C Monogram — `logo/mark-c-monogram.png`

## Usage rules
- Clear space: ≥ ¼ mark height
- Min: icon 16px · wordmark ≥ 80px wide
- On cream `#F7F1EA` / white; reverse: peach mark on cocoa `#2A211C`
- Never: chat bubbles, eyes, spy/lens, neon AI hologram, glossy plastic sheen, heavy peach bloom
- Status-only product: mark must not imply “watch the chat”
- Do not use “Spark” alone in customer-facing chrome
- **Wordmark PNG must stay gold-derived**; SVG wordmark is approximation only
- Lockup layout: horizontal mark-left / text-right (as locked JPEG); tagline on lockup asset only

## Forge drop-in
Copy `logo/svg/*` + needed PNGs into `apps/web/public/brand` / Expo adaptive icon. Prefer **PNG wordmark** (`soft-spark-wordmark-840.png`) over SVG wordmark for fidelity. Expo adaptive icon bg `#F7F1EA`.
