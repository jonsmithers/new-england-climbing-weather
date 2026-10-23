export type Location = {
  id: string;
  name: string;
  // State abbreviation, shown as a small tag on the card.
  region: string;
  lat: number;
  lon: number;
  summit?: {
    lat: number;
    lon: number;
    elevationMeters: number;
    name?: string;
  };
  // Opt-in external links shown after the weather.gov/meteoblue pair every
  // card gets. Labels and URLs live in EXTRA_LINKS in LocationCard.tsx.
  extraLinks?: ExtraLinkId[];
};

// 'mwobs' = Mount Washington Observatory's Higher Summits Forecast, a
// regional White Mountains forecast (not crag-specific).
export type ExtraLinkId = 'mwobs';

export const LOCATIONS: Location[] = [
  { id: 'gunks', name: 'The Gunks', region: 'NY', lat: 41.7711, lon: -74.1873 },
  { id: 'rumney', name: 'Rumney', region: 'NH', lat: 43.8056, lon: -71.8275 },
  {
    id: 'cathedral',
    name: 'Cathedral Ledge',
    region: 'NH',
    lat: 44.0667,
    lon: -71.1773,
    extraLinks: ['mwobs'],
  },
  {
    id: 'whitehorse',
    name: 'Whitehorse Ledge',
    region: 'NH',
    lat: 44.0590,
    lon: -71.1859,
    extraLinks: ['mwobs'],
  },
  {
    id: 'cannon',
    name: 'Cannon Cliff',
    region: 'NH',
    lat: 44.1581,
    lon: -71.6989,
    summit: {
      lat: 44.1585,
      lon: -71.6916,
      elevationMeters: 1238,
      name: 'Cannon Mountain',
    },
    extraLinks: ['mwobs'],
  },
  { id: 'farley', name: 'Farley Ledge', region: 'MA', lat: 42.6017, lon: -72.4773 },
  { id: 'ragged', name: 'Ragged Mountain', region: 'CT', lat: 41.6111, lon: -72.8639 },
  { id: 'crowhill', name: 'Crow Hill', region: 'MA', lat: 42.5722, lon: -71.8911 },
  { id: 'pawtuckaway', name: 'Pawtuckaway', region: 'NH', lat: 43.0945, lon: -71.1605 },
  { id: 'quincy', name: 'Quincy Quarries', region: 'MA', lat: 42.2360, lon: -71.0245 },
  { id: 'rossrocks', name: 'Ross Rocks', region: 'CT', lat: 41.77851, lon: -71.86603 },
];
