/**
 * send-followup.ts — 3-step follow-up sequence for non-responders.
 *
 * Step 1 (day 0):  original cold email — handled by send-{industry}.ts
 * Step 2 (day 3):  bump — "Did this get buried?"  — set with --day 3 (default)
 * Step 3 (day 7):  breakup — "Last one for {company}" — set with --day 7
 *
 * Reads all 5 state files (dental chatbot, dental redesign, lawyer, plumber,
 * hvac), filters by elapsed time + previous-step requirement, sends via Brevo,
 * then writes followup{1|2}SentAt back into the state file.
 *
 * The follow-up uses "Re: [original subject]" or "Last one for {company}"
 * to thread with the original in the recipient's inbox, and the same sender
 * address (geri@ for chatbot pitches, studio@ for redesign).
 *
 * CLI:
 *   npx ts-node scripts/send-followup.ts --day 3 --limit 50 [--dry-run]
 *   npx ts-node scripts/send-followup.ts --day 7 --limit 50 [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
if (!BREVO_API_KEY) {
  console.error('❌ Missing BREVO_API_KEY env var');
  process.exit(1);
}

interface StateEntry {
  sentAt: string;
  messageId: string;
  company: string;
  subject: string;
  city: string;
  country: string;
  lang?: string;
  pitch?: string;
  followup1SentAt?: string;
  followup1MessageId?: string;
  followup2SentAt?: string;
  followup2MessageId?: string;
}

type Pitch = 'chatbot' | 'redesign' | 'lawyer' | 'plumber' | 'hvac';
type Step = 1 | 2;

interface StateSource {
  file: string;
  fromAddr: string;
  pitch: Pitch;
}

const STATE_DIR = path.resolve(__dirname, '../output/v5-campaign');

const STATE_SOURCES: StateSource[] = [
  { file: path.join(STATE_DIR, 'send-state-v5.json'),         fromAddr: 'Geri <geri@smartflowdev.com>',   pitch: 'chatbot'  },
  { file: path.join(STATE_DIR, 'send-state-v5-outdated.json'), fromAddr: 'Geri <studio@smartflowdev.com>', pitch: 'redesign' },
  { file: path.join(STATE_DIR, 'send-state-lawyer.json'),     fromAddr: 'Geri <geri@smartflowdev.com>',   pitch: 'lawyer'   },
  { file: path.join(STATE_DIR, 'send-state-plumber.json'),    fromAddr: 'Geri <geri@smartflowdev.com>',   pitch: 'plumber'  },
  { file: path.join(STATE_DIR, 'send-state-hvac.json'),       fromAddr: 'Geri <geri@smartflowdev.com>',   pitch: 'hvac'     },
];

// ── CLI ──
function parseArgs() {
  const args = process.argv.slice(2);
  let day = 3;
  let limit = 50;
  let spreadMinutes = 0;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--day' && args[i + 1]) { day = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--min-days' && args[i + 1]) { day = parseInt(args[i + 1], 10); i++; } // legacy alias
    if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--spread-minutes' && args[i + 1]) { spreadMinutes = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--dry-run') dryRun = true;
  }
  // Map day to step: 3 → step 1 (bump), 7+ → step 2 (breakup)
  const step: Step = day >= 7 ? 2 : 1;
  return { day, step, limit, spreadMinutes, dryRun };
}

// ── Bodies ──

function landingFor(pitch: Pitch): string {
  switch (pitch) {
    case 'chatbot':  return 'https://smartflowdev.com/chatbot';
    case 'redesign': return 'https://smartflowdev.com/proposal';
    case 'lawyer':   return 'https://smartflowdev.com/lawyer';
    case 'plumber':  return 'https://smartflowdev.com/plumber';
    case 'hvac':     return 'https://smartflowdev.com/hvac';
  }
}

function buildBumpBody(company: string, pitch: Pitch): string {
  const c = company.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const link = landingFor(pitch);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c},</p>
<p style="margin:0 0 14px 0">Did this get buried? Worth 10 minutes this week if you're open to it.</p>
<p style="margin:0 0 14px 0">Reply <strong>Y</strong> for a quick call, <strong>N</strong> if not the right time.</p>
<p style="margin:0">&mdash; Geri<br><a href="${link}" style="color:#1B1B1F;text-decoration:underline">${link.replace('https://', '')}</a></p>
</div>`;
}

function buildBreakupBody(company: string, pitch: Pitch): string {
  const c = company.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const link = landingFor(pitch);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c},</p>
<p style="margin:0 0 14px 0">Last one — closing your file unless you want this. No hard feelings either way.</p>
<p style="margin:0 0 14px 0">If timing changes, just reply to any of these emails. The offer at <a href="${link}" style="color:#1B1B1F">${link.replace('https://', '')}</a> stays open.</p>
<p style="margin:0">&mdash; Geri</p>
</div>`;
}

function buildSubject(originalSubject: string, company: string, step: Step): string {
  if (step === 1) return `Re: ${originalSubject}`;
  return `Last one for ${company}`;
}

// ── Helpers ──
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
  from: string,
  to: string,
  subject: string,
  html: string,
  replyTo: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  const fromName = match ? match[1].trim() : 'Geri';
  const fromEmail = match ? match[2].trim() : from;

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
        replyTo: { email: replyTo },
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

async function sleep(ms: number): Promise<void> {
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

// ── Main ──
async function main() {
  const { day, step, limit, spreadMinutes, dryRun } = parseArgs();
  const now = Date.now();
  const minMs = day * 24 * 60 * 60 * 1000;

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log(`║  FOLLOW-UP SENDER — step ${step} (${step === 1 ? 'bump' : 'breakup'})${' '.repeat(step === 1 ? 27 : 24)}║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Mode:         ${dryRun ? '🔹 DRY RUN' : '📧 LIVE'}`);
  console.log(`  Min days:     ${day}`);
  console.log(`  Limit:        ${limit}`);
  console.log(`  Spread:       ${spreadMinutes || 'off (fixed 5s delay)'}`);
  console.log('');

  interface QueueItem {
    email: string;
    entry: StateEntry;
    src: StateSource;
  }

  const queue: QueueItem[] = [];

  for (const src of STATE_SOURCES) {
    if (!fs.existsSync(src.file)) continue;
    let state: Record<string, StateEntry>;
    try {
      state = JSON.parse(fs.readFileSync(src.file, 'utf-8'));
    } catch {
      console.warn(`⚠️  Could not parse ${src.file}, skipping`);
      continue;
    }
    for (const [email, entry] of Object.entries(state)) {
      // Skip test/internal emails
      if (email.includes('kapusicsgo') || email.includes('kapusigergo')) continue;

      const sentAt = new Date(entry.sentAt).getTime();
      if (now - sentAt < minMs) continue;

      if (step === 1) {
        // Bump: needs no prior follow-up
        if (entry.followup1SentAt) continue;
      } else {
        // Breakup: needs followup1 already sent and no followup2 yet
        if (!entry.followup1SentAt) continue;
        if (entry.followup2SentAt) continue;
      }

      queue.push({ email, entry, src });
    }
  }

  console.log(`📋 Eligible for step ${step}: ${queue.length}`);
  for (const src of STATE_SOURCES) {
    const n = queue.filter((q) => q.src.pitch === src.pitch).length;
    if (n > 0) console.log(`   ${src.pitch.padEnd(10)} (${src.fromAddr.replace(/^.*</, '').replace('>', '').padEnd(28)}): ${n}`);
  }
  console.log('');

  if (queue.length === 0) {
    console.log(`⏭️  Nobody eligible for step ${step}. Wait for elapsed time, or step 1 must run first for step 2 candidates.`);
    return;
  }

  // Oldest first
  queue.sort((a, b) => new Date(a.entry.sentAt).getTime() - new Date(b.entry.sentAt).getTime());
  const batch = queue.slice(0, limit);

  let sent = 0;
  let failed = 0;

  // Cache mutated states for write-back
  const states: Record<string, Record<string, StateEntry>> = {};
  const loadMutable = (file: string) => {
    if (!states[file]) {
      states[file] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
    }
    return states[file];
  };

  for (let i = 0; i < batch.length; i++) {
    const q = batch[i];
    const company = cleanName(q.entry.company);
    const subject = buildSubject(q.entry.subject, company, step);
    const body = step === 1
      ? buildBumpBody(company, q.src.pitch)
      : buildBreakupBody(company, q.src.pitch);

    console.log(`[${sent + 1}/${batch.length}] ${q.entry.company}`);
    console.log(`   📧 ${q.email} · ${q.entry.city} ${q.entry.country} (${q.src.pitch})`);
    console.log(`   📝 Subject: ${subject.slice(0, 70)}`);
    console.log(`   ✉️  From: ${q.src.fromAddr}`);

    if (dryRun) {
      console.log(`   🔹 DRY RUN — not sending\n`);
      sent++;
      continue;
    }

    const result = await sendEmail(q.src.fromAddr, q.email, subject, body, 'kapusicsgo@gmail.com');

    if (result.ok) {
      sent++;
      console.log(`   ✅ Sent — Message ID: ${result.id}`);

      const state = loadMutable(q.src.file);
      if (state[q.email]) {
        if (step === 1) {
          state[q.email].followup1SentAt = new Date().toISOString();
          state[q.email].followup1MessageId = result.id;
        } else {
          state[q.email].followup2SentAt = new Date().toISOString();
          state[q.email].followup2MessageId = result.id;
        }
        fs.writeFileSync(q.src.file, JSON.stringify(state, null, 2));
      }
    } else {
      failed++;
      console.log(`   ❌ Failed: ${result.error?.slice(0, 120)}`);
    }

    console.log('');

    if (i + 1 < batch.length) {
      const delayMs = spreadMinutes > 0 ? computeSpreadDelayMs(spreadMinutes, limit) : 5000;
      if (spreadMinutes > 0) {
        console.log(`   ⏱  next in ${Math.round(delayMs / 1000)}s (spread mode)`);
      }
      await sleep(delayMs);
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log(`║  FOLLOW-UP STEP ${step} COMPLETE${' '.repeat(43)}║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Sent:    ${sent}`);
  console.log(`  Failed:  ${failed}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
