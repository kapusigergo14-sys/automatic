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
  extractedFrom?: string; // 'homepage' | 'mailto' | 'jsonld' | 'cfemail' | 'obfuscated' | 'contact' | 'about' | 'team' | …
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

// Tighter junk list — remove generic role keywords (info/marketing/support);
// rely on domain matching + asset-extension blocks instead.
const JUNK = [
  '.gif', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.css', '.js', '.woff', '.ttf', '.ico',
  'your@', 'email@', 'name@', 'noreply', 'no-reply', 'donotreply',
  'example.com', 'example@', 'mailer-daemon', 'postmaster@',
  'wordpress', 'wixpress', 'wpengine', 'webmaster@', 'sentry', 'webpack', 'github',
  '2x.', 'mysocialpractice', 'yourdomain', 'domain.com', '@weomedia', '@gargle.com',
  'webreporting@', 'u0022', '\\u0022', 'pagecloud', '@wpengine',
  'kapusicsgo', 'kapusigergo', 'johndoe', 'janedoe',
  'sg-host.com', 'test@', 'anonymous@', 'user@', '.sg-host.',
  '@prosites.com', '@dentalqore', '@pbhs.com', 'smartflowdev',
];
const isJunkEmail = (e: string) => JUNK.some((p) => e.toLowerCase().includes(p));

const PREFERRED_PREFIX = /^(info|contact|hello|office|admin|reception|appointments|dental|team|front|enquiries|enquiry|practice|booking|hi|sales|service|support|emergency|dispatch|schedule)@/;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /href\s*=\s*["']mailto:([^"'?\s]+)/gi;

// CloudFlare email obfuscation: <a class="__cf_email__" data-cfemail="HEX"…>
const CFEMAIL_REGEX = /data-cfemail\s*=\s*["']([0-9a-fA-F]+)["']/g;

// Common obfuscations used to hide emails from scrapers:
//   info[at]clinic[dot]com / info(at)clinic(dot)com / info AT clinic DOT com
const OBFUSCATED_REGEX = /([a-zA-Z0-9._%+-]+)\s*[\[\(]\s*at\s*[\]\)]\s*([a-zA-Z0-9.-]+)\s*[\[\(]\s*dot\s*[\]\)]\s*([a-zA-Z]{2,})/gi;
const OBFUSCATED_SPACED_REGEX = /([a-zA-Z0-9._%+-]+)\s+(?:AT|at)\s+([a-zA-Z0-9.-]+)\s+(?:DOT|dot)\s+([a-zA-Z]{2,})/g;

const JSONLD_BLOCK_REGEX = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function decodeCfEmail(hex: string): string | null {
  if (hex.length < 4 || hex.length % 2 !== 0) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) {
    const c = parseInt(hex.slice(i, i + 2), 16) ^ r;
    out += String.fromCharCode(c);
  }
  return out;
}

interface ExtractedEmail {
  email: string;
  source: string; // 'mailto' | 'cfemail' | 'jsonld' | 'obfuscated' | 'text'
}

function extractEmailsFromHtml(html: string): ExtractedEmail[] {
  const out: ExtractedEmail[] = [];
  const seen = new Set<string>();

  const push = (raw: string, source: string) => {
    const lower = raw.toLowerCase().trim().replace(/[.,;:)>\]"']+$/g, '');
    if (!lower || seen.has(lower)) return;
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(lower)) return;
    if (isJunkEmail(lower)) return;
    seen.add(lower);
    out.push({ email: lower, source });
  };

  // 1. mailto: links — most reliable
  let m: RegExpExecArray | null;
  while ((m = MAILTO_REGEX.exec(html))) push(decodeURIComponent(m[1]), 'mailto');

  // 2. CloudFlare email decoder
  while ((m = CFEMAIL_REGEX.exec(html))) {
    const decoded = decodeCfEmail(m[1]);
    if (decoded) push(decoded, 'cfemail');
  }

  // 3. JSON-LD structured data (Organization/LocalBusiness email field)
  while ((m = JSONLD_BLOCK_REGEX.exec(html))) {
    try {
      const json = JSON.parse(m[1].trim());
      const visit = (node: any) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(visit);
        if (typeof node !== 'object') return;
        if (typeof node.email === 'string') push(node.email.replace(/^mailto:/i, ''), 'jsonld');
        for (const v of Object.values(node)) visit(v);
      };
      visit(json);
    } catch {
      // Tolerate malformed JSON-LD blocks
    }
  }

  // 4. Obfuscated forms ([at]/[dot] and AT/DOT)
  while ((m = OBFUSCATED_REGEX.exec(html))) push(`${m[1]}@${m[2]}.${m[3]}`, 'obfuscated');
  while ((m = OBFUSCATED_SPACED_REGEX.exec(html))) push(`${m[1]}@${m[2]}.${m[3]}`, 'obfuscated');

  // 5. Plain text regex (lowest priority, biggest false-positive risk)
  const textMatches = html.match(EMAIL_REGEX) || [];
  for (const t of textMatches) push(t, 'text');

  return out;
}

