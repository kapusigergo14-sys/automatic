import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { loadState, saveState, recordTouch, findDueLeads, LeadState } from './outreach-state';

const RESEND_API_KEY = process.env.RESEND_API_KEY!;

function parseArgs(): { dryRun: boolean; limit: number } {
  const args = process.argv.slice(2);
  let dryRun = false, limit = Infinity;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[i + 1], 10);
  }
  return { dryRun, limit };
}

function touch2Html(lead: LeadState): string {
  const name = lead.businessName;
  const obs = lead.observation
    ? `<p>Quick reminder of what I mentioned: <strong>${lead.observation}</strong>.</p>`
    : '';
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#333">
<p>Hi ${name} team,</p>
<p>Bumping this up in your inbox — did you get a chance to look at the 3 redesign concepts I sent for ${name}?</p>
${obs}
<p>Happy to walk you through any of them in a 10-minute call if it's useful.</p>
<p>Best,<br><strong>Geri</strong><br>smartflowdev.com</p>
<hr style="border:none;border-top:1px solid #eee;margin:20px 0">
<p style="font-size:12px;color:#999">Not interested? Ignore this email — I'll stop reaching out.</p>
</div>`;
}

function touch3Html(lead: LeadState): string {
  const name = lead.businessName;
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#333">
<p>Hi ${name} team,</p>
<p>Last note from me on this one — I'll stop reaching out after today unless I hear back.</p>
<p>If the timing isn't right for a website project, no worries. If you're curious about the 3 concepts I put together for ${name}, they're still attached to my original email (subject line started with &ldquo;I created 3 free redesign concepts&rdquo;).</p>
<p>Either way, good luck with everything!</p>
<p>Best,<br><strong>Geri</strong><br>smartflowdev.com</p>
</div>`;
}

function touchSubject(seq: number, businessName: string, originalSubject: string): string {
  if (seq === 2) return `Re: ${originalSubject}`;
  if (seq === 3) return `Closing the ${businessName} file`;
  return originalSubject;
}

async function main() {
  const { dryRun, limit } = parseArgs();
  const state = loadState();
  const due = findDueLeads(state).slice(0, limit);

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  FOLLOW-UP PIPELINE                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Total leads in state: ${Object.keys(state.leads).length}`);
  console.log(`  Due for follow-up:    ${due.length}`);
  console.log(`  Mode:                 ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  if (due.length === 0) {
    console.log('  Nothing to do. Exiting.');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(RESEND_API_KEY);

  let sent = 0, failed = 0;
  for (let i = 0; i < due.length; i++) {
    const lead = due[i];
    const seq = lead.nextSeq; // 2 or 3
    const originalSubject = lead.touches[0]?.subject || `About ${lead.businessName}`;
    const subject = touchSubject(seq, lead.businessName, originalSubject);
    const html = seq === 2 ? touch2Html(lead) : touch3Html(lead);

    console.log(`  [${i + 1}/${due.length}] Touch ${seq} → ${lead.email} (${lead.businessName})`);
    console.log(`    Subject: ${subject}`);

    if (dryRun) {
      console.log(`    🔹 DRY RUN (no email sent)`);
      sent++;
      continue;
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'Geri <geri@smartflowdev.com>',
        replyTo: 'kapusicsgo@gmail.com',
        to: lead.email,
        subject,
        html,
      });
      if (error) {
        console.log(`    ❌ Send error: ${JSON.stringify(error)}`);
        failed++;
        continue;
      }
      console.log(`    ✅ Sent! ID: ${data?.id}`);
      recordTouch(state, lead, {
        seq, sentAt: new Date().toISOString(), messageId: data?.id || null, subject,
      });
      saveState(state);
      sent++;
      await new Promise(r => setTimeout(r, 3000));
    } catch (err: any) {
      console.log(`    ❌ Error: ${err.message?.slice(0, 80)}`);
      failed++;
    }
  }

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  FOLLOW-UP COMPLETE                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Sent:   ${sent}`);
  console.log(`  Failed: ${failed}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
