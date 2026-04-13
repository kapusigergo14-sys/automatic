import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { loadState, saveState, LeadState } from './outreach-state';

/**
 * Reply-tracking helper. Since OAuth + Gmail API adds setup burden, we use a hybrid approach:
 *
 *   1. Run WITHOUT flags: prints a single Gmail search URL that matches any reply from any
 *      outreach lead to kapusicsgo@gmail.com → open it in your browser, scan inbox.
 *
 *   2. Run WITH --mark-replied email@example.com: marks that lead as replied so follow-ups
 *      will stop.
 *
 *   3. Run WITH --mark-bounced email@example.com: marks that lead as bounced (e.g. if Resend
 *      reported a hard bounce).
 *
 *   4. Run WITH --status: prints a summary of state (total leads, replied, bounced, pending).
 */

function parseArgs(): { markReplied?: string; markBounced?: string; status: boolean } {
  const args = process.argv.slice(2);
  let markReplied: string | undefined, markBounced: string | undefined;
  let status = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mark-replied' && args[i + 1]) markReplied = args[i + 1].toLowerCase();
    if (args[i] === '--mark-bounced' && args[i + 1]) markBounced = args[i + 1].toLowerCase();
    if (args[i] === '--status') status = true;
  }
  return { markReplied, markBounced, status };
}

function buildGmailSearchUrl(leads: LeadState[]): string {
  // Build a Gmail search query: from:(a@x.com OR b@y.com OR c@z.com) in:anywhere newer_than:30d
  // Limit to ~50 addresses per query; Gmail URL has a ~2000 char soft limit.
  const emails = leads.slice(0, 50).map(l => l.email).join(' OR ');
  const q = `from:(${emails}) newer_than:30d`;
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(q)}`;
}

function printStatus(): void {
  const state = loadState();
  const leads = Object.values(state.leads);
  const sent = leads.length;
  const replied = leads.filter(l => l.replied).length;
  const bounced = leads.filter(l => l.bounced).length;
  const completed = leads.filter(l => l.completed).length;
  const pending = leads.filter(l => !l.replied && !l.bounced && !l.completed).length;
  const due = leads.filter(l => !l.replied && !l.bounced && !l.completed && l.nextTouchAt && new Date(l.nextTouchAt) <= new Date()).length;

  const bySeq = { 1: 0, 2: 0, 3: 0 };
  for (const l of leads) {
    for (const t of l.touches) bySeq[t.seq as 1 | 2 | 3]++;
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  OUTREACH STATE SUMMARY                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Total leads:         ${sent}`);
  console.log(`  Replied:             ${replied}`);
  console.log(`  Bounced:             ${bounced}`);
  console.log(`  Completed (3/3):     ${completed}`);
  console.log(`  Pending follow-up:   ${pending}`);
  console.log(`  Due TODAY:           ${due}`);
  console.log('');
  console.log(`  Touch 1 sent:        ${bySeq[1]}`);
  console.log(`  Touch 2 sent:        ${bySeq[2]}`);
  console.log(`  Touch 3 sent:        ${bySeq[3]}`);
  console.log('');
  console.log(`  Last updated:        ${state.lastUpdated}`);
}

function main() {
  const { markReplied, markBounced, status } = parseArgs();
  const state = loadState();

  if (status) {
    printStatus();
    return;
  }

  if (markReplied) {
    const lead = state.leads[markReplied];
    if (!lead) {
      console.error(`❌ No lead found with email: ${markReplied}`);
      process.exit(1);
    }
    lead.replied = true;
    lead.lastReplyCheck = new Date().toISOString();
    saveState(state);
    console.log(`✅ Marked as replied: ${lead.businessName} (${markReplied})`);
    console.log(`   Follow-ups will stop for this lead.`);
    return;
  }

  if (markBounced) {
    const lead = state.leads[markBounced];
    if (!lead) {
      console.error(`❌ No lead found with email: ${markBounced}`);
      process.exit(1);
    }
    lead.bounced = true;
    lead.lastReplyCheck = new Date().toISOString();
    saveState(state);
    console.log(`✅ Marked as bounced: ${lead.businessName} (${markBounced})`);
    return;
  }

  // Default: print Gmail search URL for active leads
  const activeLeads = Object.values(state.leads).filter(l => !l.replied && !l.bounced);
  if (activeLeads.length === 0) {
    console.log('No active leads to check.');
    return;
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  GMAIL REPLY CHECK                                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Active leads: ${activeLeads.length}`);
  console.log('');
  console.log('  Open this in your browser to check for replies:');
  console.log('');
  console.log(`  ${buildGmailSearchUrl(activeLeads)}`);
  console.log('');
  console.log('  If you find replies, mark each one:');
  console.log('    npx ts-node scripts/check-replies.ts --mark-replied <email>');
  console.log('');

  // Update lastReplyCheck timestamp
  const now = new Date().toISOString();
  for (const l of activeLeads) l.lastReplyCheck = now;
  saveState(state);
}

main();
