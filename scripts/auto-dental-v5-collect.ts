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
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') { limit = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--concurrency') { concurrency = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--resume') resume = true;
  }
  return { limit, concurrency, resume };
}

// ── Search queries: English-speaking dental markets ──
const SEARCH_QUERIES: Array<{ query: string; country: string }> = [
  // US — fresh mid-size cities not yet used
  { query: 'dentist Colorado Springs Colorado', country: 'US' },
  { query: 'dentist Fort Collins Colorado', country: 'US' },
  { query: 'dentist Boulder Colorado', country: 'US' },
  { query: 'dentist Tucson Arizona', country: 'US' },
  { query: 'dentist Mesa Arizona', country: 'US' },
  { query: 'dentist Tempe Arizona', country: 'US' },
  { query: 'dentist Albuquerque New Mexico', country: 'US' },
  { query: 'dentist Santa Fe New Mexico', country: 'US' },
  { query: 'dentist Salt Lake City Utah', country: 'US' },
  { query: 'dentist Provo Utah', country: 'US' },
  { query: 'dentist Ogden Utah', country: 'US' },
  { query: 'dentist Eugene Oregon', country: 'US' },
  { query: 'dentist Salem Oregon', country: 'US' },
  { query: 'dentist Bend Oregon', country: 'US' },
  { query: 'dentist Tacoma Washington', country: 'US' },
  { query: 'dentist Olympia Washington', country: 'US' },
  { query: 'dentist Bellingham Washington', country: 'US' },
  { query: 'dentist Anchorage Alaska', country: 'US' },
  { query: 'dentist Honolulu Hawaii', country: 'US' },
  { query: 'dentist Sioux Falls South Dakota', country: 'US' },
  { query: 'dentist Fargo North Dakota', country: 'US' },
  { query: 'dentist Omaha Nebraska', country: 'US' },
  { query: 'dentist Lincoln Nebraska', country: 'US' },
  { query: 'dentist Wichita Kansas', country: 'US' },
  { query: 'dentist Topeka Kansas', country: 'US' },
  { query: 'dentist Springfield Missouri', country: 'US' },
  { query: 'dentist Columbia Missouri', country: 'US' },
  { query: 'dentist Little Rock Arkansas', country: 'US' },
  { query: 'dentist Fayetteville Arkansas', country: 'US' },
  { query: 'dentist Jackson Mississippi', country: 'US' },
  { query: 'dentist Gulfport Mississippi', country: 'US' },
  { query: 'dentist Birmingham Alabama', country: 'US' },
  { query: 'dentist Mobile Alabama', country: 'US' },
  { query: 'dentist Knoxville Tennessee', country: 'US' },
  { query: 'dentist Memphis Tennessee', country: 'US' },
  { query: 'dentist Lafayette Louisiana', country: 'US' },
  { query: 'dentist Baton Rouge Louisiana', country: 'US' },
  { query: 'dentist Shreveport Louisiana', country: 'US' },
  { query: 'dentist Fort Smith Arkansas', country: 'US' },
  { query: 'dentist Evansville Indiana', country: 'US' },
  { query: 'dentist Fort Wayne Indiana', country: 'US' },
  { query: 'dentist South Bend Indiana', country: 'US' },
  { query: 'dentist Akron Ohio', country: 'US' },
  { query: 'dentist Dayton Ohio', country: 'US' },
  { query: 'dentist Toledo Ohio', country: 'US' },
  { query: 'dentist Youngstown Ohio', country: 'US' },
  { query: 'dentist Erie Pennsylvania', country: 'US' },
  { query: 'dentist Scranton Pennsylvania', country: 'US' },
  { query: 'dentist Allentown Pennsylvania', country: 'US' },
  { query: 'dentist Syracuse New York', country: 'US' },
  { query: 'dentist Rochester New York', country: 'US' },
  { query: 'dentist Buffalo New York', country: 'US' },
  { query: 'dentist Albany New York', country: 'US' },
  { query: 'dentist Burlington Vermont', country: 'US' },
  { query: 'dentist Portland Maine', country: 'US' },
  { query: 'dentist Manchester New Hampshire', country: 'US' },
];

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
  const { limit, concurrency, resume } = parseArgs();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
  fs.mkdirSync(path.dirname(V5_STATE_FILE), { recursive: true });

  console.log('🦷 AUTO DENTAL v5 — FAST COLLECT (modern/középszerű, NO CHATBOT)');
  console.log(`   Concurrency: ${concurrency}, target: ${limit} leads\n`);

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
  const queryChunks: Array<typeof SEARCH_QUERIES> = [];
  for (let i = 0; i < SEARCH_QUERIES.length; i += 5) {
    queryChunks.push(SEARCH_QUERIES.slice(i, i + 5));
  }
  for (const chunk of queryChunks) {
    const results = await Promise.all(chunk.map(async ({ query, country }) => {
      const places = await placesSearch(query);
      console.log(`  🔎 "${query}" → ${places.length}`);
      return places.map(p => ({ ...p, country } as Candidate));
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

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ v5 COLLECTION DONE`);
  console.log(`   Candidates processed:   ${processed}`);
  console.log(`   Qualified (no chatbot): ${qualified}`);
  console.log(`   Skipped — has chatbot:  ${hasChatbotCount}`);
  console.log(`   Skipped — no email:     ${noEmailCount}`);
  console.log(`   Skipped — not modern:   ${notModernCount}`);
  console.log(`   Skipped — fetch failed: ${fetchFailCount}`);
  console.log(`   File:                   ${LEADS_FILE}`);
  console.log(`${'═'.repeat(60)}\n`);
  console.log(`📧 To send:   npx ts-node scripts/send-dental-v5.ts\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
