/**
 * AUTO DENTAL v4 — COLLECT ONLY (no sending)
 *
 * Pipeline:
 * 1. Apify Google Maps Scraper → dental businesses
 * 2. PageSpeed Insights filter → mobile score < 50
 * 3. Screenshot + Claude Vision → "visually outdated?"
 * 4. Email extraction
 * 5. Save qualified leads to JSON (NO sending)
 *
 * Tomorrow: run `send-dental-v4-tomorrow.ts` to send the collected leads.
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8').match(/ANTHROPIC_API_KEY=(.*)/)?.[1] || '';
const PSI_MAX_SCORE = 50;
const TARGET_LEADS = 100;
const OUT_DIR = path.resolve(__dirname, '../output/dental-campaign');
const STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-v4-qualified.json');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../output/leads/v4-screenshots');

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const SEARCH_QUERIES: Array<{ query: string; country: string }> = [
  // Ireland — never searched
  { query: 'dentist Limerick Ireland', country: 'IE' },
  { query: 'dentist Galway Ireland', country: 'IE' },
  { query: 'dentist Waterford Ireland', country: 'IE' },
  { query: 'dentist Kilkenny Ireland', country: 'IE' },
  { query: 'dentist Sligo Ireland', country: 'IE' },
  { query: 'dentist Drogheda Ireland', country: 'IE' },
  { query: 'dentist Dundalk Ireland', country: 'IE' },
  { query: 'dentist Tralee Ireland', country: 'IE' },
  { query: 'dentist Ennis Ireland', country: 'IE' },
  { query: 'dentist Wexford Ireland', country: 'IE' },
  // New Zealand — never searched
  { query: 'dentist Auckland New Zealand', country: 'NZ' },
  { query: 'dentist Christchurch New Zealand', country: 'NZ' },
  { query: 'dentist Hamilton New Zealand', country: 'NZ' },
  { query: 'dentist Tauranga New Zealand', country: 'NZ' },
  { query: 'dentist Dunedin New Zealand', country: 'NZ' },
  { query: 'dentist Palmerston North New Zealand', country: 'NZ' },
  { query: 'dentist Napier New Zealand', country: 'NZ' },
  { query: 'dentist Nelson New Zealand', country: 'NZ' },
  // Canada — never searched
  { query: 'dentist Halifax Nova Scotia', country: 'CA' },
  { query: 'dentist Moncton New Brunswick', country: 'CA' },
  { query: 'dentist Saint John New Brunswick', country: 'CA' },
  { query: 'dentist Regina Saskatchewan', country: 'CA' },
  { query: 'dentist Saskatoon Saskatchewan', country: 'CA' },
  { query: 'dentist Thunder Bay Ontario', country: 'CA' },
  { query: 'dentist Sudbury Ontario', country: 'CA' },
  { query: 'dentist Kingston Ontario', country: 'CA' },
  // UK — smaller towns not yet searched
  { query: 'dentist Grimsby UK', country: 'UK' },
  { query: 'dentist Blackpool UK', country: 'UK' },
  { query: 'dentist Preston UK', country: 'UK' },
  { query: 'dentist Stoke-on-Trent UK', country: 'UK' },
  { query: 'dentist Hull UK', country: 'UK' },
  { query: 'dentist Middlesbrough UK', country: 'UK' },
  { query: 'dentist Sunderland UK', country: 'UK' },
  { query: 'dentist Wolverhampton UK', country: 'UK' },
];

interface Lead {
  name: string; website: string; phone?: string; city: string; country: string;
  email: string; psiScore: number; reasoning: string; screenshotPath: string;
}

// ── Google Places API (fast, reliable, $200 free credit/month) ──
async function apifySearch(query: string): Promise<any[]> {
  console.log(`  🔎 "${query}"`);
  try {
    // Text search
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as any;
    const places = searchData.results || [];
    if (places.length === 0) { console.log('    0 results'); return []; }

    // Get details for each place (parallel)
    const details = await Promise.all(places.slice(0, 15).map(async (p: any) => {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=name,website,formatted_phone_number,formatted_address&key=${GOOGLE_API_KEY}`;
        const r = await fetch(detailsUrl);
        const d = await r.json() as any;
        return d.result || {};
      } catch { return {}; }
    }));

    // Convert to Apify-style format
    return details.filter(d => d.website).map(d => ({
      title: d.name,
      name: d.name,
      website: d.website,
      phone: d.formatted_phone_number,
      address: d.formatted_address,
      city: (d.formatted_address || '').split(',').slice(-3, -2)[0]?.trim(),
    }));
  } catch (err: any) {
    console.log(`    ❌ ${err.message?.slice(0, 50)}`);
    return [];
  }
}

// ── PSI ──
async function psiMobileScore(url: string): Promise<number> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${GOOGLE_API_KEY}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return -1;
    const data = await res.json() as any;
    const score = data?.lighthouseResult?.categories?.performance?.score;
    if (score == null) return -1;
    return Math.round(score * 100);
  } catch { return -1; }
}

// ── Claude Vision ──
async function visuallyOutdated(imagePath: string): Promise<{ outdated: boolean; reasoning: string }> {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
          { type: 'text', text: 'Evaluate this dental practice website. Only say FALSE (skip) if the site is TRULY TOP-TIER: custom professional photography (not stock), advanced animations or video backgrounds, premium custom typography (not default Google Fonts), clearly shows big budget ($10k+ spent on design), looks made by a high-end agency. Say TRUE (qualify) in ALL other cases — generic WordPress/Wix/Squarespace templates even if "clean", stock photography, default typography, simple layouts, standard Bootstrap components, anything "decent but not premium", even modern-looking sites if they use template components. ONLY skip broken/blank pages (say false). Be very generous — when in doubt, say TRUE. Reply in this exact JSON format: {"outdated": true/false, "reason": "brief reason under 100 chars"}' },
        ],
      }],
    });
    const text = (response.content[0] as any).text || '';
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      const json = JSON.parse(match[0]);
      return { outdated: !!json.outdated, reasoning: json.reason || '' };
    }
  } catch (err: any) {
    console.log(`    ⚠️ Vision: ${err.message?.slice(0, 60)}`);
  }
  return { outdated: false, reasoning: 'vision failed' };
}

// ── Email ──
const JUNK = ['.gif', '.png', '.jpg', '.svg', '.css', '.js', 'your@', 'email@', 'name@', 'noreply', 'example.com', 'wordpress', 'wixpress', 'wpengine', 'webmaster@', 'mailer-daemon', 'sentry', 'webpack', 'github', '2x.'];
const isJunkEmail = (e: string) => JUNK.some(p => e.toLowerCase().includes(p));

async function extractEmail(url: string): Promise<string | null> {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  for (const p of ['', '/contact', '/contact-us', '/about']) {
    try {
      const u = url.replace(/\/$/, '') + p;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(u, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
      clearTimeout(t);
      const h = await r.text();
      const ms = h.match(regex) || [];
      for (const m of ms) {
        const l = m.toLowerCase();
        if (isJunkEmail(l)) continue;
        if (l.match(/^(info|contact|hello|office|admin|reception|appointments|dental|team|front|enquiries|enquiry|practice)@/)) return l;
      }
      for (const m of ms) {
        const l = m.toLowerCase();
        if (isJunkEmail(l)) continue;
        return l;
      }
    } catch {}
  }
  return null;
}

async function screenshotWebsite(browser: Browser, url: string, outPath: string): Promise<string | null> {
  try {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: outPath });
    await p.close();
    const stat = fs.statSync(outPath);
    if (stat.size < 30000) return null;
    return outPath;
  } catch { return null; }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
  console.log('🦷 AUTO DENTAL v4 — COLLECT ONLY (no sending)\n');

  // Dedup against previously sent
  const existingDomains = new Set<string>();
  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    for (const em of Object.keys(state)) {
      const d = em.split('@')[1]; if (d) existingDomains.add(d);
    }
  }
  console.log(`📋 ${existingDomains.size} domains in dedup (already sent)\n`);

  // Load already collected leads (resume)
  let qualifiedLeads: Lead[] = [];
  if (fs.existsSync(LEADS_FILE)) {
    qualifiedLeads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    for (const l of qualifiedLeads) existingDomains.add(new URL(l.website).hostname.replace('www.', ''));
    console.log(`📂 Resumed: ${qualifiedLeads.length} leads already collected\n`);
  }

  const browser = await chromium.launch({ headless: true });
  const allCandidates: any[] = [];

  // STAGE 1 — Apify
  console.log('═══ STAGE 1: Apify Google Maps ═══\n');
  for (const { query, country } of SEARCH_QUERIES) {
    const results = await apifySearch(query);
    console.log(`    ${results.length} businesses`);
    for (const r of results) {
      if (!r.website) continue;
      let domain: string;
      try { domain = new URL(r.website.startsWith('http') ? r.website : `https://${r.website}`).hostname.replace('www.', ''); } catch { continue; }
      if (existingDomains.has(domain)) continue;
      existingDomains.add(domain);
      allCandidates.push({
        name: r.title || r.name, website: r.website, phone: r.phone,
        city: r.city || r.address || query.replace('dentist ', ''), country,
      });
    }
  }
  console.log(`\n📊 ${allCandidates.length} new candidates\n`);

  // STAGE 2 — PSI
  console.log('═══ STAGE 2: PageSpeed Insights ═══\n');
  const psiFiltered: any[] = [];
  for (let i = 0; i < allCandidates.length; i++) {
    if (qualifiedLeads.length >= TARGET_LEADS) break;
    const c = allCandidates[i];
    process.stdout.write(`  [${i + 1}/${allCandidates.length}] ${(c.name || '').slice(0, 40).padEnd(40)} `);
    const score = await psiMobileScore(c.website);
    if (score < 0) { console.log('❌ PSI failed'); continue; }
    if (score >= PSI_MAX_SCORE) { console.log(`⏭️ PSI ${score}`); continue; }
    console.log(`✅ PSI ${score}`);
    psiFiltered.push({ ...c, psiScore: score });
  }
  console.log(`\n📊 ${psiFiltered.length} passed PSI\n`);

  // STAGE 3 — Vision + Email
  console.log('═══ STAGE 3: Vision + Email extraction ═══\n');
  for (const c of psiFiltered) {
    if (qualifiedLeads.length >= TARGET_LEADS) break;
    console.log(`\n🔍 ${c.name} — PSI ${c.psiScore}`);

    const safeDomain = new URL(c.website.startsWith('http') ? c.website : `https://${c.website}`).hostname.replace('www.', '').replace(/[^a-z0-9.-]/g, '_');
    const ssPath = path.join(SCREENSHOTS_DIR, `${safeDomain}.png`);
    const ss = await screenshotWebsite(browser, c.website, ssPath);
    if (!ss) { console.log('    ❌ Screenshot failed'); continue; }

    const { outdated, reasoning } = await visuallyOutdated(ss);
    if (!outdated) { console.log(`    ⏭️ Not outdated: ${reasoning}`); continue; }
    console.log(`    ✅ Outdated: ${reasoning}`);

    const email = await extractEmail(c.website);
    if (!email) { console.log('    ❌ No email'); continue; }
    console.log(`    📧 ${email}`);

    qualifiedLeads.push({
      name: c.name, website: c.website, phone: c.phone, city: c.city, country: c.country,
      email, psiScore: c.psiScore, reasoning, screenshotPath: ssPath,
    });
    fs.writeFileSync(LEADS_FILE, JSON.stringify(qualifiedLeads, null, 2));
    console.log(`    💾 Saved — total qualified: ${qualifiedLeads.length}/${TARGET_LEADS}`);
  }

  await browser.close();
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ COLLECTION DONE`);
  console.log(`   Candidates: ${allCandidates.length}`);
  console.log(`   PSI passed: ${psiFiltered.length}`);
  console.log(`   Qualified (saved to send tomorrow): ${qualifiedLeads.length}`);
  console.log(`   File: ${LEADS_FILE}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n📧 To send tomorrow:`);
  console.log(`   npx ts-node scripts/send-dental-v4-tomorrow.ts`);
}

main().catch(err => { console.error(err); process.exit(1); });
