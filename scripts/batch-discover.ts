import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { discover } from './discover';

interface SearchSeed {
  country: string;
  city: string;
  industry: string;
  query: string;
  pdfIndustry: string;
}

const USA_CITIES = [
  'Nashville TN', 'Pittsburgh PA', 'Cincinnati OH', 'Milwaukee WI',
  'Jacksonville FL', 'Richmond VA', 'Tucson AZ', 'Albuquerque NM',
  'Omaha NE', 'Spokane WA',
];

const AU_CITIES = [
  'Brisbane Australia', 'Perth Australia', 'Adelaide Australia',
  'Gold Coast Australia', 'Newcastle Australia',
];

const INDUSTRIES: Array<{ query: string; industry: string }> = [
  { query: 'hvac contractor', industry: 'HVAC' },
  { query: 'roofing contractor', industry: 'Roofing' },
  { query: 'lawyer', industry: 'Legal' },
  { query: 'plumber', industry: 'Plumbing' },
  { query: 'electrician', industry: 'Electrical' },
];

function buildSeeds(): SearchSeed[] {
  const seeds: SearchSeed[] = [];

  for (const city of USA_CITIES) {
    for (const ind of INDUSTRIES) {
      seeds.push({
        country: 'USA',
        city,
        industry: ind.industry,
        query: `${ind.query} ${city}`,
        pdfIndustry: ind.industry,
      });
    }
  }

  for (const city of AU_CITIES) {
    for (const ind of INDUSTRIES) {
      seeds.push({
        country: 'Australia',
        city,
        industry: ind.industry,
        query: `${ind.query} ${city}`,
        pdfIndustry: ind.industry,
      });
    }
  }

  return seeds;
}

interface Lead {
  name: string;
  website: string;
  contactUrl: string;
  country: string;
  industry: string;
}

async function main() {
  const args = process.argv.slice(2);
  let maxPerQuery = 5;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max' && args[i + 1]) maxPerQuery = parseInt(args[i + 1], 10);
    if (args[i] === '--dry-run') dryRun = true;
  }

  const seeds = buildSeeds();
  console.log(`╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  BATCH DISCOVER — ${seeds.length} search queries (${maxPerQuery}/each)       ║`);
  console.log(`║  Expected: ~${seeds.length * maxPerQuery} leads before dedup                  ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);

  if (dryRun) {
    console.log('\n🔹 DRY RUN — listing queries only:\n');
    for (const s of seeds) console.log(`  ${s.country} | ${s.city} | ${s.industry} → "${s.query}"`);
    console.log(`\nTotal: ${seeds.length} queries × ${maxPerQuery} = ~${seeds.length * maxPerQuery} leads`);
    return;
  }

  const allLeads: Lead[] = [];
  const seenWebsites = new Set<string>();
  let queryCount = 0;

  for (const seed of seeds) {
    queryCount++;
    console.log(`\n[${queryCount}/${seeds.length}] ${seed.country} | ${seed.city} | ${seed.industry}`);
    console.log(`  Query: "${seed.query}"`);

    try {
      const result = await discover(seed.industry.toLowerCase(), seed.city, maxPerQuery);

      for (const lead of result.leads) {
        // Dedup by website domain
        const domain = lead.website.replace(/https?:\/\//, '').replace(/www\./, '').split('/')[0].toLowerCase();
        if (seenWebsites.has(domain)) {
          console.log(`  ⏭️ Duplicate: ${domain}`);
          continue;
        }
        seenWebsites.add(domain);

        allLeads.push({
          name: lead.name,
          website: lead.website,
          contactUrl: lead.website,
          country: seed.city + ', ' + seed.country,
          industry: seed.pdfIndustry,
        });
      }

      console.log(`  ✓ ${result.leads.length} found, ${allLeads.length} total unique`);

      // Rate limit: 500ms between queries
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message?.slice(0, 80)}`);
    }
  }

  // Save combined JSON
  const outDir = path.resolve(__dirname, '../output/leads');
  fs.mkdirSync(outDir, { recursive: true });
  const date = new Date().toISOString().split('T')[0];
  const outPath = path.join(outDir, `batch-usa-au-${date}.json`);

  const output = {
    source: 'batch-discover',
    date,
    totalQueries: seeds.length,
    totalLeads: allLeads.length,
    leads: allLeads,
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  DISCOVERY COMPLETE                                           ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);
  console.log(`  Queries: ${queryCount}`);
  console.log(`  Total unique leads: ${allLeads.length}`);
  console.log(`  Saved: ${outPath}`);
  console.log(`\n  Next: npx ts-node scripts/process-chatgpt-list.ts --file ${outPath} --min-score 60`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
