import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Map as PigeonMap, type PigeonProps, type Point } from 'pigeon-maps';
import type { Location } from '../locations';
import type { Drive } from '../api/routing';
import { type Origin, ORIGIN } from '../lib/origin';
import { usePreference } from '../lib/preferences';
import { formatDriveDistance, formatDriveTime } from '../lib/drive';
import { weekendVerdict, type Verdict } from '../lib/forecast';
import type { OverviewRow } from './Overview';
import './CragMap.css';

// The Map page of the overview pager. Lazy-loaded (default export for
// React.lazy), so pigeon-maps, this file and CragMap.css are a separate chunk
// that's fetched only when the page is first opened, and no tile is requested
// before that.

// OpenStreetMap's standard raster tiles: keyless, but under the OSMF tile
// usage policy (attribution on the map, browser-default Referer, no
// prefetching or bulk use). There is no dark style; CragMap.css filters the
// tile layer in dark mode instead.
function osmTile(x: number, y: number, z: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

const MIN_ZOOM = 5;
const MAX_ZOOM = 16;
// Room around the fitted bounds for pins and labels, in px. The right side
// also clears the zoom buttons.
const FIT_PAD = { top: 36, right: 60, bottom: 40, left: 36 };

type Level = Verdict['level'] | 'unknown';

type Pin = {
  location: Location;
  rank: number | null;
  level: Level;
  verdict: string;
  drive: Drive | null | undefined;
};

type Props = {
  // Ranked best-first, the same rows the other pages get.
  rows: OverviewRow[];
};

export default function CragMap({ rows }: Props) {
  const [origin] = usePreference(ORIGIN);
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [view, setView] = useState<{ center: Point; zoom: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Until the user pans or zooms, a resize (phone rotation) refits the view.
  const moved = useRef(false);
  const fitted = useRef<{ center: Point; zoom: number } | null>(null);

  const pins = toPins(rows);
  const scored = pins.filter((p) => p.rank != null).length;

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setSize({ width, height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = () => {
    if (!size) return;
    moved.current = false;
    fitted.current = fitView([...locationPoints(rows), [origin.lat, origin.lon]], size);
    setView(fitted.current);
  };

  // Fit on first measure, on resize (until the user moves the map), and
  // whenever the origin changes.
  const fitKey = `${origin.lat},${origin.lon}`;
  const lastFitKey = useRef(fitKey);
  useEffect(() => {
    if (!size) return;
    const originChanged = lastFitKey.current !== fitKey;
    lastFitKey.current = fitKey;
    if (view && moved.current && !originChanged) return;
    fit();
  }, [size, fitKey]);

  const zoomBy = (delta: number) => {
    if (!view) return;
    moved.current = true;
    // Step to the next whole level, so a fractional fitted zoom lands on crisp tiles.
    const next = delta > 0 ? Math.floor(view.zoom) + delta : Math.ceil(view.zoom) + delta;
    setView({ ...view, zoom: clamp(next, MIN_ZOOM, MAX_ZOOM) });
  };

  const selectedPin = pins.find((p) => p.location.id === selected) ?? null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && selected) {
      e.stopPropagation();
      const id = selected;
      setSelected(null);
      frameRef.current?.querySelector<HTMLElement>(`[data-pin="${id}"]`)?.focus();
    }
  };

  return (
    <div className="crag-map-page">
      <div className="crag-map" ref={frameRef} onKeyDown={onKeyDown}>
        {view && size && (
          <div className="crag-map-canvas">
            <PigeonMap
              provider={osmTile}
              center={view.center}
              zoom={view.zoom}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              // Plain wheel scrolls the page; ⌘/Ctrl + wheel (and trackpad
              // pinch, which sends ctrlKey) zooms. An empty warning disables
              // pigeon's own "use ⌘ to zoom" overlay.
              metaWheelZoom
              metaWheelZoomWarning=""
              attribution={false}
              onBoundsChanged={({ center, zoom, initial }) => {
                // The end of a fit's own animation isn't a user move.
                if (!initial && !sameView({ center, zoom }, fitted.current)) moved.current = true;
                setView({ center, zoom });
              }}
              onClick={() => setSelected(null)}
            >
              <PinLayer
                pins={pins}
                origin={origin}
                selected={selected}
                onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
              />
            </PigeonMap>
          </div>
        )}

        <div className="crag-map-controls">
          <button type="button" className="crag-map-btn" onClick={() => zoomBy(1)} aria-label="Zoom in">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
          <button type="button" className="crag-map-btn" onClick={() => zoomBy(-1)} aria-label="Zoom out">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M3 8h10" />
            </svg>
          </button>
          <button type="button" className="crag-map-btn" onClick={fit} aria-label="Show all crags">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
            </svg>
          </button>
        </div>

        {selectedPin && (
          <PinCard
            pin={selectedPin}
            scored={scored}
            origin={origin}
            onClose={() => {
              const id = selectedPin.location.id;
              setSelected(null);
              frameRef.current?.querySelector<HTMLElement>(`[data-pin="${id}"]`)?.focus();
            }}
          />
        )}

        <div className="crag-map-attribution">
          ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{' '}
          contributors
        </div>
      </div>

      <div className="crag-map-legend" aria-hidden>
        <span><LevelGlyph level="dry" /> Mostly dry</span>
        <span><LevelGlyph level="damp" /> Mixed</span>
        <span><LevelGlyph level="wet" /> Mostly wet</span>
        <span><HomeGlyph /> Start</span>
        <span className="crag-map-legend-note">Number = rank</span>
      </div>
    </div>
  );
}

function toPins(rows: OverviewRow[]): Pin[] {
  return rows.map(({ location, state, drive }, i) => {
    if (state?.status === 'ok') {
      const verdict = weekendVerdict(state.data);
      // Matches the card's rank: the rows are ranked, and only scored
      // (loaded) crags have a rank.
      return { location, rank: i + 1, level: verdict.level, verdict: verdict.label, drive };
    }
    return {
      location,
      rank: null,
      level: 'unknown',
      verdict: state?.status === 'error' ? 'Forecast unavailable' : 'Loading forecast…',
      drive,
    };
  });
}

function locationPoints(rows: OverviewRow[]): Point[] {
  return rows.map(({ location }) => [location.lat, location.lon]);
}

// --- Pins -------------------------------------------------------------------

// Pigeon positions its children itself and hands each one latLngToPixel and
// the live map state, so one layer can lay out every pin and decide which
// labels fit. It re-renders on every frame of a pan or zoom.
type PinLayerProps = PigeonProps & {
  pins: Pin[];
  origin: Origin;
  selected: string | null;
  onSelect: (id: string) => void;
};

type Box = { x0: number; y0: number; x1: number; y1: number };

const PIN_W = 38;
const PIN_H = 24;
// Pins that would overlap share one anchor and sit side by side, e.g.
// Cathedral and Whitehorse, which are a kilometer apart.
const GROUP_DX = PIN_W;
const GROUP_DY = PIN_H;
const LABEL_H = 16;
const LABEL_CHAR_W = 6.4;

function PinLayer({ pins, origin, selected, onSelect, latLngToPixel, mapState }: PinLayerProps) {
  if (!latLngToPixel || !mapState) return null;
  const { width, height } = mapState;

  // Greedy grouping in rank order, so the best crag anchors its group.
  const groups: { x: number; y: number; pins: Pin[] }[] = [];
  for (const pin of pins) {
    const [x, y] = latLngToPixel([pin.location.lat, pin.location.lon]);
    // Join the nearest group it would overlap (Whitehorse → Cathedral, not
    // Cannon).
    let near: (typeof groups)[number] | undefined;
    for (const g of groups) {
      if (Math.abs(g.x - x) >= GROUP_DX || Math.abs(g.y - y) >= GROUP_DY) continue;
      if (!near || Math.hypot(g.x - x, g.y - y) < Math.hypot(near.x - x, near.y - y)) near = g;
    }
    if (near) near.pins.push(pin);
    else groups.push({ x, y, pins: [pin] });
  }

  const [ox, oy] = latLngToPixel([origin.lat, origin.lon]);
  const groupBox = (g: (typeof groups)[number]): Box => {
    const w = g.pins.length * PIN_W;
    return { x0: g.x - w / 2, y0: g.y - PIN_H / 2, x1: g.x + w / 2, y1: g.y + PIN_H / 2 };
  };
  const taken: Box[] = [
    ...groups.map(groupBox),
    { x0: ox - 11, y0: oy - 11, x1: ox + 11, y1: oy + 11 },
  ];

  // Label each group to the right of its pins, or else the left, if that
  // spot is on the map and clear of every pin and earlier label. Higher-ranked
  // groups place first; a label that doesn't fit is dropped (the pin's
  // accessible name and its card still carry the name).
  const place = (text: string, box: Box): 'right' | 'left' | null => {
    const w = text.length * LABEL_CHAR_W + 10;
    const cy = (box.y0 + box.y1) / 2;
    for (const side of ['right', 'left'] as const) {
      const x0 = side === 'right' ? box.x1 + 3 : box.x0 - 3 - w;
      const b = { x0, y0: cy - LABEL_H / 2, x1: x0 + w, y1: cy + LABEL_H / 2 };
      const onMap = b.x0 >= 4 && b.x1 <= width - 4 && b.y0 >= 4 && b.y1 <= height - 4;
      if (onMap && !taken.some((t) => overlaps(t, b))) {
        taken.push(b);
        return side;
      }
    }
    return null;
  };

  const placed = groups.map((g) => {
    const text = g.pins.map((p) => p.location.name).join(' · ');
    return { ...g, text, side: place(text, groupBox(g)) };
  });
  const originText = origin.label.split(',')[0];
  const originSide = place(originText, taken[groups.length]);

  return (
    <div className="crag-map-pins">
      <div
        className="crag-map-origin"
        style={{ left: ox, top: oy }}
        role="img"
        aria-label={`Drive start: ${origin.label}`}
      >
        <HomeGlyph />
        {originSide && (
          <span className={`crag-map-label crag-map-label-${originSide}`} aria-hidden>
            {originText}
          </span>
        )}
      </div>
      {placed.map((g) => (
        <div key={g.pins[0].location.id} className="crag-map-group" style={{ left: g.x, top: g.y }}>
          {g.pins.map((pin) => {
            const id = pin.location.id;
            return (
              <button
                key={id}
                type="button"
                data-pin={id}
                // pigeon-drag-block: pressing a pin doesn't start a pan.
                // pigeon-click-block: clicking it isn't a map background click.
                className={`crag-map-pin crag-map-pin-${pin.level} pigeon-drag-block pigeon-click-block`}
                aria-label={`${pin.rank != null ? `#${pin.rank} ` : ''}${pin.location.name}, ${pin.verdict}`}
                aria-pressed={selected === id}
                aria-controls={selected === id ? 'crag-map-card' : undefined}
                onClick={() => onSelect(id)}
              >
                <LevelGlyph level={pin.level} />
                <span className="crag-map-rank">{pin.rank ?? '–'}</span>
              </button>
            );
          })}
          {g.side && (
            <span className={`crag-map-label crag-map-label-${g.side}`} aria-hidden>
              {g.text}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function PinCard({
  pin,
  scored,
  origin,
  onClose,
}: {
  pin: Pin;
  scored: number;
  origin: Origin;
  onClose: () => void;
}) {
  const { location, rank, level, verdict, drive } = pin;
  return (
    <div className="crag-map-card" id="crag-map-card" role="region" aria-label={location.name}>
      <div className="crag-map-card-head">
        <span className="crag-map-card-title">
          {rank != null && <span className="crag-map-card-rank">#{rank}</span>}
          {location.name}
          <span className="crag-map-card-region">{location.region}</span>
        </span>
        <button type="button" className="crag-map-card-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <span className={`crag-map-card-verdict crag-map-card-verdict-${level}`}>
        <LevelGlyph level={level} />
        {verdict}
        {rank != null && <span className="crag-map-card-of">· rank {rank} of {scored}</span>}
      </span>
      {drive && (
        <span className="crag-map-card-drive">
          {formatDriveTime(drive)} · {formatDriveDistance(drive)} from {origin.label.split(',')[0]}
        </span>
      )}
      <a className="crag-map-card-link" href={`#crag-${location.id}`}>
        Jump to forecast
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
          <path d="M8 3v10M4 9l4 4 4-4" />
        </svg>
      </a>
    </div>
  );
}

// Verdict glyph: the fill amount is the wetness (hollow = mostly dry, half =
// mixed, solid = mostly wet, dashed = not loaded), so the pin doesn't rely
// on color alone.
function LevelGlyph({ level }: { level: Level }) {
  return (
    <svg className={`crag-map-glyph crag-map-glyph-${level}`} viewBox="0 0 12 12" width="12" height="12" aria-hidden>
      <circle cx="6" cy="6" r="4.6" className="crag-map-glyph-ring" />
      {level === 'damp' && <path d="M6 1.4a4.6 4.6 0 0 1 0 9.2z" className="crag-map-glyph-fill" />}
      {level === 'wet' && <circle cx="6" cy="6" r="4.6" className="crag-map-glyph-fill" />}
    </svg>
  );
}

function HomeGlyph() {
  return (
    <svg className="crag-map-home" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <path d="M2.5 7.5 8 2.5l5.5 5V13.5h-4v-3.5h-3v3.5h-4z" />
    </svg>
  );
}

// --- View math (Web Mercator, as the tiles use) -----------------------------

function sameView(
  a: { center: Point; zoom: number },
  b: { center: Point; zoom: number } | null,
): boolean {
  return (
    b != null &&
    Math.abs(a.zoom - b.zoom) < 0.01 &&
    Math.abs(a.center[0] - b.center[0]) < 1e-4 &&
    Math.abs(a.center[1] - b.center[1]) < 1e-4
  );
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const toX = (lon: number) => (lon + 180) / 360;
const toY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
};
const fromX = (x: number) => x * 360 - 180;
const fromY = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

// Center and zoom that fit every point inside the frame, FIT_PAD inside
// each edge. The zoom may be fractional (pigeon scales the nearest tile level);
// a whole-level floor left half the frame empty.
function fitView(
  points: Point[],
  size: { width: number; height: number },
): { center: Point; zoom: number } {
  const xs = points.map(([, lon]) => toX(lon));
  const ys = points.map(([lat]) => toY(lat));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const { top, right, bottom, left } = FIT_PAD;
  const w = Math.max(size.width - left - right, 64);
  const h = Math.max(size.height - top - bottom, 64);
  const fitted = Math.log2(Math.min(w / ((x1 - x0) * 256 || 1e-9), h / ((y1 - y0) * 256 || 1e-9)));
  const zoom = clamp(Math.floor(fitted * 10) / 10, MIN_ZOOM, MAX_ZOOM);
  // The bounds' middle sits mid-way between the paddings, not at the frame's
  // center, so shift the center by half the padding difference.
  const worldPx = 256 * 2 ** zoom;
  const cx = (x0 + x1) / 2 + (right - left) / 2 / worldPx;
  const cy = (y0 + y1) / 2 + (bottom - top) / 2 / worldPx;
  return { center: [fromY(cy), fromX(cx)], zoom };
}
