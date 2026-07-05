# Architecture

A simple webapp that shows weekend weather forecasts for a curated set of New England rock climbing destinations, so the community can decide trip plans a few days out at a glance.

## Goals

Highlight four data points per crag, across the upcoming Fri–Mon window:

1. Chance of rain
2. Forecasted precipitation (inches)
3. High/low temperature for each of Fri, Sat, Sun, Mon (with a small chart)
4. Summit forecast — only for locations where a nearby summit is configured

The window is four days (Fri–Mon), with Saturday as the anchor day. See `src/lib/weekend.ts`.

## Stack

- **Frontend:** React + Vite (TypeScript)
- **UI primitives:** [`@base-ui/react`](https://base-ui.com/) for unstyled, accessible components (e.g. the collapsible summit panel, any dialogs/tooltips/selects we add later)
- **Styling:** Plain CSS — no Tailwind.
- **Hosting:** Static site on a free tier (GitHub Pages / Vercel / Netlify)
- **Backend:** None. No database, no auth, no API keys, no scraping.

## Data sources

Two free, browser-callable APIs. No keys required.

| Source | Used for | Notes |
|---|---|---|
| [National Weather Service](https://www.weather.gov/documentation/services-web-api) (`api.weather.gov`) | Crag forecast (the four data points at the base of the crag) | Authoritative US forecast. CORS-enabled. Recommends a 30-min cache. |
| [Open-Meteo](https://open-meteo.com/) | Summit panel only (elevation-aware) | Free, no key, elevation parameter gives us summit-ish conditions without scraping. |

**Why two sources, not one:** NWS is the authoritative US forecast for the crag itself. Open-Meteo's elevation-aware endpoint gives us a summit-conditions panel without scraping `mountain-forecast.com`. The two are kept visually separate on the card so a user never confuses "base of crag" with "summit" numbers.

**Why not `mountain-forecast.com`:** No public API. Scraping would be fragile (breaks on any HTML change) and a ToS gray area. Open-Meteo is the legitimate alternative.

## Data flow

```
locations.ts ──► for each crag ──┬─► NWS:  /points/{lat,lon} → forecast URL → fetch
                                 └─► Open-Meteo (only if summit configured):
                                     /v1/forecast?lat&lon&elevation&daily=...
```

All requests fan out in parallel per render. Each card owns its own loading and error state, so one bad fetch doesn't break the page.

### NWS request sequence

1. `GET /points/{lat},{lon}` — returns metadata including a `forecast` URL plus the grid coords (`gridId`, `gridX`, `gridY`)
2. Then, in parallel:
   - `GET <forecast>` — returns ~14 periods (7 days × day/night) with `temperature`, `isDaytime`, `probabilityOfPrecipitation`
   - `GET /gridpoints/{gridId}/{x},{y}` — quantitative precipitation (QPF) in mm. `parsePrecip` expands multi-hour QPF entries (PT1H, PT6H, …) into flat per-hour readings, which are then summed per day.

### Open-Meteo request (summit only)

`GET https://api.open-meteo.com/v1/forecast` with:
- `latitude`, `longitude`, `elevation` (summit values)
- `daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum`
- `timezone=auto`

## Where each data point comes from

| Data point | Source | Field(s) |
|---|---|---|
| Chance of rain | NWS forecast period | `probabilityOfPrecipitation.value` (max per day) |
| Inches of precipitation | NWS `gridpoints` QPF | sum of per-hour `quantitativePrecipitation` (mm → inches) within each day |
| Hi/Lo per day | NWS forecast periods | filter periods to each day (Fri–Mon); daytime `temperature` = high, nighttime = low |
| Summit forecast | Open-Meteo | `daily.temperature_2m_max/min`, `precipitation_probability_max`, `precipitation_sum` |

## Card layout

Top to bottom:

1. Crag name + subtitle (the Fri–Mon date range, e.g. `5/23–5/26`)
2. **Big precip badge** — color-coded: green <20%, amber 20–50%, red >50%. Inches underneath.
3. **Inline temp chart** — hi/lo for each of the four days (Fri–Mon), each column labeled with its day, hand-rolled SVG, no chart library.
4. **Summit panel** — collapsed by default, only renders when `summit` is configured.

## Caching

- Per-location response cached in `sessionStorage` with a 30-minute TTL.
- Honors NWS's recommended cache window and keeps repeated navigation cheap.

## Out of scope (deliberately)

- No backend, no database, no auth.
- No notifications / "alert me when it's dry."
- No chart library — 4 data points doesn't justify one.
- No service worker or offline mode.
- No historical data or trend analysis.

## Risks / things to verify as we build

- **NWS reliability:** occasional 500s or stale responses. Per-card error states are required.
- **Open-Meteo ≠ NWS:** the two models will disagree by a few degrees and a few percent rain. That's expected. Don't average them; show them separately.
- **CORS:** both APIs allow browser calls, but worth verifying on the first request from a deployed origin.
- **NWS User-Agent:** the API requests a custom User-Agent identifying the app. Browsers may strip it; setting `Accept: application/geo+json` is the practical lever we have.