function pickBestEmail(
  emails: ExtractedEmail[],
  websiteHostname?: string
): ExtractedEmail | null {
  if (emails.length === 0) return null;
  const domainHost = websiteHostname ? websiteHostname.replace(/^www\./, '').toLowerCase() : null;

  const sourceRank = (s: string): number => {
    if (s === 'mailto') return 0;
    if (s === 'cfemail') return 1;
    if (s === 'jsonld') return 2;
    if (s === 'obfuscated') return 3;
    return 4; // text
  };
  const matchesDomain = (e: string): boolean => {
    if (!domainHost) return false;
    const eDomain = e.split('@')[1] || '';
    return eDomain === domainHost || eDomain.endsWith('.' + domainHost) || domainHost.endsWith('.' + eDomain);
  };

  const scored = emails.map((e) => {
    let score = 0;
    if (matchesDomain(e.email)) score -= 100; // strongly prefer same-domain
    if (PREFERRED_PREFIX.test(e.email)) score -= 10; // prefer info@/contact@/etc
    score += sourceRank(e.source);
    return { e, score };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].e;
}

// ─── HTTP fetch with timeout + byte cap ─────────────────────────────────

async function fetchHtml(
  url: string,
  timeoutMs = 8000,
  maxBytes = 600_000,
  retries = 1
): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs + attempt * 4000);
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
      if (!res.ok) {
        // 5xx and 429 — retry once. 4xx other than 429 — give up.
        if (attempt < retries && (res.status >= 500 || res.status === 429)) continue;
        return null;
      }
      const text = await res.text();
      return text.slice(0, maxBytes);
    } catch {
      if (attempt < retries) continue;
      return null;
    }
  }
  return null;
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
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Identifies us to Overpass operators so they can contact us if our
// traffic pattern causes issues, per their usage policy:
// https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
const OVERPASS_USER_AGENT = 'smartflowdev-leadgen/1.0 (+https://smartflowdev.com; geri@smartflowdev.com)';

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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': OVERPASS_USER_AGENT,
        },
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

// Cascade of fallback paths to try after the homepage. Most contact-having
// pages live on one of these routes — going through all of them roughly
// doubles the email yield without much extra latency (parallel fetch).
const FALLBACK_PATHS = [
  '/contact',
  '/contact-us',
  '/contactus',
  '/contact.html',
  '/about',
  '/about-us',
  '/our-team',
  '/team',
  '/staff',
  '/meet-the-team',
  '/get-in-touch',
  '/inquiry',
];

