/**
 * Fast HTTP-only bulk email extractor for AU dental leads.
 *
 * Input:  c:/tmp/au-dental-websites.json  (array of {name,website,city,...})
 * Output: c:/tmp/au-dental-with-emails.json (array with .email added for successes)
 *
 * No Google API, no Playwright — just fetch + regex on homepage + /contact.
 * ~1-2 min total for 150 sites with 10-way concurrency.
 */

import * as fs from 'fs';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const IGNORE_EMAILS =
  /example\.com|sentry|wixpress|wordpress|gravatar|schema\.org|w3\.org|googleapis|cloudflare|domain\.com|your.?email|yourname|noreply|no-reply|\.png|\.jpg|\.svg|\.gif/i;

const PREFERRED_PREFIXES = ['info@', 'contact@', 'hello@', 'office@', 'admin@', 'reception@', 'enquiries@'];

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36 smartflowdev-leadgen/1.0';

interface LeadIn {
  name: string;
  website: string;
  phone?: string | null;
  city?: string;
  rating?: number | null;
  reviewCount?: number | null;
}

interface LeadOut extends LeadIn {
  email: string;
}

async function fetchWithTimeout(url: string, ms: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 500_000); // cap at 500KB
  } catch {
    return null;
  }
}

function pickBest(emails: string[]): string | null {
  const cleaned = emails
    .map((e) => e.toLowerCase())
    .filter((e) => !IGNORE_EMAILS.test(e))
    .filter((e) => e.length < 120);
  const unique = Array.from(new Set(cleaned));
  for (const prefix of PREFERRED_PREFIXES) {
    const match = unique.find((e) => e.startsWith(prefix));
    if (match) return match;
  }
  return unique[0] || null;
}

async function extractEmailForLead(lead: LeadIn): Promise<string | null> {
  let base = lead.website.trim();
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
  base = base.replace(/\/+$/, '');
  // Strip query/hash from base
  try {
    const u = new URL(base);
    base = u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return null;
  }

  const pagesToTry = [base, `${base}/contact`, `${base}/contact-us`, `${base}/about`];
  const found = new Set<string>();

  for (const url of pagesToTry) {
    const html = await fetchWithTimeout(url, 8000);
    if (!html) continue;
    // mailto: links first (most reliable)
    const mailtos = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [];
    for (const m of mailtos) {
      const email = m.replace(/mailto:/i, '').split(/[?&]/)[0];
      if (!IGNORE_EMAILS.test(email)) found.add(email.toLowerCase());
    }
    // Generic regex
    const matches = html.match(EMAIL_REGEX) || [];
    for (const m of matches) {
      if (!IGNORE_EMAILS.test(m)) found.add(m.toLowerCase());
    }
    // Early exit: if we found any preferred-prefix email, stop
    const preferredHit = Array.from(found).some((e) =>
      PREFERRED_PREFIXES.some((p) => e.startsWith(p))
    );
    if (preferredHit) break;
  }

  return pickBest(Array.from(found));
}

async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, idx: number) => Promise<R>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  let done = 0;

  async function worker() {
    while (nextIdx < items.length) {
      const myIdx = nextIdx++;
      results[myIdx] = await fn(items[myIdx], myIdx);
      done++;
      if (onProgress) onProgress(done, items.length);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const inputPath = 'c:/tmp/au-dental-websites.json';
  const outputPath = 'c:/tmp/au-dental-with-emails.json';

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const leads: LeadIn[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`📧 Extracting emails from ${leads.length} AU dental sites (10-way parallel)...`);

  const startedAt = Date.now();
  const withEmail: LeadOut[] = [];

  const results = await runWithConcurrency(
    leads,
    async (lead) => {
      const email = await extractEmailForLead(lead);
      return { lead, email };
    },
    10,
    (done, total) => {
      if (done % 10 === 0 || done === total) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
        console.log(`   [${done}/${total}] done (${elapsed}s elapsed)`);
      }
    }
  );

  for (const { lead, email } of results) {
    if (email) withEmail.push({ ...lead, email });
  }

  console.log(`\n✅ Finished in ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
  console.log(`   ${withEmail.length}/${leads.length} leads got an email`);

  fs.writeFileSync(outputPath, JSON.stringify(withEmail, null, 2));
  console.log(`   Saved → ${outputPath}`);
}

main().catch((e) => {
  console.error('❌ fatal:', e);
  process.exit(1);
});
