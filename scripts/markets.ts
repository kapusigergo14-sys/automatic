/**
 * markets.ts — Country/language/PDF lookup table for v5 dental campaign
 *
 * Each market defines:
 * - The country code we tag leads with
 * - The language for emails + PDFs
 * - Which static PDF to attach (per-language)
 * - The Google Places search queries to run for that market
 */

export type LangCode = 'en' | 'hu' | 'de' | 'es';

export interface Market {
  code: string;            // 2-letter country code (matches lead.country)
  lang: LangCode;
  pdfFile: string;         // Filename under output/static/
  pdfFilename: string;     // Recipient-facing attachment filename
  queries: string[];       // Google Places text-search queries
}

export const MARKETS: Record<string, Market> = {
  // ─── English-speaking markets ───────────────────────────

  US: {
    code: 'US',
    lang: 'en',
    pdfFile: 'smartflowdev-dental-proposal-en.pdf',
    pdfFilename: 'SmartflowDev-AI-Chatbot-Proposal.pdf',
    queries: [
      'dentist Colorado Springs Colorado',
      'dentist Fort Collins Colorado',
      'dentist Boulder Colorado',
      'dentist Tucson Arizona',
      'dentist Mesa Arizona',
      'dentist Tempe Arizona',
      'dentist Albuquerque New Mexico',
      'dentist Santa Fe New Mexico',
      'dentist Salt Lake City Utah',
      'dentist Provo Utah',
      'dentist Ogden Utah',
      'dentist Eugene Oregon',
      'dentist Salem Oregon',
      'dentist Bend Oregon',
      'dentist Tacoma Washington',
      'dentist Olympia Washington',
      'dentist Bellingham Washington',
      'dentist Anchorage Alaska',
      'dentist Honolulu Hawaii',
      'dentist Sioux Falls South Dakota',
      'dentist Fargo North Dakota',
      'dentist Omaha Nebraska',
      'dentist Lincoln Nebraska',
      'dentist Wichita Kansas',
      'dentist Topeka Kansas',
      'dentist Springfield Missouri',
      'dentist Columbia Missouri',
      'dentist Little Rock Arkansas',
      'dentist Fayetteville Arkansas',
      'dentist Jackson Mississippi',
      'dentist Gulfport Mississippi',
      'dentist Birmingham Alabama',
      'dentist Mobile Alabama',
      'dentist Knoxville Tennessee',
      'dentist Memphis Tennessee',
      'dentist Lafayette Louisiana',
      'dentist Baton Rouge Louisiana',
      'dentist Shreveport Louisiana',
      'dentist Fort Smith Arkansas',
      'dentist Evansville Indiana',
      'dentist Fort Wayne Indiana',
      'dentist South Bend Indiana',
      'dentist Akron Ohio',
      'dentist Dayton Ohio',
      'dentist Toledo Ohio',
      'dentist Youngstown Ohio',
      'dentist Erie Pennsylvania',
      'dentist Scranton Pennsylvania',
      'dentist Allentown Pennsylvania',
      'dentist Syracuse New York',
      'dentist Rochester New York',
      'dentist Buffalo New York',
      'dentist Albany New York',
      'dentist Burlington Vermont',
      'dentist Portland Maine',
      'dentist Manchester New Hampshire',
    ],
  },

  UK: {
    code: 'UK',
    lang: 'en',
    pdfFile: 'smartflowdev-dental-proposal-en.pdf',
    pdfFilename: 'SmartflowDev-AI-Chatbot-Proposal.pdf',
    queries: [
      'dentist Birmingham UK',
      'dentist Manchester UK',
      'dentist Leeds UK',
      'dentist Sheffield UK',
      'dentist Bristol UK',
      'dentist Liverpool UK',
      'dentist Newcastle UK',
      'dentist Nottingham UK',
      'dentist Cardiff UK',
      'dentist Belfast UK',
      'dentist Edinburgh UK',
      'dentist Glasgow UK',
      'dentist Aberdeen UK',
      'dentist Dundee UK',
      'dentist Norwich UK',
      'dentist Coventry UK',
      'dentist Leicester UK',
      'dentist Hull UK',
      'dentist Stoke-on-Trent UK',
      'dentist Wolverhampton UK',
    ],
  },

  CA: {
    code: 'CA',
    lang: 'en',
    pdfFile: 'smartflowdev-dental-proposal-en.pdf',
    pdfFilename: 'SmartflowDev-AI-Chatbot-Proposal.pdf',
    queries: [
      'dentist Toronto Ontario',
      'dentist Vancouver British Columbia',
      'dentist Calgary Alberta',
      'dentist Edmonton Alberta',
      'dentist Ottawa Ontario',
      'dentist Mississauga Ontario',
      'dentist Winnipeg Manitoba',
      'dentist Quebec City Quebec',
      'dentist Hamilton Ontario',
      'dentist London Ontario',
    ],
  },

  AU: {
    code: 'AU',
    lang: 'en',
    pdfFile: 'smartflowdev-dental-proposal-en.pdf',
    pdfFilename: 'SmartflowDev-AI-Chatbot-Proposal.pdf',
    queries: [
      'dentist Sydney NSW',
      'dentist Melbourne Victoria',
      'dentist Brisbane Queensland',
      'dentist Perth Western Australia',
      'dentist Adelaide South Australia',
      'dentist Canberra ACT',
      'dentist Cairns Queensland',
      'dentist Townsville Queensland',
      'dentist Geelong Victoria',
      'dentist Sunshine Coast Queensland',
    ],
  },

  NZ: {
    code: 'NZ',
    lang: 'en',
    pdfFile: 'smartflowdev-dental-proposal-en.pdf',
    pdfFilename: 'SmartflowDev-AI-Chatbot-Proposal.pdf',
    queries: [
      'dentist Auckland New Zealand',
      'dentist Christchurch New Zealand',
      'dentist Wellington New Zealand',
      'dentist Hamilton New Zealand',
      'dentist Tauranga New Zealand',
      'dentist Dunedin New Zealand',
      'dentist Palmerston North New Zealand',
    ],
  },

  IE: {
    code: 'IE',
    lang: 'en',
    pdfFile: 'smartflowdev-dental-proposal-en.pdf',
    pdfFilename: 'SmartflowDev-AI-Chatbot-Proposal.pdf',
    queries: [
      'dentist Dublin Ireland',
      'dentist Cork Ireland',
      'dentist Galway Ireland',
      'dentist Limerick Ireland',
      'dentist Waterford Ireland',
      'dentist Drogheda Ireland',
    ],
  },

  // ─── Hungarian market (új!) ─────────────────────────────

  HU: {
    code: 'HU',
    lang: 'hu',
    pdfFile: 'smartflowdev-dental-proposal-hu.pdf',
    pdfFilename: 'SmartflowDev-AI-Chatbot-Ajanlat.pdf',
    queries: [
      'fogorvos Budapest',
      'fogászat Budapest',
      'fogorvos Debrecen',
      'fogászat Debrecen',
      'fogorvos Szeged',
      'fogászat Szeged',
      'fogorvos Miskolc',
      'fogászat Miskolc',
      'fogorvos Pécs',
      'fogászat Pécs',
      'fogorvos Győr',
      'fogászat Győr',
      'fogorvos Nyíregyháza',
      'fogorvos Kecskemét',
      'fogorvos Székesfehérvár',
      'fogászat Székesfehérvár',
      'fogorvos Szombathely',
      'fogorvos Szolnok',
      'fogorvos Tatabánya',
      'fogorvos Kaposvár',
      'fogorvos Veszprém',
      'fogorvos Békéscsaba',
      'fogorvos Zalaegerszeg',
      'fogorvos Sopron',
      'fogorvos Eger',
      'fogorvos Nagykanizsa',
      'fogorvos Dunaújváros',
      'fogorvos Hódmezővásárhely',
      'fogorvos Salgótarján',
      'fogorvos Esztergom',
    ],
  },
};

/**
 * Get a flat list of {query, country} pairs for the requested market codes.
 */
export function getQueriesForMarkets(
  marketCodes: string[]
): Array<{ query: string; country: string }> {
  const result: Array<{ query: string; country: string }> = [];
  for (const code of marketCodes) {
    const m = MARKETS[code.toUpperCase()];
    if (!m) continue;
    for (const query of m.queries) {
      result.push({ query, country: m.code });
    }
  }
  return result;
}

/**
 * Get the Market config for a given country code (lookup by lead.country).
 * Returns null if unknown.
 */
export function getMarket(countryCode: string): Market | null {
  return MARKETS[countryCode.toUpperCase()] || null;
}

/**
 * Parse a comma-separated market list from CLI/CI input.
 * Examples: "US", "US,UK", "HU", "US,UK,HU"
 * Defaults to all English markets if empty.
 */
export function parseMarketList(input: string | undefined): string[] {
  if (!input || !input.trim()) {
    return ['US', 'UK', 'CA', 'AU', 'NZ', 'IE'];
  }
  return input
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s in MARKETS);
}
