import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';

interface ScoredLead {
  name: string;
  website: string;
  industry: string;
  city: string;
  rating: number | null;
  reviewCount: number | null;
  phone: string;
  email: string | null;
  address: string;
  googleMapsUrl: string;
  outdatedScore: number;
  leadScore: number;
  scoreBreakdown: Record<string, number>;
  screenshotPath: string;
  analyzedAt: string;
}

const HIGH_VALUE_INDUSTRIES = ['dentist', 'lawyer', 'medical clinic', 'chiropractor', 'veterinarian', 'accountant'];
const MEDIUM_VALUE_INDUSTRIES = ['hvac', 'roofing', 'plumber', 'insurance agent', 'real estate agent'];

function parseArgs(): { input: string; top?: number } {
  const args = process.argv.slice(2);
  let input = '', top: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) input = args[i + 1];
    if (args[i] === '--top' && args[i + 1]) top = parseInt(args[i + 1], 10);
  }
  if (!input) {
    console.error('Usage: npx ts-node scripts/score.ts --input output/leads/file-analyzed.json --top 10');
    process.exit(1);
  }
  return { input, top };
}

export function scoreLeads(analyzedData: any[]): ScoredLead[] {
  const scored: ScoredLead[] = [];

  for (const item of analyzedData) {
    if (item.error) continue;

    const lead = item.lead;
    const breakdown: Record<string, number> = {};
    let leadScore = 0;

    // Outdated score factor
    if (item.outdatedScore > 60) {
      breakdown['outdated_high'] = 30;
      leadScore += 30;
    } else if (item.outdatedScore >= 40) {
      breakdown['outdated_medium'] = 15;
      leadScore += 15;
    }

    // Industry value
    const ind = (lead.industry || '').toLowerCase();
    if (HIGH_VALUE_INDUSTRIES.includes(ind)) {
      breakdown['industry_high'] = 20;
      leadScore += 20;
    } else if (MEDIUM_VALUE_INDUSTRIES.includes(ind)) {
      breakdown['industry_medium'] = 10;
      leadScore += 10;
    } else {
      breakdown['industry_low'] = 5;
      leadScore += 5;
    }

    // Review count
    if (lead.reviewCount && lead.reviewCount > 50) {
      breakdown['reviews_high'] = 10;
      leadScore += 10;
    } else if (lead.reviewCount && lead.reviewCount > 20) {
      breakdown['reviews_medium'] = 5;
      leadScore += 5;
    }

    // Rating sweet spot (not too high = happy, not too low = bad business)
    if (lead.rating && lead.rating >= 3.5 && lead.rating <= 4.5) {
      breakdown['rating_sweetspot'] = 10;
      leadScore += 10;
    }

    // Has email
    if (item.email) {
      breakdown['has_email'] = 15;
      leadScore += 15;
    }

    // Has phone
    if (lead.phone) {
      breakdown['has_phone'] = 5;
      leadScore += 5;
    }

    leadScore = Math.min(100, leadScore);

    scored.push({
      name: lead.name,
      website: lead.website,
      industry: lead.industry,
      city: lead.city,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      phone: lead.phone,
      email: item.email || null,
      address: lead.address,
      googleMapsUrl: lead.googleMapsUrl,
      outdatedScore: item.outdatedScore,
      leadScore,
      scoreBreakdown: breakdown,
      screenshotPath: item.screenshotPath || '',
      analyzedAt: item.analyzedAt,
    });
  }

  scored.sort((a, b) => b.leadScore - a.leadScore);
  return scored;
}

if (require.main === module) {
  const { input, top } = parseArgs();
  const data = JSON.parse(fs.readFileSync(input, 'utf-8'));
  console.log(`🎯 Scoring ${data.length} leads...`);

  const scored = scoreLeads(data);
  const final = top ? scored.slice(0, top) : scored;

  const date = new Date().toISOString().split('T')[0];
  const outDir = path.join('output', 'leads');
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, `scored-${date}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(final, null, 2));

  console.log(`\n   Top leads:`);
  for (const l of final.slice(0, 10)) {
    console.log(`   ${l.leadScore.toString().padStart(3)}/100 | Outdated: ${l.outdatedScore.toString().padStart(3)} | ${l.name} | ${l.email || 'no email'}`);
  }
  console.log(`\n   Saved ${final.length} scored leads to ${outputPath}`);
}
