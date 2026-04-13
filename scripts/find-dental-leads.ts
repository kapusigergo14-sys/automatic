/**
 * Find 50+ dental businesses with outdated websites + extractable emails.
 *
 * Pipeline:
 * 1. Google Places API → dental businesses in US + AU cities
 * 2. Quick fetch-based outdated score (≥30 = truly bad)
 * 3. Playwright email extraction (only on outdated sites)
 * 4. Output: dental-email-leads.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser } from 'playwright';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OUT_FILE = path.resolve(__dirname, '../output/leads/dental-email-leads.json');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../output/leads/dental-screenshots');
const TARGET_EMAILS = 60; // buffer over 50
const MIN_SCORE = 35; // outdated sites — visually verified later

// Smaller US cities = more outdated dental sites
const US_CITIES = [
  // Texas small towns
  'Lufkin TX', 'Nacogdoches TX', 'Victoria TX', 'Del Rio TX', 'Eagle Pass TX',
  'Palestine TX', 'Jacksonville TX', 'Corsicana TX', 'Stephenville TX', 'Cleburne TX',
  'Weatherford TX', 'Mineral Wells TX', 'Graham TX', 'Breckenridge TX', 'Snyder TX',
  'Sweetwater TX', 'Big Spring TX', 'Monahans TX', 'Pecos TX', 'Alpine TX',
  // Alabama
  'Florence AL', 'Gadsden AL', 'Decatur AL', 'Anniston AL', 'Selma AL',
  'Troy AL', 'Enterprise AL', 'Ozark AL', 'Jasper AL', 'Cullman AL',
  // Georgia
  'Valdosta GA', 'Albany GA', 'Rome GA', 'Dalton GA', 'Tifton GA',
  'Statesboro GA', 'Waycross GA', 'Thomasville GA', 'Cordele GA', 'Dublin GA',
  // Mississippi
  'Vicksburg MS', 'Laurel MS', 'Columbus MS', 'Greenville MS', 'Natchez MS',
  'Brookhaven MS', 'McComb MS', 'Corinth MS', 'Starkville MS', 'Cleveland MS',
  // Arkansas
  'Hot Springs AR', 'Russellville AR', 'Paragould AR', 'Searcy AR', 'Conway AR',
  'Mountain Home AR', 'Harrison AR', 'Batesville AR', 'Forrest City AR', 'Helena AR',
  // Oklahoma
  'Enid OK', 'Muskogee OK', 'Bartlesville OK', 'Ponca City OK', 'Stillwater OK',
  'McAlester OK', 'Ada OK', 'Duncan OK', 'Chickasha OK', 'Tahlequah OK',
  // Kentucky
  'Bowling Green KY', 'Paducah KY', 'Owensboro KY', 'Hopkinsville KY', 'Madisonville KY',
  'Murray KY', 'Somerset KY', 'Corbin KY', 'Middlesboro KY', 'Pikeville KY',
  // Missouri
  'Joplin MO', 'Sedalia MO', 'Cape Girardeau MO', 'Poplar Bluff MO', 'West Plains MO',
  'Rolla MO', 'Lebanon MO', 'Kirksville MO', 'Hannibal MO', 'Sikeston MO',
  // Virginia
  'Danville VA', 'Lynchburg VA', 'Staunton VA', 'Martinsville VA', 'Radford VA',
  'Galax VA', 'Covington VA', 'Waynesboro VA', 'Lexington VA', 'Bedford VA',
  // Louisiana
  'Ruston LA', 'Natchitoches LA', 'Opelousas LA', 'Crowley LA', 'Abbeville LA',
  'Bogalusa LA', 'DeRidder LA', 'Leesville LA', 'Minden LA', 'Bastrop LA',
  // Tennessee
  'Cookeville TN', 'Tullahoma TN', 'McMinnville TN', 'Shelbyville TN', 'Crossville TN',
  'Dyersburg TN', 'Union City TN', 'Paris TN', 'Lawrenceburg TN', 'Athens TN',
  // West Virginia
  'Beckley WV', 'Clarksburg WV', 'Fairmont WV', 'Martinsburg WV', 'Bluefield WV',
  'Elkins WV', 'Princeton WV', 'Logan WV', 'Weirton WV', 'Lewisburg WV',
  // North Carolina small
  'Kinston NC', 'Sanford NC', 'Lumberton NC', 'Laurinburg NC', 'Henderson NC',
  'Roanoke Rapids NC', 'Elizabeth City NC', 'Albemarle NC', 'Shelby NC', 'Morganton NC',
  // South Carolina small
  'Orangeburg SC', 'Sumter SC', 'Florence SC', 'Aiken SC', 'Newberry SC',
  'Laurens SC', 'Bennettsville SC', 'Hartsville SC', 'Camden SC', 'Georgetown SC',
  // Indiana small
  'Bedford IN', 'Vincennes IN', 'Jasper IN', 'Tell City IN', 'Washington IN',
  'Madison IN', 'Seymour IN', 'Martinsville IN', 'Shelbyville IN', 'Greencastle IN',
  // Ohio small
  'Zanesville OH', 'Chillicothe OH', 'Portsmouth OH', 'Marietta OH', 'Gallipolis OH',
  'Ironton OH', 'Cambridge OH', 'New Philadelphia OH', 'Ashland OH', 'Bucyrus OH',
  // Pennsylvania small
  'Oil City PA', 'Bradford PA', 'Lock Haven PA', 'Lewistown PA', 'Clearfield PA',
  'DuBois PA', 'Punxsutawney PA', 'Tyrone PA', 'Huntingdon PA', 'Bellefonte PA',
  // Michigan small
  'Alpena MI', 'Cadillac MI', 'Ludington MI', 'Big Rapids MI', 'Grayling MI',
  'Petoskey MI', 'Cheboygan MI', 'Iron Mountain MI', 'Escanaba MI', 'Manistee MI',
  // Wisconsin small
  'Marshfield WI', 'Rhinelander WI', 'Merrill WI', 'Antigo WI', 'Tomahawk WI',
  'Rice Lake WI', 'Ladysmith WI', 'Medford WI', 'Ashland WI', 'Park Falls WI',
  // Iowa small
  'Ottumwa IA', 'Fort Madison IA', 'Burlington IA', 'Keokuk IA', 'Muscatine IA',
  'Fairfield IA', 'Mount Pleasant IA', 'Grinnell IA', 'Pella IA', 'Oskaloosa IA',
  // Nebraska small
  'Scottsbluff NE', 'North Platte NE', 'McCook NE', 'Alliance NE', 'Sidney NE',
  'Chadron NE', 'Ogallala NE', 'Broken Bow NE', 'Holdrege NE', 'Lexington NE',
  // Kansas small
  'Dodge City KS', 'Garden City KS', 'Liberal KS', 'Hays KS', 'Great Bend KS',
  'McPherson KS', 'El Dorado KS', 'Chanute KS', 'Coffeyville KS', 'Pittsburg KS',
  // New Mexico small
  'Clovis NM', 'Hobbs NM', 'Carlsbad NM', 'Roswell NM', 'Artesia NM',
  'Portales NM', 'Lovington NM', 'Deming NM', 'Silver City NM', 'Raton NM',
  // Montana small
  'Havre MT', 'Glasgow MT', 'Miles City MT', 'Lewistown MT', 'Cut Bank MT',
  'Glendive MT', 'Sidney MT', 'Shelby MT', 'Conrad MT', 'Livingston MT',
  // South Dakota small
  'Pierre SD', 'Aberdeen SD', 'Mitchell SD', 'Huron SD', 'Brookings SD',
  'Yankton SD', 'Vermillion SD', 'Madison SD', 'Watertown SD', 'Mobridge SD',
  // North Dakota small
  'Dickinson ND', 'Williston ND', 'Jamestown ND', 'Devils Lake ND', 'Valley City ND',
  'Wahpeton ND', 'Grafton ND', 'Rugby ND', 'Bottineau ND', 'Cavalier ND',
  // Wyoming small
  'Riverton WY', 'Lander WY', 'Powell WY', 'Worland WY', 'Thermopolis WY',
  'Newcastle WY', 'Torrington WY', 'Douglas WY', 'Buffalo WY', 'Rawlins WY',
  // Idaho small
  'Rexburg ID', 'Blackfoot ID', 'Burley ID', 'Rupert ID', 'Jerome ID',
  'Salmon ID', 'Sandpoint ID', 'Moscow ID', 'Orofino ID', 'Grangeville ID',
];

const AU_CITIES = [
  'Townsville QLD', 'Cairns QLD', 'Toowoomba QLD', 'Ballarat VIC',
  'Bendigo VIC', 'Rockhampton QLD', 'Bundaberg QLD', 'Wagga Wagga NSW',
  'Tamworth NSW', 'Orange NSW', 'Dubbo NSW', 'Mackay QLD',
  'Gladstone QLD', 'Shepparton VIC', 'Mildura VIC', 'Albury NSW',
  'Geraldton WA', 'Kalgoorlie WA', 'Alice Springs NT', 'Launceston TAS',
  // Batch 2 — more AU
  'Bathurst NSW', 'Lismore NSW', 'Grafton NSW', 'Coffs Harbour NSW',
  'Port Macquarie NSW', 'Broken Hill NSW', 'Armidale NSW', 'Mudgee NSW',
  'Warrnambool VIC', 'Horsham VIC', 'Wangaratta VIC', 'Sale VIC',
  'Bairnsdale VIC', 'Swan Hill VIC', 'Echuca VIC', 'Colac VIC',
  'Emerald QLD', 'Hervey Bay QLD', 'Mount Isa QLD', 'Kingaroy QLD',
  'Gympie QLD', 'Dalby QLD', 'Roma QLD', 'Longreach QLD',
  'Devonport TAS', 'Burnie TAS', 'Ulverstone TAS', 'Hobart TAS',
  'Karratha WA', 'Broome WA', 'Albany WA', 'Bunbury WA',
  'Mandurah WA', 'Busselton WA', 'Esperance WA', 'Northam WA',
  'Mount Gambier SA', 'Murray Bridge SA', 'Whyalla SA', 'Port Augusta SA',
  'Port Lincoln SA', 'Port Pirie SA', 'Victor Harbor SA', 'Berri SA',
  'Palmerston NT', 'Katherine NT', 'Tennant Creek NT', 'Nhulunbuy NT',
];

interface Lead {
  name: string;
  website: string;
  phone?: string;
  city: string;
  country: string;
  placeId: string;
  rating?: number;
  reviewCount?: number;
  outdatedScore?: number;
  email?: string;
  signals?: string[];
  screenshot?: string;
}

// ── Google Places API ──
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

// ── Quick outdated score (fetch-based, no Playwright) ──
async function quickOutdatedScore(url: string): Promise<{ score: number; signals: string[] }> {
  let score = 0;
  const signals: string[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const html = await res.text();
    const lower = html.toLowerCase();

    // WordPress
    if (lower.includes('wp-content') || lower.includes('wp-includes')) {
      score += 15; signals.push('WordPress detected');
    }

    // jQuery versions
    const jqMatch = html.match(/jquery[.-]?([\d.]+)(?:\.min)?\.js/i);
    if (jqMatch) {
      const ver = jqMatch[1];
      if (ver.startsWith('1.')) { score += 20; signals.push(`jQuery ${ver} (very old)`); }
      else if (ver.startsWith('2.')) { score += 10; signals.push(`jQuery ${ver} (old)`); }
      else if (ver.startsWith('3.')) { score += 5; signals.push(`jQuery ${ver}`); }
    } else if (lower.includes('jquery')) {
      score += 10; signals.push('jQuery (unknown version)');
    }

    // No viewport
    if (!lower.includes('viewport')) { score += 15; signals.push('No viewport meta (not mobile-friendly)'); }

    // Page weight
    const size = html.length;
    if (size > 500000) { score += 10; signals.push(`Heavy page (${(size / 1024).toFixed(0)}KB)`); }

    // Old builders
    if (lower.includes('weebly')) { score += 15; signals.push('Weebly builder'); }
    if (lower.includes('godaddy-ws')) { score += 15; signals.push('GoDaddy Website Builder'); }
    if (lower.includes('turbify') || lower.includes('yahoo.com/small-business')) { score += 20; signals.push('Turbify/Yahoo'); }

    // No HTTPS
    if (url.startsWith('http://') && !res.url.startsWith('https://')) {
      score += 10; signals.push('No HTTPS');
    }

    // Flash
    if (lower.includes('shockwave-flash') || lower.includes('.swf')) {
      score += 15; signals.push('Flash detected');
    }

    // Negative signals (modern = skip)
    if (lower.includes('react') || lower.includes('next.js') || lower.includes('__next')) { score -= 15; signals.push('React/Next.js (modern)'); }
    if (lower.includes('tailwind')) { score -= 10; signals.push('Tailwind CSS (modern)'); }
    if (lower.includes('webflow')) { score -= 10; signals.push('Webflow (modern)'); }
    if (lower.includes('squarespace')) { score -= 10; signals.push('Squarespace (modern)'); }

  } catch (err: any) {
    if (err.name === 'AbortError') {
      score += 10; signals.push('Slow/timeout (>8s)');
    }
  }

  return { score: Math.max(0, score), signals };
}

// ── Email extraction (Playwright) ──
async function extractEmails(url: string): Promise<string | null> {
  // Try fetch-based first (faster)
  const emails = new Set<string>();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  for (const pagePath of ['', '/contact', '/contact-us', '/about', '/about-us']) {
    try {
      const pageUrl = url.replace(/\/$/, '') + pagePath;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(pageUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        redirect: 'follow',
      });
      clearTimeout(timeout);
      const html = await res.text();

      const matches = html.match(emailRegex) || [];
      for (const m of matches) {
        const lower = m.toLowerCase();
        // Skip junk emails
        if (lower.includes('example.com') || lower.includes('sentry') || lower.includes('webpack') ||
            lower.includes('.png') || lower.includes('.jpg') || lower.includes('.gif') || lower.includes('.svg') ||
            lower.includes('.css') || lower.includes('.js') || lower.includes('wixpress') ||
            lower.includes('wordpress') || lower.includes('github') || lower.includes('npmjs') ||
            lower.includes('your@') || lower.includes('email@') || lower.includes('name@') ||
            lower.includes('mysocialpractice') || lower.includes('placeholder') ||
            lower.includes('2x') || lower.includes('sprite') || lower.includes('loading')) continue;
        // Prefer business emails
        if (lower.match(/^(info|contact|hello|office|admin|reception|appointments|booking|dental|dr\.|team)@/)) {
          return lower; // Best match, return immediately
        }
        emails.add(lower);
      }
    } catch { /* skip */ }
  }

  // Return first non-junk email
  for (const e of emails) {
    if (!e.includes('noreply') && !e.includes('no-reply') && !e.includes('mailer-daemon')) {
      return e;
    }
  }
  return null;
}

