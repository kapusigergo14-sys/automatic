/**
 * import-brevo-contacted.ts — Extract EVERY email ever contacted in the
 * Brevo logs and remove them from all current lead pools.
 *
 * Why: historical sends may not all be reflected in send-state-*.json
 * (manual campaigns, pre-v5 pools, etc.). The Brevo event log is the
 * definitive list of "who has ever received a cold email from us". This
 * list must be permanently excluded from new lead ingestion.
 *
 * Unlike clean-bounce-list.ts (bounces only), this accepts every row
 * regardless of event status (Delivered / Opened / Clicked / Bounced /
 * Deferred / etc.) and adds each unique recipient to the permanent
 * contacted blacklist.
 *
 * Reads every CSV in `data/` that looks like a Brevo log export.
 *
 * CLI:
 *   npx ts-node scripts/import-brevo-contacted.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '../data');
const LEADS_DIR = path.resolve(__dirname, '../output/leads');
const BLACKLIST_FILE = path.resolve(
  __dirname,
  '../output/v5-campaign/contacted-blacklist.json'
);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

interface BlacklistEntry {
  email: string;
  domain: string;
  reason: string;
  firstSeenAt: string;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function isBrevoLog(csv: string): boolean {
  const firstLine = csv.split(/\r?\n/)[0] ?? '';
  const cols = parseCsvLine(firstLine).map((c) => c.toLowerCase());
  // Brevo log has st_text + email columns
  return cols.includes('email') && (cols.includes('st_text') || cols.includes('status'));
}

function extractAllContacted(csv: string): Set<string> {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return new Set();

  const headerCols = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
  const emailIdx = headerCols.findIndex((c) => c === 'email' || c === 'recipient');

  const emails = new Set<string>();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    let candidate: string | null = null;
    if (emailIdx >= 0 && cols[emailIdx]) {
      candidate = cols[emailIdx];
    } else {
      for (const c of cols) {
        const m = c.match(EMAIL_RE);
        if (m) {
          candidate = m[0];
          break;
        }
      }
    }
    if (!candidate) continue;
    const m = candidate.match(EMAIL_RE);
    if (m) emails.add(m[0].toLowerCase());
  }
  return emails;
}

function listLeadFiles(): string[] {
  if (!fs.existsSync(LEADS_DIR)) return [];
  return fs
    .readdirSync(LEADS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(LEADS_DIR, f));
}

function cleanLeadFile(filePath: string, contacted: Set<string>, dryRun: boolean) {
  let pool: any[];
  try {
    pool = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return { file: path.basename(filePath), before: 0, removed: 0, skip: true };
  }
  if (!Array.isArray(pool)) {
    return { file: path.basename(filePath), before: 0, removed: 0, skip: true };
  }
  const before = pool.length;
  const cleaned = pool.filter((lead) => {
    const email = (lead?.email ?? '').toString().toLowerCase();
    return !email || !contacted.has(email);
  });
  const removed = before - cleaned.length;
  if (removed > 0 && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
  }
  return { file: path.basename(filePath), before, removed, skip: false };
}

function writeBlacklist(contacted: Set<string>, dryRun: boolean) {
  const existing: BlacklistEntry[] = fs.existsSync(BLACKLIST_FILE)
    ? JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf-8'))
    : [];
  const seen = new Set(existing.map((e) => e.email));
  const now = new Date().toISOString();
  const added: BlacklistEntry[] = [];
  for (const e of contacted) {
    if (seen.has(e)) continue;
    added.push({
      email: e,
      domain: e.split('@')[1] ?? '',
      reason: 'brevo-previously-contacted',
      firstSeenAt: now,
    });
  }
  const next = [...existing, ...added];
  if (!dryRun) {
    fs.mkdirSync(path.dirname(BLACKLIST_FILE), { recursive: true });
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(next, null, 2));
  }
  return { total: next.length, added: added.length };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Data dir missing: ${DATA_DIR}`);
    process.exit(1);
  }

  const csvFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .map((f) => path.join(DATA_DIR, f));

  if (csvFiles.length === 0) {
    console.error('❌ No CSV files in data/ — nothing to import.');
    process.exit(1);
  }

  const allContacted = new Set<string>();
  for (const f of csvFiles) {
    const csv = fs.readFileSync(f, 'utf-8');
    if (!isBrevoLog(csv)) {
      console.log(`⏭️  Skipping ${path.basename(f)} (not a Brevo log)`);
      continue;
    }
    const these = extractAllContacted(csv);
    these.forEach((e) => allContacted.add(e));
    console.log(`📄 ${path.basename(f)}: ${these.size} unique recipients`);
  }

  console.log(`\n🧮 Total unique contacted (union across all logs): ${allContacted.size}\n`);

  if (allContacted.size === 0) {
    console.log('⏭️  Nothing to do.');
    return;
  }

  // Clean lead pools
  const files = listLeadFiles();
  let totalBefore = 0;
  let totalRemoved = 0;
  const touched: string[] = [];

  for (const f of files) {
    const res = cleanLeadFile(f, allContacted, dryRun);
    if (res.skip) continue;
    totalBefore += res.before;
    totalRemoved += res.removed;
    if (res.removed > 0) {
      touched.push(`   ${res.file}: −${res.removed}`);
    }
  }

  console.log(`📋 Lead pools processed: ${files.length} files`);
  console.log(`   Total leads scanned:  ${totalBefore}`);
  console.log(`   Total leads removed:  ${totalRemoved}\n`);

  if (touched.length > 0) {
    console.log(`📝 Files touched (${touched.length}):`);
    touched.slice(0, 20).forEach((t) => console.log(t));
    if (touched.length > 20) console.log(`   ...and ${touched.length - 20} more`);
    console.log();
  }

  const { total, added } = writeBlacklist(allContacted, dryRun);
  console.log(`🛡️  Contacted blacklist: ${total} total (+${added} new)`);
  console.log(`   ${path.relative(process.cwd(), BLACKLIST_FILE)}\n`);

  if (dryRun) {
    console.log('🧪 DRY RUN — no files were written.');
  } else {
    console.log('✅ Import complete. These emails will be excluded from future leads.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
