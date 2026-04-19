/**
 * gen-osm-regions.ts — one-off generator for scripts/osm-regions.ts
 *
 * Data source: geonames cities15000.zip (MIT, updated daily).
 * Download URL: https://download.geonames.org/export/dump/cities15000.zip
 *
 * Process:
 *   1. Fetch the zip from geonames
 *   2. Extract cities15000.txt (tab-separated, 19 fields)
 *   3. Filter by country (US, GB, AU)
 *   4. Apply per-country minimum population thresholds
 *   5. Sort by population descending
 *   6. De-duplicate by geographic distance (≥ 20km from any already-kept city)
 *   7. Generate ±0.08° bbox around each city centroid
 *   8. Write scripts/osm-regions.ts with OSM_REGIONS constant + helpers
 *
 * Dedup guarantees:
 *   - Every city has a unique geonames `geonameid` (authoritative)
 *   - Distance filter (haversine, 20km) prevents overlapping bboxes
 *     (no Kansas City MO + Kansas City KS duplication, no suburb spam)
 *   - Lead-level dedup in osm-collect.ts stays as the backstop
 *
 * CLI:
 *   npx ts-node scripts/gen-osm-regions.ts
 *
 * Re-run whenever you want to refresh the city list or tune thresholds.
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

const GEONAMES_URL = 'https://download.geonames.org/export/dump/cities15000.zip';
const OUTPUT_FILE = path.resolve(__dirname, './osm-regions.ts');

// Country tuning — population floor tuned to land around 500/80/40 regions.
// Raising the floor yields fewer, bigger cities; lowering it yields more,
// smaller ones (and tighter bboxes → lower Overpass result count per query).
interface CountryConfig {
  market: 'US' | 'UK' | 'AU';
  geonamesCode: string;
  minPop: number;
  bboxHalfDeg: number;
}

const COUNTRIES: CountryConfig[] = [
  { market: 'US', geonamesCode: 'US', minPop: 40_000, bboxHalfDeg: 0.08 },
  { market: 'UK', geonamesCode: 'GB', minPop: 25_000, bboxHalfDeg: 0.06 },
  { market: 'AU', geonamesCode: 'AU', minPop: 20_000, bboxHalfDeg: 0.08 },
];

// Minimum distance between two kept cities, in km. Same-name cities in
// adjacent counties (Kansas City MO / KS, Bristol TN / VA) end up within
// this radius and only the larger one is kept. Prevents overlapping bboxes.
const DEDUP_DISTANCE_KM = 20;

// Cities above this population are dropped entirely. Their Overpass
// bbox contains millions of OSM objects and the public endpoints
// consistently reply HTTP 406 / 429 for them — queries never complete.
// Rather than burn our selected-per-run budget on cities that always
// fail, we just skip them. NYC (8.3M), LA (3.9M), Chicago (2.7M),
// London (~9M), Sydney (~5M), etc. get excluded at generation time.
const MEGACITY_POP_CAP = 2_000_000;

// ─── Geonames TSV field indexes (see docs/geoname.txt) ──────────────────
// 0  geonameid           integer id of record in geonames database
// 1  name                name of geographical point (utf8)
// 2  asciiname           name of geographical point in plain ascii
// 8  country code        ISO-3166 2-letter country code
// 10 admin1 code         state / region (US → state 2-letter; AU → state code)
// 14 population          integer
// 4  latitude            decimal degrees (wgs84)
// 5  longitude           decimal degrees (wgs84)

interface Row {
  geonameid: number;
  name: string;
  lat: number;
  lon: number;
  countryCode: string;
  admin1: string;
  population: number;
}

function parseRow(line: string): Row | null {
  const f = line.split('\t');
  if (f.length < 15) return null;
  const lat = parseFloat(f[4]);
  const lon = parseFloat(f[5]);
  const pop = parseInt(f[14], 10);
  if (!isFinite(lat) || !isFinite(lon) || !isFinite(pop)) return null;
  return {
    geonameid: parseInt(f[0], 10),
    name: f[1],
    lat,
    lon,
    countryCode: f[8],
    admin1: f[10] || '',
    population: pop,
  };
}

// ─── Haversine distance in km ───────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Slug generator for region codes ────────────────────────────────────
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

function makeCode(market: string, row: EnhancedRow): string {
  const name = slug(row.asciiPreferred || row.name);
  return `${market}-${name}`;
}

// Small helper so `asciiPreferred` is optional without polluting Row
interface EnhancedRow extends Row {
  asciiPreferred: string;
}

function enhance(row: Row, asciiname?: string): EnhancedRow {
  return { ...row, asciiPreferred: asciiname || row.name };
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log('🌍 gen-osm-regions — fetching geonames cities15000.zip');

  const res = await fetch(GEONAMES_URL);
  if (!res.ok) {
    console.error(`HTTP ${res.status} fetching geonames`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`   downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

  const zip = new AdmZip(buf);
  const entry = zip.getEntry('cities15000.txt');
  if (!entry) {
    console.error('cities15000.txt not found inside zip');
    process.exit(1);
  }
  const tsv = entry.getData().toString('utf-8');
  const lines = tsv.split('\n').filter(Boolean);
  console.log(`   parsed ${lines.length.toLocaleString()} city rows`);

  // Re-parse with asciiname preference (field 2 is asciiname)
  const allRows: EnhancedRow[] = [];
  for (const line of lines) {
    const f = line.split('\t');
    const row = parseRow(line);
    if (!row) continue;
    allRows.push(enhance(row, f[2]));
  }

  const buckets: Record<string, EnhancedRow[]> = {};
  const codeDedup = new Set<string>();
  const regions: Array<{ code: string; country: string; city: string; bbox: [number, number, number, number] }> = [];

  for (const cfg of COUNTRIES) {
    const rows = allRows
      .filter((r) => r.countryCode === cfg.geonamesCode
        && r.population >= cfg.minPop
        && r.population < MEGACITY_POP_CAP)
      .sort((a, b) => b.population - a.population);

    const kept: EnhancedRow[] = [];
    for (const r of rows) {
      // Distance dedup against everything already kept for this country
      const tooClose = kept.some(
        (k) => haversineKm(r.lat, r.lon, k.lat, k.lon) < DEDUP_DISTANCE_KM
      );
      if (tooClose) continue;
      kept.push(r);
    }

    buckets[cfg.market] = kept;

    for (const r of kept) {
      const base = makeCode(cfg.market, r);
      // Disambiguate same-name cities by appending admin1 (state code)
      let code = base;
      if (codeDedup.has(code) && r.admin1) {
        code = `${base}-${slug(r.admin1)}`;
      }
      // Final disambiguation with geonameid suffix if still colliding
      if (codeDedup.has(code)) {
        code = `${code}-${r.geonameid}`;
      }
      codeDedup.add(code);

      const half = cfg.bboxHalfDeg;
      const city = r.admin1
        ? `${r.asciiPreferred} ${r.admin1}`
        : r.asciiPreferred;

      regions.push({
        code,
        country: cfg.market,
        city,
        bbox: [
          +(r.lat - half).toFixed(4),
          +(r.lon - half).toFixed(4),
          +(r.lat + half).toFixed(4),
          +(r.lon + half).toFixed(4),
        ],
      });
    }

    console.log(`   ${cfg.market}: ${kept.length} regions (pop ≥ ${cfg.minPop.toLocaleString()}, ${DEDUP_DISTANCE_KM}km dedup)`);
  }

  // ─── Write file ────────────────────────────────────────────────────
  const lines2: string[] = [];
  lines2.push('/**');
  lines2.push(' * osm-regions.ts — Bounding box regions for OSM/Overpass collector.');
  lines2.push(' *');
  lines2.push(' * GENERATED FILE — do not edit by hand.');
  lines2.push(` * Source: ${GEONAMES_URL}`);
  lines2.push(` * Generated: ${new Date().toISOString()}`);
  lines2.push(' * Regenerate with: npx ts-node scripts/gen-osm-regions.ts');
  lines2.push(' *');
  lines2.push(' * Bbox format: [south, west, north, east] in decimal degrees.');
  lines2.push(` * Dedup: cities within ${DEDUP_DISTANCE_KM}km of a larger city are dropped,`);
  lines2.push(' * so bboxes never overlap materially.');
  lines2.push(' */');
  lines2.push('');
  lines2.push("export type MarketCode = 'US' | 'UK' | 'AU';");
  lines2.push('');
  lines2.push('export interface OsmRegion {');
  lines2.push('  code: string;');
  lines2.push('  country: MarketCode;');
  lines2.push('  city: string;');
  lines2.push('  bbox: [number, number, number, number];');
  lines2.push('}');
  lines2.push('');
  lines2.push('export const OSM_REGIONS: OsmRegion[] = [');
  for (const r of regions) {
    const cityEscaped = r.city.replace(/'/g, "\\'");
    lines2.push(
      `  { code: '${r.code}', country: '${r.country}', city: '${cityEscaped}', bbox: [${r.bbox.join(', ')}] },`
    );
  }
  lines2.push('];');
  lines2.push('');
  lines2.push('export function getRegionsForMarkets(markets: string[]): OsmRegion[] {');
  lines2.push('  const set = new Set(markets.map((m) => m.toUpperCase()));');
  lines2.push('  return OSM_REGIONS.filter((r) => set.has(r.country));');
  lines2.push('}');
  lines2.push('');
  lines2.push('export function bboxToString(bbox: [number, number, number, number]): string {');
  lines2.push('  return bbox.join(\',\');');
  lines2.push('}');
  lines2.push('');

  fs.writeFileSync(OUTPUT_FILE, lines2.join('\n'), 'utf-8');

  const byCountry = regions.reduce(
    (acc, r) => ((acc[r.country] = (acc[r.country] || 0) + 1), acc),
    {} as Record<string, number>
  );

  console.log('');
  console.log(`✅ wrote ${regions.length} regions to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`   breakdown: US=${byCountry.US} · UK=${byCountry.UK} · AU=${byCountry.AU}`);
  console.log(`   unique codes: ${codeDedup.size} (matches ${regions.length} regions: ${codeDedup.size === regions.length ? 'OK' : 'MISMATCH'})`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
