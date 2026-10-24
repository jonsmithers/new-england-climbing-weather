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
- **Map:** [`pigeon-maps`](https://pigeon-maps.js.org/) (React, no dependencies, ~10 KB gzip) for the overview's Map page, in a lazy-loaded chunk.
- **Styling:** Plain CSS — no Tailwind. Fonts are Space Grotesk (display) and Inter, from Google Fonts.
- **Hosting:** Static site on a free tier (GitHub Pages / Vercel / Netlify)
- **Backend:** None. No database, no auth, no API keys, no scraping.

## Data sources

Two free, browser-callable weather APIs, two for drive times, and map tiles. No keys required.

| Source | Used for | Notes |
|---|---|---|
| [National Weather Service](https://www.weather.gov/documentation/services-web-api) (`api.weather.gov`) | Crag forecast (the four data points at the base of the crag) | Authoritative US forecast. CORS-enabled. Recommends a 30-min cache. |
| [Open-Meteo](https://open-meteo.com/) | Summit panel only (elevation-aware) | Free, no key, elevation parameter gives us summit-ish conditions without scraping. |
| [OSRM](https://project-osrm.org/) on [FOSSGIS](https://routing.openstreetmap.de/) (`routing.openstreetmap.de/routed-car`) | Drive time + distance from the origin to each crag | One `/table` request covers all crags. CORS `*`. Policy: ≤1 req/s, no heavy use, attribution + "fix the map" link required (in the footer credits). No traffic data, so times run long on highway trips. |
| [Photon](https://photon.komoot.io/) (komoot) | Origin place search | Fair use, so we search on submit only (no per-keystroke autocomplete). CORS `*`. |
| [OpenStreetMap standard tiles](https://operations.osmfoundation.org/policies/tiles/) (`tile.openstreetmap.org`) | Map page basemap | Keyless raster tiles under the OSMF tile usage policy: visible "© OpenStreetMap contributors" link on the map, the browser's default Referer (don't add a restrictive referrer policy), no prefetching, bulk or offline use. Tiles are requested only once the Map page is opened. No dark style, so dark mode filters the tile layer in CSS. |

**Why OSRM `/table` and not Valhalla:** the FOSSGIS Valhalla matrix caps paths at 150 km ("Path distance exceeds the max distance limit"), which rules out the Gunks and the White Mountains from Boston, and its `/route` would mean one request per crag. `router.project-osrm.org` returns the same numbers, but the OSRM wiki points to routing.openstreetmap.de as the current public server. Nominatim also works for geocoding, but Photon's policy is friendlier and it supports a location bias.

**Why pigeon-maps + OSM tiles:** pigeon-maps is ~10 KB gzip and renders markers as React children (so pins use our tokens and state). Leaflet is ~46 KB gzip with its CSS, and MapLibre is ~450 KB gzip plus a worker; MapLibre would also need vector tiles (OpenFreeMap). CARTO's Positron/Dark Matter would give a native dark style, but CARTO's basemap terms (Sep 2026) require an API key for any free use. pigeon-maps has one maintainer and no keyboard panning, so the pins are real buttons and zoom/fit are buttons.

**Why two sources, not one:** NWS is the authoritative US forecast for the crag itself. Open-Meteo's elevation-aware endpoint gives us a summit-conditions panel without scraping `mountain-forecast.com`. The two are kept visually separate on the card so a user never confuses "base of crag" with "summit" numbers.

**Why not `mountain-forecast.com`:** No public API. Scraping would be fragile (breaks on any HTML change) and a ToS gray area. Open-Meteo is the legitimate alternative.

## Data flow

```
locations.ts ──► for each crag ──┬─► NWS:  /points/{lat,lon} → forecast URL → fetch
                                 └─► Open-Meteo (only if summit configured):
                                     /v1/forecast?lat&lon&elevation&daily=...
```

Drive times are a separate, origin-keyed request: `OSRM /table/v1/driving/{origin};{crag};…?sources=0&annotations=duration,distance` (`src/api/routing.ts`, via `useDriveTimes`). Only crags missing from the cache are requested.

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

1. **Header** — scenic hero (layered ridge silhouettes), weekend picker, an origin picker for drive times (search a place, pick a result; default Davis Square, Somerville), °F/°C and in/mm unit toggles, and a light / system / dark theme toggle.
2. **Overview** — a "best bet" spotlight for the top-ranked crag, next to a paged panel: two crag × day grids plus a map. All pages use the same ranked row order, and rows and pins link to the matching card.
   - **Rain:** chance of rain, tinted dry / damp / wet.
   - **Temperature:** each day's high (via `formatTemp`), tinted cold / comfy / hot by `tempComfort` (`src/lib/forecast.ts`, the score's own comfort band). ▼/▲ mark cold/hot, and a ring marks "far out" (`FAR_BAND_F`, 40°F / 85°F). A day with no daytime high (Friday once its daytime period has passed) shows "—" rather than the night low, which would always read as cold.
   - **Switching:** the pages sit in a native horizontal scroll-snap track, so touch users swipe. A Rain | Temperature | Map tab switch (shared `.segmented` style, WAI-ARIA tabs with arrow keys) and page dots stay in sync with the scroll. The off-screen page is `inert` and `aria-hidden`, and the choice is remembered (`pref:overviewPage`).
   - **Map:** `CragMap.tsx`, loaded with `React.lazy`, so pigeon-maps, the component and `CragMap.css` are a separate chunk fetched on the first visit to the page, and no tile is requested before that. One pin per crag shows its rank and a glyph whose fill is the weekend verdict (○ mostly dry, ◐ mixed, ● mostly wet, dashed = not loaded), so it doesn't rely on color alone. A house marks the origin. Names label the pins where they fit (best-ranked first; overlapping pins sit side by side). Tapping a pin opens a card with rank, verdict, drive time and a link to the crag's card. The view fits all crags plus the origin. The map fills the page (min-height ≈ the heatmap's) and its canvas is `touch-action: none`, so dragging pans the map rather than swiping the pager. Plain wheel scrolls the page; ⌘/Ctrl + wheel or a pinch zooms.
   - **Adding a page:** pages are one data list (`PAGES` in `Overview.tsx`: id, label, render). A page renders on first visit, so a page can `React.lazy` its content. All pages share one grid row, so the panel keeps a constant height across pages.
3. **Cards**, sorted best-first by `viabilityScore` (see below).

### Card layout

1. Crag name, state, approximate drive time + distance from the origin (hidden if routing failed), a verdict pill ("3 of 4 days dry"), and its viability rank. The rank badge is a button: hover, tap, or press Enter on it for the score's per-factor breakdown (why the card ranks where it does).
2. **Day tiles** (Fri–Mon) — weather icon from NWS `shortForecast`, max chance of rain, inches. Tinted by `dayCondition`: dry / damp / wet. Hover, tap, or press Enter on a tile for the forecast text and wind. The tiles and the rank badge use a Base UI `Popover` with `openOnHover`, not a `Tooltip`, because Tooltip ignores touch and so never opens on a phone.
3. **Hourly precip strip** — one 96-hour timeline whose bars sit under each day's tile. Absolute sqrt scale (not per-card), so bar heights compare across crags.
4. **Temp band chart** — smooth hi/lo curves on the same 4-column grid, hand-rolled SVG, no chart library.
5. **Summit panel** — collapsed by default, only renders when `summit` is configured.
6. Footer links to weather.gov (48-hour hourly graph starting 8am Saturday) and meteoblue (week view, Saturday's tab open). Both use the crag's base coordinates; weather.gov's graph can't reach past ~4 days out, so further weekends clamp to its last window. Param details live next to the URL builders in `LocationCard.tsx`. White Mountains crags (Cannon, Cathedral, Whitehorse) opt in via `extraLinks` to a third link, "MWOBS Higher Summits": Mount Washington Observatory's regional summit forecast, labeled as such because it isn't crag-specific. The links row wraps on narrow screens.

## Viability score

`viabilityScore` (`src/lib/forecast.ts`) ranks the crags. It's in penalty points, so **lower is better**, and 0 means a dry weekend with highs in the comfort band at a crag within an hour's drive. Each day gets a weight *w* of 3 for Sat/Sun and 1 for Fri/Mon.

| Factor | Points | Notes |
|---|---|---|
| Rain | Σ *w* · (inches × 10 + PoP/100) | Dominant. 0.1″ ≈ 1 point, 100% PoP ≈ 1 point. |
| Wet rock | Σ *w* · 0.2 × (previous day's rain points) | Fri→Sat, Sat→Sun, Sun→Mon. Friday has no term because Thursday isn't summarized. |
| Temperature | Σ *w* · (0.05/°F below a 45°F high, 0.025/°F above a 75°F high) | Scored in °F whatever the display unit. A missing high counts 0. |
| Drive | 0.4 × (hours − 1), floored at 0, once per trip | Counts 0 when the drive time is unknown (routing loading or failed), so an outage leaves the weather-only order intact. |

For scale: a dry weekend with 30°F highs is 6.0 points, light showers on Saturday only (0.05″, 40%) are 2.7 + 0.5 wet rock, and the Gunks' 4½-hour drive from Boston is 1.4. The weights are named constants at the top of the scoring code.

## Theming

All colors are CSS custom properties defined once in `src/styles.css` as `light-dark()` pairs. `color-scheme: light dark` follows the OS. The theme toggle pins one side by setting `data-theme` on `<html>` (saved in `localStorage`). An inline script in `index.html` applies the saved choice before first paint.

## Units and preferences

Both APIs are asked for °F and inches (NWS QPF arrives in mm and is converted to inches on ingest), and everything internal (`DaySummary`, `viabilityScore`) stays in those units. The °F/°C and in/mm toggles are display-only: `src/lib/units.ts` (`formatTemp`, `formatPrecip`) converts at render time, so scoring and caching never depend on the user's choice. TempChart lays out its curve in °F and converts only the labels, so the shape is identical in either unit. Defaults are °F and inches.

User preferences live in `localStorage` through `src/lib/preferences.ts`: a typed store (`definePreference` + `usePreference`) that validates stored JSON, falls back to the default on garbage or blocked storage, and syncs every subscriber in the tab and across tabs. Reads are synchronous, so the first render already uses the saved units (no inline pre-paint script needed, unlike the theme). The theme keeps its own older `theme` key because `index.html` reads it before first paint.

## Caching

- Per-location response cached in `sessionStorage` with a 30-minute TTL.
- Honors NWS's recommended cache window and keeps repeated navigation cheap.
- Drive times are cached in `localStorage` per (origin rounded to ~100 m, crag) for 30 days. Drive times don't change week to week, so the Refresh button leaves them alone. Switching back to a previous origin needs no request.

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
- **OSM tiles are donation-funded, best-effort:** heavy use can be blocked without notice. If the site's traffic grows, move to a hosted provider (most need a key) or self-hosted tiles.
- **Routing/geocoding are volunteer-run public servers** (FOSSGIS, komoot) with no availability guarantee. Drive times are a nice-to-have, so failures just hide the distance, and the long cache keeps our request volume to roughly one per origin per month.
- **NWS User-Agent:** the API requests a custom User-Agent identifying the app. Browsers may strip it; setting `Accept: application/geo+json` is the practical lever we have.
