import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { discover } from './discover';
import { analyze } from './analyze';
import { extractEmail } from './extract-email';
import { scoreLeads } from './score';

function parseArgs(): { industry: string; city: string; count: number } {
  const args = process.argv.slice(2);
  let industry = '', city = '', count = 20;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--industry' && args[i + 1]) industry = args[i + 1];
    if (args[i] === '--city' && args[i + 1]) city = args[i + 1];
    if (args[i] === '--count' && args[i + 1]) count = parseInt(args[i + 1], 10);
  }
  if (!industry || !city) {
    console.error('Usage: npx ts-node scripts/pipeline.ts --industry dentist --city Nashville --count 20');
    process.exit(1);
  }
  return { industry, city, count };
}

async function main() {
  const { industry, city, count } = parseArgs();
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════');
  console.log('  LEAD GENERATION PIPELINE v2');
  console.log(`  ${industry} in ${city} (max ${count})`);
  console.log('═══════════════════════════════════════════\n');

  // Step 1: Discover
  console.log('STEP 1/4: DISCOVER');
  const { leads, outputPath: discoverPath } = await discover(industry, city, count);
  if (leads.length === 0) {
    console.log('No leads found. Exiting.');
    return;
  }

  // Step 2: Analyze
  console.log('\nSTEP 2/4: ANALYZE WEBSITES');
  const analyzed = await analyze(discoverPath);

  // Step 3: Extract emails
  console.log('\nSTEP 3/4: EXTRACT EMAILS');
  for (let i = 0; i < analyzed.length; i++) {
    const item = analyzed[i];
    if (item.error) continue;
    console.log(`   [${i + 1}/${analyzed.length}] ${item.lead.name}`);
    try {
      const { bestEmail } = await extractEmail(item.lead.website);
      (item as any).email = bestEmail;
      if (bestEmail) console.log(`      Found: ${bestEmail}`);
      else console.log(`      No email found`);
    } catch (err: any) {
      console.log(`      ❌ Failed: ${err.message}`);
      (item as any).email = null;
    }
  }

  // Step 4: Score
  console.log('\nSTEP 4/4: SCORE & RANK');
  const scored = scoreLeads(analyzed);

  // Save final output
  const date = new Date().toISOString().split('T')[0];
  const slug = `${city.toLowerCase().replace(/\s+/g, '-')}-${industry.toLowerCase().replace(/\s+/g, '-')}`;
  const outDir = path.join('output', 'leads');
  fs.mkdirSync(outDir, { recursive: true });
  const finalPath = path.join(outDir, `pipeline-${slug}-${date}.json`);
  fs.writeFileSync(finalPath, JSON.stringify(scored, null, 2));

  // Summary table
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════');
  console.log('  PIPELINE COMPLETE');
  console.log('═══════════════════════════════════════════');
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Discovered: ${leads.length}`);
  console.log(`  Analyzed: ${analyzed.filter(a => !a.error).length}`);
  console.log(`  With email: ${scored.filter(s => s.email).length}`);
  console.log(`  Output: ${finalPath}`);
  console.log('───────────────────────────────────────────');
  console.log('  SCORE │ OUTDATED │ EMAIL            │ NAME');
  console.log('────────┼──────────┼──────────────────┼─────────────────────');
  for (const s of scored.slice(0, 15)) {
    const score = s.leadScore.toString().padStart(5);
    const outdated = s.outdatedScore.toString().padStart(8);
    const email = (s.email || '-').padEnd(16).slice(0, 16);
    const name = s.name.slice(0, 20);
    console.log(`  ${score} │ ${outdated} │ ${email} │ ${name}`);
  }
  console.log('═══════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Pipeline error:', err.message);
  process.exit(1);
});
