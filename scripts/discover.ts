import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';

interface Place {
  displayName?: { text: string };
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
}

interface Lead {
  name: string;
  website: string;
  rating: number | null;
  reviewCount: number | null;
  address: string;
  phone: string;
  googleMapsUrl: string;
  industry: string;
  city: string;
  discoveredAt: string;
}

function parseArgs(): { industry: string; city: string; count: number } {
  const args = process.argv.slice(2);
  let industry = '', city = '', count = 20;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--industry' && args[i + 1]) industry = args[i + 1];
    if (args[i] === '--city' && args[i + 1]) city = args[i + 1];
    if (args[i] === '--count' && args[i + 1]) count = parseInt(args[i + 1], 10);
  }
  if (!industry || !city) {
    console.error('Usage: npx ts-node scripts/discover.ts --industry dentist --city Nashville --count 20');
    process.exit(1);
  }
  return { industry, city, count };
}

async function searchPlaces(query: string, apiKey: string, pageSize: number): Promise<Place[]> {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const fieldMask = [
    'places.displayName',
    'places.websiteUri',
    'places.rating',
    'places.userRatingCount',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.googleMapsUri',
  ].join(',');

  const allPlaces: Place[] = [];
  let pageToken: string | undefined;

  while (allPlaces.length < pageSize) {
    const body: any = {
      textQuery: query,
      pageSize: Math.min(20, pageSize - allPlaces.length),
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Places API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const places: Place[] = data.places || [];
    allPlaces.push(...places);

    pageToken = data.nextPageToken;
    if (!pageToken || places.length === 0) break;
  }

  return allPlaces.slice(0, pageSize);
}

export async function discover(industry: string, city: string, count: number): Promise<{ leads: Lead[]; outputPath: string }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set in .env.local');

  const query = `${industry} in ${city}`;
  console.log(`🔍 Searching: "${query}" (max ${count})...`);

  const places = await searchPlaces(query, apiKey, count);
  console.log(`   Found ${places.length} results from Google Places`);

  const leads: Lead[] = places
    .filter(p => p.websiteUri)
    .map(p => ({
      name: p.displayName?.text || 'Unknown',
      website: p.websiteUri!,
      rating: p.rating ?? null,
      reviewCount: p.userRatingCount ?? null,
      address: p.formattedAddress || '',
      phone: p.nationalPhoneNumber || '',
      googleMapsUrl: p.googleMapsUri || '',
      industry,
      city,
      discoveredAt: new Date().toISOString(),
    }));

  console.log(`   ${leads.length} leads with websites`);

  const date = new Date().toISOString().split('T')[0];
  const slug = `${city.toLowerCase().replace(/\s+/g, '-')}-${industry.toLowerCase().replace(/\s+/g, '-')}-${date}`;
  const outDir = path.join('output', 'leads');
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${slug}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(leads, null, 2));
  console.log(`   Saved to ${outputPath}`);

  return { leads, outputPath };
}

// Run directly
if (require.main === module) {
  const { industry, city, count } = parseArgs();
  discover(industry, city, count).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
