import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IGNORE_EMAILS = /example\.com|sentry\.io|wixpress|wordpress|gravatar|schema\.org|w3\.org/i;

function parseArgs(): { url: string } {
  const args = process.argv.slice(2);
  let url = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) url = args[i + 1];
  }
  if (!url) {
    console.error('Usage: npx ts-node scripts/extract-email.ts --url https://example.com');
    process.exit(1);
  }
  return { url };
}

async function extractEmailsFromPage(page: any, url: string): Promise<string[]> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);
  } catch {
    return [];
  }

  const html = await page.content();
  const emails = new Set<string>();

  // Regex match on full HTML
  const matches = html.match(EMAIL_REGEX) || [];
  for (const m of matches) {
    if (!IGNORE_EMAILS.test(m)) emails.add(m.toLowerCase());
  }

  // Check mailto: links
  const mailtos = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href^="mailto:"]');
    return Array.from(links).map(l => l.getAttribute('href')?.replace('mailto:', '').split('?')[0] || '');
  }).catch(() => []);
  for (const m of mailtos) {
    if (m && !IGNORE_EMAILS.test(m)) emails.add(m.toLowerCase());
  }

  // Check footer specifically
  const footerEmails = await page.evaluate(() => {
    const footer = document.querySelector('footer') || document.querySelector('[class*="footer"]');
    if (!footer) return [];
    const text = footer.innerHTML;
    const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(re) || [];
  }).catch(() => []);
  for (const m of footerEmails) {
    if (!IGNORE_EMAILS.test(m)) emails.add(m.toLowerCase());
  }

  return Array.from(emails);
}

export async function extractEmail(url: string): Promise<{ emails: string[]; bestEmail: string | null }> {
  // Normalize URL
  if (!url.startsWith('http')) url = 'https://' + url;
  const baseUrl = url.replace(/\/$/, '');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const allEmails = new Set<string>();

  // Pages to check
  const pages = [
    baseUrl,
    baseUrl + '/contact',
    baseUrl + '/contact-us',
    baseUrl + '/about',
  ];

  for (const pageUrl of pages) {
    const found = await extractEmailsFromPage(page, pageUrl);
    for (const e of found) allEmails.add(e);
  }

  await browser.close();

  const emails = Array.from(allEmails);

  // Pick best email: prefer info@, contact@, hello@, then first found
  let bestEmail: string | null = null;
  const preferred = ['info@', 'contact@', 'hello@', 'office@', 'admin@'];
  for (const prefix of preferred) {
    const match = emails.find(e => e.startsWith(prefix));
    if (match) { bestEmail = match; break; }
  }
  if (!bestEmail && emails.length > 0) bestEmail = emails[0];

  return { emails, bestEmail };
}

if (require.main === module) {
  const { url } = parseArgs();
  console.log(`📧 Extracting emails from ${url}...`);
  extractEmail(url).then(result => {
    console.log(`   Found ${result.emails.length} email(s):`);
    for (const e of result.emails) console.log(`   - ${e}`);
    console.log(`   Best: ${result.bestEmail || 'none'}`);
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
