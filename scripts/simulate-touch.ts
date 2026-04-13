// Dev helper: seeds outreach-state.json with a fake past touch so follow-up can be tested.
import { loadState, saveState } from './outreach-state';

function main() {
  const state = loadState();
  const email = 'test-followup@example.com';
  // Touch 1 sent 4 days ago → next touch (seq=2) due today
  const sentAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const nextTouchAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  state.leads[email] = {
    email,
    businessName: 'Test Dental Practice',
    website: 'https://test-dental.example.com',
    contactUrl: 'https://test-dental.example.com/contact',
    industry: 'Dental',
    country: 'Test City, UK',
    outdatedScore: 70,
    outdatedBreakdown: 'wp=25;jq=15;legacy=10;heavy=15(5.2MB);oldJq=10(1.12.4)',
    observation: 'your homepage downloads 5.2MB on mobile — most patients bail before it finishes loading',
    touches: [{
      seq: 1,
      sentAt,
      messageId: 'seed-touch-1',
      subject: 'I created 3 free redesign concepts for Test Dental Practice',
    }],
    nextTouchAt,
    nextSeq: 2,
    replied: false,
    bounced: false,
    completed: false,
    lastReplyCheck: null,
  };
  saveState(state);
  console.log(`✅ Seeded fake lead: ${email} → next touch (seq=2) is due`);
}

main();
