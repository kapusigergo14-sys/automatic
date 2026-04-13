/**
 * AUTO DENTAL CAMPAIGN v4
 *
 * Pipeline:
 * 1. Apify Google Maps Scraper → dental businesses per city (reliable, cheap)
 * 2. PageSpeed Insights filter → mobile score < 50 (truly slow sites)
 * 3. Screenshot + Claude Vision → "does this LOOK outdated?" (AI visual filter)
 * 4. Email extraction
 * 5. PDF generation (A/B/C rotation)
 * 6. Send via Resend
 *
 * Target: 100 emails/day to truly outdated dental websites.
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { generatePdfV4 } from './generate-pdf-v4';

// ── Config ──
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ''; // PSI
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8').match(/ANTHROPIC_API_KEY=(.*)/)?.[1] || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

const TARGET_EMAILS = 100;
const PSI_MAX_SCORE = 50; // mobile score < 50 = slow
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const OUT_DIR = path.resolve(__dirname, '../output/dental-campaign');
const STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-v4-leads.json');

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── Search queries (new cities) ──
const SEARCH_QUERIES: Array<{ query: string; country: string }> = [
  // UK
  { query: 'dentist Birmingham UK', country: 'UK' },
  { query: 'dentist Manchester UK', country: 'UK' },
  { query: 'dentist Leeds UK', country: 'UK' },
  { query: 'dentist Sheffield UK', country: 'UK' },
  { query: 'dentist Liverpool UK', country: 'UK' },
  { query: 'dentist Bristol UK', country: 'UK' },
  { query: 'dentist Newcastle UK', country: 'UK' },
  { query: 'dentist Nottingham UK', country: 'UK' },
  { query: 'dentist Leicester UK', country: 'UK' },
  { query: 'dentist Coventry UK', country: 'UK' },
  // US small cities
  { query: 'dentist Little Rock AR', country: 'US' },
  { query: 'dentist Wichita KS', country: 'US' },
  { query: 'dentist Des Moines IA', country: 'US' },
  { query: 'dentist Omaha NE', country: 'US' },
  { query: 'dentist Boise ID', country: 'US' },
  { query: 'dentist Spokane WA', country: 'US' },
  { query: 'dentist Fresno CA', country: 'US' },
  { query: 'dentist Bakersfield CA', country: 'US' },
  { query: 'dentist Stockton CA', country: 'US' },
  { query: 'dentist Modesto CA', country: 'US' },
  // AU
  { query: 'dentist Sydney Australia', country: 'AU' },
  { query: 'dentist Melbourne Australia', country: 'AU' },
  { query: 'dentist Brisbane Australia', country: 'AU' },
  { query: 'dentist Perth Australia', country: 'AU' },
  { query: 'dentist Adelaide Australia', country: 'AU' },
];

interface Lead {
  name: string; website: string; phone?: string; city: string; country: string;
  email: string; psiScore: number; visuallyOutdated: boolean; reasoning: string;
}

// ── Apify Google Maps Scraper ──
async function apifySearch(query: string): Promise<any[]> {
  console.log(`  🔎 Apify: "${query}"`);
  const startRes = await fetch(`https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      searchStringsArray: [query],
      maxCrawledPlacesPerSearch: 20,
      language: 'en',
      includeWebResults: false,
      scrapeReviewsCount: 0,
      scrapeImagesCount: 0,
    }),
  });
  if (!startRes.ok) {
    const err = await startRes.text();
    console.log(`    ❌ Apify error: ${startRes.status} ${err.slice(0, 100)}`);
    return [];
  }
  const data = await startRes.json() as any[];
  return data || [];
}

// ── PageSpeed Insights filter ──
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

// ── Claude Vision filter ──
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
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64 },
          },
          {
            type: 'text',
            text: 'Is this dental practice website visually OUTDATED (looks like it was designed before 2018, has old stock photos, clip art, bad typography, or low-quality layout)? A modern minimalist site is NOT outdated. A broken/blank page is NOT outdated (skip). Reply in this exact JSON format: {"outdated": true/false, "reason": "brief reason under 100 chars"}',
          },
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
    console.log(`    ⚠️ Vision error: ${err.message?.slice(0, 60)}`);
  }
  return { outdated: false, reasoning: 'vision failed' };
}

// ── Email extraction ──
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

// ── Templates ──
const DENTAL_DATA: Record<string, string> = {
  '{{HERO_HEADLINE_1}}': 'Your', '{{HERO_HEADLINE_ACCENT}}': 'Smile', '{{HERO_HEADLINE_2}}': 'Our Priority',
  '{{HERO_SUBTEXT}}': 'Family dental care you can trust. Now with 24/7 online booking and AI-powered patient support.',
  '{{SERVICE_1}}': 'General Dentistry', '{{SERVICE_2}}': 'Dental Implants', '{{SERVICE_3}}': 'Teeth Whitening',
  '{{SERVICE_4}}': 'Orthodontics', '{{SERVICE_5}}': 'Emergency Care', '{{SERVICE_6}}': 'Cosmetic Dentistry',
  '{{SERVICE_DESC_1}}': 'Routine checkups and preventive care.', '{{SERVICE_DESC_2}}': 'Permanent tooth replacement.',
  '{{SERVICE_DESC_3}}': 'Professional whitening.', '{{SERVICE_DESC_4}}': 'Modern alignment options.',
  '{{SERVICE_DESC_5}}': 'Same-day emergency appointments.', '{{SERVICE_DESC_6}}': 'Smile makeovers.',
  '{{TESTIMONIAL_1}}': 'The best dental experience I\'ve ever had.', '{{TESTIMONIAL_AUTHOR_1}}': 'Sarah M.',
  '{{TESTIMONIAL_2}}': 'I actually look forward to my appointments!', '{{TESTIMONIAL_AUTHOR_2}}': 'James T.',
  '{{TESTIMONIAL_3}}': 'My whole family comes here.', '{{TESTIMONIAL_AUTHOR_3}}': 'Lisa K.',
  '{{CTA_TEXT}}': 'Book Your Free Consultation',
  '{{HERO_BG_IMAGE}}': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&h=500&fit=crop',
  '{{OFFICE_IMAGE}}': 'https://images.unsplash.com/photo-1629909615957-be38d6d18316?w=600&h=400&fit=crop',
  '{{GALLERY_1}}': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop',
  '{{GALLERY_2}}': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=300&fit=crop',
  '{{GALLERY_3}}': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=300&fit=crop',
  '{{GALLERY_4}}': 'https://images.unsplash.com/photo-1629909615957-be38d6d18316?w=400&h=300&fit=crop',
  '{{GALLERY_5}}': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop',
  '{{GALLERY_6}}': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=300&fit=crop',
  '{{ABOUT_TEXT}}': 'We believe everyone deserves a healthy, confident smile.',
  '{{TEAM_1_NAME}}': 'Dr. Smith', '{{TEAM_1_ROLE}}': 'Principal Dentist', '{{TEAM_1_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{TEAM_2_NAME}}': 'Dr. Johnson', '{{TEAM_2_ROLE}}': 'Associate Dentist', '{{TEAM_2_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{TEAM_3_NAME}}': 'Sarah', '{{TEAM_3_ROLE}}': 'Dental Hygienist', '{{TEAM_3_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{TEAM_4_NAME}}': 'Emily', '{{TEAM_4_ROLE}}': 'Practice Manager', '{{TEAM_4_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{RATING}}': '4.8', '{{REVIEW_COUNT}}': '85', '{{YEARS_EXPERIENCE}}': '15',
};

function fillTemplate(html: string, lead: Lead): string {
  let r = html;
  const repl: Record<string, string> = {
    ...DENTAL_DATA,
    '{{COMPANY_NAME}}': lead.name, '{{COMPANY_SHORT_NAME}}': lead.name.split(' ').slice(0, 3).join(' '),
    '{{PRIMARY_COLOR}}': '#0d9488', '{{ACCENT_COLOR}}': '#0d9488', '{{BG_COLOR}}': '#ffffff', '{{TEXT_COLOR}}': '#1a1a2e',
    '{{PHONE}}': lead.phone || '', '{{CITY}}': lead.city,
  };
  for (const [k, v] of Object.entries(repl)) r = r.split(k).join(v);
  return r;
}

async function screenshotHtml(browser: Browser, html: string, outPath: string): Promise<string> {
  const tmp = outPath.replace('.png', '.tmp.html');
  fs.writeFileSync(tmp, html);
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 15000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: outPath });
  await p.close();
  try { fs.unlinkSync(tmp); } catch {}
  return outPath;
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

async function sendEmail(to: string, companyName: string, pdfPath: string): Promise<boolean> {
  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');
  const safeName = companyName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Geri <geri@smartflowdev.com>', to: [to], subject: `AI chatbot for ${safeName}?`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;color:#333;line-height:1.6;">
        <p>Hi ${safeName} team,</p>
        <p>I came across your dental practice while researching clinics in your area — and I noticed your website could benefit from an <strong>AI chatbot and online booking system</strong>.</p>
        <p>So I put together <strong>3 design concepts specifically for ${safeName}</strong>. You'll find them in the attached PDF.</p>
        <p><strong>A few quick improvements I identified:</strong></p>
        <ul style="padding-left:20px;margin:12px 0;">
          <li>AI chatbot for instant patient answers 24/7</li>
          <li>Online booking system with Google Calendar sync</li>
          <li>SMS appointment reminders</li>
          <li>After-hours AI phone agent</li>
        </ul>
        <p>Would you be open to a quick 10-minute call to discuss?</p>
        <p style="margin:20px 0;"><a href="https://smartflowdev.com" style="display:inline-block;background:#667eea;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">See our work →</a></p>
        <p>Best regards,<br><strong>Geri</strong><br>AI Web Development Specialist<br><a href="https://smartflowdev.com" style="color:#667eea;">smartflowdev.com</a></p>
      </div>`,
      attachments: [{ filename: `${safeName}-AI-Chatbot-Proposal.pdf`, content: pdfBase64 }],
    }),
  });
  return res.ok;
}

async function processLead(browser: Browser, lead: Lead, tplLetter: string, currentSitePath: string, sendState: Record<string, any>): Promise<boolean> {
  const leadDir = path.join(OUT_DIR, lead.email.replace(/[^a-z0-9@.-]/gi, '_'));
  fs.mkdirSync(leadDir, { recursive: true });
  try {
    const desktops: Record<string, string> = {};
    const bookings: Record<string, string> = {};
    for (const l of ['a', 'b', 'c']) {
      desktops[l] = await screenshotHtml(browser, fillTemplate(fs.readFileSync(path.join(TEMPLATES_DIR, `dental-chatbot-${l}.html`), 'utf-8'), lead), path.join(leadDir, `d-${l}.png`));
      bookings[l] = await screenshotHtml(browser, fillTemplate(fs.readFileSync(path.join(TEMPLATES_DIR, `dental-booking-${l}.html`), 'utf-8'), lead), path.join(leadDir, `b-${l}.png`));
    }
    const currency = lead.country === 'AU' ? 'AUD' as const : lead.country === 'UK' ? 'GBP' as const : 'USD' as const;
    const pdfPath = path.join(leadDir, 'proposal.pdf');
    await generatePdfV4({
      lead: { name: lead.name.split(' ').slice(0, 4).join(' '), company: lead.name, city: lead.city, website: lead.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), phone: lead.phone, email: lead.email },
      industry: 'dental', currency,
      images: { currentSite: currentSitePath, redesignA_desktop: desktops['a'], redesignA_mobile: desktops['a'], redesignB_desktop: desktops['b'], redesignB_mobile: desktops['b'], redesignC_desktop: desktops['c'], redesignC_mobile: desktops['c'], bookingA: bookings['a'], bookingB: bookings['b'], bookingC: bookings['c'] },
      outputPath: pdfPath,
    });
    const ok = await sendEmail(lead.email, lead.name, pdfPath);
    if (ok) {
      sendState[lead.email] = { sentAt: new Date().toISOString(), template: tplLetter, city: lead.city, country: lead.country, psiScore: lead.psiScore, visualReasoning: lead.reasoning };
      fs.writeFileSync(STATE_FILE, JSON.stringify(sendState, null, 2));
    }
    return ok;
  } catch { return false; }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
  console.log('🦷 AUTO DENTAL v4 — Apify + PSI + Claude Vision\n');

  let sendState: Record<string, any> = {};
  const existingDomains = new Set<string>();
  if (fs.existsSync(STATE_FILE)) {
    sendState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    for (const em of Object.keys(sendState)) {
      const d = em.split('@')[1]; if (d) existingDomains.add(d);
    }
  }
  const startCount = Object.keys(sendState).length;
  console.log(`📋 ${startCount} already sent\n`);

  const browser = await chromium.launch({ headless: true });
  const templateLetters = ['a', 'b', 'c'];
  let newSent = 0;
  const qualifiedLeads: Lead[] = [];
  const allCandidates: any[] = [];

  // ══ STAGE 1: Apify search all queries ══
  console.log('═══ STAGE 1: Apify Google Maps search ═══\n');
  for (const { query, country } of SEARCH_QUERIES) {
    if (newSent >= TARGET_EMAILS) break;
    const results = await apifySearch(query);
    console.log(`    Found ${results.length} businesses`);
    for (const r of results) {
      if (!r.website) continue;
      let domain: string;
      try { domain = new URL(r.website.startsWith('http') ? r.website : `https://${r.website}`).hostname.replace('www.', ''); } catch { continue; }
      if (existingDomains.has(domain)) continue;
      existingDomains.add(domain);
      allCandidates.push({
        name: r.title || r.name,
        website: r.website,
        phone: r.phone,
        city: r.city || r.address || query.replace('dentist ', ''),
        country,
      });
    }
  }
  console.log(`\n📊 ${allCandidates.length} candidates from Apify\n`);

  // ══ STAGE 2: PSI filter ══
  console.log('═══ STAGE 2: PageSpeed Insights filter (mobile < 50) ═══\n');
  const psiFiltered: any[] = [];
  for (let i = 0; i < allCandidates.length; i++) {
    if (newSent >= TARGET_EMAILS) break;
    const c = allCandidates[i];
    process.stdout.write(`  [${i + 1}/${allCandidates.length}] ${c.name.slice(0, 40).padEnd(40)} `);
    const score = await psiMobileScore(c.website);
    if (score < 0) { console.log('❌ PSI failed'); continue; }
    if (score >= PSI_MAX_SCORE) { console.log(`⏭️ PSI ${score}`); continue; }
    console.log(`✅ PSI ${score}`);
    psiFiltered.push({ ...c, psiScore: score });
  }
  console.log(`\n📊 ${psiFiltered.length} passed PSI filter\n`);

  // ══ STAGE 3: Claude Vision filter + email + send ══
  console.log('═══ STAGE 3: Claude Vision + email extraction + send ═══\n');
  for (const c of psiFiltered) {
    if (newSent >= TARGET_EMAILS) break;
    console.log(`\n🔍 ${c.name} (${c.city}) — ${c.website}`);
    console.log(`    PSI: ${c.psiScore}`);

    // Screenshot website
    const leadDir = path.join(OUT_DIR, 'tmp-' + Date.now());
    fs.mkdirSync(leadDir, { recursive: true });
    const ssPath = path.join(leadDir, 'current.png');
    const ss = await screenshotWebsite(browser, c.website, ssPath);
    if (!ss) { console.log('    ❌ Screenshot failed'); continue; }

    // Claude Vision check
    const { outdated, reasoning } = await visuallyOutdated(ss);
    if (!outdated) { console.log(`    ⏭️ Not visually outdated: ${reasoning}`); continue; }
    console.log(`    ✅ Visually outdated: ${reasoning}`);

    // Email
    const email = await extractEmail(c.website);
    if (!email) { console.log('    ❌ No email'); continue; }
    console.log(`    📧 ${email}`);

    const lead: Lead = {
      name: c.name, website: c.website, phone: c.phone, city: c.city, country: c.country,
      email, psiScore: c.psiScore, visuallyOutdated: true, reasoning,
    };
    qualifiedLeads.push(lead);
    fs.writeFileSync(LEADS_FILE, JSON.stringify(qualifiedLeads, null, 2));

    // Send
    const tpl = templateLetters[newSent % 3];
    console.log(`    📬 Sending (template ${tpl.toUpperCase()})...`);

    // Move screenshot to final location
    const finalLeadDir = path.join(OUT_DIR, email.replace(/[^a-z0-9@.-]/gi, '_'));
    fs.mkdirSync(finalLeadDir, { recursive: true });
    const finalSs = path.join(finalLeadDir, 'current.png');
    fs.copyFileSync(ss, finalSs);

    const ok = await processLead(browser, lead, tpl, finalSs, sendState);
    if (ok) {
      newSent++;
      console.log(`    ✅ SENT #${newSent} (total: ${Object.keys(sendState).length})`);
    } else {
      console.log('    ❌ Send failed');
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ DONE: ${newSent} new emails sent`);
  console.log(`   Apify candidates: ${allCandidates.length}`);
  console.log(`   PSI passed: ${psiFiltered.length}`);
  console.log(`   Visual outdated + email: ${qualifiedLeads.length}`);
  console.log(`   Total in state: ${Object.keys(sendState).length}`);
  console.log(`${'═'.repeat(60)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
