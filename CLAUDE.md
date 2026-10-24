# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server
- `npm run typecheck` — `tsc -b --noEmit`, no build output
- `npm run build` — typecheck (`tsc -b`) then production build to `dist/`
- `npm run preview` — serve the built `dist/`

There is no test runner and no linter/formatter configured. `typecheck` is the only automated gate.

## What this is

A static, single-page React app (React 19 + Vite + TypeScript) that shows a weekend weather forecast for a curated list of New England climbing crags, one card per crag. **No backend, no database, no auth, no API keys** — the browser calls free, CORS-enabled APIs directly (two for weather, plus routing and geocoding for drive times, plus keyless OpenStreetMap tiles for the map). Styling is plain CSS (one `.css` file per component); unstyled accessible primitives come from `@base-ui/react`.

## Architecture

Two weather sources, kept visually and structurally separate so "base of crag" numbers are never confused with "summit" numbers:

- **NWS (`api.weather.gov`)** — `src/api/nws.ts` — the authoritative crag (base) forecast. Two-step fetch: `/points` yields a forecast URL + grid coords, then the day/night periods and the gridpoint QPF are fetched in parallel (`parsePrecip` flattens multi-hour QPF into per-hour readings). See ARCHITECTURE.md for the full request sequence.
- **Open-Meteo** — `src/api/openMeteo.ts` — summit panel only, and only for locations with a `summit` configured. Its `elevation` param gives summit-ish conditions without scraping. Returns daily min/max temp, PoP, precip sum (requested directly in °F / inches).

Drive times (separate from the weather data):

- **OSRM on FOSSGIS (`routing.openstreetmap.de`)**: `src/api/routing.ts`. One `/table` request returns the drive time and distance from the origin to every crag. `useDriveTimes` (called from `App`) maps crag id to `Drive | null`. A crag missing from that map (loading or failed) shows no distance, and a failed call never breaks the page.
- **Photon (`photon.komoot.io`)**: `src/api/geocode.ts`, the place search in `OriginPicker`. It searches **on submit only**, never per keystroke (fair-use policy).
- The origin is the `ORIGIN` preference in `src/lib/origin.ts` (default: Davis Square, Somerville). Attribution for OSRM/OSM is required and lives in the `RefreshFooter` credits.

Map (the overview's third page):

- **`src/components/CragMap.tsx`** (`pigeon-maps` + OSM's `tile.openstreetmap.org` raster tiles) is imported only through `React.lazy` in `Overview.tsx`'s `PAGES`. Keep it that way: importing CragMap, pigeon-maps or CragMap.css from anything in the main bundle would pull the map into the initial load. Check `vite build` output for a separate `CragMap-*.js` chunk. The on-map "© OpenStreetMap contributors" link is required by the tile policy; don't hide it. Dark mode is a CSS filter on `.pigeon-tiles` (OSM has no dark style). Pins get rank + verdict from the ranked `OverviewRow`s and drive time from their optional `drive` field.

Data flow: `LOCATIONS` (`src/locations.ts`) → `useCragForecasts` (`src/hooks/`, called from `App`) fetches NWS for every crag in parallel and keeps a separate `loading | ok | error` state for each crag (one bad fetch never breaks the page) → `App` ranks crags best-first by `viabilityScore` (penalty points, lower is better: rain, prior-day "wet rock", temperature outside a comfort band, and drive time beyond an hour; formula in ARCHITECTURE.md) and passes them to `Overview` (best-bet spotlight + a swipeable Rain | Temperature | Map panel whose pages are a data list, `PAGES`) and to one `LocationCard` per crag. `SummitPanel` fetches Open-Meteo itself when `location.summit` is set. Raw API responses are normalized into a shared `WeekendForecast` / `DaySummary[]` shape by `src/lib/forecast.ts` (`summarizeWeekend` for NWS, `summarizeSummitWeekend` for Open-Meteo).

### The "weekend" concept (`src/lib/weekend.ts`)

Despite the name, a `Weekend` covers **four days — Fri, Sat, Sun, Mon** (`days: Date[]`, in display order). `saturday` is the anchor: it is the pivot for external forecast links, `useEffect` dependency arrays, and cache reasoning. `weekendAt(offset)` shifts by whole weeks; the `WeekendPicker` drives `offset` from `App` state. When comparing forecast days, use `isSameDay` / `formatYmd` from this module — NWS periods are matched by local day, Open-Meteo daily rows by `YYYY-MM-DD` string.

### Caching

Per-location responses are cached in `sessionStorage` with a 30-minute TTL (honors NWS's recommended cache window). Each API module (`nws.ts`, `openMeteo.ts`) has its **own private `readCache`/`writeCache`** — the logic is duplicated, not shared. `src/lib/cache.ts` provides cross-cutting helpers (`clearForecastCache`, `getOldestCacheAgeMs`) used by the `RefreshFooter`; it matches entries by key **prefix**, and exports `CACHE_PREFIX` as the single source of truth for those prefixes.

Drive times are cached separately in `localStorage` under `drive:<origin lat,lon to 3 dp>:<crag id>` with a 30-day TTL (`src/api/routing.ts`). That prefix is deliberately **not** in `CACHE_PREFIX`, so the forecast Refresh button doesn't clear drive times.

### Theming

Colors are tokens in `src/styles.css`, each one a `light-dark()` pair. Use the tokens; don't hard-code colors in component CSS. The theme toggle (`src/lib/theme.ts`) sets `data-theme` on `<html>`. `index.html` has an inline script that applies the saved theme before first paint, and it shares the `theme` localStorage key with `theme.ts`.

### Units and preferences

Internal data is always °F and inches. The °F/°C and in/mm header toggles (`src/components/UnitToggle.tsx`) only affect display: format every displayed temperature or precip amount with `formatTemp` / `formatPrecip` from `src/lib/units.ts`, never by hand. Unit choices are stored with `src/lib/preferences.ts`, a generic typed localStorage store (`definePreference(key, default, validator)` + `usePreference(pref)`, synced across components and tabs). Use it for new user preferences; `theme.ts` stays on its own key because of the `index.html` pre-paint script.

## Common changes

- **Add/remove a crag:** edit `LOCATIONS` in `src/locations.ts`. Each crag needs a `region` (state abbreviation). Add an optional `summit: { lat, lon, elevationMeters, name? }` to enable the summit panel for that crag.
- **Tune the ranking:** the weights are named constants above `viabilityScore` in `src/lib/forecast.ts`. Keep the table in ARCHITECTURE.md's "Viability score" section and the `CardInfo` breakdown labels in `LocationCard.tsx` in sync with them.
- **External forecast links** (`weather.gov` graphical hourly + `meteoblue`, on every card) are built in `LocationCard.tsx` (`buildForecastUrl`, `buildMeteoblueUrl`) — both have detailed comments on their URL params; keep those comments accurate if you change the query strings. Extra per-crag links are opt-in: list ids in a crag's `extraLinks` in `src/locations.ts`; each id's label and URL live in `EXTRA_LINKS` in `LocationCard.tsx`. Today the only one is `mwobs` (Mount Washington Observatory Higher Summits Forecast), set on the White Mountains crags (Cannon, Cathedral, Whitehorse; not Rumney).

## Note on docs

`ARCHITECTURE.md` explains the *why* (source choices, out-of-scope decisions) and is worth reading for design rationale. Keep it in sync when you change data sources, the forecast window, or card layout.
