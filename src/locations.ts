export type Location = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  summit?: {
    lat: number;
    lon: number;
    elevationMeters: number;
    name?: string;
  };
};

export const LOCATIONS: Location[] = [
  { id: 'gunks', name: 'The Gunks', lat: 41.7711, lon: -74.1873 },
  { id: 'rumney', name: 'Rumney', lat: 43.8056, lon: -71.8275 },
  { id: 'cathedral', name: 'Cathedral Ledge', lat: 44.0667, lon: -71.1773 },
  { id: 'whitehorse', name: 'Whitehorse Ledge', lat: 44.0590, lon: -71.1859 },
  {
    id: 'cannon',
    name: 'Cannon Cliff',
    lat: 44.1581,
    lon: -71.6989,
    summit: {
      lat: 44.1585,
      lon: -71.6916,
      elevationMeters: 1238,
      name: 'Cannon Mountain',
    },
  },
  { id: 'farley', name: 'Farley Ledge', lat: 42.6017, lon: -72.4773 },
  { id: 'ragged', name: 'Ragged Mountain (CT)', lat: 41.6111, lon: -72.8639 },
  { id: 'crowhill', name: 'Crow Hill', lat: 42.5722, lon: -71.8911 },
  { id: 'pawtuckaway', name: 'Pawtuckaway', lat: 43.0945, lon: -71.1605 },
  { id: 'quincy', name: 'Quincy Quarries', lat: 42.2360, lon: -71.0245 },
];