// ── Screenshot ──
async function screenshotSite(browser: Browser, url: string, outPath: string): Promise<boolean> {
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: outPath });
    await page.close();
    return true;
  } catch {
    return false;
  }
}

// ── Main ──
async function main() {
  console.log('🦷 Dental Lead Finder — Target: 60 email leads (min score: 35)\n');
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // Load existing leads to deduplicate
  const existingDomains = new Set<string>();
  const leadsDir = path.resolve(__dirname, '../output/leads');
  if (fs.existsSync(leadsDir)) {
    for (const f of fs.readdirSync(leadsDir)) {
      if (f.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(leadsDir, f), 'utf-8'));
          const arr = Array.isArray(data) ? data : data.leads || [];
          for (const l of arr) {
            if (l.website) {
              existingDomains.add(new URL(l.website.startsWith('http') ? l.website : `https://${l.website}`).hostname.replace('www.', ''));
            }
          }
        } catch { /* skip bad files */ }
      }
    }
  }
  console.log(`📋 ${existingDomains.size} existing domains loaded for dedup\n`);

  // Load outreach state
  const statePath = path.resolve(__dirname, 'outreach-state.json');
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      for (const email of Object.keys(state)) {
        const domain = email.split('@')[1];
        if (domain) existingDomains.add(domain);
      }
    } catch { /* skip */ }
  }

  // Check Resend for previously sent emails
  console.log('📧 Checking Resend for previously sent emails...');
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
    });
    if (resendRes.ok) {
      const resendData = await resendRes.json() as any;
      const sentEmails = resendData.data || [];
      for (const e of sentEmails) {
        if (e.to) {
          for (const addr of (Array.isArray(e.to) ? e.to : [e.to])) {
            const domain = addr.split('@')[1];
            if (domain) existingDomains.add(domain);
          }
        }
      }
      console.log(`  Found ${sentEmails.length} previously sent emails in Resend\n`);
    }
  } catch { console.log('  Could not check Resend\n'); }

  // Launch browser for screenshots
  const browser = await chromium.launch({ headless: true });

  const allCities = [
    ...US_CITIES.map(c => ({ city: c, country: 'US' })),
    ...AU_CITIES.map(c => ({ city: c, country: 'AU' })),
  ];

  // Load existing leads (append mode)
  let leads: Lead[] = [];
  if (fs.existsSync(OUT_FILE)) {
    try { leads = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8')); } catch { /* start fresh */ }
  }
  console.log(`📂 Loaded ${leads.length} existing leads (append mode)\n`);

  // Add existing lead domains to dedup
  for (const l of leads) {
    try {
      const d = new URL(l.website.startsWith('http') ? l.website : `https://${l.website}`).hostname.replace('www.', '');
      existingDomains.add(d);
    } catch { /* skip */ }
  }

  let totalScanned = 0;
  let totalOutdated = 0;
  let totalEmails = leads.length;

  for (const { city, country } of allCities) {
    if (totalEmails >= TARGET_EMAILS) {
      console.log(`\n✅ Target reached: ${totalEmails} emails found!`);
      break;
    }

    const query = `dentist ${city}`;
    console.log(`\n🔍 ${query}...`);

    let places: any[];
    try {
      places = await searchPlaces(query);
    } catch (err: any) {
      console.log(`  ❌ Search failed: ${err.message?.slice(0, 50)}`);
      continue;
    }

    console.log(`  Found ${places.length} businesses`);

    for (const place of places) {
      if (totalEmails >= TARGET_EMAILS) break;

      // Get website from details
      let details: any;
      try {
        details = await getPlaceDetails(place.place_id);
      } catch { continue; }

      if (!details.website) continue;

      const website = details.website;
      let domain: string;
      try {
        domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace('www.', '');
      } catch { continue; }

      // Dedup
      if (existingDomains.has(domain)) {
        continue;
      }
      existingDomains.add(domain);

      totalScanned++;

      // Quick outdated score
      const { score, signals } = await quickOutdatedScore(website);

      if (score < MIN_SCORE) {
        continue;
      }

      totalOutdated++;
      console.log(`  ⚠️  ${details.name} — score ${score} (${signals.join(', ')})`);

      // Extract email
      const email = await extractEmails(website);
      if (!email) {
        console.log(`     ❌ No email found`);
        continue;
      }

      totalEmails++;

      // Screenshot the site for visual review
      const safeName = domain.replace(/[^a-z0-9.-]/g, '_');
      const screenshotPath = path.join(SCREENSHOTS_DIR, `${safeName}.png`);
      const screenshotOk = await screenshotSite(browser, website, screenshotPath);
      console.log(`     ✅ ${email} — LEAD #${totalEmails}${screenshotOk ? ' (screenshot saved)' : ' (screenshot failed)'}`);

      leads.push({
        name: details.name || place.name,
        website,
        phone: details.formatted_phone_number,
        city,
        country,
        placeId: place.place_id,
        rating: details.rating,
        reviewCount: details.user_ratings_total,
        outdatedScore: score,
        email,
        signals,
        screenshot: screenshotOk ? screenshotPath : undefined,
      });

      // Save incrementally
      fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
      fs.writeFileSync(OUT_FILE, JSON.stringify(leads, null, 2));
    }
  }

  await browser.close();

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 Results:`);
  console.log(`   Scanned: ${totalScanned}`);
  console.log(`   Outdated (score ≥${MIN_SCORE}): ${totalOutdated}`);
  console.log(`   With email: ${totalEmails}`);
  console.log(`   Saved to: ${OUT_FILE}`);
  console.log(`${'═'.repeat(50)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
