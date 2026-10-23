# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server
- `npm run typecheck` — `tsc -b --noEmit`, no build output
- `npm run build` — typecheck (`tsc -b`) then production build to `dist/`
- `npm run preview` — serve the built `dist/`

There is no test runner and no linter/formatter configured. `typecheck` is the only automated gate.

## What this is

A static, single-page React app (React 19 + Vite + TypeScript) that shows a weekend weather forecast for a curated list of New England climbing crags, one card per crag. **No backend, no database, no auth, no API keys** — the browser calls two free, CORS-enabled weather APIs directly. Styling is plain CSS (one `.css` file per component); unstyled accessible primitives come from `@base-ui/react`.

## Architecture

Two weather sources, kept visually and structurally separate so "base of crag" numbers are never confused with "summit" numbers:

- **NWS (`api.weather.gov`)** — `src/api/nws.ts` — the authoritative crag (base) forecast. Two-step fetch: `/points` yields a forecast URL + grid coords, then the day/night periods and the gridpoint QPF are fetched in parallel (`parsePrecip` flattens multi-hour QPF into per-hour readings). See ARCHITECTURE.md for the full request sequence.
- **Open-Meteo** — `src/api/openMeteo.ts` — summit panel only, and only for locations with a `summit` configured. Its `elevation` param gives summit-ish conditions without scraping. Returns daily min/max temp, PoP, precip sum (requested directly in °F / inches).

Data flow: `LOCATIONS` (`src/locations.ts`) → `useCragForecasts` (`src/hooks/`, called from `App`) fetches NWS for every crag in parallel and keeps a separate `loading | ok | error` state for each crag (one bad fetch never breaks the page) → `App` ranks crags driest-first by `rainScore` and passes them to `Overview` (best-bet spotlight + heatmap) and to one `LocationCard` per crag. `SummitPanel` fetches Open-Meteo itself when `location.summit` is set. Raw API responses are normalized into a shared `WeekendForecast` / `DaySummary[]` shape by `src/lib/forecast.ts` (`summarizeWeekend` for NWS, `summarizeSummitWeekend` for Open-Meteo).

### The "weekend" concept (`src/lib/weekend.ts`)

Despite the name, a `Weekend` covers **four days — Fri, Sat, Sun, Mon** (`days: Date[]`, in display order). `saturday` is the anchor: it is the pivot for external forecast links, `useEffect` dependency arrays, and cache reasoning. `weekendAt(offset)` shifts by whole weeks; the `WeekendPicker` drives `offset` from `App` state. When comparing forecast days, use `isSameDay` / `formatYmd` from this module — NWS periods are matched by local day, Open-Meteo daily rows by `YYYY-MM-DD` string.

### Caching

Per-location responses are cached in `sessionStorage` with a 30-minute TTL (honors NWS's recommended cache window). Each API module (`nws.ts`, `openMeteo.ts`) has its **own private `readCache`/`writeCache`** — the logic is duplicated, not shared. `src/lib/cache.ts` provides cross-cutting helpers (`clearForecastCache`, `getOldestCacheAgeMs`) used by the `RefreshFooter`; it matches entries by key **prefix**, and exports `CACHE_PREFIX` as the single source of truth for those prefixes.

### Theming

Colors are tokens in `src/styles.css`, each one a `light-dark()` pair. Use the tokens; don't hard-code colors in component CSS. The theme toggle (`src/lib/theme.ts`) sets `data-theme` on `<html>`. `index.html` has an inline script that applies the saved theme before first paint, and it shares the `theme` localStorage key with `theme.ts`.

### Units and preferences

Internal data is always °F and inches. The °F/°C and in/mm header toggles (`src/components/UnitToggle.tsx`) only affect display: format every displayed temperature or precip amount with `formatTemp` / `formatPrecip` from `src/lib/units.ts`, never by hand. Unit choices are stored with `src/lib/preferences.ts`, a generic typed localStorage store (`definePreference(key, default, validator)` + `usePreference(pref)`, synced across components and tabs). Use it for new user preferences; `theme.ts` stays on its own key because of the `index.html` pre-paint script.

## Common changes

- **Add/remove a crag:** edit `LOCATIONS` in `src/locations.ts`. Each crag needs a `region` (state abbreviation). Add an optional `summit: { lat, lon, elevationMeters, name? }` to enable the summit panel for that crag.
- **External forecast links** (`weather.gov` graphical hourly + `meteoblue`) are built in `LocationCard.tsx` (`buildForecastUrl`, `buildMeteoblueUrl`) — both have detailed comments on their URL params; keep those comments accurate if you change the query strings.

## Note on docs

`ARCHITECTURE.md` explains the *why* (source choices, out-of-scope decisions) and is worth reading for design rationale. Keep it in sync when you change data sources, the forecast window, or card layout.
