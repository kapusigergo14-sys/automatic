import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import { discover } from './discover';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const IGNORE = /example\.com|sentry|wixpress|wordpress|gravatar|schema\.org|w3\.org|googleapis|cloudflare|domain\.com/i;

interface LeadWithEmail {
  name: string;
  website: string;
  email: string;
  contactUrl: string;
  country: string;
  industry: string;
  phone: string;
  rating: number | null;
  reviewCount: number | null;
}

const SEARCHES = [
  // USA — smaller cities = more outdated sites
  { query: 'hvac contractor', city: 'Knoxville TN', country: 'Knoxville, TN USA', industry: 'HVAC' },
  { query: 'hvac repair', city: 'Tulsa OK', country: 'Tulsa, OK USA', industry: 'HVAC' },
  { query: 'air conditioning repair', city: 'Little Rock AR', country: 'Little Rock, AR USA', industry: 'HVAC' },
  { query: 'roofing contractor', city: 'Shreveport LA', country: 'Shreveport, LA USA', industry: 'Roofing' },
  { query: 'roof repair', city: 'Akron OH', country: 'Akron, OH USA', industry: 'Roofing' },
  { query: 'roofing company', city: 'Wichita KS', country: 'Wichita, KS USA', industry: 'Roofing' },
  { query: 'lawyer', city: 'Chattanooga TN', country: 'Chattanooga, TN USA', industry: 'Legal' },
  { query: 'attorney', city: 'Baton Rouge LA', country: 'Baton Rouge, LA USA', industry: 'Legal' },
  { query: 'family lawyer', city: 'Lexington KY', country: 'Lexington, KY USA', industry: 'Legal' },
  { query: 'plumber', city: 'Dayton OH', country: 'Dayton, OH USA', industry: 'Plumbing' },
  { query: 'plumbing company', city: 'Augusta GA', country: 'Augusta, GA USA', industry: 'Plumbing' },
  { query: 'electrician', city: 'Lubbock TX', country: 'Lubbock, TX USA', industry: 'Electrical' },
  { query: 'auto repair', city: 'Macon GA', country: 'Macon, GA USA', industry: 'Auto' },
  { query: 'auto mechanic', city: 'Topeka KS', country: 'Topeka, KS USA', industry: 'Auto' },
  { query: 'general contractor', city: 'Fayetteville NC', country: 'Fayetteville, NC USA', industry: 'Construction' },
  { query: 'hvac', city: 'Springfield MO', country: 'Springfield, MO USA', industry: 'HVAC' },
  { query: 'roofing', city: 'Evansville IN', country: 'Evansville, IN USA', industry: 'Roofing' },
  { query: 'lawyer', city: 'Fort Wayne IN', country: 'Fort Wayne, IN USA', industry: 'Legal' },
  { query: 'plumber', city: 'Corpus Christi TX', country: 'Corpus Christi, TX USA', industry: 'Plumbing' },
  { query: 'electrician', city: 'Savannah GA', country: 'Savannah, GA USA', industry: 'Electrical' },
  // Australia — regional
  { query: 'roofing', city: 'Townsville Australia', country: 'Townsville, Australia', industry: 'Roofing' },
  { query: 'plumber', city: 'Cairns Australia', country: 'Cairns, Australia', industry: 'Plumbing' },
  { query: 'electrician', city: 'Toowoomba Australia', country: 'Toowoomba, Australia', industry: 'Electrical' },
  { query: 'lawyer', city: 'Geelong Australia', country: 'Geelong, Australia', industry: 'Legal' },
  { query: 'hvac', city: 'Ballarat Australia', country: 'Ballarat, Australia', industry: 'HVAC' },
];

async function extractEmailFromSite(browser: any, url: string): Promise<string | null> {
  const page = await browser.newPage();
  try {
    // Try main page + contact page
    const urls = [url, url.replace(/\/$/, '') + '/contact', url.replace(/\/$/, '') + '/contact-us'];
    const emails = new Set<string>();

    for (const u of urls) {
      try {
        await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(1000);
        const html = await page.content();

        // mailto: links
        const mailtos = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [];
        for (const m of mailtos) {
          const email = m.replace('mailto:', '').toLowerCase();
          if (!IGNORE.test(email)) emails.add(email);
        }

        // Regex in HTML
        const found = html.match(EMAIL_REGEX) || [];
        for (const e of found) {
          if (!IGNORE.test(e) && !e.includes('.png') && !e.includes('.jpg') && !e.includes('.svg') && !e.includes('.css')) {
            emails.add(e.toLowerCase());
          }
        }

        if (emails.size > 0) break;
      } catch { /* skip */ }
    }

    await page.close();

    // Pick best email
    const arr = Array.from(emails);
    const preferred = ['info@', 'contact@', 'hello@', 'office@', 'admin@', 'service@'];
    for (const p of preferred) {
      const match = arr.find(e => e.startsWith(p));
      if (match) return match;
    }
    return arr[0] || null;
  } catch {
    try { await page.close(); } catch {}
    return null;
  }
}

