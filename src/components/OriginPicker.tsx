import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { usePreference } from '../lib/preferences';
import { DEFAULT_ORIGIN, ORIGIN, isDefaultOrigin, type Origin } from '../lib/origin';
import { searchPlaces } from '../api/geocode';
import './OriginPicker.css';

type Search =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'done'; results: Origin[] }
  | { status: 'error' };

// Header control for where drive times are measured from. Searches only on
// submit, per the geocoder's fair-use policy (no per-keystroke requests).
export function OriginPicker() {
  const [origin, setOrigin] = usePreference(ORIGIN);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<Search>({ status: 'idle' });

  const choose = (next: Origin) => {
    setOrigin(next);
    setOpen(false);
    setQuery('');
    setSearch({ status: 'idle' });
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="origin-trigger" title="Change where drive times start">
        <CarIcon />
        <span className="origin-trigger-label">{origin.label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8}>
          <Popover.Popup className="origin-popup">
            <Popover.Title className="origin-title">Drive times from</Popover.Title>
            <p className="origin-current">{origin.label}</p>
            <form
              className="origin-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!query.trim() || search.status === 'searching') return;
                setSearch({ status: 'searching' });
                searchPlaces(query)
                  .then((results) => setSearch({ status: 'done', results }))
                  .catch(() => setSearch({ status: 'error' }));
              }}
            >
              <input
                className="origin-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Town, address, or place"
                aria-label="Search for a starting place"
              />
              <button className="origin-search" type="submit" disabled={!query.trim()}>
                Search
              </button>
            </form>

            {search.status === 'searching' && <p className="origin-status">Searching…</p>}
            {search.status === 'error' && (
              <p className="origin-status">Search failed. Try again in a moment.</p>
            )}
            {search.status === 'done' && search.results.length === 0 && (
              <p className="origin-status">No matches.</p>
            )}
            {search.status === 'done' && search.results.length > 0 && (
              <ul className="origin-results">
                {search.results.map((r) => (
                  <li key={`${r.lat},${r.lon},${r.label}`}>
                    <button type="button" className="origin-result" onClick={() => choose(r)}>
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="origin-foot">
              {!isDefaultOrigin(origin) && (
                <button
                  type="button"
                  className="origin-reset"
                  onClick={() => choose(DEFAULT_ORIGIN)}
                >
                  Reset to {DEFAULT_ORIGIN.label}
                </button>
              )}
              <span className="origin-credit">
                Search by{' '}
                <a href="https://photon.komoot.io/" target="_blank" rel="noopener noreferrer">
                  Photon
                </a>
              </span>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function CarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      <path
        d="M2.5 10.5V8.2l1.3-3.3A1.5 1.5 0 0 1 5.2 4h5.6a1.5 1.5 0 0 1 1.4.9l1.3 3.3v2.3a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5zM2.5 8.2h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="11.5" r="1.3" fill="currentColor" />
      <circle cx="11" cy="11.5" r="1.3" fill="currentColor" />
    </svg>
  );
}
