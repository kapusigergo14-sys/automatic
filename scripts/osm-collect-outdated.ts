/**
 * osm-collect-outdated.ts — OSM collector for the OUTDATED SITES variant.
 *
 * Mirror of osm-collect.ts with two key differences:
 *   1. processCandidate qualifies leads with modernScore < 2 (inverted filter).
 *      Chatbot presence is NOT a filter — an outdated site can have one, doesn't
 *      matter for the redesign pitch.
 *   2. Writes to a separate pool (dental-v5-outdated.json) and progress file
 *      (osm-region-progress-outdated.json).
 *
 * Dedup cross-checks BOTH v5 modern state AND outdated state — a lead can
 * receive exactly one pitch, never both.
 *
 * CLI (identical to osm-collect.ts):
 *   npx ts-node scripts/osm-collect-outdated.ts \
 *     --markets "US,UK,AU" \
 *     --limit 100 \
 *     --regions-per-market 3 \
 *     --concurrency 10 \
 *     --min-cooldown-days 7 \
 *     [--dry-run] [--reset-progress]
 *
 * Local-only script. No GitHub Actions workflow. User runs manually.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getRegionsForMarkets, bboxToString, type OsmRegion, type MarketCode } from './osm-regions';

// ─── Paths ──────────────────────────────────────────────────────────────

const V4_STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const V5_STATE_MODERN_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5.json');
const V5_STATE_OUTDATED_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5-outdated.json');
const LEADS_MODERN_FILE = path.resolve(__dirname, '../output/leads/dental-v5-modern.json');
const LEADS_OUTDATED_FILE = path.resolve(__dirname, '../output/leads/dental-v5-outdated.json');
const REGION_PROGRESS_FILE = path.resolve(__dirname, '../output/v5-campaign/osm-region-progress-outdated.json');

// ─── Schema (matches V5Lead exactly — sender compatibility) ─────────────

interface V5Lead {
  name: string;
  website: string;
  phone?: string;
  city: string;
  country: string;
  email: string;
  hasBooking: boolean;
  modernScore: number; // 0-3 (viewport + https + doctype) — for outdated, always < 2
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
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  let marketsRaw = 'US,UK,AU';
  let limit = 100;
  let regionsPerMarket = 3;
  let concurrency = 10;
  let minCooldownDays = 7;
  let dryRun = false;
  let resetProgress = false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--markets' && a[i + 1]) { marketsRaw = a[i + 1]; i++; }
    else if (a[i] === '--limit' && a[i + 1]) { limit = parseInt(a[i + 1], 10); i++; }
    else if (a[i] === '--regions-per-market' && a[i + 1]) { regionsPerMarket = parseInt(a[i + 1], 10); i++; }
    else if (a[i] === '--concurrency' && a[i + 1]) { concurrency = parseInt(a[i + 1], 10); i++; }
    else if (a[i] === '--min-cooldown-days' && a[i + 1]) { minCooldownDays = parseInt(a[i + 1], 10); i++; }
    else if (a[i] === '--dry-run') dryRun = true;
    else if (a[i] === '--reset-progress') resetProgress = true;
  }

  const valid: MarketCode[] = ['US', 'UK', 'AU'];
  const markets = marketsRaw
    .split(',')
    .map((m) => m.trim().toUpperCase())
    .filter((m): m is MarketCode => {
      if ((valid as string[]).includes(m)) return true;
      console.warn(`⚠️  Ignoring unknown market code "${m}" (only US, UK, AU supported)`);
      return false;
    });

  if (markets.length === 0) {
    console.error('❌ No valid markets selected. Use --markets with US, UK, and/or AU.');
    process.exit(1);
  }

  return { markets, limit, regionsPerMarket, concurrency, minCooldownDays, dryRun, resetProgress };
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

// ─── Detection (duplicated from osm-collect.ts — keep in sync manually) ──

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

function buildOverpassQuery(bboxStr: string): string {
  return `[out:json][timeout:25];
(
  node["amenity"="dentist"]["website"](${bboxStr});
  way["amenity"="dentist"]["website"](${bboxStr});
  node["healthcare"="dentist"]["website"](${bboxStr});
  way["healthcare"="dentist"]["website"](${bboxStr});
  node["amenity"="dentist"]["contact:website"](${bboxStr});
  node["healthcare"="dentist"]["contact:website"](${bboxStr});
);
out center tags;`;
}

async function queryOverpass(region: OsmRegion): Promise<RawCandidate[]> {
  const bboxStr = bboxToString(region.bbox);
  const query = buildOverpassQuery(bboxStr);

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
        const name = tags.name || tags['name:en'] || 'Dental Practice';
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

// ─── Process one candidate (Stage 2) — INVERTED FILTER ─────────────────

interface ProcessResult {
  lead: V5Lead | null;
  reason: string;
}

async function processCandidate(c: RawCandidate): Promise<ProcessResult> {
  let normalizedUrl = c.website.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = 'https://' + normalizedUrl;
  try {
    const u = new URL(normalizedUrl);
    normalizedUrl = u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return { lead: null, reason: 'invalid url' };
  }

  const html = await fetchHtml(normalizedUrl);
  if (!html) return { lead: null, reason: 'fetch failed' };

  // NOTE: we do NOT skip chatbot-having sites here — an outdated site can
  // still have a chatbot, it's irrelevant for the redesign pitch.

  let email = extractEmailFromHtml(html);
  if (!email) {
    const contactHtml = await fetchHtml(normalizedUrl + '/contact', 6000);
    if (contactHtml) email = extractEmailFromHtml(contactHtml);
  }
  if (!email) {
    const contactUsHtml = await fetchHtml(normalizedUrl + '/contact-us', 6000);
    if (contactUsHtml) email = extractEmailFromHtml(contactUsHtml);
  }
  if (!email) return { lead: null, reason: 'no email' };

  const modern = modernScore(html, normalizedUrl);
  // Target any site missing at least one modern marker (HTTPS, DOCTYPE,
  // or mobile viewport). A 2/3 site still has a legitimate redesign pitch
  // (e.g. missing mobile viewport = not responsive). Only 3/3 is skipped.
  if (modern >= 3) return { lead: null, reason: `fully-modern (${modern}/3)` };

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
    reason: 'outdated-qualified',
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

// ─── Dedup helpers (cross-check BOTH modern + outdated state files) ────

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

  // Load v4 state (historical sends)
  if (fs.existsSync(V4_STATE_FILE)) {
    try {
      addFromState(Object.keys(JSON.parse(fs.readFileSync(V4_STATE_FILE, 'utf-8'))));
    } catch {}
  }
  // Load v5 MODERN state (chatbot pitch sends)
  if (fs.existsSync(V5_STATE_MODERN_FILE)) {
    try {
      addFromState(Object.keys(JSON.parse(fs.readFileSync(V5_STATE_MODERN_FILE, 'utf-8'))));
    } catch {}
  }
  // Load v5 OUTDATED state (own redesign pitch sends)
  if (fs.existsSync(V5_STATE_OUTDATED_FILE)) {
    try {
      addFromState(Object.keys(JSON.parse(fs.readFileSync(V5_STATE_OUTDATED_FILE, 'utf-8'))));
    } catch {}
  }
  // Load modern pool (leads already queued for chatbot pitch)
  if (fs.existsSync(LEADS_MODERN_FILE)) {
    try {
      const existing: V5Lead[] = JSON.parse(fs.readFileSync(LEADS_MODERN_FILE, 'utf-8'));
      for (const l of existing) {
        skipEmails.add(l.email.toLowerCase());
        try {
          skipDomains.add(new URL(l.website).hostname.replace('www.', '').toLowerCase());
        } catch {}
      }
    } catch {}
  }
  // Load outdated pool (own existing leads)
  if (fs.existsSync(LEADS_OUTDATED_FILE)) {
    try {
      const existing: V5Lead[] = JSON.parse(fs.readFileSync(LEADS_OUTDATED_FILE, 'utf-8'));
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

  console.log('🦷 OSM DENTAL COLLECT — OUTDATED sites variant (redesign pitch target)');
  console.log(`   Markets:            ${args.markets.join(', ')}`);
  console.log(`   Limit:              ${args.limit} new leads`);
  console.log(`   Regions/market:     ${args.regionsPerMarket}`);
  console.log(`   Concurrency:        ${args.concurrency}`);
  console.log(`   Cooldown:           ${args.minCooldownDays} days`);
  console.log(`   Mode:               ${args.dryRun ? '🔹 DRY RUN' : '💾 WRITE'}\n`);

  if (args.resetProgress) {
    if (fs.existsSync(REGION_PROGRESS_FILE)) fs.unlinkSync(REGION_PROGRESS_FILE);
    console.log('♻️  osm-region-progress-outdated.json reset\n');
  }

  const progress = loadRegionProgress();

  const allRegions = getRegionsForMarkets(args.markets);
  console.log(`📍 ${allRegions.length} regions available for selected markets`);

  const eligible = allRegions
    .map((r) => ({ region: r, status: shouldRunRegion(r.code, progress, args.minCooldownDays) }))
    .filter((x) => x.status.run)
    .map((x) => x.region);
  const cooledOut = allRegions.length - eligible.length;

  eligible.sort((a, b) => {
    const ea = progress[a.code];
    const eb = progress[b.code];
    if (!ea && eb) return -1;
    if (ea && !eb) return 1;
    if (!ea && !eb) return 0;
    return new Date(ea!.lastRunAt).getTime() - new Date(eb!.lastRunAt).getTime();
  });

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

  const { skipEmails, skipDomains } = buildSkipSets();
  console.log(`📋 Dedup: ${skipEmails.size} emails, ${skipDomains.size} custom domains to skip`);
  console.log(`   (includes modern pool + modern send-state + outdated pool + outdated send-state)\n`);

  let pool: V5Lead[] = [];
  if (fs.existsSync(LEADS_OUTDATED_FILE)) {
    try {
      pool = JSON.parse(fs.readFileSync(LEADS_OUTDATED_FILE, 'utf-8'));
    } catch {
      pool = [];
    }
  }
  const initialPoolSize = pool.length;

  // ─── STAGE 1: Overpass queries ────────
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

    if (i < selected.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

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

  const targetToProcess = uniqueRaw.slice(0, args.limit * 3);

  let processed = 0;
  let qualified = 0;
  let noEmailCount = 0;
  let modernNotOutdatedCount = 0;
  let fetchFailCount = 0;
  let dupEmailCount = 0;

  await parallelMap(targetToProcess, args.concurrency, async (c, idx) => {
    if (qualified >= args.limit) return null;

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

      if (!args.dryRun) {
        fs.writeFileSync(LEADS_OUTDATED_FILE, JSON.stringify(pool, null, 2));
      }

      console.log(
        `  [${idx + 1}/${targetToProcess.length}] ✅ ${c.name.slice(0, 40)} | ${r.lead.email} | ${c.city} ${c.country} (modern=${r.lead.modernScore}/3, total: ${qualified})`
      );
    } else {
      if (r.reason === 'no email') noEmailCount++;
      else if (r.reason.startsWith('fully-modern')) modernNotOutdatedCount++;
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
  console.log('✅ OSM COLLECTION DONE (OUTDATED variant)');
  console.log(`   Regions processed:          ${selected.length}`);
  console.log(`   Raw candidates:             ${allRaw.length}`);
  console.log(`   Unique after dedup:         ${uniqueRaw.length}`);
  console.log(`   Processed (scraped):        ${processed}`);
  console.log(`   ✅ Outdated qualified:      ${qualified}`);
  console.log(`   Skipped — no email:         ${noEmailCount}`);
  console.log(`   Skipped — modern (not us):  ${modernNotOutdatedCount}`);
  console.log(`   Skipped — fetch failed:     ${fetchFailCount}`);
  console.log(`   Skipped — dup email:        ${dupEmailCount}`);
  console.log(`   Outdated pool size:         ${initialPoolSize} → ${pool.length}`);
  if (args.dryRun) {
    console.log('   🔹 DRY RUN — no files written');
  } else {
    console.log(`   Leads file:                 ${LEADS_OUTDATED_FILE}`);
    console.log(`   Progress file:              ${REGION_PROGRESS_FILE}`);
  }
  console.log(`${'═'.repeat(60)}\n`);
  console.log('📧 To send: npx ts-node scripts/send-dental-redesign.ts --markets ... --limit ...\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