async function processCandidate(c: RawCandidate): Promise<ProcessResult> {
  let normalizedUrl = c.website.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = 'https://' + normalizedUrl;
  // Strip trailing query/hash for stability
  let websiteHost: string | undefined;
  try {
    const u = new URL(normalizedUrl);
    normalizedUrl = u.origin + u.pathname.replace(/\/$/, '');
    websiteHost = u.hostname;
  } catch {
    return { lead: null, reason: 'invalid url' };
  }

  const html = await fetchHtml(normalizedUrl);
  if (!html) return { lead: null, reason: 'fetch failed' };

  if (hasChatbot(html)) return { lead: null, reason: 'has chatbot' };

  // Collect all extracted candidate emails across pages, then pick the best.
  const allEmails: ExtractedEmail[] = [];
  const homepageEmails = extractEmailsFromHtml(html);
  for (const e of homepageEmails) {
    // Tag homepage source as 'homepage:<src>' so we can audit later
    allEmails.push({ email: e.email, source: 'homepage:' + e.source });
  }

  // Quick win: if homepage already has a same-domain mailto/jsonld/cfemail,
  // we're done — no need to fetch fallbacks.
  const earlyPick = pickBestEmail(homepageEmails, websiteHost);
  const earlyGood = earlyPick && (
    earlyPick.source === 'mailto' ||
    earlyPick.source === 'cfemail' ||
    earlyPick.source === 'jsonld'
  );

  if (!earlyGood) {
    // Fan out fallback fetches in parallel for speed.
    const fallbackResults = await Promise.all(
      FALLBACK_PATHS.map(async (p) => {
        const h = await fetchHtml(normalizedUrl + p, 6000, 600_000, 0);
        return h ? { path: p, html: h } : null;
      })
    );
    for (const r of fallbackResults) {
      if (!r) continue;
      // If any fallback page exposes a chatbot, the prospect is no longer a fit.
      if (hasChatbot(r.html)) return { lead: null, reason: `has chatbot (${r.path})` };
      const found = extractEmailsFromHtml(r.html);
      const tag = r.path.replace(/^\//, '').replace(/-/g, '_');
      for (const e of found) allEmails.push({ email: e.email, source: `${tag}:${e.source}` });
    }
  }

  const best = pickBestEmail(allEmails, websiteHost);
  if (!best) return { lead: null, reason: 'no email' };

  const modern = modernScore(html, normalizedUrl);
  if (modern < 2) return { lead: null, reason: `not modern (${modern}/3)` };

  return {
    lead: {
      name: c.name,
      website: normalizedUrl,
      phone: c.phone,
      city: c.city,
      country: c.country,
      email: best.email,
      hasBooking: hasBooking(html),
      modernScore: modern,
      collectedAt: new Date().toISOString(),
      extractedFrom: best.source,
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

  // Partition + weighted shuffle. Never-run regions win priority, and
  // within them we use a population-weighted reservoir sort (Efraimidis-
  // Spirakis A-Res algorithm): key = U^(1/pop). Larger cities end up
  // toward the front but still with randomness, so runs spread traffic
  // without wasting slots on 20k-pop towns where OSM has 0 dental POIs.
  // Has-run regions rotate by oldest lastRunAt as before.
  const neverRun = eligible.filter((r) => !progress[r.code]);
  const hasRun = eligible.filter((r) => progress[r.code]);
  const keyed = neverRun.map((r) => ({
    r,
    // Population acts as the weight. Fallback 50_000 if pop missing
    // (shouldn't happen with generator, but defensive).
    key: Math.random() ** (1 / Math.max(1, (r as any).pop || 50_000)),
  }));
  keyed.sort((a, b) => b.key - a.key);
  const weighted = keyed.map((x) => x.r);
  hasRun.sort((a, b) =>
    new Date(progress[a.code]!.lastRunAt).getTime()
    - new Date(progress[b.code]!.lastRunAt).getTime()
  );
  eligible.length = 0;
  eligible.push(...weighted, ...hasRun);

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

    // 15-25s delay between Overpass queries (jittered). The public
    // endpoints rate-limit aggressive back-to-back batches; GitHub
    // Actions shared IPs are especially prone to getting a short-term
    // 403/429 ban. Jitter helps avoid looking like bot traffic.
    if (i < selected.length - 1) {
      const delay = 15000 + Math.floor(Math.random() * 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
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
