import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface GoogleReviewsResult {
  placeId: string | null;
  avgRating: number | null;
  reviewCount: number | null;
  reviews: GoogleReview[];
}

function parseArgs(): { query: string } {
  const args = process.argv.slice(2);
  let query = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--query' && args[i + 1]) query = args[i + 1];
  }
  if (!query) {
    console.error('Usage: npx ts-node scripts/extract-google-reviews.ts --query "Company Name City"');
    process.exit(1);
  }
  return { query };
}

async function findPlace(query: string, apiKey: string): Promise<string | null> {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({ textQuery: query, pageSize: 1 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.places?.[0]?.id || null;
}

async function fetchReviews(placeId: string, apiKey: string): Promise<GoogleReviewsResult> {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,rating,userRatingCount,reviews',
    },
  });
  if (!res.ok) {
    return { placeId, avgRating: null, reviewCount: null, reviews: [] };
  }
  const data = await res.json();
  const reviews: GoogleReview[] = (data.reviews || []).slice(0, 5).map((r: any) => ({
    author: r.authorAttribution?.displayName || 'Google User',
    rating: r.rating || 5,
    text: (r.text?.text || r.originalText?.text || '').trim(),
    relativeTime: r.relativePublishTimeDescription || '',
  })).filter((r: GoogleReview) => r.text.length > 20);
  return {
    placeId,
    avgRating: data.rating || null,
    reviewCount: data.userRatingCount || null,
    reviews,
  };
}

export async function extractGoogleReviews(query: string): Promise<GoogleReviewsResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const empty: GoogleReviewsResult = { placeId: null, avgRating: null, reviewCount: null, reviews: [] };
  if (!apiKey) return empty;
  try {
    const placeId = await findPlace(query, apiKey);
    if (!placeId) return empty;
    return await fetchReviews(placeId, apiKey);
  } catch (err) {
    return empty;
  }
}

if (require.main === module) {
  const { query } = parseArgs();
  console.log(`Extracting Google reviews for: ${query}`);
  extractGoogleReviews(query).then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