async function main() {
  const TARGET = 60; // want 60 leads with email (buffer for 50 sends)
  const leads: LeadWithEmail[] = [];
  const seenDomains = new Set<string>();

  const browser = await chromium.launch({ headless: true });

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  FIND LEADS WITH EMAIL — target: 60 leads                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  for (const search of SEARCHES) {
    if (leads.length >= TARGET) break;

    console.log(`\n🔍 ${search.country} | ${search.industry} | "${search.query} ${search.city}"`);

    try {
      const result = await discover(search.query, search.city, 20);

      for (const lead of result.leads) {
        if (leads.length >= TARGET) break;

        const domain = lead.website.replace(/https?:\/\//, '').replace(/www\./, '').split('/')[0].toLowerCase();
        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        // FIRST: Quick outdated check (fetch-based, no Playwright)
        let isOutdated = false;
        try {
          const resp = await fetch(lead.website, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(8000),
            redirect: 'follow',
          });
          if (resp.ok) {
            const html = await resp.text();
            const wp = /wp-content|wp-includes|wp-json/i.test(html);
            const jq = /jquery(\.min)?\.js|wp-includes\/js\/jquery/i.test(html);
            const legacy = /contact_us|about_us|contact\.php|contact\.html/i.test(html);
            const noViewport = !/name=["']viewport["']/i.test(html);
            const modern = /__NEXT_DATA__|__NUXT__|data-reactroot|svelte-|Webflow|Squarespace|wix\.com/i.test(html);
            const turbify = /Web Hosting by Turbify|Powered by Yahoo/i.test(html);
            const oldJq = /jquery[\/\-]1\.\d+|jquery\.min\.js\?ver=1\./i.test(html);

            let quickScore = 0;
            if (wp) quickScore += 15;
            if (jq) quickScore += 5;
            if (oldJq) quickScore += 15;
            if (legacy) quickScore += 10;
            if (noViewport) quickScore += 15;
            if (turbify) quickScore += 20;
            if (modern) quickScore -= 15;

            isOutdated = quickScore >= 20;
            if (!isOutdated) {
              console.log(`  ⏭️ ${lead.name.slice(0, 40)} — modern (score=${quickScore})`);
              continue;
            }
            console.log(`  🔍 ${lead.name.slice(0, 40)} — outdated (score=${quickScore}), checking email...`);
          }
        } catch {
          // If fetch fails, skip
          console.log(`  ⏭️ ${lead.name.slice(0, 40)} — fetch failed`);
          continue;
        }

        // THEN: Extract email (only for outdated sites)
        const email = await extractEmailFromSite(browser, lead.website);
        if (!email) {
          console.log(`    ⏭️ no email found`);
          continue;
        }

        leads.push({
          name: lead.name,
          website: lead.website,
          email,
          contactUrl: lead.website,
          country: search.country,
          industry: search.industry,
          phone: lead.phone || '',
          rating: lead.rating,
          reviewCount: lead.reviewCount,
        });

        console.log(`  ✅ ${lead.name.slice(0, 40)} → ${email}`);
      }

      console.log(`  Total with email: ${leads.length}/${TARGET}`);
    } catch (err: any) {
      console.log(`  ❌ ${err.message?.slice(0, 60)}`);
    }
  }

  await browser.close();

  // Save
  const outDir = path.resolve(__dirname, '../output/leads');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'email-verified-leads.json');

  const output = {
    source: 'find-leads-with-email',
    date: new Date().toISOString().split('T')[0],
    totalLeads: leads.length,
    leads: leads.map(l => ({
      name: l.name,
      website: l.website,
      email: l.email,
      contactUrl: l.contactUrl,
      country: l.country,
      industry: l.industry,
    })),
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  DONE — ${leads.length} leads with verified email                    ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);
  console.log(`  Saved: ${outPath}`);
  console.log(`  Next: npx ts-node scripts/process-chatgpt-list.ts --file ${outPath} --no-score`);
}

main().catch(err => { console.error(err); process.exit(1); });
