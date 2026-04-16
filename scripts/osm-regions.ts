/**
 * osm-regions.ts — Bounding box regions for OSM/Overpass dental collector.
 *
 * UK + AU regions copied verbatim from auto-100-dental-v3.ts (lines 45-102),
 * which were hand-curated earlier. US regions are added here for the first
 * time — 20 major metros that OSM generally has good coverage on.
 *
 * Bbox format: [south, west, north, east] in decimal degrees.
 * (Note: Overpass API itself expects "south,west,north,east" comma string,
 * converted at query build time.)
 */

export type MarketCode = 'US' | 'UK' | 'AU';

export interface OsmRegion {
  code: string;                                          // e.g. "US-AUSTIN"
  country: MarketCode;
  city: string;                                          // display name
  bbox: [number, number, number, number];                // [S, W, N, E]
}

export const OSM_REGIONS: OsmRegion[] = [
  // ─── US — 20 major metros ───────────────────────────────────────────────
  { code: 'US-NYC',           country: 'US', city: 'New York NY',       bbox: [40.55, -74.10, 40.92, -73.70] },
  { code: 'US-LA',            country: 'US', city: 'Los Angeles CA',    bbox: [33.70, -118.50, 34.30, -118.15] },
  { code: 'US-CHICAGO',       country: 'US', city: 'Chicago IL',        bbox: [41.65, -87.85, 42.02, -87.52] },
  { code: 'US-HOUSTON',       country: 'US', city: 'Houston TX',        bbox: [29.55, -95.68, 29.95, -95.20] },
  { code: 'US-PHOENIX',       country: 'US', city: 'Phoenix AZ',        bbox: [33.30, -112.32, 33.75, -111.92] },
  { code: 'US-PHILADELPHIA',  country: 'US', city: 'Philadelphia PA',   bbox: [39.88, -75.28, 40.14, -75.00] },
  { code: 'US-SAN-ANTONIO',   country: 'US', city: 'San Antonio TX',    bbox: [29.30, -98.72, 29.60, -98.35] },
  { code: 'US-SAN-DIEGO',     country: 'US', city: 'San Diego CA',      bbox: [32.55, -117.30, 32.90, -117.05] },
  { code: 'US-DALLAS',        country: 'US', city: 'Dallas TX',         bbox: [32.63, -96.95, 32.95, -96.60] },
  { code: 'US-AUSTIN',        country: 'US', city: 'Austin TX',         bbox: [30.10, -97.95, 30.52, -97.56] },
  { code: 'US-JACKSONVILLE',  country: 'US', city: 'Jacksonville FL',   bbox: [30.20, -81.85, 30.50, -81.45] },
  { code: 'US-COLUMBUS',      country: 'US', city: 'Columbus OH',       bbox: [39.85, -83.15, 40.12, -82.80] },
  { code: 'US-CHARLOTTE',     country: 'US', city: 'Charlotte NC',      bbox: [35.10, -80.95, 35.40, -80.65] },
  { code: 'US-NASHVILLE',     country: 'US', city: 'Nashville TN',      bbox: [36.02, -86.90, 36.32, -86.60] },
  { code: 'US-SEATTLE',       country: 'US', city: 'Seattle WA',        bbox: [47.48, -122.45, 47.74, -122.22] },
  { code: 'US-DENVER',        country: 'US', city: 'Denver CO',         bbox: [39.60, -105.12, 39.82, -104.80] },
  { code: 'US-BOSTON',        country: 'US', city: 'Boston MA',         bbox: [42.23, -71.20, 42.40, -70.95] },
  { code: 'US-PORTLAND',      country: 'US', city: 'Portland OR',       bbox: [45.45, -122.80, 45.62, -122.50] },
  { code: 'US-ATLANTA',       country: 'US', city: 'Atlanta GA',        bbox: [33.65, -84.55, 33.89, -84.28] },
  { code: 'US-MIAMI',         country: 'US', city: 'Miami FL',          bbox: [25.70, -80.35, 25.92, -80.12] },

  // US — smaller cities (better Overpass success rate, less rate-limited)
  { code: 'US-TUCSON',        country: 'US', city: 'Tucson AZ',         bbox: [32.15, -111.02, 32.30, -110.85] },
  { code: 'US-ALBUQUERQUE',   country: 'US', city: 'Albuquerque NM',    bbox: [35.03, -106.72, 35.15, -106.55] },
  { code: 'US-OMAHA',         country: 'US', city: 'Omaha NE',          bbox: [41.20, -96.05, 41.32, -95.88] },
  { code: 'US-SPOKANE',       country: 'US', city: 'Spokane WA',        bbox: [47.62, -117.48, 47.72, -117.35] },
  { code: 'US-RICHMOND',      country: 'US', city: 'Richmond VA',       bbox: [37.50, -77.55, 37.60, -77.40] },
  { code: 'US-WICHITA',       country: 'US', city: 'Wichita KS',        bbox: [37.63, -97.40, 37.75, -97.25] },
  { code: 'US-TOLEDO',        country: 'US', city: 'Toledo OH',          bbox: [41.62, -83.62, 41.70, -83.50] },
  { code: 'US-KNOXVILLE',     country: 'US', city: 'Knoxville TN',      bbox: [35.92, -84.00, 36.00, -83.85] },
  { code: 'US-RALEIGH',       country: 'US', city: 'Raleigh NC',        bbox: [35.72, -78.72, 35.84, -78.58] },
  { code: 'US-LEXINGTON',     country: 'US', city: 'Lexington KY',      bbox: [37.97, -84.55, 38.08, -84.42] },

  // ─── UK — copied from auto-100-dental-v3.ts lines 47-91 (44 regions) ───
  { code: 'UK-LONDON',        country: 'UK', city: 'London',            bbox: [51.28, -0.51, 51.69, 0.33] },
  { code: 'UK-MANCHESTER',    country: 'UK', city: 'Manchester',        bbox: [53.35, -2.30, 53.55, -2.08] },
  { code: 'UK-BIRMINGHAM',    country: 'UK', city: 'Birmingham',        bbox: [52.40, -2.00, 52.55, -1.75] },
  { code: 'UK-LEEDS',         country: 'UK', city: 'Leeds',             bbox: [53.75, -1.62, 53.88, -1.40] },
  { code: 'UK-LIVERPOOL',     country: 'UK', city: 'Liverpool',         bbox: [53.35, -3.05, 53.48, -2.85] },
  { code: 'UK-BRISTOL',       country: 'UK', city: 'Bristol',           bbox: [51.42, -2.65, 51.52, -2.50] },
  { code: 'UK-NEWCASTLE',     country: 'UK', city: 'Newcastle',         bbox: [54.90, -1.70, 55.05, -1.50] },
  { code: 'UK-NOTTINGHAM',    country: 'UK', city: 'Nottingham',        bbox: [52.90, -1.20, 53.05, -1.05] },
  { code: 'UK-LEICESTER',     country: 'UK', city: 'Leicester',         bbox: [52.60, -1.20, 52.68, -1.05] },
  { code: 'UK-BRIGHTON',      country: 'UK', city: 'Brighton',          bbox: [50.85, -0.22, 50.90, -0.10] },
  { code: 'UK-SOUTHAMPTON',   country: 'UK', city: 'Southampton',       bbox: [50.70, -1.45, 50.78, -1.30] },
  { code: 'UK-EXETER',        country: 'UK', city: 'Exeter',            bbox: [50.72, -3.58, 50.77, -3.48] },
  { code: 'UK-SHEFFIELD',     country: 'UK', city: 'Sheffield',         bbox: [53.40, -1.55, 53.47, -1.40] },
  { code: 'UK-CARDIFF',       country: 'UK', city: 'Cardiff',           bbox: [51.45, -3.25, 51.55, -3.10] },
  { code: 'UK-GLASGOW',       country: 'UK', city: 'Glasgow',           bbox: [55.85, -4.35, 55.93, -4.15] },
  { code: 'UK-EDINBURGH',     country: 'UK', city: 'Edinburgh',         bbox: [55.90, -3.27, 55.98, -3.10] },
  { code: 'UK-ABERDEEN',      country: 'UK', city: 'Aberdeen',          bbox: [57.10, -2.25, 57.20, -2.05] },
  { code: 'UK-BELFAST',       country: 'UK', city: 'Belfast',           bbox: [54.55, -5.97, 54.65, -5.83] },
  { code: 'UK-OXFORD',        country: 'UK', city: 'Oxford',            bbox: [51.74, -1.30, 51.79, -1.20] },
  { code: 'UK-CAMBRIDGE',     country: 'UK', city: 'Cambridge',         bbox: [52.19, 0.08, 52.23, 0.17] },

  // ─── AU — copied from auto-100-dental-v3.ts lines 93-102 (10 regions) ──
  { code: 'AU-SYDNEY',        country: 'AU', city: 'Sydney NSW',        bbox: [-33.95, 151.00, -33.75, 151.30] },
  { code: 'AU-MELBOURNE',     country: 'AU', city: 'Melbourne VIC',     bbox: [-37.90, 144.85, -37.70, 145.05] },
  { code: 'AU-BRISBANE',      country: 'AU', city: 'Brisbane QLD',      bbox: [-27.55, 152.95, -27.40, 153.10] },
  { code: 'AU-PERTH',         country: 'AU', city: 'Perth WA',          bbox: [-31.98, 115.80, -31.90, 115.95] },
  { code: 'AU-ADELAIDE',      country: 'AU', city: 'Adelaide SA',       bbox: [-34.97, 138.55, -34.88, 138.70] },
  { code: 'AU-CANBERRA',      country: 'AU', city: 'Canberra ACT',      bbox: [-35.35, 149.05, -35.25, 149.20] },
  { code: 'AU-HOBART',        country: 'AU', city: 'Hobart TAS',        bbox: [-42.90, 147.25, -42.85, 147.40] },
  { code: 'AU-GOLD-COAST',    country: 'AU', city: 'Gold Coast QLD',    bbox: [-28.10, 153.35, -28.00, 153.50] },
  { code: 'AU-NEWCASTLE',     country: 'AU', city: 'Newcastle NSW',     bbox: [-32.95, 151.60, -32.85, 151.80] },
  { code: 'AU-WOLLONGONG',    country: 'AU', city: 'Wollongong NSW',    bbox: [-34.45, 150.80, -34.35, 150.95] },
];

export function getRegionsForMarkets(markets: string[]): OsmRegion[] {
  const set = new Set(markets.map((m) => m.toUpperCase()));
  return OSM_REGIONS.filter((r) => set.has(r.country));
}

export function bboxToString(bbox: [number, number, number, number]): string {
  return bbox.join(',');
}
