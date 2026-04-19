/**
 * import-brevo-openers.ts — build the re-engagement opener list from
 * Brevo Logs and/or Resend export CSVs.
 *
 * Two provider formats are auto-detected by their header row:
 *   - Brevo UI export:  st_text, ts, sub, frm, email, tag, mid, link
 *   - Resend export:    id, created_at, subject, from, to, …, last_event, sent_at, …
 *
 * Pipeline:
 *   1. Parse each CSV (; or , delimiter auto-detected)
 *   2. Merge all rows into one event stream
 *   3. Collect every email with `opened` / `clicked` / `loaded by proxy` event
 *      (Resend "last_event = clicked" or "opened"; Brevo "Loaded by proxy"
 *      / "Opened" / "Clicks")
 *   4. Blacklist anyone with `bounced`/`hardBounce`/`complaint`/`unsubscribed`
 *   5. Cross-reference each opener against the 5 send-state files to tag
 *      pitch / company / country / lang
 *   6. Emit `output/v5-campaign/openers.json` with enriched rows
 *
 * CLI:
 *   npx ts-node scripts/import-brevo-openers.ts \
 *     --csv data/brevo-logs.csv \
 *     --csv data/resend-logs.csv
 *
 * Dedup guarantees:
 *   - One entry per email (earliest open wins)
 *   - Anyone on the bounce/complaint blacklist is excluded
 *   - Emails not found in any send-state are skipped (we don't know how
 *     to address them without an original pitch)
 *   - Internal test addresses (`kapusicsgo`, `kapusigergo`) always skipped
 */

import * as fs from 'fs';
import * as path from 'path';

const STATE_DIR = path.resolve(__dirname, '../output/v5-campaign');
const LEADS_DIR = path.resolve(__dirname, '../output/leads');
const OUTPUT_FILE = path.resolve(STATE_DIR, 'openers.json');

type Pitch = 'chatbot' | 'redesign' | 'lawyer' | 'plumber' | 'hvac';
type Lang = 'en' | 'hu' | 'de' | 'es';

interface StateEntry {
  sentAt?: string;
  messageId?: string;
  company?: string;
  subject?: string;
  city?: string;
  country?: string;
  lang?: Lang;
  pitch?: string;
  followup1SentAt?: string;
  followup2SentAt?: string;
}

interface StateSource {
  file: string;
  pitch: Pitch;
}

const STATE_SOURCES: StateSource[] = [
  { file: path.join(STATE_DIR, 'send-state-v5.json'),          pitch: 'chatbot' },
  { file: path.join(STATE_DIR, 'send-state-v5-outdated.json'), pitch: 'redesign' },
  { file: path.join(STATE_DIR, 'send-state-lawyer.json'),      pitch: 'lawyer' },
  { file: path.join(STATE_DIR, 'send-state-plumber.json'),     pitch: 'plumber' },
  { file: path.join(STATE_DIR, 'send-state-hvac.json'),        pitch: 'hvac' },
];

interface Opener {
  email: string;
  company: string;
  city: string;
  country: string;
  lang: Lang;
  pitch: Pitch;
  firstOpenedAt: string;
  originalSubject: string;
  originalSentAt: string;
  hasFollowup: boolean;
}

// ─── CLI ─────────────────────────────────────────────────────────────
function parseArgs() {
  const a = process.argv.slice(2);
  const csvs: string[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--csv' && a[i + 1]) { csvs.push(a[i + 1]); i++; }
  }
  if (csvs.length === 0) csvs.push('data/brevo-logs.csv');
  return { csvs: csvs.map((c) => path.resolve(process.cwd(), c)) };
}

// ─── CSV parser ──────────────────────────────────────────────────────
// Tiny RFC-4180-ish parser: handles quoted fields with embedded delimiters
// and doubled quotes. Enough for Brevo's export, and zero-dep.
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += ch; }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].length > 0));
}

function detectDelimiter(firstLine: string): string {
  // Brevo default is ';' but some locales / re-exports use ','. Whichever
  // yields more columns in the header row is the right one.
  const semi = firstLine.split(';').length;
  const comma = firstLine.split(',').length;
  return semi >= comma ? ';' : ',';
}

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[_\s]/g, '');
}

