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

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

if (!RESEND_API_KEY) {
  console.error('❌ Missing RESEND_API_KEY env var');
  process.exit(1);
}

const LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-v5-modern.json');
const V4_STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const V5_STATE_FILE = path.resolve(__dirname, '../output/v5-campaign/send-state-v5.json');
const STATIC_PDF_PATH = path.resolve(__dirname, '../output/static/smartflowdev-dental-proposal.pdf');

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
} {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit = Infinity;
  let spreadMinutes = 0;
  let gitCommitPerSend = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--spread-minutes' && args[i + 1]) { spreadMinutes = parseInt(args[i + 1], 10); i++; }
    if (args[i] === '--git-commit-per-send') gitCommitPerSend = true;
  }
  return { dryRun, limit, spreadMinutes, gitCommitPerSend };
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
    .replace(/[^a-zA-Z0-9 &'.]/g, '') // strip odd chars
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ');
}

// ── Subject rotation ──
const SUBJECT_VARIANTS = [
  (company: string) => `Quick chatbot idea for ${company}`,
  (company: string) => `${company} — missing chatbot?`,
  (company: string) => `Noticed something about ${company}'s site`,
];

function pickSubject(idx: number, company: string): string {
  return SUBJECT_VARIANTS[idx % SUBJECT_VARIANTS.length](company);
}

// ── Email body template ──
function buildBodyHtml(company: string): string {
  const c = esc(company);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.6;font-size:15px">
<p style="margin:0 0 14px 0">Hi ${c} team,</p>

<p style="margin:0 0 14px 0">Geri here &mdash; I build AI chatbots for dental practices.</p>

<p style="margin:0 0 14px 0">Your site actually looks solid, but there's no chatbot yet &mdash; which is probably costing you a few patients a month in after-hours inquiries.</p>

<p style="margin:0 0 14px 0">I can install a branded one on your site in <strong>48 hours</strong>, everything included. Short overview attached as a PDF.</p>

<p style="margin:0 0 14px 0">If it's interesting, just reply. If not, no worries &mdash; delete this and I'll stop reaching out.</p>

<p style="margin:0 0 18px 0">Cheers,<br><strong>Geri</strong> &middot; <a href="https://smartflowdev.com" style="color:#6366F1;text-decoration:none">smartflowdev.com</a></p>

<p style="margin:0">
  <a href="https://smartflowdev.com" style="display:block;text-decoration:none">
    <img src="https://www.smartflowdev.com/chatbot-preview.png" alt="AI Chatbot Proposal — smartflowdev" width="420" style="display:block;width:100%;max-width:420px;height:auto;border-radius:10px;border:1px solid #e4e4e7" />
  </a>
</p>
</div>`;
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
        'Authorization': `Bearer ${RESEND_API_KEY}`,
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
    const data = await res.json() as any;
    return { ok: true, id: data?.id };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

// ── Main ──
async function main() {
  const { dryRun, limit, spreadMinutes, gitCommitPerSend } = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DENTAL v5 SEND — chatbot pitch (static PDF)                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Mode:            ${dryRun ? '🔹 DRY RUN' : '📧 LIVE'}`);
  console.log(`  Limit:           ${limit === Infinity ? 'no limit' : limit}`);
  console.log(`  Spread minutes:  ${spreadMinutes || 'off (fixed 5s delay)'}`);
  console.log(`  Git per send:    ${gitCommitPerSend ? 'YES' : 'no'}`);
  console.log('');

  // Load leads
  if (!fs.existsSync(LEADS_FILE)) {
    console.log('❌ No leads file. Run `auto-dental-v5-collect.ts` first.');
    return;
  }
  const leads: V5Lead[] = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  console.log(`📋 Loaded ${leads.length} qualified leads`);

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

  // Load static PDF
  if (!fs.existsSync(STATIC_PDF_PATH)) {
    console.log(`❌ Static PDF missing: ${STATIC_PDF_PATH}`);
    return;
  }
  const pdfBuffer = fs.readFileSync(STATIC_PDF_PATH);
  const pdfBase64 = pdfBuffer.toString('base64');
  console.log(`📎 Static PDF loaded: ${(pdfBuffer.length / 1024).toFixed(0)} KB (${(pdfBase64.length / 1024).toFixed(0)} KB base64)\n`);

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

    const company = cleanName(lead.name);
    const subject = pickSubject(sent, company);
    const body = buildBodyHtml(company);
    const pdfFilename = 'SmartflowDev-AI-Chatbot-Proposal.pdf';

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

    const result = await sendEmail(lead.email, subject, body, pdfBase64, pdfFilename);

    if (result.ok) {
      v5State[emailLower] = {
        sentAt: new Date().toISOString(),
        messageId: result.id,
        company: lead.name,
        subject,
        city: lead.city,
        country: lead.country,
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
