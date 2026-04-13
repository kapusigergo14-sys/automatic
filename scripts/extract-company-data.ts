import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium, Page } from 'playwright';

export interface CompanyData {
  services: string[];           // real service names from nav/services page
  phone: string | null;
  address: string | null;
  city: string | null;
  hours: string | null;
  teamMembers: { name: string; role: string; photoUrl?: string }[];
  heroHeadline: string | null;
  metaDescription: string | null;
  aboutSnippet: string | null;
  images: string[];             // significant photos (office, gallery, hero bg candidates)
}

const SERVICE_STOP_WORDS = /^(home|about|contact|blog|news|faq|services?|team|portfolio|gallery|reviews?|testimonials|location|shop|cart|login|sign|menu|more|privacy|terms|sitemap|careers?|pricing)$/i;

function parseArgs(): { url: string } {
  const args = process.argv.slice(2);
  let url = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) url = args[i + 1];
  }
  if (!url) {
    console.error('Usage: npx ts-node scripts/extract-company-data.ts --url https://example.com');
    process.exit(1);
  }
  return { url };
}

async function safeGoto(page: Page, url: string, timeout = 12000): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(1200);
    return true;
  } catch {
    return false;
  }
}

async function extractServicesFromNav(page: Page): Promise<string[]> {
  return await page.evaluate((stopRe: string) => {
    const stopRegex = new RegExp(stopRe, 'i');
    const results = new Set<string>();
    // Prioritize submenus under "services" nav item
    const navLinks = document.querySelectorAll('nav a, header a, .menu a, [class*="nav"] a, [class*="menu"] a');
    for (const link of Array.from(navLinks)) {
      const text = (link.textContent || '').trim();
      if (!text || text.length < 3 || text.length > 60) continue;
      const href = (link.getAttribute('href') || '').toLowerCase();
      // detect services submenu items
      if (href.includes('service') || href.includes('treatment') || href.includes('practice-area')) {
        if (!stopRegex.test(text)) results.add(text);
      }
    }
    return Array.from(results).slice(0, 12);
  }, SERVICE_STOP_WORDS.source);
}

async function extractServicesFromServicesPage(page: Page, baseUrl: string): Promise<string[]> {
  const candidates = [
    baseUrl + '/services',
    baseUrl + '/our-services',
    baseUrl + '/treatments',
    baseUrl + '/practice-areas',
    baseUrl + '/what-we-do',
  ];
  for (const url of candidates) {
    const ok = await safeGoto(page, url, 8000);
    if (!ok) continue;
    const services = await page.evaluate(() => {
      const headers = document.querySelectorAll('h2, h3, h4');
      const out: string[] = [];
      for (const h of Array.from(headers)) {
        const text = (h.textContent || '').trim();
        if (text && text.length >= 3 && text.length <= 60) out.push(text);
      }
      return out;
    });
    if (services.length >= 3) {
      return services.slice(0, 12);
    }
  }
  return [];
}

async function extractPhone(page: Page): Promise<string | null> {
  const phone = await page.evaluate(() => {
    // Prefer tel: links
    const telLink = document.querySelector('a[href^="tel:"]');
    if (telLink) {
      const href = telLink.getAttribute('href') || '';
      return href.replace('tel:', '').trim();
    }
    // Fallback: search header/footer text
    const zones = ['header', 'footer', '[class*="header"]', '[class*="footer"]', '[class*="contact"]'];
    for (const sel of zones) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const txt = el.textContent || '';
      const m = txt.match(/(\+?\d{1,3}[\s.\-]?)?\(?\d{2,4}\)?[\s.\-]?\d{3,4}[\s.\-]?\d{3,4}/);
      if (m && m[0].replace(/\D/g, '').length >= 9) return m[0].trim();
    }
    return null;
  });
  return phone;
}

async function extractAddress(page: Page): Promise<{ address: string | null; city: string | null }> {
  return await page.evaluate(() => {
    // Look for address tag first
    const addrEl = document.querySelector('address');
    let addr: string | null = null;
    if (addrEl) {
      addr = (addrEl.textContent || '').trim().replace(/\s+/g, ' ');
    } else {
      const footer = document.querySelector('footer') || document.querySelector('[class*="footer"]');
      if (footer) {
        const text = (footer.textContent || '').trim();
        // Heuristic: look for pattern like "123 Street Name, City, ST 12345"
        const m = text.match(/\d{1,5}\s+[\w\s]{3,40},\s*[\w\s]{2,30},?\s*[A-Z]{2}\s*\d{4,5}/);
        if (m) addr = m[0].trim();
      }
    }
    // Extract city (heuristic: word before state abbreviation+zip)
    let city: string | null = null;
    if (addr) {
      const m = addr.match(/,\s*([A-Za-z\s]{2,30}),?\s*[A-Z]{2}\s*\d{4,5}/);
      if (m) city = m[1].trim();
    }
    return { address: addr, city };
  });
}