// ─── Event classification ────────────────────────────────────────────
// Brevo values we've seen: "Delivered", "Soft bounce", "Hard bounce",
// "Blocked", "Opened", "Unique opened", "Loaded by proxy", "Clicks",
// "Unique clicks", "Complaint", "Unsubscribed".
//
// "Loaded by proxy" means Gmail/Outlook fetched the tracking pixel
// through their image proxy — in practice this is the dominant open
// signal for Gmail inboxes, so we treat it as an open.
function isOpenEvent(e: string): boolean {
  const n = norm(e);
  return (
    n === 'opened' ||
    n === 'uniqueopened' ||
    n === 'open' ||
    n === 'loadedbyproxy' ||
    n === 'clicks' ||
    n === 'uniqueclicks' ||
    n === 'click' ||
    n === 'clicked' // Resend uses past tense
  );
}

function isHardBounce(e: string): boolean {
  const n = norm(e);
  return (
    n === 'hardbounce' || n === 'hardbounces' || n === 'blocked' ||
    n === 'bounced' || n === 'failed' // Resend terms
  );
}

function isComplaint(e: string): boolean {
  const n = norm(e);
  return (
    n === 'complaint' || n === 'complaints' || n === 'spam' ||
    n === 'complained' // Resend term
  );
}

function isUnsubscribe(e: string): boolean {
  const n = norm(e);
  return n === 'unsubscribed' || n === 'unsubscribe';
}

// ─── Language inference (fallback if state has no `lang`) ────────────
function langFromCountry(country: string): Lang {
  const c = (country || '').toUpperCase();
  if (c === 'HU') return 'hu';
  if (c === 'DE' || c === 'AT' || c === 'CH') return 'de';
  if (c === 'ES' || c === 'MX' || c === 'AR') return 'es';
  return 'en'; // US / UK / AU / fallback
}

// ─── Provider detection ─────────────────────────────────────────────
type Provider = 'brevo' | 'resend';

