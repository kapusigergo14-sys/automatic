/**
 * enrich-personalized-hook.ts — Generate a per-lead 1-sentence observation.
 *
 * For each lead in a given pool (default: dental-v5-modern.json):
 *   1. Fetch the lead.website
 *   2. Extract <h1>, <meta description>, and first hero-copy blob
 *   3. Ask Claude to write ONE sentence observation about this specific site
 *   4. Store as `lead.personalizedHook` and rewrite the file
 *
 * Skips leads that already have a hook (idempotent).
 *
 * CLI:
 *   npx ts-node scripts/enrich-personalized-hook.ts \
 *     --pool output/leads/dental-v5-modern.json \
 *     --industry dental \
 *     --limit 20 \
 *     [--dry-run]
 *
 * Cost: roughly $0.002–$0.005 per lead at Claude Sonnet prices.
 * 1,400 leads ≈ $3–7 total. Cap via --limit during testing.
 *
 * Env required:
 *   ANTHROPIC_API_KEY — Claude API key
 */

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

interface Args {
  pool: string;
  industry: 'dental' | 'lawyer' | 'plumber' | 'hvac' | 'generic';
  limit: number;
  dryRun: boolean;
  concurrency: number;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string, fallback: string): string => {
    const i = a.indexOf(flag);
    return i >= 0 && a[i + 1] ? a[i + 1] : fallback;
  };
  const pool = get('--pool', 'output/leads/dental-v5-modern.json');
  const industry = (get('--industry', 'dental') as Args['industry']);
  const limit = parseInt(get('--limit', '20'), 10);
  const concurrency = parseInt(get('--concurrency', '3'), 10);
  const dryRun = a.includes('--dry-run');
  return { pool, industry, limit, dryRun, concurrency };
}

interface Lead {
  name: string;
  website?: string;
  email: string;
  city?: string;
  country?: string;
  personalizedHook?: string;
  [key: string]: any;
}

function stripHtml(html: string): string {
  // Strip script/style first
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Extract head title / meta description
  const title = cleaned.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '';
  const meta = cleaned.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  )?.[1] ?? '';
  const h1 = cleaned.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] ?? '';
  // Strip tags from body
  const body = cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const firstChunk = body.slice(0, 500);
  return [
    title && `TITLE: ${title.trim()}`,
    meta && `META: ${meta.trim()}`,
    h1 && `H1: ${h1.trim()}`,
    `BODY-SAMPLE: ${firstChunk}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function fetchSite(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; smartflowdev-research/1.0; +https://smartflowdev.com)',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    return stripHtml(html);
  } catch {
    return '';
  }
}

const INDUSTRY_CONTEXT: Record<string, string> = {
  dental: 'a dental practice',
  lawyer: 'a law firm',
  plumber: 'a plumbing contractor',
  hvac: 'an HVAC contractor',
  generic: 'a local service business',
};

async function generateHook(
  anthropic: Anthropic,
  industry: string,
  companyName: string,
  siteContent: string
): Promise<string> {
  const biz = INDUSTRY_CONTEXT[industry] ?? INDUSTRY_CONTEXT.generic;
  const prompt = `You are writing ONE sentence for a cold email opener. The recipient runs ${biz} called "${companyName}".

Below is what their website says (title, meta description, h1, body sample). Write ONE specific observation about their business that shows I actually looked at the site — something they'd notice if they read it. Not "your site is old" or "I noticed you help clients". Something specific.

Constraints:
- MAX 25 words
- Start with a verb or "Your ..."
- Include ONE specific detail from the site (a service mentioned, a location, a tagline, a niche)
- Do NOT mention their website URL
- Do NOT use "I noticed", "I saw" (too cliché) — just state the observation
- Neutral tone, not salesy

Website content:
${siteContent || '(site unavailable — use generic industry observation)'}

Output JUST the sentence. No quotes, no preamble.`;

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = res.content[0];
  if (block.type !== 'text') return '';
  return block.text.trim().replace(/^["']|["']$/g, '');
}

async function processLeadsInBatches<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<void>
): Promise<void> {
  const queue = items.map((item, idx) => ({ item, idx }));
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      await fn(next.item, next.idx);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const args = parseArgs();

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('❌ ANTHROPIC_API_KEY missing. Set it first.');
    process.exit(1);
  }
  const anthropic = new Anthropic({ apiKey: key });

  const poolPath = path.resolve(process.cwd(), args.pool);
  if (!fs.existsSync(poolPath)) {
    console.error(`❌ Pool not found: ${poolPath}`);
    process.exit(1);
  }

  const leads: Lead[] = JSON.parse(fs.readFileSync(poolPath, 'utf-8'));
  console.log(`📋 Loaded ${leads.length} leads from ${args.pool}`);

  const needHook = leads.filter(
    (l) => !l.personalizedHook && l.website
  );
  console.log(`   ${needHook.length} need a hook (skipping ${leads.length - needHook.length} already done or without website)`);

  const targets = needHook.slice(0, args.limit);
  console.log(`   Processing ${targets.length} this run (limit ${args.limit})\n`);

  if (args.dryRun) {
    console.log('🧪 DRY RUN — no API calls, no file writes.\n');
    targets.slice(0, 5).forEach((l) => console.log(`   would-process: ${l.name} (${l.website})`));
    return;
  }

  let done = 0;
  let errors = 0;

  await processLeadsInBatches(targets, args.concurrency, async (lead) => {
    try {
      const content = lead.website ? await fetchSite(lead.website) : '';
      const hook = await generateHook(anthropic, args.industry, lead.name, content);
      if (hook && hook.length < 300) {
        lead.personalizedHook = hook;
        done += 1;
        console.log(`✓ ${lead.name}: ${hook}`);
      } else {
        errors += 1;
        console.log(`⚠️  ${lead.name}: empty/oversized hook, skipping`);
      }
    } catch (err: any) {
      errors += 1;
      console.log(`✗ ${lead.name}: ${err?.message ?? err}`);
    }
    // Flush to disk every 5 successes so we don't lose progress
    if (done > 0 && done % 5 === 0) {
      fs.writeFileSync(poolPath, JSON.stringify(leads, null, 2));
    }
  });

  fs.writeFileSync(poolPath, JSON.stringify(leads, null, 2));

  console.log('');
  console.log(`✅ Done. ${done} hooks generated, ${errors} errors, ${targets.length - done - errors} skipped.`);
  console.log(`   Pool updated: ${args.pool}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