async function extractHours(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const text = document.body.textContent || '';
    const m = text.match(/(Mon|Monday)[^\n]{5,120}(PM|pm|AM|am)/);
    return m ? m[0].trim().replace(/\s+/g, ' ').slice(0, 200) : null;
  });
}

async function extractTeamFromImages(page: Page): Promise<{ name: string; role: string; photoUrl?: string }[]> {
  // Heuristic: find <img> tags with alt text matching a person pattern (Dr. / name + role)
  return await page.evaluate(() => {
    const out: { name: string; role: string; photoUrl?: string }[] = [];
    const imgs = document.querySelectorAll('img');
    for (const img of Array.from(imgs) as HTMLImageElement[]) {
      const alt = (img.alt || '').trim();
      const src = img.src || '';
      if (!alt || !src || src.startsWith('data:')) continue;
      // Heuristic: split on first " - " or " , " or " | " separator
      const sep = alt.match(/^(.+?)\s+[\-\u2013\u2014|,]\s+(.+)$/);
      if (sep) {
        const name = sep[1].trim();
        const role = sep[2].trim();
        // Validate name looks like a person (starts with Dr./Mr./Ms. OR has 2+ capitalized words)
        const looksLikeName = /^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)\s/i.test(name)
          || /^[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+(\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+){1,3}$/.test(name);
        if (looksLikeName && name.length >= 5 && name.length <= 50 && role.length >= 3 && role.length <= 80) {
          out.push({ name, role, photoUrl: src });
        }
      }
      if (out.length >= 6) break;
    }
    return out;
  });
}

async function extractTeamFromAbout(page: Page, baseUrl: string): Promise<{ name: string; role: string; photoUrl?: string }[]> {
  // First try to find team from alt-tagged images on the home page
  const fromImages = await extractTeamFromImages(page);
  if (fromImages.length >= 2) return fromImages.slice(0, 4);

  const candidates = [
    baseUrl + '/about',
    baseUrl + '/about-us',
    baseUrl + '/team',
    baseUrl + '/our-team',
    baseUrl + '/staff',
    baseUrl + '/doctors',
    baseUrl + '/attorneys',
    baseUrl + '/rolunk',     // HU
    baseUrl + '/csapat',     // HU
    baseUrl + '/munkatarsak',// HU
    baseUrl + '/uber-uns',   // DE
    baseUrl + '/team',       // DE
  ];
  for (const url of candidates) {
    const ok = await safeGoto(page, url, 8000);
    if (!ok) continue;
    // Try image-alt based first on the subpage
    const fromSubImages = await extractTeamFromImages(page);
    if (fromSubImages.length >= 2) return fromSubImages.slice(0, 4);
    const team = await page.evaluate(() => {
      const out: { name: string; role: string; photoUrl?: string }[] = [];
      // Look for typical team member card structure
      const cards = document.querySelectorAll('[class*="team"], [class*="member"], [class*="staff"], [class*="doctor"], [class*="attorney"], [class*="bio"]');
      for (const card of Array.from(cards).slice(0, 20)) {
        const nameEl = card.querySelector('h2, h3, h4, h5, .name, [class*="name"]');
        const roleEl = card.querySelector('p, .title, .role, [class*="title"], [class*="role"], [class*="position"]');
        const imgEl = card.querySelector('img') as HTMLImageElement | null;
        const name = (nameEl?.textContent || '').trim();
        const role = (roleEl?.textContent || '').trim();
        const photoUrl = imgEl?.src || undefined;
        if (name && name.length >= 3 && name.length <= 50 && /[A-Z]/.test(name)) {
          out.push({ name, role: role.slice(0, 60) || 'Team Member', photoUrl });
        }
      }
      return out.slice(0, 4);
    });
    if (team.length > 0) return team;
  }
  return [];
}

