/**
 * osm-collect.ts — OSM/Overpass-based dental lead collector (zero API cost).
 *
 * Replaces auto-dental-v5-collect.ts for markets where we can no longer use
 * Google Places API (billing disabled). Uses OpenStreetMap Overpass API which
 * is authentication-free and rate-limit-friendly with reasonable delays.
 *
 * Pipeline:
 *   1. For each OSM region (bbox), query Overpass for dental POIs with a
 *      `website` tag.
 *   2. For each candidate, HTTP fetch the homepage (+ /contact fallback)
 *      and run the same detection the v5 collector uses: chatbot filter,
 *      modern-score heuristic, email extraction.
 *   3. Dedup against v4 + v5 send-state and the existing dental-v5-modern.json
 *      pool (by email + custom domain).
 *   4. Merge new qualified leads into dental-v5-modern.json (same schema, same
 *      file — the sender picks them up with no changes).
 *   5. Track per-region cooldown in osm-region-progress.json (parallel to the
 *      city-progress.json the Places API collector uses).
 *
 * CLI:
 *   npx ts-node scripts/osm-collect.ts \
 *     --markets "US,UK,AU" \
 *     --limit 300 \
 *     --regions-per-market 5 \
 *     --concurrency 10 \
 *     --min-cooldown-days 7 \
 *     [--dry-run] [--reset-progress]
 *
 * Requires NO env vars — Overpass is auth-free. The chatbot/booking detection
 * is pure string-match, no Anthropic API needed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { OSM_REGIONS, getRegionsForMarkets, bboxToString, type OsmRegion, type MarketCode } from './osm-regions';
import { getIndustry, listIndustries, type IndustryConfig } from './industries';

// ─── Paths ──────────────────────────────────────────────────────────────

const V4_STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
let V5_STATE_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5.json');
let LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-v5-modern.json');
let REGION_PROGRESS_FILE = path.resolve(__dirname, '../output/v5-campaign/osm-region-progress.json');

// Module-level industry state — set in main() from industry config
let currentOsmTags: string[] = ['amenity=dentist', 'healthcare=dentist'];
let currentDefaultName = 'Dental Practice';

// ─── Schema (matches V5Lead exactly — sender compatibility) ─────────────

interface V5Lead {
  name: string;
  website: string;
  phone?: string;
  city: string;
  country: string;
  email: string;
  hasBooking: boolean;
  modernScore: number; // 0-3 (viewport + https + doctype)
  collectedAt: string;
}

interface RegionProgress {
  lastRunAt: string;
  totalRuns: number;
  lastNewLeads: number;
  totalNewLeads: number;
  lastResultsCount: number;
}

// ─── CLI args ───────────────────────────────────────────────────────────

interface Args {
  markets: MarketCode[];
  limit: number;
  regionsPerMarket: number;
  concurrency: number;
  minCooldownDays: number;
  dryRun: boolean;
  resetProgress: boolean;
  industry: string;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  let marketsRaw = 'US,UK,AU';
  let limit = 300;
  let regionsPerMarket = 5;
  let concurrency = 10;
  let minCooldownDays = 7;
  let dryRun = false;
  let resetProgress = false;
  let industry = 'dentist';

  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--markets' && a[i + 1]) { marketsRaw = a[i + 1]; i++; }
    else if (a[i] === '--limit' && a[i + 1]) { limit = parseInt(a[i + 1], 10); i++; }
    else if (a[i] === '--regions-per-market' && a[i + 1]) { regionsPerMarket = parseInt(a[i + 1], 10); i++; }
    else if (a[i] === '--concurrency' && a[i + 1]) { concurrency = parseInt(a[i + 1], 10); i++; }
    else if (a[i] === '--min-cooldown-days' && a[i + 1]) { minCooldownDays = parseInt(a[i + 1], 10); i++; }
    else if (a[i] === '--industry' && a[i + 1]) { industry = a[i + 1]; i++; }
    else if (a[i] === '--dry-run') dryRun = true;
    else if (a[i] === '--reset-progress') resetProgress = true;
  }

  const valid: MarketCode[] = ['US', 'UK', 'AU'];
  const markets = marketsRaw
    .split(',')
    .map((m) => m.trim().toUpperCase())
    .filter((m): m is MarketCode => {
      if ((valid as string[]).includes(m)) return true;
      console.warn(`⚠️  Ignoring unknown market code "${m}" (only US, UK, AU are supported by OSM collector)`);
      return false;
    });

  if (markets.length === 0) {
    console.error('❌ No valid markets selected. Use --markets with US, UK, and/or AU.');
    process.exit(1);
  }

  return { markets, limit, regionsPerMarket, concurrency, minCooldownDays, dryRun, resetProgress, industry };
}

// ─── Region progress ────────────────────────────────────────────────────

function loadRegionProgress(): Record<string, RegionProgress> {
  if (!fs.existsSync(REGION_PROGRESS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(REGION_PROGRESS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveRegionProgress(p: Record<string, RegionProgress>): void {
  fs.mkdirSync(path.dirname(REGION_PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(REGION_PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function shouldRunRegion(
  code: string,
  progress: Record<string, RegionProgress>,
  cooldownDays: number
): { run: boolean; reason: string } {
  const e = progress[code];
  if (!e) return { run: true, reason: 'never run' };
  const ageDays = (Date.now() - new Date(e.lastRunAt).getTime()) / (24 * 3600 * 1000);
  if (ageDays >= cooldownDays) return { run: true, reason: `>${cooldownDays}d cooldown ok` };
  return { run: false, reason: `cooled (${ageDays.toFixed(1)}d ago)` };
}

// ─── Detection (copy from auto-dental-v5-collect.ts:150-211) ────────────
// Source of truth: auto-dental-v5-collect.ts. If those patterns change,
// update here too. Kept as explicit duplication to avoid coupling the two
// collectors during refactoring.

const CHATBOT_PATTERNS = [
  'intercom', 'drift.com', 'tidio', 'crisp.chat', 'tawk.to', 'livechat',
  'landbot', 'botsify', 'freshchat', 'olark',
  'hubspot-conversations', 'hs-scripts.com', 'zdassets.com', 'zendesk',
  'messagebird', 'jivochat', 'smooch', 'gorgias', 'chatwoot',
  'fresh-chat', 'helpcrunch', 'userlike', 'chatlio',
  'kommunicate', 'chaport', 'chatra', 'snapengage', 'zoho.com/salesiq',
  'manychat', 'botpress', 'rasa', 'ada.cx', 'drift-iframe',
  'livechatinc', 'collect.chat', 'rocketbots', 'formilla',
];

const BOOKING_PATTERNS = [
  'calendly', 'acuityscheduling', 'setmore', 'booksy', 'nexhealth',
  'zocdoc', 'square-appointments', 'simplybook', 'localmed',
  'dentalhq', 'modento', 'timely', 'squareup.com/appointments',
  'flexbooker', '10to8', 'bookingbug',
];

function hasChatbot(html: string): boolean {
  const lower = html.toLowerCase();
  return CHATBOT_PATTERNS.some((p) => lower.includes(p));
}

function hasBooking(html: string): boolean {
  const lower = html.toLowerCase();
  return BOOKING_PATTERNS.some((p) => lower.includes(p));
}

function modernScore(html: string, url: string): number {
  const lower = html.toLowerCase();
  let score = 0;
  if (url.startsWith('https://')) score++;
  if (lower.includes('<!doctype html')) score++;
  if (lower.includes('name="viewport"') || lower.includes("name='viewport'")) score++;
  return score;
}

const JUNK = ['.gif', '.png', '.jpg', '.svg', '.css', '.js', 'your@', 'email@', 'name@', 'noreply', 'example.com', 'example@', 'wordpress', 'wixpress', 'wpengine', 'webmaster@', 'mailer-daemon', 'sentry', 'webpack', 'github', '2x.', 'mysocialpractice', 'yourdomain', 'domain.com', '@weomedia', '@gargle.com', 'webreporting@', 'u0022', '\\u0022', 'pagecloud', '@wpengine', 'marketing@', 'support@smartflow', 'kapusicsgo', 'johndoe', 'janedoe', 'sg-host.com', 'test@', 'anonymous', 'user@', '.sg-host.', '@prosites.com', '@dentalqore', '@pbhs.com'];
const isJunkEmail = (e: string) => JUNK.some((p) => e.toLowerCase().includes(p));

function extractEmailFromHtml(html: string): string | null {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(regex) || [];
  for (const m of matches) {
    const l = m.toLowerCase();
    if (isJunkEmail(l)) continue;
    if (l.match(/^(info|contact|hello|office|admin|reception|appointments|dental|team|front|enquiries|enquiry|practice|booking|hi)@/)) {
      return l;
    }
  }
  for (const m of matches) {
    const l = m.toLowerCase();
    if (isJunkEmail(l)) continue;
    return l;
  }
  return null;
}

// ─── HTTP fetch with timeout + byte cap ─────────────────────────────────

async function fetchHtml(url: string, timeoutMs = 8000, maxBytes = 300_000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, maxBytes);
  } catch {
    return null;
  }
}

// ─── Overpass query (Stage 1) ───────────────────────────────────────────

interface RawCandidate {
  name: string;
  website: string;
  phone?: string;
  city: string;
  country: MarketCode;
  regionCode: string;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function buildOverpassQuery(bboxStr: string, osmTags: string[]): string {
  const tagQueries = osmTags.flatMap(tag => {
    const [key, value] = tag.split('=');
    return [
      `node["${key}"="${value}"]["website"](${bboxStr});`,
      `way["${key}"="${value}"]["website"](${bboxStr});`,
    ];
  });
  const contactQueries = osmTags.flatMap(tag => {
    const [key, value] = tag.split('=');
    return [
      `node["${key}"="${value}"]["contact:website"](${bboxStr});`,
    ];
  });

  return `[out:json][timeout:25];\n(\n  ${[...tagQueries, ...contactQueries].join('\n  ')}\n);\nout center tags;`;
}

async function queryOverpass(region: OsmRegion): Promise<RawCandidate[]> {
  const bboxStr = bboxToString(region.bbox);
  const query = buildOverpassQuery(bboxStr, currentOsmTags);

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30_000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      clearTimeout(t);

      if (!res.ok) {
        console.log(`    ⚠️  ${endpoint} → HTTP ${res.status}, trying fallback`);
        continue;
      }

      const data = (await res.json()) as any;
      const elements = data?.elements || [];
      const candidates: RawCandidate[] = [];

      for (const el of elements) {
        const tags = el?.tags || {};
        const website = tags.website || tags['contact:website'];
        if (!website) continue;
        const name = tags.name || tags['name:en'] || currentDefaultName;
        const city = tags['addr:city'] || tags['addr:suburb'] || region.city;
        const phone = tags.phone || tags['contact:phone'];
        candidates.push({
          name: String(name).slice(0, 120),
          website: String(website),
          phone: phone ? String(phone) : undefined,
          city: String(city),
          country: region.country,
          regionCode: region.code,
        });
      }
      return candidates;
    } catch (err: any) {
      console.log(`    ⚠️  ${endpoint} failed (${err?.message?.slice(0, 60) || 'unknown'}), trying fallback`);
    }
  }

  console.log(`    ❌ All Overpass endpoints failed for region ${region.code}`);
  return [];
}

// ─── Process one candidate (Stage 2) ────────────────────────────────────

interface ProcessResult {
  lead: V5Lead | null;
  reason: string;
}

async function processCandidate(c: RawCandidate): Promise<ProcessResult> {
  let normalizedUrl = c.website.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = 'https://' + normalizedUrl;
  // Strip trailing query/hash for stability
  try {
    const u = new URL(normalizedUrl);
    normalizedUrl = u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return { lead: null, reason: 'invalid url' };
  }

  const html = await fetchHtml(normalizedUrl);
  if (!html) return { lead: null, reason: 'fetch failed' };

  if (hasChatbot(html)) return { lead: null, reason: 'has chatbot' };

  let email = extractEmailFromHtml(html);
  if (!email) {
    const contactHtml = await fetchHtml(normalizedUrl + '/contact', 6000);
    if (contactHtml) {
      if (hasChatbot(contactHtml)) return { lead: null, reason: 'has chatbot (contact page)' };
      email = extractEmailFromHtml(contactHtml);
    }
  }
  if (!email) {
    const contactUsHtml = await fetchHtml(normalizedUrl + '/contact-us', 6000);
    if (contactUsHtml) {
      if (hasChatbot(contactUsHtml)) return { lead: null, reason: 'has chatbot (contact-us page)' };
      email = extractEmailFromHtml(contactUsHtml);
    }
  }
  if (!email) return { lead: null, reason: 'no email' };

  const modern = modernScore(html, normalizedUrl);
  if (modern < 2) return { lead: null, reason: `not modern (${modern}/3)` };

  return {
    lead: {
      name: c.name,
      website: normalizedUrl,
      phone: c.phone,
      city: c.city,
      country: c.country,
      email,
      hasBooking: hasBooking(html),
      modernScore: modern,
      collectedAt: new Date().toISOString(),
    },
    reason: 'qualified',
  };
}

// ─── Concurrency-limited parallel map ───────────────────────────────────

async function parallelMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Dedup helpers ──────────────────────────────────────────────────────

const PUBLIC_MAIL = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'protonmail.com', 'mail.com', 'live.com', 'msn.com', 'me.com',
]);

function buildSkipSets(): { skipEmails: Set<string>; skipDomains: Set<string> } {
  const skipEmails = new Set<string>();
  const skipDomains = new Set<string>();

  const addFromState = (emails: string[]) => {
    for (const em of emails) {
      const lower = em.toLowerCase();
      skipEmails.add(lower);
      const d = lower.split('@')[1];
      if (d && !PUBLIC_MAIL.has(d)) skipDomains.add(d);
    }
  };

  if (fs.existsSync(V4_STATE_FILE)) {
    try {
      addFromState(Object.keys(JSON.parse(fs.readFileSync(V4_STATE_FILE, 'utf-8'))));
    } catch {}
  }
  if (fs.existsSync(V5_STATE_FILE)) {
    try {
      addFromState(Object.keys(JSON.parse(fs.readFileSync(V5_STATE_FILE, 'utf-8'))));
    } catch {}
  }
  if (fs.existsSync(LEADS_FILE)) {
    try {
      const existing: V5Lead[] = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
      for (const l of existing) {
        skipEmails.add(l.email.toLowerCase());
        try {
          skipDomains.add(new URL(l.website).hostname.replace('www.', '').toLowerCase());
        } catch {}
      }
    } catch {}
  }

  return { skipEmails, skipDomains };
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  // Resolve industry config and set module-level state
  const industryConfig = getIndustry(args.industry);
  LEADS_FILE = industryConfig.leadsFile;
  V5_STATE_FILE = industryConfig.stateFile;
  REGION_PROGRESS_FILE = industryConfig.progressFile;
  currentOsmTags = industryConfig.osmTags;
  currentDefaultName = industryConfig.defaultName;

  console.log(`🔍 OSM ${industryConfig.label.toUpperCase()} COLLECT — zero-cost (OpenStreetMap Overpass)`);
  console.log(`   Markets:            ${args.markets.join(', ')}`);
  console.log(`   Limit:              ${args.limit} new leads`);
  console.log(`   Regions/market:     ${args.regionsPerMarket}`);
  console.log(`   Concurrency:        ${args.concurrency}`);
  console.log(`   Cooldown:           ${args.minCooldownDays} days`);
  console.log(`   Mode:               ${args.dryRun ? '🔹 DRY RUN' : '💾 WRITE'}\n`);

  // Reset progress if requested
  if (args.resetProgress) {
    if (fs.existsSync(REGION_PROGRESS_FILE)) fs.unlinkSync(REGION_PROGRESS_FILE);
    console.log('♻️  osm-region-progress.json reset\n');
  }

  const progress = loadRegionProgress();

  // Pick eligible regions with smart rotation (never-run first, then oldest)
  const allRegions = getRegionsForMarkets(args.markets);
  console.log(`📍 ${allRegions.length} regions available for selected markets`);

  const eligible = allRegions
    .map((r) => ({ region: r, status: shouldRunRegion(r.code, progress, args.minCooldownDays) }))
    .filter((x) => x.status.run)
    .map((x) => x.region);
  const cooledOut = allRegions.length - eligible.length;

  // Sort: never-run first, then oldest lastRunAt
  eligible.sort((a, b) => {
    const ea = progress[a.code];
    const eb = progress[b.code];
    if (!ea && eb) return -1;
    if (ea && !eb) return 1;
    if (!ea && !eb) return 0;
    return new Date(ea!.lastRunAt).getTime() - new Date(eb!.lastRunAt).getTime();
  });

  // Take N per market
  const selected: OsmRegion[] = [];
  const perMarketCount: Record<string, number> = {};
  for (const r of eligible) {
    const c = perMarketCount[r.country] || 0;
    if (c >= args.regionsPerMarket) continue;
    selected.push(r);
    perMarketCount[r.country] = c + 1;
  }

  console.log(`   Eligible (not cooled):  ${eligible.length}`);
  console.log(`   Cooled down (skip):     ${cooledOut}`);
  console.log(`   Selected this run:      ${selected.length}\n`);

  if (selected.length === 0) {
    console.log('⏭️  All regions cooled down. Nothing to collect right now.');
    console.log('   Options: wait for cooldown, or run with --reset-progress.');
    return;
  }

  // Build dedup sets
  const { skipEmails, skipDomains } = buildSkipSets();
  console.log(`📋 Dedup: ${skipEmails.size} emails, ${skipDomains.size} custom domains to skip\n`);

  // Load existing pool for merging
  let pool: V5Lead[] = [];
  if (fs.existsSync(LEADS_FILE)) {
    try {
      pool = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    } catch {
      pool = [];
    }
  }
  const initialPoolSize = pool.length;

  // ─── STAGE 1: Overpass queries (sequential w/ 5s delay between) ────────
  console.log('═══ STAGE 1: Overpass queries ═══\n');
  const allRaw: RawCandidate[] = [];
  const perRegionStats: Record<string, { resultsCount: number; newQualified: number }> = {};

  for (let i = 0; i < selected.length; i++) {
    const r = selected[i];
    console.log(`  [${i + 1}/${selected.length}] 🔍 ${r.code} (${r.city})`);
    const raw = await queryOverpass(r);
    console.log(`      → ${raw.length} raw candidates with website tag`);
    perRegionStats[r.code] = { resultsCount: raw.length, newQualified: 0 };
    allRaw.push(...raw);

    // 5s delay between Overpass queries (rate-limit hygiene)
    if (i < selected.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Dedup raw candidates by domain against skipDomains and each other
  const seenDomain = new Set<string>();
  const uniqueRaw: RawCandidate[] = [];
  for (const c of allRaw) {
    let domain: string;
    try {
      domain = new URL(c.website.startsWith('http') ? c.website : 'https://' + c.website)
        .hostname.replace('www.', '')
        .toLowerCase();
    } catch {
      continue;
    }
    if (seenDomain.has(domain)) continue;
    if (skipDomains.has(domain)) continue;
    seenDomain.add(domain);
    uniqueRaw.push(c);
  }
  console.log(`\n📊 ${allRaw.length} raw → ${uniqueRaw.length} unique after dedup\n`);

  if (uniqueRaw.length === 0) {
    console.log('⏭️  No new unique candidates to process.');
    return;
  }

  // ─── STAGE 2: Parallel scrape + filter ───────────────────────────────
  console.log(`═══ STAGE 2: Scrape + filter (${args.concurrency} concurrent) ═══\n`);

  // Process up to 3x limit to account for skip rate (fetch fails, no email, etc.)
  const targetToProcess = uniqueRaw.slice(0, args.limit * 3);

  let processed = 0;
  let qualified = 0;
  let hasChatbotCount = 0;
  let noEmailCount = 0;
  let notModernCount = 0;
  let fetchFailCount = 0;
  let dupEmailCount = 0;

  await parallelMap(targetToProcess, args.concurrency, async (c, idx) => {
    if (qualified >= args.limit) return null; // short-circuit when we hit the limit

    const r = await processCandidate(c);
    processed++;

    if (r.lead) {
      const emailLower = r.lead.email.toLowerCase();
      if (skipEmails.has(emailLower)) {
        dupEmailCount++;
        return { lead: null, reason: 'email already sent/pooled' };
      }
      skipEmails.add(emailLower);
      qualified++;
      pool.push(r.lead);
      perRegionStats[c.regionCode].newQualified++;

      // Incremental write (unless dry-run) so a crash mid-run doesn't lose progress
      if (!args.dryRun) {
        fs.writeFileSync(LEADS_FILE, JSON.stringify(pool, null, 2));
      }

      console.log(
        `  [${idx + 1}/${targetToProcess.length}] ✅ ${c.name.slice(0, 40)} | ${r.lead.email} | ${c.city} ${c.country} (total: ${qualified})`
      );
    } else {
      if (r.reason.startsWith('has chatbot')) hasChatbotCount++;
      else if (r.reason === 'no email') noEmailCount++;
      else if (r.reason.startsWith('not modern')) notModernCount++;
      else if (r.reason === 'fetch failed') fetchFailCount++;

      if (processed % 25 === 0) {
        console.log(
          `  [${idx + 1}/${targetToProcess.length}] ⏭️  ${r.reason} (progress: ${qualified}/${args.limit} qualified, ${processed} processed)`
        );
      }
    }
    return r;
  });

  // ─── Update region progress ──────────────────────────────────────────
  const nowIso = new Date().toISOString();
  for (const r of selected) {
    const stat = perRegionStats[r.code] || { resultsCount: 0, newQualified: 0 };
    const prev = progress[r.code];
    progress[r.code] = {
      lastRunAt: nowIso,
      totalRuns: (prev?.totalRuns || 0) + 1,
      lastNewLeads: stat.newQualified,
      totalNewLeads: (prev?.totalNewLeads || 0) + stat.newQualified,
      lastResultsCount: stat.resultsCount,
    };
  }

  if (!args.dryRun) {
    saveRegionProgress(progress);
  }

  // ─── Summary ─────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('✅ OSM COLLECTION DONE');
  console.log(`   Regions processed:       ${selected.length}`);
  console.log(`   Raw candidates:          ${allRaw.length}`);
  console.log(`   Unique after dedup:      ${uniqueRaw.length}`);
  console.log(`   Processed (scraped):     ${processed}`);
  console.log(`   ✅ Qualified (new):      ${qualified}`);
  console.log(`   Skipped — has chatbot:   ${hasChatbotCount}`);
  console.log(`   Skipped — no email:      ${noEmailCount}`);
  console.log(`   Skipped — not modern:    ${notModernCount}`);
  console.log(`   Skipped — fetch failed:  ${fetchFailCount}`);
  console.log(`   Skipped — dup email:     ${dupEmailCount}`);
  console.log(`   Pool size:               ${initialPoolSize} → ${pool.length}`);
  if (args.dryRun) {
    console.log('   🔹 DRY RUN — no files written');
  } else {
    console.log(`   Leads file:              ${LEADS_FILE}`);
    console.log(`   Progress file:           ${REGION_PROGRESS_FILE}`);
  }
  console.log(`${'═'.repeat(60)}\n`);
  console.log(`📧 To send: npx ts-node scripts/send-${args.industry === 'dentist' ? 'dental-v5' : args.industry}.ts --markets ... --limit ...\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
