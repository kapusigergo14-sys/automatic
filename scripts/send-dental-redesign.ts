/**
 * SEND DENTAL REDESIGN — website redesign pitch to outdated dental sites.
 *
 * Mirror of send-dental-v5.ts with three differences:
 *   1. Imports from email-bodies-redesign.ts (redesign subject/body)
 *   2. Reads dental-v5-outdated.json + writes send-state-v5-outdated.json
 *   3. Loads smartflowdev-dental-proposal-redesign-en.pdf (hardcoded, not per-market)
 *
 * Pipeline:
 * 1. Load qualified outdated leads from dental-v5-outdated.json
 * 2. Load v4 + v5-modern + v5-outdated send-states for cross-dedup
 * 3. Load static redesign PDF → base64 ONCE
 * 4. For each lead (rate-limited):
 *    - Rotate subject (3 variants, English only in v1)
 *    - Fill body template
 *    - Attach cached redesign PDF
 *    - Send via Resend API
 *    - Append to send-state-v5-outdated.json
 *
 * CLI (identical flags to send-dental-v5.ts):
 *   npx ts-node scripts/send-dental-redesign.ts [--limit 10] [--spread-minutes 60] [--dry-run]
 *
 * Local-only — no GitHub Actions workflow. User runs manually.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { getMarket, parseMarketList } from './markets';
import { pickSubject, buildBody } from './email-bodies-redesign';
import type { LangCode } from './markets';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

if (!RESEND_API_KEY) {
  console.error('❌ Missing RESEND_API_KEY env var');
  process.exit(1);
}

// ─── Paths (redesign variant) ────────────────────────────────────────────

const LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-v5-outdated.json');
const V4_STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const V5_STATE_MODERN_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5.json');
const V5_STATE_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5-outdated.json');
const REDESIGN_PDF_PATH = path.resolve(
  __dirname,
  '../output/static/smartflowdev-dental-proposal-redesign-en.pdf'
);
const REDESIGN_PDF_FILENAME = 'SmartflowDev-Website-Redesign-Proposal.pdf';

interface V5Lead {
  name: string;
  website: string;
  phone?: string;
  city: string;
  country: string;
  email: string;
  hasBooking: boolean;
  modernScore: number;
  collectedAt: string;
}

// ── CLI ──
function parseArgs(): {
  dryRun: boolean;
  limit: number;
  spreadMinutes: number;
  gitCommitPerSend: boolean;
  markets: string[];
} {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit = Infinity;
  let spreadMinutes = 0;
  let gitCommitPerSend = false;
  let marketsRaw = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--spread-minutes' && args[i + 1]) { spreadMinutes = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--git-commit-per-send') gitCommitPerSend = true;
    if (args[i] === '--markets' && args[i + 1]) { marketsRaw = args[i + 1]; i++; }
  }
  const markets = parseMarketList(marketsRaw);
  return { dryRun, limit, spreadMinutes, gitCommitPerSend, markets };
}

// ── Spread delay helper ──
function computeSpreadDelayMs(spreadMinutes: number, limit: number): number {
  if (spreadMinutes <= 0 || limit <= 1) return 5000;
  const totalSec = spreadMinutes * 60;
  const avgSec = Math.floor(totalSec / limit);
  const minSec = Math.max(30, Math.floor(avgSec * 0.5));
  const maxSec = Math.max(minSec + 10, Math.floor(avgSec * 1.5));
  const sec = minSec + Math.random() * (maxSec - minSec);
  return Math.floor(sec * 1000);
}

// ── Git commit + push with retry ──
async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function commitAndPushState(email: string): Promise<void> {
  const relState = 'output/v5-campaign/send-state-v5-outdated.json';
  try {
    execSync(`git add ${relState}`, { stdio: 'pipe' });
    try {
      execSync('git diff --staged --quiet', { stdio: 'pipe' });
      return;
    } catch {
      // staged changes exist, proceed
    }
    execSync(
      `git -c commit.gpgsign=false commit -m "redesign send: ${email}" --no-verify`,
      { stdio: 'pipe' }
    );
    let pushErr: unknown = null;
    for (let i = 0; i < 3; i++) {
      try {
        execSync('git push origin HEAD', { stdio: 'pipe' });
        return;
      } catch (err) {
        pushErr = err;
        if (i < 2) await sleep(2000 * (i + 1));
      }
    }
    throw pushErr || new Error('git push failed');
  } catch (err: any) {
    throw new Error(`commit/push failed for ${email}: ${err?.message || err}`);
  }
}

// ── Company name cleanup (same as v5) ──
function cleanName(name: string): string {
  return name
    .replace(/\s*-\s*.*/g, '')
    .replace(/\s*\|.*/g, '')
    .replace(/[^\p{L}\p{N} &'.]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}

// ── Send via Resend ──
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  pdfBase64: string,
  pdfFilename: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Geri <geri@smartflowdev.com>',
        reply_to: 'kapusicsgo@gmail.com',
        to: [to],
        subject,
        html,
        attachments: [{ filename: pdfFilename, content: pdfBase64 }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as any;
    return { ok: true, id: data?.id };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

// ── Redesign PDF loader (hardcoded path, single cache) ──
let pdfCache: { base64: string; sizeKb: number } | null = null;
function loadRedesignPdf(): { base64: string; sizeKb: number } | null {
  if (pdfCache) return pdfCache;
  if (!fs.existsSync(REDESIGN_PDF_PATH)) {
    console.error(`❌ Redesign PDF not found: ${REDESIGN_PDF_PATH}`);
    console.error('   Run: npx ts-node scripts/generate-pdf-v5-redesign-en.ts');
    return null;
  }
  const buffer = fs.readFileSync(REDESIGN_PDF_PATH);
  pdfCache = {
    base64: buffer.toString('base64'),
    sizeKb: Math.round(buffer.length / 1024),
  };
  console.log(`📎 Redesign PDF loaded: ${pdfCache.sizeKb} KB`);
  return pdfCache;
}

// ── Main ──
async function main() {
  const { dryRun, limit, spreadMinutes, gitCommitPerSend, markets } = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DENTAL REDESIGN SEND — website redesign pitch (outdated)     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Mode:            ${dryRun ? '🔹 DRY RUN' : '📧 LIVE'}`);
  console.log(`  Limit:           ${limit === Infinity ? 'no limit' : limit}`);
  console.log(`  Spread minutes:  ${spreadMinutes || 'off (fixed 5s delay)'}`);
  console.log(`  Git per send:    ${gitCommitPerSend ? 'YES' : 'no'}`);
  console.log(`  Markets:         ${markets.join(', ')}`);
  console.log('');

  if (!fs.existsSync(LEADS_FILE)) {
    console.log('❌ No outdated leads file. Run `osm-collect-outdated.ts` first.');
    return;
  }
  const allLeads: V5Lead[] = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

  const marketSet = new Set(markets);
  const leads = allLeads.filter((l) => marketSet.has(l.country.toUpperCase()));
  console.log(`📋 Loaded ${allLeads.length} total outdated leads → ${leads.length} match selected markets`);

  // Load state for cross-dedup (v4 + v5 modern + v5 outdated)
  const skipEmails = new Set<string>();
  if (fs.existsSync(V4_STATE_FILE)) {
    const s = JSON.parse(fs.readFileSync(V4_STATE_FILE, 'utf-8'));
    for (const em of Object.keys(s)) skipEmails.add(em.toLowerCase());
  }
  if (fs.existsSync(V5_STATE_MODERN_FILE)) {
    const s = JSON.parse(fs.readFileSync(V5_STATE_MODERN_FILE, 'utf-8'));
    for (const em of Object.keys(s)) skipEmails.add(em.toLowerCase());
  }
  let outdatedState: Record<string, any> = {};
  if (fs.existsSync(V5_STATE_FILE)) {
    outdatedState = JSON.parse(fs.readFileSync(V5_STATE_FILE, 'utf-8'));
    for (const em of Object.keys(outdatedState)) skipEmails.add(em.toLowerCase());
  }
  console.log(`🔒 Dedup: ${skipEmails.size} already-sent emails will be skipped (modern + outdated + v4)\n`);

  // Load the redesign PDF once
  const pdf = loadRedesignPdf();
  if (!pdf) {
    console.error('❌ Cannot proceed without redesign PDF.');
    process.exit(1);
  }

  // Ensure state dir
  fs.mkdirSync(path.dirname(V5_STATE_FILE), { recursive: true });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < leads.length && sent < limit; i++) {
    const lead = leads[i];
    const emailLower = lead.email.toLowerCase();

    if (skipEmails.has(emailLower)) {
      skipped++;
      continue;
    }

    // Resolve market for this lead (mostly for lang — subject/body use 'en' currently)
    const market = getMarket(lead.country);
    if (!market) {
      console.log(`   ⚠️  Skipping ${lead.email} — no market config for country ${lead.country}`);
      skipped++;
      continue;
    }

    const company = cleanName(lead.name);
    const subject = pickSubject(sent, company, market.lang);
    const body = buildBody(company, market.lang);

    console.log(`[${sent + 1}/${Math.min(limit, leads.length - skipped)}] ${lead.name}`);
    console.log(`   📧 ${lead.email} · ${lead.city} ${lead.country} (modernScore ${lead.modernScore}/3)`);
    console.log(`   📝 Subject: ${subject}`);
    console.log(`   📎 Attach:  ${REDESIGN_PDF_FILENAME}`);

    if (dryRun) {
      console.log(`   🔹 DRY RUN — not sending`);
      sent++;
      console.log('');
      continue;
    }

    const result = await sendEmail(lead.email, subject, body, pdf.base64, REDESIGN_PDF_FILENAME);

    if (result.ok) {
      outdatedState[emailLower] = {
        sentAt: new Date().toISOString(),
        messageId: result.id,
        company: lead.name,
        subject,
        city: lead.city,
        country: lead.country,
        lang: market.lang,
        hasBooking: lead.hasBooking,
        modernScore: lead.modernScore,
        pitch: 'redesign',
      };
      fs.writeFileSync(V5_STATE_FILE, JSON.stringify(outdatedState, null, 2));
      skipEmails.add(emailLower);
      sent++;
      console.log(`   ✅ Sent — Message ID: ${result.id}`);

      if (gitCommitPerSend) {
        try {
          await commitAndPushState(emailLower);
          console.log(`   📦 State pushed to git`);
        } catch (err: any) {
          console.error(`   ❌ CRITICAL: ${err.message}`);
          console.error(`   Stopping to prevent duplicate risk on next run.`);
          process.exit(1);
        }
      }
    } else {
      failed++;
      console.log(`   ❌ Failed: ${result.error?.slice(0, 120)}`);
    }

    console.log('');

    if (sent < limit && i + 1 < leads.length) {
      const delayMs = spreadMinutes > 0 ? computeSpreadDelayMs(spreadMinutes, limit) : 5000;
      if (spreadMinutes > 0) {
        console.log(`   ⏱  next send in ${Math.round(delayMs / 1000)}s (spread mode)`);
      }
      await sleep(delayMs);
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DENTAL REDESIGN SEND COMPLETE                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Sent:    ${sent}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped} (dedup)`);
  console.log(`  State:   ${V5_STATE_FILE}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