async function extractImages(page: Page): Promise<string[]> {
  // Collect significant images from the homepage:
  // - Skip small icons, logos, thumbnails (<300px wide)
  // - Skip duplicates
  // - Skip team photos (already captured separately)
  // - Prefer hero/banner/gallery/background images
  return await page.evaluate(() => {
    const out = new Set<string>();
    const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
    for (const img of imgs) {
      const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
      if (!src || src.startsWith('data:')) continue;
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w < 400 || h < 250) continue;
      // Skip obvious logos / icons
      const low = src.toLowerCase();
      const alt = (img.alt || '').toLowerCase();
      if (low.includes('logo') || alt.includes('logo')) continue;
      if (low.includes('/icon') || low.includes('favicon')) continue;
      if (low.endsWith('.svg')) continue;
      // Skip if alt mentions person / dr / doctor (likely team photo — handled elsewhere)
      if (/^dr\.?\s|doctor|^mr\.?\s|^mrs\.?\s|^ms\.?\s/i.test(alt)) continue;
      out.add(src);
      if (out.size >= 20) break;
    }
    // Also collect CSS background-image URLs from common hero/banner sections
    const zones = document.querySelectorAll('[class*="hero"],[class*="banner"],[class*="slider"],[class*="cover"],[class*="header"],section,header');
    for (const el of Array.from(zones).slice(0, 30)) {
      const style = window.getComputedStyle(el as HTMLElement);
      const bg = style.backgroundImage;
      if (bg && bg.startsWith('url(')) {
        const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (m && m[1] && !m[1].startsWith('data:')) out.add(m[1]);
      }
      if (out.size >= 25) break;
    }
    return Array.from(out);
  });
}

async function extractHeroHeadline(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    if (!h1) return null;
    const text = (h1.textContent || '').trim().replace(/\s+/g, ' ');
    return text.length > 5 && text.length < 150 ? text : null;
  });
}

async function extractMetaDescription(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const meta = document.querySelector('meta[name="description"]');
    return meta ? (meta.getAttribute('content') || '').trim() : null;
  });
}

async function extractAboutSnippet(page: Page, baseUrl: string): Promise<string | null> {
  const candidates = [baseUrl + '/about', baseUrl + '/about-us'];
  for (const url of candidates) {
    const ok = await safeGoto(page, url, 8000);
    if (!ok) continue;
    const snippet = await page.evaluate(() => {
      const paras = document.querySelectorAll('p');
      for (const p of Array.from(paras)) {
        const t = (p.textContent || '').trim();
        if (t.length >= 80 && t.length <= 400) return t;
      }
      return null;
    });
    if (snippet) return snippet;
  }
  return null;
}

export async function extractCompanyData(url: string): Promise<CompanyData> {
  const empty: CompanyData = {
    services: [], phone: null, address: null, city: null, hours: null,
    teamMembers: [], heroHeadline: null, metaDescription: null, aboutSnippet: null,
    images: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    const baseUrl = url.replace(/\/$/, '');
    const ok = await safeGoto(page, baseUrl, 15000);
    if (!ok) {
      await browser.close();
      return empty;
    }

    // Run home-page extractions first (including team from image alts)
    const [
      navServices, phone, addressInfo, hours, heroHeadline, metaDescription, homePageTeam, homeImages,
    ] = await Promise.all([
      extractServicesFromNav(page),
      extractPhone(page),
      extractAddress(page),
      extractHours(page),
      extractHeroHeadline(page),
      extractMetaDescription(page),
      extractTeamFromImages(page),
      extractImages(page),
    ]);

    // Now navigate to additional pages sequentially
    let services = navServices;
    if (services.length < 3) {
      const fromPage = await extractServicesFromServicesPage(page, baseUrl);
      if (fromPage.length > services.length) services = fromPage;
    }

    let teamMembers = homePageTeam.slice(0, 4);
    if (teamMembers.length < 2) {
      teamMembers = await extractTeamFromAbout(page, baseUrl);
    }
    const aboutSnippet = await extractAboutSnippet(page, baseUrl);

    await browser.close();

    return {
      services: services.slice(0, 6),
      phone,
      address: addressInfo.address,
      city: addressInfo.city,
      hours,
      teamMembers,
      heroHeadline,
      metaDescription,
      aboutSnippet,
      images: homeImages,
    };
  } catch (err) {
    try { await browser.close(); } catch {}
    return empty;
  }
}

if (require.main === module) {
  const { url } = parseArgs();
  console.log(`Extracting company data from ${url}...`);
  extractCompanyData(url).then(data => {
    console.log(JSON.stringify(data, null, 2));
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
