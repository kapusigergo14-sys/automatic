/**
 * SEND PLUMBER — chatbot pitch to modern plumbing service sites.
 *
 * Pipeline:
 * 1. Load qualified plumber leads from plumber-modern.json
 * 2. Load send-state for dedup
 * 3. For each lead (rate-limited):
 *    - Rotate subject (3 variants)
 *    - Fill body template with {Company}
 *    - Send via Brevo API
 *    - Append to send-state-plumber.json
 *
 * CLI:
 *   npx ts-node scripts/send-plumber.ts [--limit 30] [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { getMarket, parseMarketList } from './markets';
import { pickSubject, buildBody } from './email-bodies-plumber';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

if (!BREVO_API_KEY) {
  console.error('Missing BREVO_API_KEY env var');
  process.exit(1);
}

const LEADS_FILE = path.resolve(__dirname, '../output/leads/plumber-modern.json');
const V5_STATE_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-plumber.json');

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

function computeSpreadDelayMs(spreadMinutes: number, limit: number): number {
  if (spreadMinutes <= 0 || limit <= 1) return 5000;
  const totalSec = spreadMinutes * 60;
  const avgSec = Math.floor(totalSec / limit);
  const minSec = Math.max(30, Math.floor(avgSec * 0.5));
  const maxSec = Math.max(minSec + 10, Math.floor(avgSec * 1.5));
  const sec = minSec + Math.random() * (maxSec - minSec);
  return Math.floor(sec * 1000);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function commitAndPushState(email: string): Promise<void> {
  const relState = 'output/v5-campaign/send-state-plumber.json';
  try {
    execSync(`git add ${relState}`, { stdio: 'pipe' });
    try {
      execSync('git diff --staged --quiet', { stdio: 'pipe' });
      return;
    } catch {
      // staged changes present
    }
    execSync(
      `git -c commit.gpgsign=false commit -m "plumber send: ${email}" --no-verify`,
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
    const data = (await res.json()) as any;
    return { ok: true, id: data?.messageId };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function main() {
  const { dryRun, limit, spreadMinutes, gitCommitPerSend, markets } = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  PLUMBER CHATBOT SEND — plumbing service pitch                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Mode:            ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Limit:           ${limit === Infinity ? 'no limit' : limit}`);
  console.log(`  Spread minutes:  ${spreadMinutes || 'off (fixed 5s delay)'}`);
  console.log(`  Git per send:    ${gitCommitPerSend ? 'YES' : 'no'}`);
  console.log(`  Markets:         ${markets.join(', ')}`);
  console.log('');

  if (!fs.existsSync(LEADS_FILE)) {
    console.log('No leads file. Run `osm-collect.ts --industry plumber` first.');
    return;
  }
  const allLeads: V5Lead[] = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  const marketSet = new Set(markets);
  const leads = allLeads.filter((l) => marketSet.has(l.country.toUpperCase()));
  console.log(`Loaded ${allLeads.length} total qualified leads -> ${leads.length} match selected markets`);

  const skipEmails = new Set<string>();
  let v5State: Record<string, any> = {};
  if (fs.existsSync(V5_STATE_FILE)) {
    v5State = JSON.parse(fs.readFileSync(V5_STATE_FILE, 'utf-8'));
    for (const em of Object.keys(v5State)) skipEmails.add(em.toLowerCase());
  }
  console.log(`Dedup: ${skipEmails.size} already-sent emails will be skipped\n`);

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

    const market = getMarket(lead.country);
    if (!market) {
      console.log(`   Skipping ${lead.email} — no market config for country ${lead.country}`);
      skipped++;
      continue;
    }

    const company = cleanName(lead.name);
    const subject = pickSubject(sent, company, market.lang);
    const body = buildBody(company, market.lang);

    console.log(`[${sent + 1}/${Math.min(limit, leads.length - skipped)}] ${lead.name}`);
    console.log(`   ${lead.email} · ${lead.city} ${lead.country}`);
    console.log(`   Subject: ${subject}`);

    if (dryRun) {
      console.log(`   DRY RUN — not sending`);
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
        pitch: 'plumber',
      };
      fs.writeFileSync(V5_STATE_FILE, JSON.stringify(v5State, null, 2));
      skipEmails.add(emailLower);
      sent++;
      console.log(`   Sent — Message ID: ${result.id}`);

      if (gitCommitPerSend) {
        try {
          await commitAndPushState(emailLower);
          console.log(`   State pushed to git`);
        } catch (err: any) {
          console.error(`   CRITICAL: ${err.message}`);
          console.error(`   Stopping to prevent duplicate risk on next run.`);
          process.exit(1);
        }
      }
    } else {
      failed++;
      console.log(`   Failed: ${result.error?.slice(0, 120)}`);
    }

    console.log('');

    if (sent < limit && i + 1 < leads.length) {
      const delayMs = spreadMinutes > 0
        ? computeSpreadDelayMs(spreadMinutes, limit)
        : 5000;
      if (spreadMinutes > 0) {
        console.log(`   next send in ${Math.round(delayMs / 1000)}s (spread mode)`);
      }
      await sleep(delayMs);
    }
  }

  if (sent > 0 && !dryRun) {
    const remaining = allLeads.filter((l) => !skipEmails.has(l.email.toLowerCase()));
    fs.writeFileSync(LEADS_FILE, JSON.stringify(remaining, null, 2));
    console.log(`\nPool cleaned: ${allLeads.length} -> ${remaining.length} leads (${allLeads.length - remaining.length} removed)`);
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  PLUMBER CHATBOT SEND COMPLETE                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Sent:    ${sent}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped} (dedup)`);
  console.log(`  State:   ${V5_STATE_FILE}`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
