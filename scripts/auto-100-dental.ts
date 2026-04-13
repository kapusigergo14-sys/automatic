/**
 * AUTO 100 DENTAL CAMPAIGN
 *
 * One command: npx ts-node scripts/auto-100-dental.ts
 * Finds 100 dental leads with outdated websites, generates personalized PDFs, sends emails.
 * All automatic — no human review needed.
 *
 * Pipeline:
 * 1. Google Places → dental businesses (500+ new small cities US/AU/UK)
 * 2. Outdated score ≥35
 * 3. Email extraction
 * 4. Auto visual filter (skip 404, vets, hospitals, modern sites, bad emails)
 * 5. Screenshot + Template fill + PDF generation
 * 6. Email via Resend (geri@smartflowdev.com)
 * 7. Full dedup against previous campaigns
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser } from 'playwright';
import { generatePdfV4, PdfV4Options } from './generate-pdf-v4';

// ── Config ──
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MIN_SCORE = 35;
const TARGET_EMAILS = 100;
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const OUT_DIR = path.resolve(__dirname, '../output/dental-campaign');
const STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-email-leads-v2.json');

// ── ALL NEW cities (never searched before) ──

const US_CITIES = [
  // Florida
  'Panama City FL', 'Fort Walton Beach FL', 'Crestview FL', 'DeFuniak Springs FL', 'Marianna FL',
  'Live Oak FL', 'Lake City FL', 'Palatka FL', 'Starke FL', 'Macclenny FL',
  // Georgia
  'Vidalia GA', 'Jesup GA', 'Baxley GA', 'Douglas GA', 'Fitzgerald GA',
  'Eastman GA', 'Swainsboro GA', 'Sandersville GA', 'Milledgeville GA', 'Eatonton GA',
  // Alabama
  'Albertville AL', 'Scottsboro AL', 'Fort Payne AL', 'Guntersville AL', 'Boaz AL',
  'Arab AL', 'Hamilton AL', 'Winfield AL', 'Russellville AL', 'Atmore AL',
  // Tennessee
  'Morristown TN', 'Newport TN', 'Dayton TN', 'Dunlap TN', 'Jasper TN',
  'Fayetteville TN', 'Pulaski TN', 'Lewisburg TN', 'Columbia TN', 'Dickson TN',
  // North Carolina
  'Reidsville NC', 'Eden NC', 'Mount Airy NC', 'Elkin NC', 'North Wilkesboro NC',
  'Lenoir NC', 'Marion NC', 'Brevard NC', 'Waynesville NC', 'Sylva NC',
  // South Carolina
  'Walterboro SC', 'Bamberg SC', 'Manning SC', 'Cheraw SC', 'Dillon SC',
  'Mullins SC', 'Kingstree SC', 'Seneca SC', 'Easley SC', 'Clemson SC',
  // Mississippi
  'Canton MS', 'Kosciusko MS', 'Philadelphia MS', 'Forest MS', 'Magee MS',
  'Hazlehurst MS', 'Monticello MS', 'Tylertown MS', 'Picayune MS', 'Bay St Louis MS',
  // Louisiana
  'Jennings LA', 'Rayne LA', 'New Iberia LA', 'Franklin LA', 'Morgan City LA',
  'Donaldsonville LA', 'Gonzales LA', 'Hammond LA', 'Ponchatoula LA', 'Covington LA',
  // Arkansas
  'Blytheville AR', 'Osceola AR', 'West Memphis AR', 'Cabot AR', 'Beebe AR',
  'Heber Springs AR', 'Clinton AR', 'Booneville AR', 'Paris AR', 'Waldron AR',
  // Oklahoma
  'Shawnee OK', 'Seminole OK', 'Wewoka OK', 'Henryetta OK', 'Okmulgee OK',
  'Sapulpa OK', 'Claremore OK', 'Pryor OK', 'Grove OK', 'Poteau OK',
  // Virginia
  'Wytheville VA', 'Marion VA', 'Pulaski VA', 'Tazewell VA', 'Richlands VA',
  'Grundy VA', 'Norton VA', 'Wise VA', 'Lebanon VA', 'Abingdon VA',
  // West Virginia extra
  'Point Pleasant WV', 'Ripley WV', 'Spencer WV', 'Glenville WV', 'Summersville WV',
  'Hinton WV', 'Marlinton WV', 'Buckhannon WV', 'Grafton WV', 'Philippi WV',
  // Kentucky extra
  'Glasgow KY', 'Campbellsville KY', 'Danville KY', 'Harrodsburg KY', 'Bardstown KY',
  'Elizabethtown KY', 'Radcliff KY', 'Leitchfield KY', 'Greensburg KY', 'Monticello KY',
  // Missouri extra
  'Bolivar MO', 'Monett MO', 'Aurora MO', 'Ava MO', 'Mountain Grove MO',
  'Salem MO', 'Waynesville MO', 'Camdenton MO', 'Osage Beach MO', 'Eldon MO',
  // Indiana extra
  'Salem IN', 'Paoli IN', 'French Lick IN', 'Mitchell IN', 'Bloomfield IN',
  'Linton IN', 'Sullivan IN', 'Clinton IN', 'Terre Haute IN', 'Brazil IN',
  // Ohio extra
  'Logan OH', 'Jackson OH', 'Waverly OH', 'Hillsboro OH', 'Wilmington OH',
  'Greenfield OH', 'Washington Court House OH', 'Circleville OH', 'Lancaster OH', 'Nelsonville OH',
  // Pennsylvania extra
  'Wellsboro PA', 'Mansfield PA', 'Towanda PA', 'Tunkhannock PA', 'Honesdale PA',
  'Milford PA', 'Stroudsburg PA', 'Jim Thorpe PA', 'Tamaqua PA', 'Pottsville PA',
  // Michigan extra
  'Clare MI', 'Harrison MI', 'Houghton Lake MI', 'West Branch MI', 'Standish MI',
  'Tawas City MI', 'Gladwin MI', 'Midland MI', 'Alma MI', 'Ithaca MI',
];

const UK_CITIES = [
  // England Yorkshire
  'Whitby', 'Scarborough', 'Bridlington', 'Beverley', 'Driffield',
  'Goole', 'Selby', 'Thirsk', 'Ripon', 'Knaresborough',
  // Wales
  'Llanelli', 'Neath', 'Bridgend', 'Pontypridd', 'Merthyr Tydfil',
  'Brecon', 'Newtown', 'Welshpool', 'Aberystwyth', 'Cardigan',
  // Scotland
  'Dumfries', 'Stranraer', 'Ayr', 'Kilmarnock', 'Irvine',
  'Greenock', 'Helensburgh', 'Oban', 'Fort William', 'Elgin',
  // England Midlands
  'Louth', 'Skegness', 'Boston', 'Spalding', 'Stamford',
  'Oakham', 'Melton Mowbray', 'Market Harborough', 'Corby', 'Kettering',
  // England South West
  'Tiverton', 'Crediton', 'Okehampton', 'Tavistock', 'Liskeard',
  'Bodmin', 'Wadebridge', 'Bude', 'Minehead', 'Bridgwater',
  // England North
  'Whitehaven', 'Workington', 'Penrith', 'Kendal', 'Barrow-in-Furness',
  'Morecambe', 'Skipton', 'Settle', 'Barnard Castle', 'Bishop Auckland',
  // England East
  'Thetford', 'Dereham', 'Fakenham', 'Cromer', 'Sheringham',
  'Hunstanton', 'Downham Market', 'Swaffham', 'Attleborough', 'Wymondham',
  // Northern Ireland
  'Omagh', 'Enniskillen', 'Strabane', 'Cookstown', 'Dungannon',
  'Magherafelt', 'Ballymena', 'Larne', 'Carrickfergus', 'Bangor',
];

const AU_CITIES = [
  // Queensland
  'Biloela QLD', 'Yeppoon QLD', 'Clermont QLD', 'Moranbah QLD', 'Proserpine QLD',
  'Bowen QLD', 'Ayr QLD', 'Ingham QLD', 'Innisfail QLD', 'Tully QLD',
  // NSW
  'Cessnock NSW', 'Maitland NSW', 'Singleton NSW', 'Muswellbrook NSW', 'Scone NSW',
  'Gunnedah NSW', 'Narrabri NSW', 'Moree NSW', 'Inverell NSW', 'Glen Innes NSW',
  // Victoria
  'Hamilton VIC', 'Portland VIC', 'Ararat VIC', 'Stawell VIC', 'Castlemaine VIC',
  'Kyneton VIC', 'Seymour VIC', 'Benalla VIC', 'Myrtleford VIC', 'Bright VIC',
  // WA
  'Carnarvon WA', 'Port Hedland WA', 'Newman WA', 'Merredin WA', 'Katanning WA',
  'Narrogin WA', 'Collie WA', 'Harvey WA', 'Manjimup WA', 'Margaret River WA',
  // SA
  'Kadina SA', 'Clare SA', 'Nuriootpa SA', 'Tanunda SA', 'Gawler SA',
  'Mount Barker SA', 'Strathalbyn SA', 'Naracoorte SA', 'Millicent SA', 'Bordertown SA',
];

// ── Types ──
interface Lead {
  name: string; website: string; phone?: string; city: string; country: string;
  email: string; outdatedScore: number; signals: string[]; screenshot?: string;
}

// ── Helpers ──

async function searchPlaces(query: string): Promise<any[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json() as any;
  return data.results || [];
}

async function getPlaceDetails(placeId: string): Promise<any> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_phone_number,rating,user_ratings_total&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json() as any;
  return data.result || {};
}

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

    if (lower.includes('wp-content') || lower.includes('wp-includes')) { score += 15; signals.push('WordPress'); }
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
    if (lower.includes('godaddy-ws')) { score += 15; signals.push('GoDaddy builder'); }
    if (lower.includes('turbify')) { score += 20; signals.push('Turbify'); }
    if (url.startsWith('http://') && !res.url.startsWith('https://')) { score += 10; signals.push('No HTTPS'); }
    if (lower.includes('shockwave-flash') || lower.includes('.swf')) { score += 15; signals.push('Flash'); }
    if (lower.includes('react') || lower.includes('next.js') || lower.includes('__next')) { score -= 15; signals.push('Modern (React)'); }
    if (lower.includes('tailwind')) { score -= 10; signals.push('Modern (Tailwind)'); }
    if (lower.includes('webflow') || lower.includes('squarespace')) { score -= 10; signals.push('Modern (builder)'); }

    // Auto visual filter — check for broken pages
    if (lower.includes('404') && lower.includes('not found')) { score = -1; signals.push('404 page'); }
    if (lower.includes('403') || lower.includes('forbidden') || lower.includes('unauthorized')) { score = -1; signals.push('403/blocked'); }
  } catch (err: any) {
    if (err.name === 'AbortError') { score += 10; signals.push('Timeout'); }
    else { score = -1; signals.push('Error: ' + (err.message || '').slice(0, 30)); }
  }
  return { score: Math.max(-1, score), signals };
}

const JUNK_EMAIL_PATTERNS = ['.gif', '.png', '.jpg', '.svg', '.css', '.js', 'your@', 'email@', 'name@', 'noreply', 'no-reply', 'example.com', 'wordpress', 'wixpress', 'mysocialpractice', 'wpengine', 'webmaster@', 'mailer-daemon', 'sentry', 'webpack', 'github', 'npmjs', '2x', 'sprite', 'loading', 'placeholder'];
const SKIP_DOMAIN_PATTERNS = ['vet', 'animal', 'insurance', 'hospital', 'medical center', 'pharmacy', 'physio'];

function isJunkEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return JUNK_EMAIL_PATTERNS.some(p => lower.includes(p));
}

function isNonDentalDomain(domain: string, name: string): boolean {
  const lower = (domain + ' ' + name).toLowerCase();
  return SKIP_DOMAIN_PATTERNS.some(p => lower.includes(p)) && !lower.includes('dental');
}

async function extractEmail(url: string): Promise<string | null> {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  for (const pagePath of ['', '/contact', '/contact-us', '/about']) {
    try {
      const pageUrl = url.replace(/\/$/, '') + pagePath;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(pageUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
      clearTimeout(timeout);
      const html = await res.text();
      const matches = html.match(emailRegex) || [];
      for (const m of matches) {
        const lower = m.toLowerCase();
        if (isJunkEmail(lower)) continue;
        if (lower.match(/^(info|contact|hello|office|admin|reception|appointments|booking|dental|team|front)@/)) return lower;
      }
      for (const m of matches) {
        const lower = m.toLowerCase();
        if (isJunkEmail(lower)) continue;
        return lower;
      }
    } catch {}
  }
  return null;
}

// ── Template data ──
const DENTAL_DATA: Record<string, string> = {
  '{{HERO_HEADLINE_1}}': 'Your', '{{HERO_HEADLINE_ACCENT}}': 'Smile', '{{HERO_HEADLINE_2}}': 'Our Priority',
  '{{HERO_SUBTEXT}}': 'Family dental care you can trust. Now with 24/7 online booking and AI-powered patient support.',
  '{{SERVICE_1}}': 'General Dentistry', '{{SERVICE_2}}': 'Dental Implants', '{{SERVICE_3}}': 'Teeth Whitening',
  '{{SERVICE_4}}': 'Orthodontics', '{{SERVICE_5}}': 'Emergency Care', '{{SERVICE_6}}': 'Cosmetic Dentistry',
  '{{SERVICE_DESC_1}}': 'Routine checkups, cleanings, and preventive care.', '{{SERVICE_DESC_2}}': 'Permanent tooth replacement solutions.',
  '{{SERVICE_DESC_3}}': 'Professional whitening for a brighter smile.', '{{SERVICE_DESC_4}}': 'Modern, discreet alignment options.',
  '{{SERVICE_DESC_5}}': 'Same-day emergency appointments.', '{{SERVICE_DESC_6}}': 'Veneers, bonding, and smile makeovers.',
  '{{TESTIMONIAL_1}}': 'The best dental experience I\'ve ever had.', '{{TESTIMONIAL_AUTHOR_1}}': 'Sarah M.',
  '{{TESTIMONIAL_2}}': 'I actually look forward to my appointments now!', '{{TESTIMONIAL_AUTHOR_2}}': 'James T.',
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
  let result = html;
  const r: Record<string, string> = {
    ...DENTAL_DATA,
    '{{COMPANY_NAME}}': lead.name, '{{COMPANY_SHORT_NAME}}': lead.name.split(' ').slice(0, 3).join(' '),
    '{{PRIMARY_COLOR}}': '#0d9488', '{{ACCENT_COLOR}}': '#0d9488', '{{BG_COLOR}}': '#ffffff', '{{TEXT_COLOR}}': '#1a1a2e',
    '{{PHONE}}': lead.phone || '', '{{CITY}}': lead.city,
  };
  for (const [k, v] of Object.entries(r)) result = result.split(k).join(v);
  return result;
}

async function screenshotHtml(browser: Browser, html: string, outPath: string): Promise<string> {
  const tmp = outPath.replace('.png', '.tmp.html');
  fs.writeFileSync(tmp, html);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: outPath });
  await page.close();
  try { fs.unlinkSync(tmp); } catch {}
  return outPath;
}

async function screenshotWebsite(browser: Browser, url: string, outPath: string): Promise<string> {
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: outPath });
    await page.close();
  } catch {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent('<div style="width:1280px;height:900px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999">Screenshot unavailable</div>');
    await page.screenshot({ path: outPath });
    await page.close();
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
      from: 'Geri <geri@smartflowdev.com>',
      to: [to],
      subject: `AI chatbot for ${safeName}?`,
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
  const data = await res.json() as any;
  return res.ok;
}

// ── Main ──
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });

  console.log('🦷 AUTO 100 DENTAL CAMPAIGN\n');

  // Load dedup state
  const existingDomains = new Set<string>();
  let sendState: Record<string, any> = {};
  if (fs.existsSync(STATE_FILE)) {
    sendState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    for (const email of Object.keys(sendState)) {
      const d = email.split('@')[1];
      if (d) existingDomains.add(d);
    }
  }
  // Load all previous lead files for domain dedup
  const leadsDir = path.resolve(__dirname, '../output/leads');
  if (fs.existsSync(leadsDir)) {
    for (const f of fs.readdirSync(leadsDir)) {
      if (f.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(leadsDir, f), 'utf-8'));
          const arr = Array.isArray(data) ? data : data.leads || [];
          for (const l of arr) {
            if (l.website) { try { existingDomains.add(new URL(l.website.startsWith('http') ? l.website : `https://${l.website}`).hostname.replace('www.', '')); } catch {} }
            if (l.email) { const d = l.email.split('@')[1]; if (d) existingDomains.add(d); }
          }
        } catch {}
      }
    }
  }
  console.log(`📋 ${existingDomains.size} existing domains loaded for dedup\n`);

  const allCities = [
    ...US_CITIES.map(c => ({ city: c, country: 'US' as const })),
    ...UK_CITIES.map(c => ({ city: c, country: 'UK' as const })),
    ...AU_CITIES.map(c => ({ city: c, country: 'AU' as const })),
  ];

  const browser = await chromium.launch({ headless: true });
  const templateLetters = ['a', 'b', 'c'];
  const leads: Lead[] = [];
  let totalScanned = 0;
  let totalSent = 0;

  for (const { city, country } of allCities) {
    if (totalSent >= TARGET_EMAILS) break;

    const query = `dentist ${city}`;
    console.log(`\n🔍 ${query}...`);

    let places: any[];
    try { places = await searchPlaces(query); } catch { continue; }
    console.log(`  Found ${places.length} businesses`);

    for (const place of places) {
      if (totalSent >= TARGET_EMAILS) break;

      let details: any;
      try { details = await getPlaceDetails(place.place_id); } catch { continue; }
      if (!details.website) continue;

      const website = details.website;
      let domain: string;
      try { domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace('www.', ''); } catch { continue; }

      if (existingDomains.has(domain)) continue;
      existingDomains.add(domain);
      totalScanned++;

      // Auto filter: skip non-dental
      if (isNonDentalDomain(domain, details.name || '')) continue;

      // Outdated score
      const { score, signals } = await quickOutdatedScore(website);
      if (score < MIN_SCORE) continue;

      // Email
      const email = await extractEmail(website);
      if (!email || isJunkEmail(email)) continue;

      console.log(`  ⚠️ ${details.name} — score ${score} | ${email}`);

      const lead: Lead = {
        name: details.name || place.name, website, phone: details.formatted_phone_number,
        city, country, email, outdatedScore: score, signals,
      };
      leads.push(lead);

      // Generate PDF + Send email
      const tplLetter = templateLetters[totalSent % 3];
      const leadDir = path.join(OUT_DIR, email.replace(/[^a-z0-9@.-]/gi, '_'));
      fs.mkdirSync(leadDir, { recursive: true });

      try {
        console.log(`  📸 Screenshot + PDF + Send (template ${tplLetter.toUpperCase()})...`);

        // Screenshot current site
        const currentSite = await screenshotWebsite(browser, website, path.join(leadDir, 'current.png'));

        // Check screenshot size (auto visual filter)
        const ssSize = fs.statSync(currentSite).size;
        if (ssSize < 50000) { console.log(`  ⏭️ Screenshot too small (${ssSize}b) — skipping`); continue; }

        // Generate design mockups
        const desktops: Record<string, string> = {};
        const bookings: Record<string, string> = {};
        for (const l of templateLetters) {
          desktops[l] = await screenshotHtml(browser, fillTemplate(fs.readFileSync(path.join(TEMPLATES_DIR, `dental-chatbot-${l}.html`), 'utf-8'), lead), path.join(leadDir, `d-${l}.png`));
          bookings[l] = await screenshotHtml(browser, fillTemplate(fs.readFileSync(path.join(TEMPLATES_DIR, `dental-booking-${l}.html`), 'utf-8'), lead), path.join(leadDir, `b-${l}.png`));
        }

        // PDF
        const currency = country === 'AU' ? 'AUD' as const : country === 'UK' ? 'GBP' as const : 'USD' as const;
        const pdfPath = path.join(leadDir, 'proposal.pdf');
        await generatePdfV4({
          lead: { name: lead.name.split(' ').slice(0, 4).join(' '), company: lead.name, city, website: website.replace(/^https?:\/\//, '').replace(/\/$/, ''), phone: lead.phone, email },
          industry: 'dental', currency,
          images: {
            currentSite, redesignA_desktop: desktops['a'], redesignA_mobile: desktops['a'],
            redesignB_desktop: desktops['b'], redesignB_mobile: desktops['b'],
            redesignC_desktop: desktops['c'], redesignC_mobile: desktops['c'],
            bookingA: bookings['a'], bookingB: bookings['b'], bookingC: bookings['c'],
          },
          outputPath: pdfPath,
        });

        // Send
        const ok = await sendEmail(email, lead.name, pdfPath);
        if (ok) {
          totalSent++;
          sendState[email] = { sentAt: new Date().toISOString(), template: tplLetter, city, country };
          fs.writeFileSync(STATE_FILE, JSON.stringify(sendState, null, 2));
          console.log(`  ✅ SENT #${totalSent} — ${lead.name} (${email})`);
        } else {
          console.log(`  ❌ Send failed`);
        }

        // Save leads incrementally
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

        // Rate limit
        await new Promise(r => setTimeout(r, 3000));
      } catch (err: any) {
        console.log(`  ❌ Error: ${err.message?.slice(0, 50)}`);
      }
    }
  }

  await browser.close();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 CAMPAIGN RESULTS:`);
  console.log(`   Scanned: ${totalScanned}`);
  console.log(`   Leads found: ${leads.length}`);
  console.log(`   Emails sent: ${totalSent}`);
  console.log(`   Target: ${TARGET_EMAILS}`);
  console.log(`${'═'.repeat(60)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