function detectProvider(headerNorm: string[]): Provider {
  // Resend: has `lastevent` column (or the `to` + `sentat` pair)
  if (headerNorm.includes('lastevent')) return 'resend';
  // Brevo UI: has `sttext` (or `st_text` normalised)
  if (headerNorm.includes('sttext')) return 'brevo';
  // Fallbacks
  if (headerNorm.includes('event')) return 'brevo';
  return 'brevo';
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const { csvs } = parseArgs();
  console.log('📥 import-brevo-openers');
  console.log(`   CSVs: ${csvs.length}`);
  for (const c of csvs) console.log(`     - ${c}`);

  const earliestOpen = new Map<string, { date: string; subject: string }>();
  const blacklist = new Set<string>();
  let totalScanned = 0;

  for (const csv of csvs) {
    if (!fs.existsSync(csv)) {
      console.warn(`⚠️  skipping ${csv} (not found)`);
      continue;
    }
    const raw = fs.readFileSync(csv, 'utf-8');
    const firstLine = raw.split(/\r?\n/, 1)[0] || '';
    const delim = detectDelimiter(firstLine);
    const rows = parseCsv(raw, delim);
    if (rows.length < 2) continue;
    const header = rows[0].map(norm);
    const provider = detectProvider(header);
    const idx = (name: string) => header.indexOf(norm(name));

    let iEmail = -1, iEvent = -1, iDate = -1, iSubject = -1;
    if (provider === 'resend') {
      iEmail   = [idx('to'), idx('recipient'), idx('email')].find((x) => x >= 0) ?? -1;
      iEvent   = [idx('lastevent'), idx('event')].find((x) => x >= 0) ?? -1;
      iDate    = [idx('sentat'), idx('createdat'), idx('date')].find((x) => x >= 0) ?? -1;
      iSubject = [idx('subject')].find((x) => x >= 0) ?? -1;
    } else {
      // Brevo — st_text / ts / sub / email
      iEmail   = [idx('email'), idx('recipient'), idx('to')].find((x) => x >= 0) ?? -1;
      iEvent   = [idx('sttext'), idx('event'), idx('type'), idx('status')].find((x) => x >= 0) ?? -1;
      iDate    = [idx('ts'), idx('date'), idx('sentat'), idx('timestamp'), idx('time')].find((x) => x >= 0) ?? -1;
      iSubject = [idx('sub'), idx('subject'), idx('messagesubject')].find((x) => x >= 0) ?? -1;
    }

    if (iEmail < 0 || iEvent < 0) {
      console.warn(`⚠️  ${path.basename(csv)}: missing required columns (email/event). Header: ${rows[0].join(' | ')}`);
      continue;
    }

    let scanned = 0, localOpens = 0, localBlacklist = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length <= iEmail) continue;
      const email = (row[iEmail] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      if (email.includes('kapusicsgo') || email.includes('kapusigergo')) continue;
      const event = row[iEvent] || '';
      const date = iDate >= 0 ? (row[iDate] || '') : '';
      const subject = iSubject >= 0 ? (row[iSubject] || '') : '';
      scanned++;

      if (isHardBounce(event) || isComplaint(event) || isUnsubscribe(event)) {
        blacklist.add(email);
        localBlacklist++;
        continue;
      }
      if (isOpenEvent(event)) {
        const prev = earliestOpen.get(email);
        if (!prev || (date && date < prev.date)) {
          earliestOpen.set(email, { date, subject });
        }
        localOpens++;
      }
    }
    totalScanned += scanned;
    console.log(`   ${path.basename(csv)} [${provider}]: ${scanned} rows, ${localOpens} open events, ${localBlacklist} blacklist events`);
  }

  // Strip anyone blacklisted across all providers
  for (const e of blacklist) earliestOpen.delete(e);

  console.log(`   total rows scanned: ${totalScanned}`);
  console.log(`   unique openers: ${earliestOpen.size}`);
  console.log(`   blacklisted (bounce/complaint/unsub): ${blacklist.size}`);

  // Pass 2: cross-reference state files
  const stateByEmail = new Map<string, { pitch: Pitch; entry: StateEntry }>();
  for (const src of STATE_SOURCES) {
    if (!fs.existsSync(src.file)) continue;
    let obj: Record<string, StateEntry>;
    try {
      obj = JSON.parse(fs.readFileSync(src.file, 'utf-8'));
    } catch {
      console.warn(`⚠️  could not parse ${path.basename(src.file)}`);
      continue;
    }
    for (const [email, entry] of Object.entries(obj)) {
      const key = email.toLowerCase();
      // If the same email shows up in multiple state files, keep the most
      // recent sentAt (they're more likely to remember that campaign).
      const prev = stateByEmail.get(key);
      if (!prev || (entry.sentAt && prev.entry.sentAt && entry.sentAt > prev.entry.sentAt)) {
        stateByEmail.set(key, { pitch: src.pitch, entry });
      }
    }
  }

  const openers: Opener[] = [];
  let notInState = 0;
  let missingFields = 0;

  for (const [email, open] of earliestOpen) {
    const st = stateByEmail.get(email);
    if (!st) { notInState++; continue; }
    const e = st.entry;
    const company = e.company || '';
    const country = (e.country || '').toUpperCase();
    const city = e.city || '';
    if (!company || !country) { missingFields++; continue; }

    openers.push({
      email,
      company,
      city,
      country,
      lang: (e.lang as Lang) || langFromCountry(country),
      pitch: st.pitch,
      firstOpenedAt: open.date,
      originalSubject: e.subject || open.subject || '',
      originalSentAt: e.sentAt || '',
      hasFollowup: !!(e.followup1SentAt || e.followup2SentAt),
    });
  }

  // Oldest open first so our pilot batch hits the stalest leads
  openers.sort((a, b) => (a.firstOpenedAt || '').localeCompare(b.firstOpenedAt || ''));

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(openers, null, 2));

  // Breakdown by pitch for sanity
  const byPitch = openers.reduce((acc, o) => ((acc[o.pitch] = (acc[o.pitch] || 0) + 1), acc), {} as Record<string, number>);

  console.log('');
  console.log(`✅ wrote ${openers.length} openers to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`   skipped (not in any state):  ${notInState}`);
  console.log(`   skipped (missing fields):    ${missingFields}`);
  console.log('   breakdown by pitch:');
  for (const p of Object.keys(byPitch).sort()) {
    console.log(`     ${p.padEnd(10)}: ${byPitch[p]}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
