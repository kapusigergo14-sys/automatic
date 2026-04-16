/**
 * send-followup.ts — Follow-up email sender for non-responders.
 *
 * Reads both send-state files (modern chatbot + redesign), finds leads
 * whose first email was sent 3+ days ago and who haven't received a
 * follow-up yet, then sends a short bump email (no attachment, no pitch
 * repeat, just a reminder).
 *
 * The follow-up uses "Re: [original subject]" to thread with the original
 * in the recipient's inbox, and the same sender address (geri@ for chatbot,
 * studio@ for redesign).
 *
 * CLI:
 *   npx ts-node scripts/send-followup.ts --min-days 3 --limit 50 [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
if (!RESEND_API_KEY) {
  console.error('❌ Missing RESEND_API_KEY env var');
  process.exit(1);
}

const V5_STATE_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5.json');
const V5_STATE_OUTDATED_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5-outdated.json');

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
}

// ── CLI ──
function parseArgs() {
  const args = process.argv.slice(2);
  let minDays = 3;
  let limit = 50;
  let spreadMinutes = 0;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--min-days' && args[i + 1]) { minDays = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--spread-minutes' && args[i + 1]) { spreadMinutes = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--dry-run') dryRun = true;
  }
  return { minDays, limit, spreadMinutes, dryRun };
}

// ── Follow-up body (short, no attachment, no pitch repeat) ──

function buildFollowupBody(company: string, pitch: 'chatbot' | 'redesign'): string {
  const c = company.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (pitch === 'redesign') {
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c},</p>
<p style="margin:0 0 14px 0">Bumping my note from earlier this week. Still happy to put together a free design concept for your practice &mdash; no strings attached.</p>
<p style="margin:0 0 14px 0">If it's not a good fit, no worries at all. Just reply "pass" and I'll stop reaching out.</p>
<p style="margin:0">&mdash; Geri</p>
</div>`;
  }

  // chatbot pitch follow-up
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c},</p>
<p style="margin:0 0 14px 0">Just wanted to bump my email from a few days ago. The offer still stands &mdash; I can install a 24/7 AI chatbot on your site in 48 hours.</p>
<p style="margin:0 0 14px 0">If the timing isn't right, totally fine. Just reply "not interested" and I'll stop reaching out.</p>
<p style="margin:0">&mdash; Geri</p>
</div>`;
}

// ── Company name cleanup ──
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
  from: string,
  to: string,
  subject: string,
  html: string,
  replyTo: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        reply_to: replyTo,
        to: [to],
        subject,
        html,
        // NO attachments — follow-up is clean text only
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

// ── Helpers ──
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
  const { minDays, limit, spreadMinutes, dryRun } = parseArgs();
  const now = Date.now();
  const minMs = minDays * 24 * 60 * 60 * 1000;

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  FOLLOW-UP SENDER — bump email for non-responders             ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Mode:         ${dryRun ? '🔹 DRY RUN' : '📧 LIVE'}`);
  console.log(`  Min days:     ${minDays}`);
  console.log(`  Limit:        ${limit}`);
  console.log(`  Spread:       ${spreadMinutes || 'off (fixed 5s delay)'}`);
  console.log('');

  // Load both state files
  interface QueueItem {
    email: string;
    entry: StateEntry;
    stateFile: string;
    fromAddr: string;
    pitch: 'chatbot' | 'redesign';
  }

  const queue: QueueItem[] = [];

  const loadState = (file: string, fromAddr: string, pitch: 'chatbot' | 'redesign') => {
    if (!fs.existsSync(file)) return;
    const state: Record<string, StateEntry> = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const [email, entry] of Object.entries(state)) {
      // Skip if already got follow-up
      if (entry.followup1SentAt) continue;
      // Skip test/internal emails
      if (email.includes('kapusicsgo') || email.includes('kapusigergo')) continue;
      // Skip if sent less than minDays ago
      const sentAt = new Date(entry.sentAt).getTime();
      if (now - sentAt < minMs) continue;
      queue.push({ email, entry, stateFile: file, fromAddr, pitch });
    }
  };

  loadState(V5_STATE_FILE, 'Geri <geri@smartflowdev.com>', 'chatbot');
  loadState(V5_STATE_OUTDATED_FILE, 'Geri <studio@smartflowdev.com>', 'redesign');

  console.log(`📋 Eligible for follow-up: ${queue.length} (sent ${minDays}+ days ago, no follow-up yet)`);
  const chatbotCount = queue.filter((q) => q.pitch === 'chatbot').length;
  const redesignCount = queue.filter((q) => q.pitch === 'redesign').length;
  console.log(`   Chatbot pitch (geri@):     ${chatbotCount}`);
  console.log(`   Redesign pitch (studio@):  ${redesignCount}\n`);

  if (queue.length === 0) {
    console.log('⏭️  Nobody to follow up yet. Wait for --min-days to elapse.');
    return;
  }

  // Sort: oldest first
  queue.sort((a, b) => new Date(a.entry.sentAt).getTime() - new Date(b.entry.sentAt).getTime());

  const batch = queue.slice(0, limit);
  let sent = 0;
  let failed = 0;

  // Load states for mutation
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
    const subject = `Re: ${q.entry.subject}`;
    const body = buildFollowupBody(company, q.pitch);

    console.log(`[${sent + 1}/${batch.length}] ${q.entry.company}`);
    console.log(`   📧 ${q.email} · ${q.entry.city} ${q.entry.country} (${q.pitch})`);
    console.log(`   📝 Subject: ${subject.slice(0, 70)}`);
    console.log(`   ✉️  From: ${q.fromAddr}`);

    if (dryRun) {
      console.log(`   🔹 DRY RUN — not sending\n`);
      sent++;
      continue;
    }

    const result = await sendEmail(q.fromAddr, q.email, subject, body, 'kapusicsgo@gmail.com');

    if (result.ok) {
      sent++;
      console.log(`   ✅ Sent follow-up — Message ID: ${result.id}`);

      // Update state
      const state = loadMutable(q.stateFile);
      if (state[q.email]) {
        state[q.email].followup1SentAt = new Date().toISOString();
        state[q.email].followup1MessageId = result.id;
        fs.writeFileSync(q.stateFile, JSON.stringify(state, null, 2));
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
  console.log('║  FOLLOW-UP SEND COMPLETE                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Sent:    ${sent}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  States:  ${V5_STATE_FILE}`);
  console.log(`           ${V5_STATE_OUTDATED_FILE}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
