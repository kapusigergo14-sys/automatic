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

  // US — wave 3: more mid-size cities for fresh lead supply
  { code: 'US-MEMPHIS',       country: 'US', city: 'Memphis TN',         bbox: [35.04, -90.10, 35.20, -89.85] },
  { code: 'US-LOUISVILLE',    country: 'US', city: 'Louisville KY',      bbox: [38.18, -85.82, 38.30, -85.65] },
  { code: 'US-MILWAUKEE',     country: 'US', city: 'Milwaukee WI',       bbox: [42.95, -87.98, 43.07, -87.86] },
  { code: 'US-PITTSBURGH',    country: 'US', city: 'Pittsburgh PA',      bbox: [40.40, -80.05, 40.48, -79.90] },
  { code: 'US-CINCINNATI',    country: 'US', city: 'Cincinnati OH',      bbox: [39.08, -84.58, 39.18, -84.44] },
  { code: 'US-SACRAMENTO',    country: 'US', city: 'Sacramento CA',      bbox: [38.52, -121.55, 38.62, -121.42] },
  { code: 'US-LASVEGAS',      country: 'US', city: 'Las Vegas NV',       bbox: [36.10, -115.25, 36.25, -115.08] },
  { code: 'US-SALTLAKE',      country: 'US', city: 'Salt Lake City UT',  bbox: [40.70, -111.95, 40.80, -111.82] },
  { code: 'US-TAMPA',         country: 'US', city: 'Tampa FL',           bbox: [27.90, -82.52, 28.02, -82.38] },
  { code: 'US-ORLANDO',       country: 'US', city: 'Orlando FL',         bbox: [28.48, -81.42, 28.58, -81.30] },
  { code: 'US-STLOUIS',       country: 'US', city: 'St. Louis MO',       bbox: [38.58, -90.32, 38.70, -90.18] },
  { code: 'US-MINNEAPOLIS',   country: 'US', city: 'Minneapolis MN',     bbox: [44.92, -93.32, 45.02, -93.20] },
  { code: 'US-CLEVELAND',     country: 'US', city: 'Cleveland OH',       bbox: [41.45, -81.75, 41.55, -81.62] },
  { code: 'US-NEWARK',        country: 'US', city: 'Newark NJ',          bbox: [40.70, -74.22, 40.77, -74.13] },
  { code: 'US-BATONROUGE',    country: 'US', city: 'Baton Rouge LA',     bbox: [30.38, -91.22, 30.48, -91.08] },
  { code: 'US-BIRMINGHAM',    country: 'US', city: 'Birmingham AL',      bbox: [33.48, -86.85, 33.58, -86.72] },
  { code: 'US-ROCHESTER',     country: 'US', city: 'Rochester NY',       bbox: [43.12, -77.65, 43.20, -77.55] },
  { code: 'US-HARTFORD',      country: 'US', city: 'Hartford CT',        bbox: [41.73, -72.72, 41.80, -72.64] },
  { code: 'US-DESMOINES',     country: 'US', city: 'Des Moines IA',      bbox: [41.55, -93.68, 41.63, -93.55] },
  { code: 'US-MADISON',       country: 'US', city: 'Madison WI',         bbox: [43.04, -89.45, 43.12, -89.32] },
  { code: 'US-CHARLESTON',    country: 'US', city: 'Charleston SC',      bbox: [32.76, -79.98, 32.84, -79.90] },
  { code: 'US-SAVANNAH',      country: 'US', city: 'Savannah GA',        bbox: [32.03, -81.15, 32.10, -81.05] },
  { code: 'US-TULSA',         country: 'US', city: 'Tulsa OK',           bbox: [36.10, -96.02, 36.20, -95.88] },
  { code: 'US-OKCCITY',       country: 'US', city: 'Oklahoma City OK',   bbox: [35.40, -97.58, 35.52, -97.42] },
  { code: 'US-LITTLEROCK',    country: 'US', city: 'Little Rock AR',     bbox: [34.70, -92.35, 34.78, -92.22] },
  { code: 'US-FORTWORTH',     country: 'US', city: 'Fort Worth TX',      bbox: [32.68, -97.40, 32.78, -97.28] },
  { code: 'US-HONOLULU',      country: 'US', city: 'Honolulu HI',        bbox: [21.28, -157.88, 21.35, -157.80] },
  { code: 'US-ANCHORAGE',     country: 'US', city: 'Anchorage AK',       bbox: [61.15, -149.95, 61.23, -149.82] },
  { code: 'US-BOISE',         country: 'US', city: 'Boise ID',           bbox: [43.58, -116.25, 43.66, -116.15] },
  { code: 'US-SPRINGFIELD',   country: 'US', city: 'Springfield MO',     bbox: [37.17, -93.33, 37.25, -93.22] },

  // US — wave 4: 100+ new cities across all 50 states
  // Alabama
  { code: 'US-HUNTSVILLE',    country: 'US', city: 'Huntsville AL',       bbox: [34.67, -86.67, 34.79, -86.51] },
  { code: 'US-MOBILE',        country: 'US', city: 'Mobile AL',           bbox: [30.63, -88.13, 30.75, -87.97] },
  { code: 'US-MONTGOMERY',    country: 'US', city: 'Montgomery AL',       bbox: [32.30, -86.34, 32.42, -86.18] },
  // Arizona
  { code: 'US-MESA',          country: 'US', city: 'Mesa AZ',             bbox: [33.36, -111.87, 33.48, -111.71] },
  { code: 'US-SCOTTSDALE',    country: 'US', city: 'Scottsdale AZ',       bbox: [33.43, -111.95, 33.55, -111.79] },
  { code: 'US-GILBERT',       country: 'US', city: 'Gilbert AZ',          bbox: [33.29, -111.83, 33.41, -111.67] },
  { code: 'US-CHANDLER',      country: 'US', city: 'Chandler AZ',         bbox: [33.24, -111.88, 33.36, -111.72] },
  // Arkansas
  { code: 'US-FAYETTEVILLE',  country: 'US', city: 'Fayetteville AR',     bbox: [36.02, -94.20, 36.14, -94.04] },
  // California
  { code: 'US-SANJOSE',       country: 'US', city: 'San Jose CA',         bbox: [37.28, -121.97, 37.40, -121.81] },
  { code: 'US-FRESNO',        country: 'US', city: 'Fresno CA',           bbox: [36.69, -119.87, 36.81, -119.71] },
  { code: 'US-LONGBEACH',     country: 'US', city: 'Long Beach CA',       bbox: [33.74, -118.23, 33.86, -118.07] },
  { code: 'US-BAKERSFIELD',   country: 'US', city: 'Bakersfield CA',      bbox: [35.31, -119.11, 35.43, -118.95] },
  { code: 'US-ANAHEIM',       country: 'US', city: 'Anaheim CA',          bbox: [33.78, -117.99, 33.90, -117.83] },
  { code: 'US-SANTAANA',      country: 'US', city: 'Santa Ana CA',        bbox: [33.70, -117.93, 33.82, -117.77] },
  { code: 'US-RIVERSIDE',     country: 'US', city: 'Riverside CA',        bbox: [33.89, -117.45, 34.01, -117.29] },
  { code: 'US-STOCKTON',      country: 'US', city: 'Stockton CA',         bbox: [37.90, -121.35, 38.02, -121.19] },
  { code: 'US-IRVINE',        country: 'US', city: 'Irvine CA',           bbox: [33.62, -117.84, 33.74, -117.68] },
  // Colorado
  { code: 'US-COLORADOSPRINGS', country: 'US', city: 'Colorado Springs CO', bbox: [38.77, -104.87, 38.89, -104.71] },
  { code: 'US-AURORA-CO',     country: 'US', city: 'Aurora CO',           bbox: [39.67, -104.87, 39.79, -104.71] },
  // Connecticut
  { code: 'US-NEWHAVEN',      country: 'US', city: 'New Haven CT',        bbox: [41.25, -72.97, 41.37, -72.81] },
  { code: 'US-BRIDGEPORT',    country: 'US', city: 'Bridgeport CT',       bbox: [41.15, -73.24, 41.27, -73.08] },
  { code: 'US-STAMFORD',      country: 'US', city: 'Stamford CT',         bbox: [41.01, -73.58, 41.13, -73.42] },
  // Delaware
  { code: 'US-WILMINGTON',    country: 'US', city: 'Wilmington DE',       bbox: [39.71, -75.59, 39.83, -75.43] },
  // Florida
  { code: 'US-STPETERSBURG',  country: 'US', city: 'St. Petersburg FL',   bbox: [27.71, -82.72, 27.83, -82.56] },
  { code: 'US-HIALEAH',       country: 'US', city: 'Hialeah FL',          bbox: [25.83, -80.36, 25.95, -80.20] },
  { code: 'US-TALLAHASSEE',   country: 'US', city: 'Tallahassee FL',      bbox: [30.38, -84.35, 30.50, -84.19] },
  { code: 'US-FORTLAUDERDALE', country: 'US', city: 'Fort Lauderdale FL', bbox: [26.06, -80.21, 26.18, -80.05] },
  { code: 'US-CAPECORAL',     country: 'US', city: 'Cape Coral FL',       bbox: [26.57, -82.03, 26.69, -81.87] },
  // Georgia
  { code: 'US-AUGUSTA',       country: 'US', city: 'Augusta GA',          bbox: [33.41, -82.05, 33.53, -81.89] },
  { code: 'US-MACON',         country: 'US', city: 'Macon GA',            bbox: [32.78, -83.70, 32.90, -83.54] },
  { code: 'US-ATHENS',        country: 'US', city: 'Athens GA',           bbox: [33.90, -83.43, 34.02, -83.27] },
  // Idaho
  { code: 'US-NAMPA',         country: 'US', city: 'Nampa ID',            bbox: [43.51, -116.64, 43.63, -116.48] },
  // Illinois
  { code: 'US-AURORA-IL',     country: 'US', city: 'Aurora IL',           bbox: [41.72, -88.38, 41.84, -88.22] },
  { code: 'US-ROCKFORD',      country: 'US', city: 'Rockford IL',         bbox: [42.21, -89.13, 42.33, -88.97] },
  { code: 'US-NAPERVILLE',    country: 'US', city: 'Naperville IL',       bbox: [41.72, -88.23, 41.84, -88.07] },
  // Indiana
  { code: 'US-INDIANAPOLIS',  country: 'US', city: 'Indianapolis IN',     bbox: [39.71, -86.26, 39.83, -86.10] },
  { code: 'US-FORTWAYNE',     country: 'US', city: 'Fort Wayne IN',       bbox: [41.01, -85.18, 41.13, -85.02] },
  { code: 'US-EVANSVILLE',    country: 'US', city: 'Evansville IN',       bbox: [37.93, -87.64, 38.05, -87.48] },
  // Iowa
  { code: 'US-CEDARRAPIDS',   country: 'US', city: 'Cedar Rapids IA',     bbox: [41.92, -91.72, 42.04, -91.56] },
  { code: 'US-DAVENPORT',     country: 'US', city: 'Davenport IA',        bbox: [41.49, -90.66, 41.61, -90.50] },
  // Kansas
  { code: 'US-OVERLANDPARK',  country: 'US', city: 'Overland Park KS',    bbox: [38.88, -94.74, 39.00, -94.58] },
  { code: 'US-KANSASCITY-KS', country: 'US', city: 'Kansas City KS',      bbox: [39.06, -94.72, 39.18, -94.56] },
  // Kentucky
  { code: 'US-BOWLINGGREEN',  country: 'US', city: 'Bowling Green KY',    bbox: [36.93, -86.49, 37.05, -86.33] },
  // Louisiana
  { code: 'US-NEWORLEANS',    country: 'US', city: 'New Orleans LA',      bbox: [29.90, -90.14, 30.02, -89.98] },
  { code: 'US-SHREVEPORT',    country: 'US', city: 'Shreveport LA',       bbox: [32.39, -93.83, 32.51, -93.67] },
  { code: 'US-LAFAYETTE',     country: 'US', city: 'Lafayette LA',        bbox: [30.16, -92.07, 30.28, -91.91] },
  // Maine
  { code: 'US-PORTLAND-ME',   country: 'US', city: 'Portland ME',         bbox: [43.63, -70.34, 43.75, -70.18] },
  // Maryland
  { code: 'US-BALTIMORE',     country: 'US', city: 'Baltimore MD',        bbox: [39.23, -76.71, 39.35, -76.55] },
  // Massachusetts
  { code: 'US-WORCESTER',     country: 'US', city: 'Worcester MA',        bbox: [42.22, -71.87, 42.34, -71.71] },
  { code: 'US-SPRINGFIELD-MA', country: 'US', city: 'Springfield MA',     bbox: [42.06, -72.63, 42.18, -72.47] },
  // Michigan
  { code: 'US-DETROIT',       country: 'US', city: 'Detroit MI',          bbox: [42.29, -83.29, 42.41, -83.13] },
  { code: 'US-GRANDRAPIDS',   country: 'US', city: 'Grand Rapids MI',     bbox: [42.90, -85.73, 43.02, -85.57] },
  { code: 'US-ANNARBOR',      country: 'US', city: 'Ann Arbor MI',        bbox: [42.22, -83.80, 42.34, -83.64] },
  { code: 'US-LANSING',       country: 'US', city: 'Lansing MI',          bbox: [42.70, -84.63, 42.82, -84.47] },
  // Minnesota
  { code: 'US-STPAUL',        country: 'US', city: 'St. Paul MN',         bbox: [44.89, -93.17, 45.01, -93.01] },
  { code: 'US-ROCHESTER-MN',  country: 'US', city: 'Rochester MN',        bbox: [43.97, -92.54, 44.09, -92.38] },
  // Mississippi
  { code: 'US-JACKSON-MS',    country: 'US', city: 'Jackson MS',          bbox: [32.24, -90.26, 32.36, -90.10] },
  { code: 'US-GULFPORT',      country: 'US', city: 'Gulfport MS',         bbox: [30.35, -89.17, 30.47, -89.01] },
  // Missouri
  { code: 'US-KANSASCITY-MO', country: 'US', city: 'Kansas City MO',      bbox: [39.03, -94.66, 39.15, -94.50] },
  { code: 'US-COLUMBIA-MO',   country: 'US', city: 'Columbia MO',         bbox: [38.89, -92.38, 39.01, -92.22] },
  // Montana
  { code: 'US-BILLINGS',      country: 'US', city: 'Billings MT',         bbox: [45.72, -108.58, 45.84, -108.42] },
  { code: 'US-MISSOULA',      country: 'US', city: 'Missoula MT',         bbox: [46.81, -114.07, 46.93, -113.91] },
  // Nebraska
  { code: 'US-LINCOLN',       country: 'US', city: 'Lincoln NE',          bbox: [40.75, -96.74, 40.87, -96.58] },
  // Nevada
  { code: 'US-RENO',          country: 'US', city: 'Reno NV',             bbox: [39.49, -119.87, 39.61, -119.71] },
  { code: 'US-HENDERSON',     country: 'US', city: 'Henderson NV',        bbox: [35.96, -115.11, 36.08, -114.95] },
  // New Hampshire
  { code: 'US-MANCHESTER-NH', country: 'US', city: 'Manchester NH',       bbox: [42.93, -71.51, 43.05, -71.35] },
  { code: 'US-NASHUA',        country: 'US', city: 'Nashua NH',           bbox: [42.72, -71.55, 42.84, -71.39] },
  // New Jersey
  { code: 'US-JERSEYCITY',    country: 'US', city: 'Jersey City NJ',      bbox: [40.68, -74.11, 40.80, -73.95] },
  { code: 'US-PATERSON',      country: 'US', city: 'Paterson NJ',         bbox: [40.88, -74.21, 41.00, -74.05] },
  // New Mexico
  { code: 'US-LASCRUCES',     country: 'US', city: 'Las Cruces NM',       bbox: [32.29, -106.83, 32.41, -106.67] },
  // New York
  { code: 'US-BUFFALO',       country: 'US', city: 'Buffalo NY',          bbox: [42.83, -78.93, 42.95, -78.77] },
  { code: 'US-SYRACUSE',      country: 'US', city: 'Syracuse NY',         bbox: [42.98, -76.20, 43.10, -76.04] },
  { code: 'US-ALBANY',        country: 'US', city: 'Albany NY',           bbox: [42.61, -73.82, 42.73, -73.66] },
  { code: 'US-YONKERS',       country: 'US', city: 'Yonkers NY',         bbox: [40.91, -73.90, 41.03, -73.74] },
  // North Carolina
  { code: 'US-GREENSBORO',    country: 'US', city: 'Greensboro NC',       bbox: [36.01, -79.87, 36.13, -79.71] },
  { code: 'US-DURHAM',        country: 'US', city: 'Durham NC',           bbox: [35.93, -79.01, 36.05, -78.85] },
  { code: 'US-WINSTONSALEM',  country: 'US', city: 'Winston-Salem NC',    bbox: [36.04, -80.33, 36.16, -80.17] },
  { code: 'US-FAYETTEVILLE-NC', country: 'US', city: 'Fayetteville NC',   bbox: [35.00, -79.01, 35.12, -78.85] },
  // North Dakota
  { code: 'US-FARGO',         country: 'US', city: 'Fargo ND',            bbox: [46.83, -96.87, 46.95, -96.71] },
  { code: 'US-BISMARCK',      country: 'US', city: 'Bismarck ND',         bbox: [46.75, -100.84, 46.87, -100.68] },
  // Ohio
  { code: 'US-AKRON',         country: 'US', city: 'Akron OH',            bbox: [41.02, -81.56, 41.14, -81.40] },
  { code: 'US-DAYTON',        country: 'US', city: 'Dayton OH',           bbox: [39.71, -84.27, 39.83, -84.11] },
  // Oklahoma
  { code: 'US-NORMAN',        country: 'US', city: 'Norman OK',           bbox: [35.17, -97.52, 35.29, -97.36] },
  // Oregon
  { code: 'US-SALEM',         country: 'US', city: 'Salem OR',            bbox: [44.88, -123.11, 45.00, -122.95] },
  { code: 'US-EUGENE',        country: 'US', city: 'Eugene OR',           bbox: [43.99, -123.17, 44.11, -123.01] },
  // Pennsylvania
  { code: 'US-ALLENTOWN',     country: 'US', city: 'Allentown PA',        bbox: [40.57, -75.55, 40.69, -75.39] },
  { code: 'US-ERIE',          country: 'US', city: 'Erie PA',             bbox: [42.07, -80.13, 42.19, -79.97] },
  // Rhode Island
  { code: 'US-PROVIDENCE',    country: 'US', city: 'Providence RI',       bbox: [41.79, -71.47, 41.91, -71.31] },
  // South Carolina
  { code: 'US-COLUMBIA-SC',   country: 'US', city: 'Columbia SC',         bbox: [33.94, -81.09, 34.06, -80.93] },
  { code: 'US-GREENVILLE',    country: 'US', city: 'Greenville SC',       bbox: [34.79, -82.44, 34.91, -82.28] },
  // South Dakota
  { code: 'US-SIOUXFALLS',    country: 'US', city: 'Sioux Falls SD',      bbox: [43.48, -96.78, 43.60, -96.62] },
  { code: 'US-RAPIDCITY',     country: 'US', city: 'Rapid City SD',       bbox: [43.98, -103.31, 44.10, -103.15] },
  // Tennessee
  { code: 'US-CHATTANOOGA',   country: 'US', city: 'Chattanooga TN',      bbox: [34.97, -85.38, 35.09, -85.22] },
  { code: 'US-CLARKSVILLE',   country: 'US', city: 'Clarksville TN',      bbox: [36.47, -87.38, 36.59, -87.22] },
  // Texas
  { code: 'US-ELPASO',        country: 'US', city: 'El Paso TX',          bbox: [31.69, -106.49, 31.81, -106.33] },
  { code: 'US-ARLINGTON',     country: 'US', city: 'Arlington TX',        bbox: [32.67, -97.16, 32.79, -97.00] },
  { code: 'US-CORPUSCHRISTI', country: 'US', city: 'Corpus Christi TX',   bbox: [27.74, -97.47, 27.86, -97.31] },
  { code: 'US-PLANO',         country: 'US', city: 'Plano TX',            bbox: [32.99, -96.77, 33.11, -96.61] },
  { code: 'US-LAREDO',        country: 'US', city: 'Laredo TX',           bbox: [27.44, -99.56, 27.56, -99.40] },
  { code: 'US-LUBBOCK',       country: 'US', city: 'Lubbock TX',          bbox: [33.50, -101.93, 33.62, -101.77] },
  { code: 'US-AMARILLO',      country: 'US', city: 'Amarillo TX',         bbox: [35.16, -101.91, 35.28, -101.75] },
  // Utah
  { code: 'US-PROVO',         country: 'US', city: 'Provo UT',            bbox: [40.18, -111.73, 40.30, -111.57] },
  { code: 'US-OREM',          country: 'US', city: 'Orem UT',             bbox: [40.27, -111.74, 40.39, -111.58] },
  // Vermont
  { code: 'US-BURLINGTON',    country: 'US', city: 'Burlington VT',       bbox: [44.41, -73.27, 44.53, -73.11] },
  // Virginia
  { code: 'US-VIRGINIABEACH', country: 'US', city: 'Virginia Beach VA',   bbox: [36.79, -76.11, 36.91, -75.95] },
  { code: 'US-NORFOLK',       country: 'US', city: 'Norfolk VA',          bbox: [36.82, -76.34, 36.94, -76.18] },
  { code: 'US-CHESAPEAKE',    country: 'US', city: 'Chesapeake VA',       bbox: [36.71, -76.31, 36.83, -76.15] },
  { code: 'US-ARLINGTON-VA',  country: 'US', city: 'Arlington VA',        bbox: [38.83, -77.16, 38.95, -77.00] },
  // Washington
  { code: 'US-TACOMA',        country: 'US', city: 'Tacoma WA',           bbox: [47.19, -122.52, 47.31, -122.36] },
  { code: 'US-VANCOUVER-WA',  country: 'US', city: 'Vancouver WA',        bbox: [45.59, -122.73, 45.71, -122.57] },
  { code: 'US-BELLEVUE',      country: 'US', city: 'Bellevue WA',         bbox: [47.53, -122.24, 47.65, -122.08] },
  // West Virginia
  { code: 'US-CHARLESTON-WV', country: 'US', city: 'Charleston WV',       bbox: [38.29, -81.71, 38.41, -81.55] },
  { code: 'US-HUNTINGTON',    country: 'US', city: 'Huntington WV',       bbox: [38.35, -82.50, 38.47, -82.34] },
  // Wisconsin
  { code: 'US-GREENBAY',      country: 'US', city: 'Green Bay WI',        bbox: [44.47, -88.08, 44.59, -87.92] },
  // Wyoming
  { code: 'US-CHEYENNE',      country: 'US', city: 'Cheyenne WY',         bbox: [41.08, -104.86, 41.20, -104.70] },
  { code: 'US-CASPER',        country: 'US', city: 'Casper WY',           bbox: [42.80, -106.39, 42.92, -106.23] },

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

  // UK — wave 2: 15 additional cities
  { code: 'UK-BATH',          country: 'UK', city: 'Bath',              bbox: [51.33, -2.43, 51.45, -2.27] },
  { code: 'UK-PLYMOUTH',      country: 'UK', city: 'Plymouth',          bbox: [50.33, -4.18, 50.45, -4.02] },
  { code: 'UK-CHESTER',       country: 'UK', city: 'Chester',           bbox: [53.15, -2.97, 53.27, -2.81] },
  { code: 'UK-COVENTRY',      country: 'UK', city: 'Coventry',          bbox: [52.38, -1.58, 52.50, -1.42] },
  { code: 'UK-DERBY',         country: 'UK', city: 'Derby',             bbox: [52.88, -1.55, 53.00, -1.39] },
  { code: 'UK-DUNDEE',        country: 'UK', city: 'Dundee',            bbox: [56.40, -3.07, 56.52, -2.91] },
  { code: 'UK-INVERNESS',     country: 'UK', city: 'Inverness',         bbox: [57.42, -4.31, 57.54, -4.15] },
  { code: 'UK-NORWICH',       country: 'UK', city: 'Norwich',           bbox: [52.59, 1.21, 52.71, 1.37] },
  { code: 'UK-PETERBOROUGH',  country: 'UK', city: 'Peterborough',      bbox: [52.55, -0.28, 52.67, -0.12] },
  { code: 'UK-PORTSMOUTH',    country: 'UK', city: 'Portsmouth',        bbox: [50.75, -1.13, 50.87, -0.97] },
  { code: 'UK-STOKE',         country: 'UK', city: 'Stoke-on-Trent',    bbox: [52.96, -2.23, 53.08, -2.07] },
  { code: 'UK-SWANSEA',       country: 'UK', city: 'Swansea',           bbox: [51.59, -3.98, 51.71, -3.82] },
  { code: 'UK-WOLVERHAMPTON', country: 'UK', city: 'Wolverhampton',     bbox: [52.55, -2.17, 52.67, -2.01] },
  { code: 'UK-YORK',          country: 'UK', city: 'York',              bbox: [53.90, -1.13, 54.02, -0.97] },
  { code: 'UK-READING',       country: 'UK', city: 'Reading',           bbox: [51.40, -1.05, 51.52, -0.89] },

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

  // AU — wave 2: 10 additional cities
  { code: 'AU-CAIRNS',        country: 'AU', city: 'Cairns QLD',        bbox: [-16.98, 145.69, -16.86, 145.85] },
  { code: 'AU-TOWNSVILLE',    country: 'AU', city: 'Townsville QLD',    bbox: [-19.33, 146.72, -19.21, 146.88] },
  { code: 'AU-DARWIN',        country: 'AU', city: 'Darwin NT',         bbox: [-12.49, 130.82, -12.37, 130.98] },
  { code: 'AU-GEELONG',       country: 'AU', city: 'Geelong VIC',      bbox: [-38.21, 144.27, -38.09, 144.43] },
  { code: 'AU-BALLARAT',      country: 'AU', city: 'Ballarat VIC',     bbox: [-37.62, 143.78, -37.50, 143.94] },
  { code: 'AU-BENDIGO',       country: 'AU', city: 'Bendigo VIC',      bbox: [-36.82, 144.20, -36.70, 144.36] },
  { code: 'AU-TOOWOOMBA',     country: 'AU', city: 'Toowoomba QLD',    bbox: [-27.62, 151.87, -27.50, 152.03] },
  { code: 'AU-LAUNCESTON',    country: 'AU', city: 'Launceston TAS',   bbox: [-41.50, 147.07, -41.38, 147.23] },
  { code: 'AU-ALBURY',        country: 'AU', city: 'Albury NSW',       bbox: [-36.14, 146.83, -36.02, 146.99] },
  { code: 'AU-MACKAY',        country: 'AU', city: 'Mackay QLD',       bbox: [-21.21, 149.10, -21.09, 149.26] },
];

export function getRegionsForMarkets(markets: string[]): OsmRegion[] {
  const set = new Set(markets.map((m) => m.toUpperCase()));
  return OSM_REGIONS.filter((r) => set.has(r.country));
}

export function bboxToString(bbox: [number, number, number, number]): string {
  return bbox.join(',');
}
