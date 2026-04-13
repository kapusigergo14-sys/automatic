/**
 * AUTO 100 DENTAL v3 — Overpass API (OSM)
 * Fetches ALL dentists with website in UK + US + AU from OpenStreetMap.
 * No billing, no API keys needed. Extremely effective for UK (well-mapped).
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser } from 'playwright';
import { generatePdfV4 } from './generate-pdf-v4';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MIN_SCORE = 35; // Truly outdated sites only
const TARGET_EMAILS = 100;
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const OUT_DIR = path.resolve(__dirname, '../output/dental-campaign');
const STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const OSM_CACHE = path.resolve(__dirname, '../output/leads/osm-dentists.json');

interface Lead {
  name: string; website: string; phone?: string; city: string; country: string;
  email: string; outdatedScore: number; signals: string[];
}

interface OsmDentist {
  name: string;
  website: string;
  phone?: string;
  country: string;
  city: string;
}

// ── Overpass API — fetch dentists by bbox regions (smaller, faster) ──
async function fetchOsmDentists(): Promise<OsmDentist[]> {
  if (fs.existsSync(OSM_CACHE)) {
    const cached = JSON.parse(fs.readFileSync(OSM_CACHE, 'utf-8'));
    if (cached.length > 0) {
      console.log('📦 Using cached OSM data');
      return cached;
    }
  }

  const all: OsmDentist[] = [];
  // Smaller bounding boxes — much faster than country-level
  const regions: Array<{ bbox: string; name: string; country: string }> = [
    // UK regions
    { bbox: '51.28,-0.51,51.69,0.33', name: 'London', country: 'UK' },
    { bbox: '53.35,-2.30,53.55,-2.08', name: 'Manchester', country: 'UK' },
    { bbox: '52.40,-2.00,52.55,-1.75', name: 'Birmingham', country: 'UK' },
    { bbox: '53.75,-1.62,53.88,-1.40', name: 'Leeds', country: 'UK' },
    { bbox: '53.35,-3.05,53.48,-2.85', name: 'Liverpool', country: 'UK' },
    { bbox: '51.42,-2.65,51.52,-2.50', name: 'Bristol', country: 'UK' },
    { bbox: '54.90,-1.70,55.05,-1.50', name: 'Newcastle', country: 'UK' },
    { bbox: '52.90,-1.20,53.05,-1.05', name: 'Nottingham', country: 'UK' },
    { bbox: '52.60,-1.20,52.68,-1.05', name: 'Leicester', country: 'UK' },
    { bbox: '50.85,-0.22,50.90,-0.10', name: 'Brighton', country: 'UK' },
    { bbox: '50.70,-1.45,50.78,-1.30', name: 'Southampton', country: 'UK' },
    { bbox: '50.72,-3.58,50.77,-3.48', name: 'Exeter', country: 'UK' },
    { bbox: '53.40,-1.55,53.47,-1.40', name: 'Sheffield', country: 'UK' },
    { bbox: '51.45,-3.25,51.55,-3.10', name: 'Cardiff', country: 'UK' },
    { bbox: '55.85,-4.35,55.93,-4.15', name: 'Glasgow', country: 'UK' },
    { bbox: '55.90,-3.27,55.98,-3.10', name: 'Edinburgh', country: 'UK' },
    { bbox: '57.10,-2.25,57.20,-2.05', name: 'Aberdeen', country: 'UK' },
    { bbox: '54.55,-5.97,54.65,-5.83', name: 'Belfast', country: 'UK' },
    { bbox: '54.55,-1.25,54.65,-1.10', name: 'Middlesbrough', country: 'UK' },
    { bbox: '53.50,-2.65,53.60,-2.50', name: 'Bolton', country: 'UK' },
    // UK smaller towns
    { bbox: '52.95,-1.17,53.02,-1.05', name: 'Derby', country: 'UK' },
    { bbox: '52.19,0.08,52.23,0.17', name: 'Cambridge', country: 'UK' },
    { bbox: '51.74,-1.30,51.79,-1.20', name: 'Oxford', country: 'UK' },
    { bbox: '51.35,-2.40,51.40,-2.30', name: 'Bath', country: 'UK' },
    { bbox: '50.33,-4.17,50.40,-4.08', name: 'Plymouth', country: 'UK' },
    { bbox: '51.03,-4.08,51.10,-3.98', name: 'Barnstaple', country: 'UK' },
    { bbox: '52.06,-1.00,52.12,-0.90', name: 'Luton', country: 'UK' },
    { bbox: '52.22,-0.27,52.28,-0.20', name: 'Bedford', country: 'UK' },
    { bbox: '51.63,-0.22,51.70,-0.15', name: 'Enfield', country: 'UK' },
    { bbox: '51.43,0.08,51.50,0.18', name: 'Bexley', country: 'UK' },
    { bbox: '51.56,-0.41,51.62,-0.33', name: 'Harrow', country: 'UK' },
    { bbox: '51.45,-0.20,51.52,-0.12', name: 'Wandsworth', country: 'UK' },
    { bbox: '51.37,-0.48,51.43,-0.40', name: 'Kingston', country: 'UK' },
    { bbox: '51.46,-0.01,51.52,0.08', name: 'Greenwich', country: 'UK' },
    { bbox: '51.50,-0.30,51.55,-0.22', name: 'Hammersmith', country: 'UK' },
    { bbox: '53.10,-2.95,53.18,-2.85', name: 'Chester', country: 'UK' },
    { bbox: '52.67,-1.88,52.72,-1.78', name: 'Lichfield', country: 'UK' },
    { bbox: '53.00,-2.20,53.05,-2.12', name: 'Stoke', country: 'UK' },
    { bbox: '52.20,-2.25,52.25,-2.17', name: 'Worcester', country: 'UK' },
    { bbox: '51.88,-2.11,51.92,-2.05', name: 'Cheltenham', country: 'UK' },
    { bbox: '51.13,-0.18,51.18,-0.10', name: 'Crawley', country: 'UK' },
    { bbox: '51.26,-0.75,51.30,-0.68', name: 'Guildford', country: 'UK' },
    { bbox: '51.27,0.50,51.32,0.57', name: 'Maidstone', country: 'UK' },
    { bbox: '51.12,1.28,51.15,1.35', name: 'Dover', country: 'UK' },
    // AU regions
    { bbox: '-33.95,151.00,-33.75,151.30', name: 'Sydney', country: 'AU' },
    { bbox: '-37.90,144.85,-37.70,145.05', name: 'Melbourne', country: 'AU' },
    { bbox: '-27.55,152.95,-27.40,153.10', name: 'Brisbane', country: 'AU' },
    { bbox: '-31.98,115.80,-31.90,115.95', name: 'Perth', country: 'AU' },
    { bbox: '-34.97,138.55,-34.88,138.70', name: 'Adelaide', country: 'AU' },
    { bbox: '-35.35,149.05,-35.25,149.20', name: 'Canberra', country: 'AU' },
    { bbox: '-42.90,147.25,-42.85,147.40', name: 'Hobart', country: 'AU' },
    { bbox: '-28.10,153.35,-28.00,153.50', name: 'Gold Coast', country: 'AU' },
    { bbox: '-32.95,151.60,-32.85,151.80', name: 'Newcastle AU', country: 'AU' },
    { bbox: '-34.45,150.80,-34.35,150.95', name: 'Wollongong', country: 'AU' },
    // IE — Ireland
    { bbox: '53.30,-6.32,53.40,-6.20', name: 'Dublin', country: 'IE' },
    { bbox: '51.88,-8.50,51.92,-8.40', name: 'Cork', country: 'IE' },
    { bbox: '52.65,-8.66,52.69,-8.58', name: 'Limerick', country: 'IE' },
    { bbox: '53.26,-9.10,53.30,-9.00', name: 'Galway', country: 'IE' },
    // NZ — New Zealand
    { bbox: '-36.90,174.70,-36.82,174.85', name: 'Auckland', country: 'NZ' },
    { bbox: '-41.30,174.75,-41.25,174.85', name: 'Wellington', country: 'NZ' },
    { bbox: '-43.57,172.55,-43.50,172.70', name: 'Christchurch', country: 'NZ' },
  ];

  for (const { bbox, name, country } of regions) {
    console.log(`\n🌍 ${name} (${country})...`);
    const query = `
[out:json][timeout:60];
(
  node["amenity"="dentist"]["website"](${bbox});
  node["healthcare"="dentist"]["website"](${bbox});
  node["amenity"="dentist"]["contact:website"](${bbox});
);
out tags;
`;

    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) { console.log(`  ❌ HTTP ${res.status}`); await new Promise(r => setTimeout(r, 5000)); continue; }
      const data = await res.json() as any;
      const elements = data.elements || [];
      console.log(`  Found ${elements.length} dentists`);

      for (const el of elements) {
        const tags = el.tags || {};
        const website = tags.website || tags['contact:website'];
        if (!website) continue;
        const dentistName = tags.name || tags['name:en'] || 'Dental Practice';
        const city = tags['addr:city'] || tags['addr:suburb'] || name;
        const phone = tags.phone || tags['contact:phone'];
        all.push({ name: dentistName, website, phone, country, city });
      }
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message?.slice(0, 60)}`);
    }

    await new Promise(r => setTimeout(r, 2500));
  }

  // Shuffle so UK and AU mixed
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  fs.mkdirSync(path.dirname(OSM_CACHE), { recursive: true });
  fs.writeFileSync(OSM_CACHE, JSON.stringify(all, null, 2));
  console.log(`\n✅ Cached ${all.length} dentists to ${OSM_CACHE}`);
  return all;
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
    if (lower.includes('404') && lower.includes('not found')) { score = -1; }
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
  for (const p of ['', '/contact', '/contact-us', '/about', '/about-us']) {
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
    if (ssSize < 30000) return false;
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
  console.log('🦷 AUTO 100 DENTAL v3 — Overpass OSM\n');

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

  const dentists = await fetchOsmDentists();
  console.log(`\n🦷 ${dentists.length} total dentists from OSM\n`);

  const browser = await chromium.launch({ headless: true });
  const templateLetters = ['a', 'b', 'c'];
  let newSent = 0;
  let processed = 0;

  for (const d of dentists) {
    const totalSent = Object.keys(sendState).length;
    if (newSent >= TARGET_EMAILS) break;

    let url = d.website;
    if (!url.startsWith('http')) url = 'https://' + url;
    let domain: string;
    try { domain = new URL(url).hostname.replace('www.', ''); } catch { continue; }
    if (existingDomains.has(domain)) continue;
    existingDomains.add(domain);
    processed++;

    if (processed % 10 === 0) console.log(`\n[Progress: ${processed} processed, ${newSent}/${TARGET_EMAILS} sent]\n`);

    console.log(`🔍 ${d.name} (${d.city}, ${d.country}) — ${url}`);

    const { score, signals } = await quickOutdatedScore(url);
    if (score < MIN_SCORE) { console.log(`  ⏭️ Score ${score}`); continue; }

    const email = await extractEmail(url);
    if (!email) { console.log('  ❌ No email'); continue; }
    console.log(`  📧 ${email} (score: ${score})`);

    const lead: Lead = {
      name: d.name, website: url, phone: d.phone, city: d.city, country: d.country,
      email, outdatedScore: score, signals,
    };

    const tpl = templateLetters[newSent % 3];
    const ok = await processLead(browser, lead, tpl, sendState);
    if (ok) {
      newSent++;
      console.log(`  ✅ SENT #${newSent} (total: ${totalSent + 1})`);
    } else {
      console.log(`  ❌ Send failed`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ DONE: ${newSent} new emails sent (total in state: ${Object.keys(sendState).length})`);
  console.log(`${'═'.repeat(60)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
