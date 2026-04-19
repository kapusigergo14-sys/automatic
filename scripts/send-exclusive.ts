/**
 * SEND EXCLUSIVE — 50%-off re-engagement blast to previous openers.
 *
 * Reads `output/v5-campaign/openers.json` (produced by
 * import-brevo-openers.ts) and sends each recipient a pitch-specific
 * exclusive offer with a per-recipient 72-hour deadline.
 *
 * CLI:
 *   npx ts-node scripts/send-exclusive.ts [--limit 50] [--dry-run]
 *   [--spread-minutes 60] [--git-commit-per-send]
 *
 * Dedup:
 *   - send-state-exclusive.json: one exclusive offer per email, ever
 *   - internal test addresses always skipped
 *
 * The `from` address is chosen per pitch:
 *   - chatbot / lawyer / plumber / hvac          → geri@smartflowdev.com
 *   - redesign                                   → studio@smartflowdev.com
 *
 * Each state row records the email's own `expiresAt` so we can audit
 * who got what deadline.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { pickSubject, buildBody, type Pitch } from './email-bodies-exclusive';
import type { LangCode } from './markets';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
if (!BREVO_API_KEY) {
  console.error('Missing BREVO_API_KEY env var');
  process.exit(1);
}

const OPENERS_FILE = path.resolve(__dirname, '../output/v5-campaign/openers.json');
const STATE_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-exclusive.json');

const OFFER_WINDOW_MS = 72 * 60 * 60 * 1000;

interface Opener {
  email: string;
  company: string;
  city: string;
  country: string;
  lang: LangCode;
  pitch: Pitch;
  firstOpenedAt: string;
  originalSubject: string;
  originalSentAt: string;
  hasFollowup: boolean;
}

interface StateEntry {
  sentAt: string;
  messageId?: string;
  company: string;
  subject: string;
  city: string;
  country: string;
  lang: LangCode;
  pitch: Pitch;
  expiresAt: string;
  originalSentAt: string;
}

// ── CLI ──────────────────────────────────────────────────────────────
function parseArgs() {
  const a = process.argv.slice(2);
  let dryRun = false;
  let limit = 50;
  let spreadMinutes = 0;
  let gitCommitPerSend = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--dry-run' || a[i] === '--dry') dryRun = true;
    if (a[i] === '--limit' && a[i + 1]) { limit = parseInt(a[i + 1], 10); i++; }
    if (a[i] === '--spread-minutes' && a[i + 1]) { spreadMinutes = parseInt(a[i + 1], 10); i++; }
    if (a[i] === '--git-commit-per-send') gitCommitPerSend = true;
  }
  return { dryRun, limit, spreadMinutes, gitCommitPerSend };
}

function senderFor(pitch: Pitch): { name: string; email: string } {
  if (pitch === 'redesign') return { name: 'Geri', email: 'studio@smartflowdev.com' };
  return { name: 'Geri', email: 'geri@smartflowdev.com' };
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function computeSpreadDelayMs(spreadMinutes: number, limit: number): number {
  if (spreadMinutes <= 0 || limit <= 1) return 5000;
  const totalSec = spreadMinutes * 60;
  const avgSec = Math.floor(totalSec / limit);
  const minSec = Math.max(30, Math.floor(avgSec * 0.5));
  const maxSec = Math.max(minSec + 10, Math.floor(avgSec * 1.5));
  return Math.floor((minSec + Math.random() * (maxSec - minSec)) * 1000);
}

async function commitAndPushState(email: string): Promise<void> {
  const relState = 'output/v5-campaign/send-state-exclusive.json';
  try {
    execSync(`git add ${relState}`, { stdio: 'pipe' });
    try {
      execSync('git diff --staged --quiet', { stdio: 'pipe' });
      return;
    } catch {
      // staged changes
    }
    execSync(
      `git -c commit.gpgsign=false commit -m "exclusive send: ${email}" --no-verify`,
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

async function sendEmail(
  fromName: string,
  fromEmail: string,
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
        sender: { name: fromName, email: fromEmail },
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

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const { dryRun, limit, spreadMinutes, gitCommitPerSend } = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  EXCLUSIVE SEND — 50% off re-engagement (72h deadline)        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Mode:            ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Limit:           ${limit}`);
  console.log(`  Spread minutes:  ${spreadMinutes || 'off (fixed 5s delay)'}`);
  console.log(`  Git per send:    ${gitCommitPerSend ? 'YES' : 'no'}`);
  console.log('');

  if (!fs.existsSync(OPENERS_FILE)) {
    console.error(`❌ ${OPENERS_FILE} not found. Run import-brevo-openers.ts first.`);
    process.exit(1);
  }
  const openers: Opener[] = JSON.parse(fs.readFileSync(OPENERS_FILE, 'utf-8'));
  console.log(`Loaded ${openers.length} openers`);

  // Dedup against send-state-exclusive.json
  const state: Record<string, StateEntry> = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
    : {};
  const skipEmails = new Set<string>(Object.keys(state).map((e) => e.toLowerCase()));
  console.log(`Dedup: ${skipEmails.size} already-sent exclusive emails will be skipped\n`);

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < openers.length && sent < limit; i++) {
    const op = openers[i];
    const email = op.email.toLowerCase();

    if (skipEmails.has(email)) { skipped++; continue; }
    if (email.includes('kapusicsgo') || email.includes('kapusigergo')) { skipped++; continue; }

    const expiresAt = new Date(Date.now() + OFFER_WINDOW_MS);
    const company = cleanName(op.company);
    const subject = pickSubject(sent, company, op.lang, expiresAt);
    const body = buildBody({ company, lang: op.lang, pitch: op.pitch, expiresAt });
    const from = senderFor(op.pitch);

    console.log(`[${sent + 1}/${Math.min(limit, openers.length - skipped)}] ${op.company}`);
    console.log(`   📧 ${email} · ${op.city} ${op.country} (${op.pitch})`);
    console.log(`   📝 Subject: ${subject.slice(0, 70)}`);
    console.log(`   ✉️  From: ${from.name} <${from.email}>`);
    console.log(`   ⏳ Expires: ${expiresAt.toISOString()}`);

    if (dryRun) {
      console.log(`   🔹 DRY RUN — not sending\n`);
      sent++;
      continue;
    }

    const result = await sendEmail(from.name, from.email, email, subject, body);

    if (result.ok) {
      state[email] = {
        sentAt: new Date().toISOString(),
        messageId: result.id,
        company: op.company,
        subject,
        city: op.city,
        country: op.country,
        lang: op.lang,
        pitch: op.pitch,
        expiresAt: expiresAt.toISOString(),
        originalSentAt: op.originalSentAt,
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      skipEmails.add(email);
      sent++;
      console.log(`   ✅ Sent — Message ID: ${result.id}`);

      if (gitCommitPerSend) {
        try {
          await commitAndPushState(email);
          console.log(`   State pushed to git`);
        } catch (err: any) {
          console.error(`   CRITICAL: ${err.message}`);
          console.error(`   Stopping to prevent duplicate risk on next run.`);
          process.exit(1);
        }
      }
    } else {
      failed++;
      console.log(`   ❌ Failed: ${result.error?.slice(0, 120)}`);
    }

    console.log('');

    if (sent < limit && i + 1 < openers.length) {
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
  console.log('║  EXCLUSIVE SEND COMPLETE                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Sent:    ${sent}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped} (dedup / test address)`);
  console.log(`  State:   ${STATE_FILE}`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
