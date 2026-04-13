/**
 * Recover leads from screenshots — extract emails from websites we already screenshotted
 */
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = path.resolve(__dirname, '../output/leads/dental-screenshots');
const EXISTING_FILE = path.resolve(__dirname, '../output/leads/dental-send-list.json');
const OUT_FILE = path.resolve(__dirname, '../output/leads/dental-send-list.json');

const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Skip list — domains we know are bad
const SKIP_DOMAINS = new Set([
  'ambrosepd.com', // 404
  'antigodentalclinic.com', // 403
  'auldfamilydentistry.com', // túl jó
  'drauld.com', // dupla
  'bloomdentist.com', // túl jó
  'bradfordfamilydentist.ca', // kanadai
  'crookedcreekfamilydental.com', // túl jó
  'dentistryoflawrenceburg.com', // túl jó
  'duboisfreeclinic.org', // nem dental
  'guidryhoraistortho.com', // túl jó
  'haysvethosp.com', // állatorvos
  'healthy-connections.org', // nem dental
  'neoralsurgery.com', // túl jó (oral surgery)
  'sarvey.com', // biztosító
  'wth.org', // kórház
  'smileesteem.com.au', // túl jó
  'echucavets.com.au', // állatorvos
  'trustedsmiles.com.au', // túl jó
]);

async function extractEmail(domain: string): Promise<string | null> {
  const urls = [
    `https://${domain}`,
    `https://${domain}/contact`,
    `https://${domain}/contact-us`,
    `https://www.${domain}`,
    `https://www.${domain}/contact`,
    `http://${domain}`,
    `http://${domain}/contact`,
    `http://www.${domain}`,
  ];

  const junkPatterns = ['.png', '.jpg', '.gif', '.svg', '.css', '.js', 'example.com', 'sentry', 'webpack', 'wixpress', 'wordpress', 'github', 'npmjs', 'your@', 'email@', 'name@', 'mysocialpractice', '2x', 'sprite', 'loading', 'noreply', 'no-reply'];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        redirect: 'follow',
      });
      clearTimeout(timeout);
      const html = await res.text();
      const matches = html.match(emailRegex) || [];

      for (const m of matches) {
        const lower = m.toLowerCase();
        if (junkPatterns.some(p => lower.includes(p))) continue;
        if (lower.match(/^(info|contact|hello|office|admin|reception|appointments|booking|dental|dr\.|team|front)@/)) {
          return lower;
        }
      }
      // Return first non-junk
      for (const m of matches) {
        const lower = m.toLowerCase();
        if (junkPatterns.some(p => lower.includes(p))) continue;
        if (!lower.includes('noreply') && !lower.includes('mailer-daemon')) {
          return lower;
        }
      }
    } catch { /* try next URL */ }
  }
  return null;
}

async function main() {
  // Load existing leads
  let existing: any[] = [];
  if (fs.existsSync(EXISTING_FILE)) {
    existing = JSON.parse(fs.readFileSync(EXISTING_FILE, 'utf-8'));
  }
  const existingDomains = new Set(existing.map((l: any) => {
    try { return new URL(l.website.startsWith('http') ? l.website : `https://${l.website}`).hostname.replace('www.', ''); } catch { return ''; }
  }));

  console.log(`📂 Existing: ${existing.length} leads`);
  console.log(`📸 Screenshots: checking for missing leads...\n`);

  const screenshots = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
  let recovered = 0;

  for (const file of screenshots) {
    const domain = file.replace('.png', '');

    // Skip known bad
    if (SKIP_DOMAINS.has(domain)) continue;
    // Skip already in list
    if (existingDomains.has(domain)) continue;

    console.log(`🔍 ${domain}...`);
    const email = await extractEmail(domain);

    if (email) {
      console.log(`  ✅ ${email}`);
      existing.push({
        name: domain.replace(/\.(com|net|org|co|au)\.?/g, ' ').replace(/[.-]/g, ' ').trim(),
        website: `https://${domain}`,
        city: 'Unknown',
        country: domain.endsWith('.au') ? 'AU' : 'US',
        email,
        outdatedScore: 35,
        signals: ['Recovered from screenshot'],
      });
      existingDomains.add(domain);
      recovered++;
    } else {
      console.log(`  ❌ No email`);
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2));
  console.log(`\n✅ Recovered ${recovered} leads. Total: ${existing.length}`);
}

main().catch(console.error);
