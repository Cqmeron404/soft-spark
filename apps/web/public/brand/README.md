# Ember (locked · Aura)

Tagline: **Your bot dates. You show up.**

Do not invent a different mark. Do not use “Spark” alone in chrome. See `logo-directions.md`.

Production wordmark/lockup PNGs are gold-derived. SVG wordmark is an approximation.

## SVG

| File | Use |
|------|-----|
| `svg/soft-spark-mark.svg` | App icon (cream `#F7F1EA`) |
| `svg/soft-spark-mark-transparent.svg` | Inline SessionBar mark |
| `svg/soft-spark-mark-on-dark.svg` | Cocoa `#2A211C` background |
| `svg/soft-spark-wordmark.svg` | Vector approx — prefer PNG |
| `svg/soft-spark-lockup.svg` | Vector approx + tagline — prefer PNG |
| `svg/soft-spark-favicon.svg` | Favicon |

## PNG

| File | Use |
|------|-----|
| `png/soft-spark-mark-{128,256,512,1024,2048}.png` | Expo icon / adaptive icon / raster mark |
| `png/soft-spark-wordmark-{840,1680,3360}.png` | **Preferred** wordmark |
| `png/soft-spark-lockup-{1200,2400}.png` | Cream card + tagline |
| `png/soft-spark-favicon-{32,64,180,512}.png` | Favicon / apple-touch |

`AppLogo` (`packages/ui`) uses PNG wordmark/lockup and SVG mark/favicon. Expo chrome uses `apps/mobile/assets/brand/png/soft-spark-mark-128.png`. Adaptive icon background `#F7F1EA`.
