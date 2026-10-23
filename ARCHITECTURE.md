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
- **Styling:** Plain CSS — no Tailwind. Fonts are Space Grotesk (display) and Inter, from Google Fonts.
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

All requests fan out in parallel per render. `useCragForecasts` gives each crag its own loading and error slot, so one bad fetch doesn't break the page.

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

## Page layout

Top to bottom:

1. **Header** — scenic hero (layered ridge silhouettes), weekend picker, °F/°C and in/mm unit toggles, and a light / system / dark theme toggle.
2. **Overview** — a "best bet" spotlight for the driest crag, next to a crag × day heatmap (chance of rain, tinted by dry / damp / wet). Rows link to the matching card.
3. **Cards**, sorted driest-first by `rainScore`.

### Card layout

1. Crag name, state, a verdict pill ("3 of 4 days dry"), and its driest-first rank.
2. **Day tiles** (Fri–Mon) — weather icon from NWS `shortForecast`, max chance of rain, inches. Tinted by `dayCondition`: dry / damp / wet. Hover or focus a tile for the forecast text and wind.
3. **Hourly precip strip** — one 96-hour timeline whose bars sit under each day's tile. Absolute sqrt scale (not per-card), so bar heights compare across crags.
4. **Temp band chart** — smooth hi/lo curves on the same 4-column grid, hand-rolled SVG, no chart library.
5. **Summit panel** — collapsed by default, only renders when `summit` is configured.
6. Footer links to weather.gov and meteoblue.

## Theming

All colors are CSS custom properties defined once in `src/styles.css` as `light-dark()` pairs. `color-scheme: light dark` follows the OS. The theme toggle pins one side by setting `data-theme` on `<html>` (saved in `localStorage`). An inline script in `index.html` applies the saved choice before first paint.

## Units and preferences

Both APIs are asked for °F and inches (NWS QPF arrives in mm and is converted to inches on ingest), and everything internal (`DaySummary`, `rainScore`) stays in those units. The °F/°C and in/mm toggles are display-only: `src/lib/units.ts` (`formatTemp`, `formatPrecip`) converts at render time, so scoring and caching never depend on the user's choice. TempChart lays out its curve in °F and converts only the labels, so the shape is identical in either unit. Defaults are °F and inches.

User preferences live in `localStorage` through `src/lib/preferences.ts`: a typed store (`definePreference` + `usePreference`) that validates stored JSON, falls back to the default on garbage or blocked storage, and syncs every subscriber in the tab and across tabs. Reads are synchronous, so the first render already uses the saved units (no inline pre-paint script needed, unlike the theme). The theme keeps its own older `theme` key because `index.html` reads it before first paint.

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
