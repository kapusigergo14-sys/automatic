/**
 * AUTO DENTAL v5 — FAST COLLECT (modern/középszerű, NO CHATBOT filter)
 *
 * Pipeline (optimized for speed, 10x faster than v4):
 * 1. Google Places API → dental businesses
 * 2. HTML fetch (parallel, 10 concurrent)
 * 3. Chatbot string-match → SKIP if has chatbot
 * 4. Modern site heuristic (viewport + HTTPS + DOCTYPE)
 * 5. Email extraction
 * 6. Cross-dedup with v4 send-state + v5 send-state
 * 7. Save to dental-v5-modern.json
 *
 * NO PSI (slow), NO screenshot (slow), NO vision analysis (slow).
 *
 * Target: ~2 sec per candidate → 500 candidates in ~5-10 minutes.
 *
 * CLI:
 *   npx ts-node scripts/auto-dental-v5-collect.ts [--limit 500] [--concurrency 10] [--resume]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getQueriesForMarkets, parseMarketList } from './markets';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';

if (!GOOGLE_API_KEY) {
  console.error('❌ Missing GOOGLE_API_KEY (or GOOGLE_PLACES_API_KEY) env var');
  process.exit(1);
}

const OUT_DIR = path.resolve(__dirname, '../output/dental-campaign');
const V4_STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const V5_STATE_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5.json');
const LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-v5-modern.json');
const CITY_PROGRESS_FILE = path.resolve(__dirname, '../output/v5-campaign/city-progress.json');

// ── Smart query rotation state ──
interface CityProgress {
  lastRunAt: string;        // ISO timestamp
  totalRuns: number;
  lastNewLeads: number;     // qualified leads added in last run
  totalNewLeads: number;    // cumulative qualified leads
  lastResultsCount: number; // raw Google Places results count
}

function makeQueryKey(country: string, query: string): string {
  return `${country}::${query}`;
}

function loadCityProgress(): Record<string, CityProgress> {
  if (!fs.existsSync(CITY_PROGRESS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CITY_PROGRESS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveCityProgress(progress: Record<string, CityProgress>): void {
  fs.mkdirSync(path.dirname(CITY_PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(CITY_PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function shouldRunQuery(
  key: string,
  progress: Record<string, CityProgress>,
  cooldownDays: number
): { run: boolean; reason: string } {
  const entry = progress[key];
  if (!entry) return { run: true, reason: 'never run' };
  const ageMs = Date.now() - new Date(entry.lastRunAt).getTime();
  const ageDays = ageMs / (24 * 3600 * 1000);
  // Strict cooldown: don't re-run within N days regardless of yield.
  // (No new dental practice opens within hours/days. Re-running would just
  // hit the cached Google Places result set and cost API quota for nothing.)
  if (ageDays >= cooldownDays) return { run: true, reason: `>${cooldownDays}d cooldown ok` };
  return { run: false, reason: `cooled (${ageDays.toFixed(1)}d ago)` };
}

interface V5Lead {
  name: string;
  website: string;
  phone?: string;
  city: string;
  country: string;
  email: string;
  hasBooking: boolean;
  modernScore: number;  // 0-3 (viewport + https + doctype)
  collectedAt: string;
}

// ── CLI args ──
function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 500;
  let concurrency = 10;
  let resume = false;
  let marketsRaw = '';
  let maxQueries = 50;
  let minCooldownDays = 7;
  let resetProgress = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') { limit = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--concurrency') { concurrency = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--resume') resume = true;
    if (args[i] === '--markets' && args[i + 1]) { marketsRaw = args[i + 1]; i++; }
    if (args[i] === '--max-queries') { maxQueries = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--min-cooldown-days') { minCooldownDays = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--reset-progress') resetProgress = true;
  }
  const markets = parseMarketList(marketsRaw);
  return { limit, concurrency, resume, markets, maxQueries, minCooldownDays, resetProgress };
}


// ── Google Places search ──
async function placesSearch(query: string): Promise<any[]> {
  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as any;
    const places = searchData.results || [];
    if (places.length === 0) return [];

    const details = await Promise.all(places.slice(0, 15).map(async (p: any) => {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=name,website,formatted_phone_number,formatted_address&key=${GOOGLE_API_KEY}`;
        const r = await fetch(detailsUrl);
        const d = await r.json() as any;
        return d.result || {};
      } catch { return {}; }
    }));

    return details.filter(d => d.website).map(d => ({
      name: d.name,
      website: d.website,
      phone: d.formatted_phone_number,
      address: d.formatted_address,
      city: (d.formatted_address || '').split(',').slice(-3, -2)[0]?.trim() || '',
    }));
  } catch {
    return [];
  }
}

// ── Chatbot detection ──
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
  return CHATBOT_PATTERNS.some(p => lower.includes(p));
}

function hasBooking(html: string): boolean {
  const lower = html.toLowerCase();
  return BOOKING_PATTERNS.some(p => lower.includes(p));
}

// ── Modern site heuristic (0-3 score) ──
function modernScore(html: string, url: string): number {
  const lower = html.toLowerCase();
  let score = 0;
  if (url.startsWith('https://')) score++;
  if (lower.includes('<!doctype html')) score++;
  if (lower.includes('name="viewport"') || lower.includes("name='viewport'")) score++;
  return score;
}

// ── Email extraction ──
const JUNK = ['.gif', '.png', '.jpg', '.svg', '.css', '.js', 'your@', 'email@', 'name@', 'noreply', 'example.com', 'example@', 'wordpress', 'wixpress', 'wpengine', 'webmaster@', 'mailer-daemon', 'sentry', 'webpack', 'github', '2x.', 'mysocialpractice', 'yourdomain', 'domain.com', '@weomedia', '@gargle.com', 'webreporting@', 'u0022', '\\u0022', 'pagecloud', '@wpengine', 'marketing@', 'support@smartflow', 'kapusicsgo', 'johndoe', 'janedoe', 'sg-host.com', 'test@', 'anonymous', 'user@', '.sg-host.', '@prosites.com', '@dentalqore', '@pbhs.com'];
const isJunkEmail = (e: string) => JUNK.some(p => e.toLowerCase().includes(p));

function extractEmailFromHtml(html: string): string | null {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(regex) || [];
  // First pass: prefer structured inbox names
  for (const m of matches) {
    const l = m.toLowerCase();
    if (isJunkEmail(l)) continue;
    if (l.match(/^(info|contact|hello|office|admin|reception|appointments|dental|team|front|enquiries|enquiry|practice|booking|hi)@/)) {
      return l;
    }
  }
  // Second pass: any valid email
  for (const m of matches) {
    const l = m.toLowerCase();
    if (isJunkEmail(l)) continue;
    return l;
  }
  return null;
}

// ── HTML fetch with limits ──
async function fetchHtml(url: string, timeoutMs = 8000, maxBytes = 300_000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
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

// ── Process one candidate ──
interface Candidate {
  name: string;
  website: string;
  phone?: string;
  city: string;
  country: string;
  sourceQueryKey?: string;
}

interface ProcessResult {
  lead: V5Lead | null;
  reason: string;
}

async function processCandidate(c: Candidate): Promise<ProcessResult> {
  const normalizedUrl = c.website.startsWith('http') ? c.website : `https://${c.website}`;

  // Try root first
  let html = await fetchHtml(normalizedUrl);
  if (!html) return { lead: null, reason: 'fetch failed' };

  // Chatbot check — CRITICAL FILTER
  if (hasChatbot(html)) return { lead: null, reason: 'has chatbot' };

  // Email extraction (try root + /contact)
  let email = extractEmailFromHtml(html);
  if (!email) {
    const contactUrl = normalizedUrl.replace(/\/$/, '') + '/contact';
    const contactHtml = await fetchHtml(contactUrl, 6000);
    if (contactHtml) {
      if (hasChatbot(contactHtml)) return { lead: null, reason: 'has chatbot (contact page)' };
      email = extractEmailFromHtml(contactHtml);
    }
  }
  if (!email) return { lead: null, reason: 'no email' };

  const modern = modernScore(html, normalizedUrl);
  if (modern < 2) return { lead: null, reason: `not modern (${modern}/3)` };

  const booking = hasBooking(html);

  return {
    lead: {
      name: c.name,
      website: normalizedUrl,
      phone: c.phone,
      city: c.city,
      country: c.country,
      email,
      hasBooking: booking,
      modernScore: modern,
      collectedAt: new Date().toISOString(),
    },
    reason: 'qualified',
  };
}

// ── Concurrency-limited map ──
async function parallelMap<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
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

// ── Main ──
async function main() {
  const { limit, concurrency, resume, markets, maxQueries, minCooldownDays, resetProgress } = parseArgs();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
  fs.mkdirSync(path.dirname(V5_STATE_FILE), { recursive: true });

  // Resolve search queries from the requested markets
  const ALL_QUERIES = getQueriesForMarkets(markets);

  console.log('🦷 AUTO DENTAL v5 — FAST COLLECT (modern/középszerű, NO CHATBOT)');
  console.log(`   Markets:     ${markets.join(', ')}`);
  console.log(`   Queries:     ${ALL_QUERIES.length} total in selected markets`);
  console.log(`   Max/run:     ${maxQueries}`);
  console.log(`   Cooldown:    ${minCooldownDays} days`);
  console.log(`   Concurrency: ${concurrency}, target: ${limit} leads\n`);

  // ── Smart query rotation ──
  if (resetProgress) {
    saveCityProgress({});
    console.log('♻️  city-progress.json reset (--reset-progress)\n');
  }
  const cityProgress = loadCityProgress();

  let neverRun = 0;
  let dueAge = 0;
  let cooledDown = 0;
  const eligibleQueries: typeof ALL_QUERIES = [];
  for (const q of ALL_QUERIES) {
    const key = makeQueryKey(q.country, q.query);
    const decision = shouldRunQuery(key, cityProgress, minCooldownDays);
    if (decision.run) {
      eligibleQueries.push(q);
      if (decision.reason === 'never run') neverRun++;
      else dueAge++;
    } else {
      cooledDown++;
    }
  }

  // Cap to maxQueries — prefer never-run > due > recently-fertile order
  const sorted = [...eligibleQueries].sort((a, b) => {
    const ka = makeQueryKey(a.country, a.query);
    const kb = makeQueryKey(b.country, b.query);
    const ea = cityProgress[ka];
    const eb = cityProgress[kb];
    // never-run first
    if (!ea && eb) return -1;
    if (ea && !eb) return 1;
    if (!ea && !eb) return 0;
    // older first (older = more time has passed)
    return new Date(ea!.lastRunAt).getTime() - new Date(eb!.lastRunAt).getTime();
  });
  const SEARCH_QUERIES = sorted.slice(0, maxQueries);

  console.log('🔍 Smart rotation status:');
  console.log(`   Never run:                  ${neverRun}`);
  console.log(`   Due (>${minCooldownDays}d cooldown):       ${dueAge}`);
  console.log(`   Cooled down (skip):         ${cooledDown}`);
  console.log(`   Eligible total:             ${eligibleQueries.length}`);
  console.log(`   To run this batch:          ${SEARCH_QUERIES.length} (max ${maxQueries})\n`);

  if (SEARCH_QUERIES.length === 0) {
    console.log('⏭️  All queries cooled down. Nothing to mine right now.');
    console.log(`   Next eligible: wait until cooldown expires (${minCooldownDays} days from last run).`);
    console.log('   Or: --reset-progress to force re-run, or expand markets.ts city lists.');
    return;
  }

  // Cross-dedup: v4 send-state + v5 send-state
  // IMPORTANT: only dedup by CUSTOM domains — public webmail providers (gmail, yahoo, etc)
  // are shared by many dentists, can't dedup on them.
  const PUBLIC_MAIL = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'mail.com', 'live.com', 'msn.com', 'me.com']);
  const skipEmails = new Set<string>();
  const skipDomains = new Set<string>();
  const addToState = (emails: string[]) => {
    for (const em of emails) {
      const lower = em.toLowerCase();
      skipEmails.add(lower);
      const d = lower.split('@')[1];
      if (d && !PUBLIC_MAIL.has(d)) skipDomains.add(d);
    }
  };
  if (fs.existsSync(V4_STATE_FILE)) {
    const s = JSON.parse(fs.readFileSync(V4_STATE_FILE, 'utf-8'));
    addToState(Object.keys(s));
  }
  if (fs.existsSync(V5_STATE_FILE)) {
    const s = JSON.parse(fs.readFileSync(V5_STATE_FILE, 'utf-8'));
    addToState(Object.keys(s));
  }
  console.log(`📋 Dedup: ${skipEmails.size} emails, ${skipDomains.size} custom domains to skip\n`);

  // Resume from existing collected leads
  let qualifiedLeads: V5Lead[] = [];
  if (resume && fs.existsSync(LEADS_FILE)) {
    qualifiedLeads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    for (const l of qualifiedLeads) {
      skipEmails.add(l.email.toLowerCase());
      try { skipDomains.add(new URL(l.website).hostname.replace('www.', '').toLowerCase()); } catch {}
    }
    console.log(`📂 Resumed: ${qualifiedLeads.length} already qualified\n`);
  }

  // STAGE 1 — Google Places (parallel 5 queries)
  console.log('═══ STAGE 1: Google Places search ═══\n');
  const allCandidates: Candidate[] = [];
  const perQueryStats = new Map<string, { resultsCount: number; newQualified: number }>();
  const queryChunks: Array<typeof SEARCH_QUERIES> = [];
  for (let i = 0; i < SEARCH_QUERIES.length; i += 5) {
    queryChunks.push(SEARCH_QUERIES.slice(i, i + 5));
  }
  for (const chunk of queryChunks) {
    const results = await Promise.all(chunk.map(async ({ query, country }) => {
      const places = await placesSearch(query);
      const key = makeQueryKey(country, query);
      perQueryStats.set(key, { resultsCount: places.length, newQualified: 0 });
      console.log(`  🔎 "${query}" → ${places.length}`);
      return places.map(p => ({ ...p, country, sourceQueryKey: key } as Candidate));
    }));
    for (const r of results) allCandidates.push(...r);
  }

  // Dedup candidates by domain
  const seen = new Set<string>();
  const uniqueCandidates: Candidate[] = [];
  for (const c of allCandidates) {
    let domain: string;
    try { domain = new URL(c.website.startsWith('http') ? c.website : `https://${c.website}`).hostname.replace('www.', '').toLowerCase(); } catch { continue; }
    if (seen.has(domain)) continue;
    if (skipDomains.has(domain)) continue;
    seen.add(domain);
    uniqueCandidates.push(c);
  }
  console.log(`\n📊 ${allCandidates.length} candidates, ${uniqueCandidates.length} unique after dedup\n`);

  // STAGE 2 — Parallel HTML fetch + chatbot check + email extract
  console.log(`═══ STAGE 2: Fetch + filter (${concurrency} concurrent) ═══\n`);
  const targetToProcess = uniqueCandidates.slice(0, limit * 3); // fetch 3x target (some will be skipped)

  let processed = 0;
  let qualified = 0;
  let hasChatbotCount = 0;
  let noEmailCount = 0;
  let notModernCount = 0;
  let fetchFailCount = 0;

  const results = await parallelMap(targetToProcess, concurrency, async (c, idx) => {
    const r = await processCandidate(c);
    processed++;

    if (r.lead) {
      if (skipEmails.has(r.lead.email.toLowerCase())) {
        return { lead: null, reason: 'email already sent' };
      }
      qualified++;
      qualifiedLeads.push(r.lead);
      fs.writeFileSync(LEADS_FILE, JSON.stringify(qualifiedLeads, null, 2));
      // Credit this qualified lead to the source query
      if (c.sourceQueryKey) {
        const stat = perQueryStats.get(c.sourceQueryKey);
        if (stat) stat.newQualified++;
      }
      console.log(`  [${idx + 1}/${targetToProcess.length}] ✅ ${c.name.slice(0, 40)} | ${r.lead.email} | ${c.city} ${c.country} (total: ${qualified})`);
    } else {
      if (r.reason === 'has chatbot' || r.reason === 'has chatbot (contact page)') hasChatbotCount++;
      else if (r.reason === 'no email') noEmailCount++;
      else if (r.reason.startsWith('not modern')) notModernCount++;
      else if (r.reason === 'fetch failed') fetchFailCount++;

      if (processed % 20 === 0) {
        console.log(`  [${idx + 1}/${targetToProcess.length}] ⏭️  ${r.reason} (progress: ${qualified} qualified, ${processed} processed)`);
      }
    }
    return r;
  });

  // Update city-progress with this run's results
  const nowIso = new Date().toISOString();
  for (const q of SEARCH_QUERIES) {
    const key = makeQueryKey(q.country, q.query);
    const stat = perQueryStats.get(key) || { resultsCount: 0, newQualified: 0 };
    const prev = cityProgress[key];
    cityProgress[key] = {
      lastRunAt: nowIso,
      totalRuns: (prev?.totalRuns || 0) + 1,
      lastNewLeads: stat.newQualified,
      totalNewLeads: (prev?.totalNewLeads || 0) + stat.newQualified,
      lastResultsCount: stat.resultsCount,
    };
  }
  saveCityProgress(cityProgress);

  // Compute exhausted count
  const exhaustedThisRun = SEARCH_QUERIES.filter((q) => {
    const stat = perQueryStats.get(makeQueryKey(q.country, q.query));
    return stat && stat.newQualified === 0;
  }).length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ v5 COLLECTION DONE`);
  console.log(`   Queries run this batch:  ${SEARCH_QUERIES.length}`);
  console.log(`     → exhausted (0 new):   ${exhaustedThisRun}`);
  console.log(`     → fertile (>0 new):    ${SEARCH_QUERIES.length - exhaustedThisRun}`);
  console.log(`   Candidates processed:    ${processed}`);
  console.log(`   Qualified (no chatbot):  ${qualified}`);
  console.log(`   Skipped — has chatbot:   ${hasChatbotCount}`);
  console.log(`   Skipped — no email:      ${noEmailCount}`);
  console.log(`   Skipped — not modern:    ${notModernCount}`);
  console.log(`   Skipped — fetch failed:  ${fetchFailCount}`);
  console.log(`   Leads file:              ${LEADS_FILE}`);
  console.log(`   City progress:           ${CITY_PROGRESS_FILE}`);
  console.log(`${'═'.repeat(60)}\n`);
  console.log(`📧 To send:   npx ts-node scripts/send-dental-v5.ts\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
