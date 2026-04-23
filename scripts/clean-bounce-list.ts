/**
 * clean-bounce-list.ts — Remove bounced emails from all lead pools.
 *
 * Input: Brevo bounce CSV export (Transactional → Logs → Filter: Bounced →
 * Export as CSV). Place at `input/brevo-bounces.csv`.
 *
 * What it does:
 *   1. Reads the bounce CSV, extracts all email addresses
 *   2. Filters every lead JSON in `output/leads/` to remove bounced ones
 *   3. Writes a permanent blacklist at
 *      `output/v5-campaign/bounce-blacklist.json`
 *   4. Prints before/after counts per file
 *
 * CLI:
 *   npx ts-node scripts/clean-bounce-list.ts [--dry-run]
 *
 * The Brevo CSV has a header row; we extract the `Email` column (case-
 * insensitive). If the column is missing we look at every field and
 * accept anything that looks like an email.
 */

import * as fs from 'fs';
import * as path from 'path';

// Accept either a pre-filtered bounces CSV at input/brevo-bounces.csv OR
// the full Brevo logs dump at data/brevo-logs.csv (we'll filter rows whose
// `st_text` column contains "bounce").
const BOUNCE_CSV_CANDIDATES = [
  path.resolve(__dirname, '../input/brevo-bounces.csv'),
  path.resolve(__dirname, '../data/brevo-logs.csv'),
];
const LEADS_DIR = path.resolve(__dirname, '../output/leads');
const BLACKLIST_FILE = path.resolve(
  __dirname,
  '../output/v5-campaign/bounce-blacklist.json'
);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

interface BlacklistEntry {
  email: string;
  domain: string;
  reason: string;
  addedAt: string;
}

function parseCsvLine(line: string): string[] {
  // Very small CSV parser — handles quoted commas only.
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

function extractBouncedEmails(csv: string): Set<string> {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return new Set();

  const headerCols = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
  const emailIdx = headerCols.findIndex((c) => c === 'email' || c === 'recipient');
  // Brevo full-log dump has `st_text` containing e.g. "Soft bounce", "Hard
  // bounce", "Loaded by proxy", "Delivered", "Clicked". If that column
  // exists we only keep rows with "bounce" (case-insensitive). If the
  // column is absent, we assume every row is already a bounce.
  const statusIdx = headerCols.findIndex(
    (c) => c === 'st_text' || c === 'status' || c === 'event'
  );

  const emails = new Set<string>();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);

    if (statusIdx >= 0) {
      const status = (cols[statusIdx] ?? '').toLowerCase();
      if (!status.includes('bounce')) continue;
    }

    let candidate: string | null = null;
    if (emailIdx >= 0 && cols[emailIdx]) {
      candidate = cols[emailIdx];
    } else {
      // Fallback: find any email-shaped field
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

function cleanLeadFile(filePath: string, bounced: Set<string>, dryRun: boolean) {
  let pool: any[];
  try {
    pool = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return { file: path.basename(filePath), before: 0, after: 0, removed: 0, skip: true };
  }
  if (!Array.isArray(pool)) {
    return { file: path.basename(filePath), before: 0, after: 0, removed: 0, skip: true };
  }
  const before = pool.length;
  const cleaned = pool.filter((lead) => {
    const email = (lead?.email ?? '').toString().toLowerCase();
    return !email || !bounced.has(email);
  });
  const removed = before - cleaned.length;
  if (removed > 0 && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
  }
  return { file: path.basename(filePath), before, after: cleaned.length, removed, skip: false };
}

function writeBlacklist(bounced: Set<string>, dryRun: boolean) {
  const existing: BlacklistEntry[] = fs.existsSync(BLACKLIST_FILE)
    ? JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf-8'))
    : [];
  const seen = new Set(existing.map((e) => e.email));
  const now = new Date().toISOString();
  const added: BlacklistEntry[] = [];
  for (const e of bounced) {
    if (seen.has(e)) continue;
    added.push({
      email: e,
      domain: e.split('@')[1] ?? '',
      reason: 'hard-bounce',
      addedAt: now,
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

  const bounceCsv = BOUNCE_CSV_CANDIDATES.find((p) => fs.existsSync(p));
  if (!bounceCsv) {
    console.error('❌ No bounce CSV found. Looked at:');
    BOUNCE_CSV_CANDIDATES.forEach((p) =>
      console.error('   ' + path.relative(process.cwd(), p))
    );
    console.error('Export from Brevo: Transactional → Logs → Export CSV');
    process.exit(1);
  }

  console.log(`📄 Reading bounce CSV: ${path.relative(process.cwd(), bounceCsv)}`);
  const csv = fs.readFileSync(bounceCsv, 'utf-8');
  const bounced = extractBouncedEmails(csv);
  console.log(`   ${bounced.size} bounced emails detected\n`);

  if (bounced.size === 0) {
    console.log('⏭️  No bounces to process.');
    return;
  }

  // Clean lead pools
  const files = listLeadFiles();
  let totalBefore = 0;
  let totalAfter = 0;
  let totalRemoved = 0;
  const touched: string[] = [];

  for (const f of files) {
    const res = cleanLeadFile(f, bounced, dryRun);
    if (res.skip) continue;
    totalBefore += res.before;
    totalAfter += res.after;
    totalRemoved += res.removed;
    if (res.removed > 0) {
      touched.push(`   ${res.file}: ${res.before} → ${res.after} (−${res.removed})`);
    }
  }

  console.log(`📋 Lead pools processed: ${files.length} files`);
  console.log(`   Total leads before:  ${totalBefore}`);
  console.log(`   Total leads after:   ${totalAfter}`);
  console.log(`   Total removed:       ${totalRemoved}\n`);

  if (touched.length > 0) {
    console.log('📝 Files with removals:');
    touched.forEach((t) => console.log(t));
    console.log();
  }

  // Append to permanent blacklist
  const { total, added } = writeBlacklist(bounced, dryRun);
  console.log(`🛡️  Blacklist: ${total} total (+${added} new)`);
  console.log(`   ${path.relative(process.cwd(), BLACKLIST_FILE)}\n`);

  if (dryRun) {
    console.log('🧪 DRY RUN — no files were written.');
  } else {
    console.log('✅ Cleanup complete.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
