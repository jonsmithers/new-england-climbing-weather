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

- **NWS (`api.weather.gov`)** — `src/api/nws.ts` — the authoritative crag (base) forecast. Sequence: `GET /points/{lat},{lon}` → yields a `forecast` URL plus grid coords → then in parallel `GET <forecast>` (day/night periods: temp, isDaytime, PoP) and `GET /gridpoints/{gridId}/{x},{y}` (quantitative precipitation / QPF, in mm). `parsePrecip` expands multi-hour QPF entries (PT6H etc.) into flat per-hour readings.
- **Open-Meteo** — `src/api/openMeteo.ts` — summit panel only, and only for locations with a `summit` configured. Its `elevation` param gives summit-ish conditions without scraping. Returns daily min/max temp, PoP, precip sum (requested directly in °F / inches).

Data flow: `LOCATIONS` (`src/locations.ts`) → `App` renders one `LocationCard` per crag → each card independently fetches NWS and owns its own `loading | ok | error` state (one bad fetch never breaks the page). `SummitPanel` does the same against Open-Meteo when `location.summit` is set. Raw API responses are normalized into a shared `WeekendForecast` / `DaySummary[]` shape by `src/lib/forecast.ts` (`summarizeWeekend` for NWS, `summarizeSummitWeekend` for Open-Meteo).

### The "weekend" concept (`src/lib/weekend.ts`)

Despite the name, a `Weekend` covers **four days — Fri, Sat, Sun, Mon** (`days: Date[]`, in display order). `saturday` is the anchor: it is the pivot for external forecast links, `useEffect` dependency arrays, and cache reasoning. `weekendAt(offset)` shifts by whole weeks; the `WeekendPicker` drives `offset` from `App` state. When comparing forecast days, use `isSameDay` / `formatYmd` from this module — NWS periods are matched by local day, Open-Meteo daily rows by `YYYY-MM-DD` string.

### Caching

Per-location responses are cached in `sessionStorage` with a 30-minute TTL (honors NWS's recommended cache window). Each API module (`nws.ts`, `openMeteo.ts`) has its **own private `readCache`/`writeCache`** — the logic is duplicated, not shared. `src/lib/cache.ts` provides cross-cutting helpers (`clearForecastCache`, `getOldestCacheAgeMs`) used by the `RefreshFooter`; it matches entries by key **prefix**.

⚠️ **Cache key prefixes must stay in sync across three files.** `cache.ts` matches `['nws:', 'om:']`, `openMeteo.ts` writes `om:…`, and `nws.ts` writes `nws:…`. If you touch any cache key, reconcile all three or the global clear/age helpers will silently stop matching those entries.

## Common changes

- **Add/remove a crag:** edit `LOCATIONS` in `src/locations.ts`. Add an optional `summit: { lat, lon, elevationMeters, name? }` to enable the summit panel for that crag.
- **External forecast links** (`weather.gov` graphical hourly + `meteoblue`) are built in `LocationCard.tsx` (`buildForecastUrl`, `buildMeteoblueUrl`) — both have detailed comments on their URL params; keep those comments accurate if you change the query strings.

## Note on docs

`ARCHITECTURE.md` explains the *why* (source choices, out-of-scope decisions) and is worth reading for design rationale. Keep it in sync when you change data sources, the forecast window, or card layout.
