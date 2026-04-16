/**
 * SEND DENTAL v5 — chatbot add-on pitch to modern dental sites.
 *
 * Pipeline:
 * 1. Load qualified v5 leads from dental-v5-modern.json
 * 2. Load v4 send-state + v5 send-state for cross-dedup
 * 3. Load static PDF (smartflowdev-dental-proposal.pdf) → base64 ONCE
 * 4. For each lead (rate-limited 5 sec):
 *    - Rotate subject (3 variants)
 *    - Fill body template with {Company}
 *    - Attach cached PDF
 *    - Send via Resend API
 *    - Append to send-state-v5.json
 *
 * No per-lead PDF generation. One file, many recipients.
 *
 * CLI:
 *   npx ts-node scripts/send-dental-v5.ts [--limit 30] [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { getMarket, parseMarketList } from './markets';
import { pickSubject, buildBody } from './email-bodies';
import type { LangCode } from './markets';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

if (!BREVO_API_KEY) {
  console.error('❌ Missing BREVO_API_KEY env var');
  process.exit(1);
}

const LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-v5-modern.json');
const V4_STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const V5_STATE_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5.json');
const STATIC_PDF_DIR = path.resolve(__dirname, '../output/static');

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
  return new Promise(r => setTimeout(r, ms));
}

async function commitAndPushState(email: string): Promise<void> {
  const relState = 'output/v5-campaign/send-state-v5.json';
  try {
    execSync(`git add ${relState}`, { stdio: 'pipe' });
    // Only commit if there are staged changes
    try {
      execSync('git diff --staged --quiet', { stdio: 'pipe' });
      // No staged changes — nothing to commit, skip
      return;
    } catch {
      // There are staged changes, proceed
    }
    execSync(
      `git -c commit.gpgsign=false commit -m "v5 send: ${email}" --no-verify`,
      { stdio: 'pipe' }
    );
    // Push with 3 retries, exponential backoff
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

// ── HTML escape ──
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Company name cleanup ──
function cleanName(name: string): string {
  return name
    .replace(/\s*-\s*.*/g, '')       // drop " - tagline" after dash
    .replace(/\s*\|.*/g, '')          // drop after pipe
    // Keep ASCII + extended Latin (HU/DE/ES/FR diacritics) + space + a few punctuation
    .replace(/[^\p{L}\p{N} &'.]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}

// (Subject + body now come from email-bodies.ts via pickSubject/buildBody imports)

// ── Send via Brevo ──
async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Geri', email: 'geri@smartflowdev.com' },
        to: [{ email: to }],
        replyTo: { email: 'kapusicsgo@gmail.com' },
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = await res.json() as any;
    return { ok: true, id: data?.messageId };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

// ── Main ──
async function main() {
  const { dryRun, limit, spreadMinutes, gitCommitPerSend, markets } = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DENTAL v5 SEND — chatbot pitch (static PDF, multi-market)    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Mode:            ${dryRun ? '🔹 DRY RUN' : '📧 LIVE'}`);
  console.log(`  Limit:           ${limit === Infinity ? 'no limit' : limit}`);
  console.log(`  Spread minutes:  ${spreadMinutes || 'off (fixed 5s delay)'}`);
  console.log(`  Git per send:    ${gitCommitPerSend ? 'YES' : 'no'}`);
  console.log(`  Markets:         ${markets.join(', ')}`);
  console.log('');

  // Load leads
  if (!fs.existsSync(LEADS_FILE)) {
    console.log('❌ No leads file. Run `auto-dental-v5-collect.ts` first.');
    return;
  }
  const allLeads: V5Lead[] = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

  // Filter leads by selected markets
  const marketSet = new Set(markets);
  const leads = allLeads.filter((l) => marketSet.has(l.country.toUpperCase()));
  console.log(`📋 Loaded ${allLeads.length} total qualified leads → ${leads.length} match selected markets`);

  // Load state for cross-dedup
  const skipEmails = new Set<string>();
  if (fs.existsSync(V4_STATE_FILE)) {
    const s = JSON.parse(fs.readFileSync(V4_STATE_FILE, 'utf-8'));
    for (const em of Object.keys(s)) skipEmails.add(em.toLowerCase());
  }
  let v5State: Record<string, any> = {};
  if (fs.existsSync(V5_STATE_FILE)) {
    v5State = JSON.parse(fs.readFileSync(V5_STATE_FILE, 'utf-8'));
    for (const em of Object.keys(v5State)) skipEmails.add(em.toLowerCase());
  }
  console.log(`🔒 Dedup: ${skipEmails.size} already-sent emails will be skipped\n`);

  // Load PDFs once per language (lazy cache)
  const pdfCache = new Map<LangCode, { base64: string; sizeKb: number }>();
  function loadPdf(lang: LangCode, pdfFile: string): { base64: string; sizeKb: number } | null {
    if (pdfCache.has(lang)) return pdfCache.get(lang)!;
    const fullPath = path.join(STATIC_PDF_DIR, pdfFile);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ PDF missing for lang=${lang}: ${fullPath}`);
      return null;
    }
    const buffer = fs.readFileSync(fullPath);
    const cached = {
      base64: buffer.toString('base64'),
      sizeKb: Math.round(buffer.length / 1024),
    };
    pdfCache.set(lang, cached);
    console.log(`📎 PDF loaded for lang=${lang}: ${cached.sizeKb} KB`);
    return cached;
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

    // Resolve market for this lead
    const market = getMarket(lead.country);
    if (!market) {
      console.log(`   ⚠️  Skipping ${lead.email} — no market config for country ${lead.country}`);
      skipped++;
      continue;
    }

    // Load PDF for this lang (cached)
    const pdf = loadPdf(market.lang, market.pdfFile);
    if (!pdf) {
      console.log(`   ❌ Skipping ${lead.email} — PDF unavailable`);
      failed++;
      continue;
    }

    const company = cleanName(lead.name);
    const subject = pickSubject(sent, company, market.lang);
    const body = buildBody(company, market.lang);
    const pdfFilename = market.pdfFilename;

    console.log(`[${sent + 1}/${Math.min(limit, leads.length - skipped)}] ${lead.name}`);
    console.log(`   📧 ${lead.email} · ${lead.city} ${lead.country}`);
    console.log(`   📝 Subject: ${subject}`);
    console.log(`   📎 Attach:  ${pdfFilename}`);

    if (dryRun) {
      console.log(`   🔹 DRY RUN — not sending`);
      sent++;
      console.log('');
      continue;
    }

    const result = await sendEmail(lead.email, subject, body);

    if (result.ok) {
      v5State[emailLower] = {
        sentAt: new Date().toISOString(),
        messageId: result.id,
        company: lead.name,
        subject,
        city: lead.city,
        country: lead.country,
        lang: market.lang,
        hasBooking: lead.hasBooking,
        modernScore: lead.modernScore,
      };
      fs.writeFileSync(V5_STATE_FILE, JSON.stringify(v5State, null, 2));
      skipEmails.add(emailLower);
      sent++;
      console.log(`   ✅ Sent — Message ID: ${result.id}`);

      // Per-send git commit + push (critical for GHA dedup safety)
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

    // Delay between sends
    if (sent < limit && i + 1 < leads.length) {
      const delayMs = spreadMinutes > 0
        ? computeSpreadDelayMs(spreadMinutes, limit)
        : 5000;
      if (spreadMinutes > 0) {
        console.log(`   ⏱  next send in ${Math.round(delayMs / 1000)}s (spread mode)`);
      }
      await sleep(delayMs);
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DENTAL v5 SEND COMPLETE                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Sent:    ${sent}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped} (dedup)`);
  console.log(`  State:   ${V5_STATE_FILE}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
