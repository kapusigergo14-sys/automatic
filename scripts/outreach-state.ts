import * as fs from 'fs';
import * as path from 'path';

export interface Touch {
  seq: number;                  // 1, 2, or 3
  sentAt: string;               // ISO date string
  messageId: string | null;
  subject: string;
}

export interface LeadState {
  email: string;
  businessName: string;
  website: string;
  contactUrl: string;
  industry: string;
  country: string;
  outdatedScore: number | null;
  outdatedBreakdown: string | null;
  observation: string | null;
  touches: Touch[];
  nextTouchAt: string | null;   // ISO date string, null if completed
  nextSeq: number;              // next touch sequence number (2 or 3), 0 if completed
  replied: boolean;
  bounced: boolean;
  completed: boolean;
  lastReplyCheck: string | null;
}

export interface OutreachState {
  version: number;
  lastUpdated: string;
  leads: Record<string, LeadState>;  // keyed by email
}

export const STATE_FILE = path.resolve(__dirname, '../output/outreach-state.json');

// Touch cadence: days after previous touch
export const TOUCH_CADENCE_DAYS: Record<number, number> = {
  2: 3,  // touch 2 sent 3 days after touch 1
  3: 7,  // touch 3 sent 7 days after touch 1 (i.e. 4 days after touch 2)
};

export function loadState(): OutreachState {
  if (!fs.existsSync(STATE_FILE)) {
    return { version: 1, lastUpdated: new Date().toISOString(), leads: {} };
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as OutreachState;
    if (!parsed.leads) parsed.leads = {};
    return parsed;
  } catch (err) {
    console.error(`⚠️ Could not read ${STATE_FILE}, starting fresh:`, (err as Error).message);
    return { version: 1, lastUpdated: new Date().toISOString(), leads: {} };
  }
}

export function saveState(state: OutreachState): void {
  state.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Record a successful touch send and schedule the next one. */
export function recordTouch(state: OutreachState, leadInit: Omit<LeadState, 'touches' | 'nextTouchAt' | 'nextSeq' | 'replied' | 'bounced' | 'completed' | 'lastReplyCheck'>, touch: Touch): void {
  const key = leadInit.email.toLowerCase();
  const existing = state.leads[key];

  if (!existing) {
    // First touch
    const nextSeq = touch.seq + 1;
    const nextTouchAt = nextSeq <= 3 ? addDays(touch.sentAt, TOUCH_CADENCE_DAYS[nextSeq] - (touch.seq === 1 ? 0 : TOUCH_CADENCE_DAYS[touch.seq] || 0)) : null;
    state.leads[key] = {
      ...leadInit,
      touches: [touch],
      nextTouchAt,
      nextSeq: nextSeq <= 3 ? nextSeq : 0,
      replied: false,
      bounced: false,
      completed: nextSeq > 3,
      lastReplyCheck: null,
    };
  } else {
    // Follow-up touch
    existing.touches.push(touch);
    const nextSeq = touch.seq + 1;
    if (nextSeq > 3) {
      existing.nextTouchAt = null;
      existing.nextSeq = 0;
      existing.completed = true;
    } else {
      // Cadence measured from the FIRST touch
      const firstSent = existing.touches[0].sentAt;
      existing.nextTouchAt = addDays(firstSent, TOUCH_CADENCE_DAYS[nextSeq]);
      existing.nextSeq = nextSeq;
    }
  }
}

/** Find all leads due for next touch (nextTouchAt <= now, not replied/bounced/completed). */
export function findDueLeads(state: OutreachState, now: Date = new Date()): LeadState[] {
  const due: LeadState[] = [];
  for (const lead of Object.values(state.leads)) {
    if (lead.replied || lead.bounced || lead.completed) continue;
    if (!lead.nextTouchAt) continue;
    if (new Date(lead.nextTouchAt) <= now) due.push(lead);
  }
  return due;
}
