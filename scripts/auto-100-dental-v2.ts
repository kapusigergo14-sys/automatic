/**
 * AUTO 100 DENTAL CAMPAIGN — v2
 * Uses OpenStreetMap Nominatim (free, no billing) + existing UK leads
 * Runs until 100 emails sent.
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser } from 'playwright';
import { generatePdfV4 } from './generate-pdf-v4';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MIN_SCORE = 35;
const TARGET_EMAILS = 100;
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const OUT_DIR = path.resolve(__dirname, '../output/dental-campaign');
const STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');

// UK + US + AU cities (for Nominatim search)
const CITIES = [
  // UK small cities (Nominatim handles UK well)
  { name: 'Whitby, UK', country: 'UK' }, { name: 'Scarborough, UK', country: 'UK' },
  { name: 'Bridlington, UK', country: 'UK' }, { name: 'Beverley, UK', country: 'UK' },
  { name: 'Ripon, UK', country: 'UK' }, { name: 'Louth, UK', country: 'UK' },
  { name: 'Spalding, UK', country: 'UK' }, { name: 'Stamford, UK', country: 'UK' },
  { name: 'Kettering, UK', country: 'UK' }, { name: 'Corby, UK', country: 'UK' },
  { name: 'Tiverton, UK', country: 'UK' }, { name: 'Tavistock, UK', country: 'UK' },
  { name: 'Bodmin, UK', country: 'UK' }, { name: 'Minehead, UK', country: 'UK' },
  { name: 'Bridgwater, UK', country: 'UK' }, { name: 'Whitehaven, UK', country: 'UK' },
  { name: 'Workington, UK', country: 'UK' }, { name: 'Penrith, UK', country: 'UK' },
  { name: 'Kendal, UK', country: 'UK' }, { name: 'Morecambe, UK', country: 'UK' },
  { name: 'Skipton, UK', country: 'UK' }, { name: 'Dereham, UK', country: 'UK' },
  { name: 'Fakenham, UK', country: 'UK' }, { name: 'Cromer, UK', country: 'UK' },
  { name: 'Sheringham, UK', country: 'UK' }, { name: 'Hunstanton, UK', country: 'UK' },
  { name: 'Swaffham, UK', country: 'UK' }, { name: 'Thetford, UK', country: 'UK' },
  { name: 'Llanelli, UK', country: 'UK' }, { name: 'Neath, UK', country: 'UK' },
  { name: 'Bridgend, UK', country: 'UK' }, { name: 'Pontypridd, UK', country: 'UK' },
  { name: 'Merthyr Tydfil, UK', country: 'UK' }, { name: 'Brecon, UK', country: 'UK' },
  { name: 'Aberystwyth, UK', country: 'UK' }, { name: 'Carmarthen, UK', country: 'UK' },
  { name: 'Haverfordwest, UK', country: 'UK' }, { name: 'Dumfries, UK', country: 'UK' },
  { name: 'Ayr, UK', country: 'UK' }, { name: 'Kilmarnock, UK', country: 'UK' },
  { name: 'Irvine, UK', country: 'UK' }, { name: 'Greenock, UK', country: 'UK' },
  { name: 'Oban, UK', country: 'UK' }, { name: 'Fort William, UK', country: 'UK' },
  { name: 'Elgin, UK', country: 'UK' }, { name: 'Inverness, UK', country: 'UK' },
  { name: 'Omagh, UK', country: 'UK' }, { name: 'Enniskillen, UK', country: 'UK' },
  { name: 'Ballymena, UK', country: 'UK' }, { name: 'Bangor, UK', country: 'UK' },
];

interface Lead {
  name: string; website: string; phone?: string; city: string; country: string;
  email: string; outdatedScore: number; signals: string[];
}

// ── OSM Nominatim search ──
async function nominatimSearch(query: string, city: string): Promise<any[]> {
  const q = `dentist ${city}`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&extratags=1&limit=20`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SmartFlowDev Lead Tool (geri@smartflowdev.com)' } });
    const data = await res.json() as any[];
    return data.filter(d => d.extratags?.website || d.extratags?.['contact:website']);
  } catch { return []; }
}

// Extract website from Nominatim result
function getWebsiteFromNominatim(r: any): string | null {
  return r.extratags?.website || r.extratags?.['contact:website'] || null;
}

// ── Outdated scoring ──
async function quickOutdatedScore(url: string): Promise<{ score: number; signals: string[] }> {
  let score = 0;
  const signals: string[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, redirect: 'follow' });
    clearTimeout(timeout);
    const html = await res.text();
    const lower = html.toLowerCase();
    if (lower.includes('wp-content')) { score += 15; signals.push('WordPress'); }
    const jqMatch = html.match(/jquery[.-]?([\d.]+)(?:\.min)?\.js/i);
    if (jqMatch) {
      const ver = jqMatch[1];
      if (ver.startsWith('1.')) { score += 20; signals.push(`jQuery ${ver}`); }
      else if (ver.startsWith('2.')) { score += 10; signals.push(`jQuery ${ver}`); }
      else if (ver.startsWith('3.')) { score += 5; signals.push(`jQuery ${ver}`); }
    } else if (lower.includes('jquery')) { score += 10; signals.push('jQuery'); }
    if (!lower.includes('viewport')) { score += 15; signals.push('No viewport'); }
    if (html.length > 500000) { score += 10; signals.push('Heavy page'); }
    if (lower.includes('weebly')) { score += 15; signals.push('Weebly'); }
    if (lower.includes('godaddy-ws')) { score += 15; signals.push('GoDaddy'); }
    if (url.startsWith('http://') && !res.url.startsWith('https://')) { score += 10; signals.push('No HTTPS'); }
    if (lower.includes('react') || lower.includes('__next')) { score -= 15; }
    if (lower.includes('tailwind') || lower.includes('webflow') || lower.includes('squarespace')) { score -= 10; }
    if (lower.includes('404') && lower.includes('not found')) { score = -1; signals.push('404'); }
  } catch { score = -1; }
  return { score, signals };
}

// ── Email extraction ──
const JUNK = ['.gif', '.png', '.jpg', '.svg', '.css', '.js', 'your@', 'email@', 'name@', 'noreply', 'example.com', 'wordpress', 'wixpress', 'wpengine', 'webmaster@', 'mailer-daemon', 'sentry', 'webpack', 'github', '2x.'];

function isJunkEmail(e: string): boolean {
  return JUNK.some(p => e.toLowerCase().includes(p));
}

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

async function screenshotWebsite(browser: Browser, url: string, outPath: string): Promise<string> {
  try {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: outPath });
    await p.close();
  } catch {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.setContent('<div style="width:1280px;height:900px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999">Screenshot unavailable</div>');
    await p.screenshot({ path: outPath });
    await p.close();
  }
  return outPath;
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

async function processLead(browser: Browser, lead: Lead, tplLetter: string, sendState: Record<string, any>): Promise<boolean> {
  const leadDir = path.join(OUT_DIR, lead.email.replace(/[^a-z0-9@.-]/gi, '_'));
  fs.mkdirSync(leadDir, { recursive: true });
  try {
    const currentSite = await screenshotWebsite(browser, lead.website, path.join(leadDir, 'current.png'));
    const ssSize = fs.statSync(currentSite).size;
    if (ssSize < 50000) return false;
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
      images: { currentSite, redesignA_desktop: desktops['a'], redesignA_mobile: desktops['a'], redesignB_desktop: desktops['b'], redesignB_mobile: desktops['b'], redesignC_desktop: desktops['c'], redesignC_mobile: desktops['c'], bookingA: bookings['a'], bookingB: bookings['b'], bookingC: bookings['c'] },
      outputPath: pdfPath,
    });
    const ok = await sendEmail(lead.email, lead.name, pdfPath);
    if (ok) {
      sendState[lead.email] = { sentAt: new Date().toISOString(), template: tplLetter, city: lead.city, country: lead.country };
      fs.writeFileSync(STATE_FILE, JSON.stringify(sendState, null, 2));
    }
    return ok;
  } catch { return false; }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('🦷 AUTO 100 DENTAL v2 (Nominatim + existing UK)\n');

  let sendState: Record<string, any> = {};
  const existingDomains = new Set<string>();
  if (fs.existsSync(STATE_FILE)) {
    sendState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    for (const em of Object.keys(sendState)) {
      const d = em.split('@')[1]; if (d) existingDomains.add(d);
    }
  }
  console.log(`📋 ${Object.keys(sendState).length} already sent, ${existingDomains.size} domains in dedup\n`);

  const browser = await chromium.launch({ headless: true });
  const templateLetters = ['a', 'b', 'c'];
  let totalSent = 0;

  // ══ STAGE 1: Process existing UK dental leads ══
  console.log('\n═══ STAGE 1: Existing UK dental leads ═══\n');
  const ukFiles = ['uk-dental-25.json', 'uk-dental-26.json'];
  for (const f of ukFiles) {
    const fp = path.resolve(__dirname, '../output/leads', f);
    if (!fs.existsSync(fp)) continue;
    const arr = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const leads = Array.isArray(arr) ? arr : arr.leads || [];
    for (const l of leads) {
      if (totalSent >= TARGET_EMAILS) break;
      if (!l.website) continue;
      let domain: string;
      try { domain = new URL(l.website.startsWith('http') ? l.website : `https://${l.website}`).hostname.replace('www.', ''); } catch { continue; }
      if (existingDomains.has(domain)) continue;
      existingDomains.add(domain);

      console.log(`🔍 ${l.name} — ${l.website}`);
      const email = await extractEmail(l.website);
      if (!email) { console.log('  ❌ No email'); continue; }
      console.log(`  ✅ ${email}`);

      const { score, signals } = await quickOutdatedScore(l.website);
      if (score < MIN_SCORE) { console.log(`  ⏭️ Score ${score} too low`); continue; }

      const lead: Lead = {
        name: l.name, website: l.website, city: 'UK', country: 'UK',
        email, outdatedScore: score, signals,
      };

      const tpl = templateLetters[totalSent % 3];
      console.log(`  📧 Sending (template ${tpl.toUpperCase()})...`);
      const ok = await processLead(browser, lead, tpl, sendState);
      if (ok) {
        totalSent++;
        console.log(`  ✅ SENT #${totalSent}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // ══ STAGE 2: Nominatim search for more ══
  console.log(`\n═══ STAGE 2: Nominatim search (${totalSent}/${TARGET_EMAILS} so far) ═══\n`);
  for (const { name: city, country } of CITIES) {
    if (totalSent >= TARGET_EMAILS) break;
    console.log(`\n🌐 ${city}...`);
    await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit
    const results = await nominatimSearch('dentist', city);
    console.log(`  Found ${results.length} results with website`);

    for (const r of results) {
      if (totalSent >= TARGET_EMAILS) break;
      const website = getWebsiteFromNominatim(r);
      if (!website) continue;
      let url = website;
      if (!url.startsWith('http')) url = 'https://' + url;
      let domain: string;
      try { domain = new URL(url).hostname.replace('www.', ''); } catch { continue; }
      if (existingDomains.has(domain)) continue;
      existingDomains.add(domain);

      const name = r.display_name?.split(',')[0] || r.extratags?.name || domain;
      console.log(`  🔍 ${name} — ${url}`);

      const email = await extractEmail(url);
      if (!email) { console.log('    ❌ No email'); continue; }
      console.log(`    ✅ ${email}`);

      const { score, signals } = await quickOutdatedScore(url);
      if (score < MIN_SCORE) { console.log(`    ⏭️ Score ${score}`); continue; }

      const lead: Lead = { name, website: url, city, country, email, outdatedScore: score, signals };
      const tpl = templateLetters[totalSent % 3];
      const ok = await processLead(browser, lead, tpl, sendState);
      if (ok) {
        totalSent++;
        console.log(`    ✅ SENT #${totalSent}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await browser.close();
  console.log(`\n${'═'.repeat(60)}\n✅ DONE: ${totalSent}/${TARGET_EMAILS} sent\n${'═'.repeat(60)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
