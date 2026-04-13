import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, Page } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';

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

interface VisualDetails {
  visual_modernity: number;
  image_quality: number;
  layout_cleanliness: number;
  color_scheme: number;
  typography: number;
  pre2018: boolean;
  trustworthy: boolean;
  old_copyright: boolean;
}

interface ConversionDetails {
  no_cta_above_fold: boolean;
  no_online_booking: boolean;
  no_phone_in_header: boolean;
  no_contact_form: boolean;
  no_social_proof: boolean;
  no_email_signup: boolean;
  no_contact_in_nav: boolean;
}

interface MobileDetails {
  no_viewport: boolean;
  mobile_experience: number;
  horizontal_scroll: boolean;
  small_buttons: boolean;
  slow_mobile_load: boolean;
}

interface TrustDetails {
  http_not_https: boolean;
  no_team_page: boolean;
  no_google_reviews: boolean;
  old_copyright_year: boolean;
  no_privacy_policy: boolean;
  broken_links: number;
}

interface TechDetails {
  slow_load: boolean;
  no_sitemap: boolean;
  large_page: boolean;
  no_schema: boolean;
  high_lcp: boolean;
}

interface CategoryScore {
  score: number;
  details: Record<string, any>;
}

interface Breakdown {
  visual: CategoryScore;
  conversion: CategoryScore;
  mobile: CategoryScore;
  trust: CategoryScore;
  tech: CategoryScore;
}

interface AnalysisResult {
  lead: Lead;
  company: string;
  url: string;
  outdatedScore: number;
  breakdown: Breakdown;
  aiAnalysis: { desktop: any; mobile: any };
  contact_email: string | null;
  screenshots: { desktop: string; mobile: string };
  screenshotPath: string;
  loadTimeMs: number;
  analyzedAt: string;
  error?: string;
  // legacy compat
  checks?: Record<string, { detected: boolean; points: number }>;
  aiScore?: number | null;
}

function parseArgs(): { input?: string; url?: string; name?: string } {
  const args = process.argv.slice(2);
  let input: string | undefined;
  let url: string | undefined;
  let name: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) input = args[i + 1];
    if (args[i] === '--url' && args[i + 1]) url = args[i + 1];
    if (args[i] === '--name' && args[i + 1]) name = args[i + 1];
  }
  if (!input && !url) {
    console.error('Usage:');
    console.error('  npx ts-node scripts/analyze.ts --input output/leads/file.json');
    console.error('  npx ts-node scripts/analyze.ts --url "https://example.com" --name "Test"');
    process.exit(1);
  }
  return { input, url, name };
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

async function callAI(
  anthropic: Anthropic,
  screenshotBase64: string,
  prompt: string,
): Promise<any> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
        },
        { type: 'text', text: prompt },
      ],
    }],
  });
  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  // Extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]);
}

// ── VISUAL QUALITY (30 points max) ──────────────────────────────────
function scoreVisual(ai: VisualDetails | null, html: string): CategoryScore {
  let score = 0;
  const details: Record<string, any> = {};

  if (ai) {
    const ratings = [ai.visual_modernity, ai.image_quality, ai.layout_cleanliness, ai.color_scheme, ai.typography];
    const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    const ratingScore = Math.round(((10 - avg) / 10) * 15);
    details.avg_rating = +avg.toFixed(1);
    details.rating_score = ratingScore;
    score += ratingScore;

    if (ai.pre2018) { score += 6; details.pre2018 = true; }
    if (!ai.trustworthy) { score += 6; details.not_trustworthy = true; }
  }

  // Old copyright check
  const copyrightMatch = /©.*?(20[01]\d|201[0-8])/i.test(html);
  if (copyrightMatch) { score += 3; details.old_copyright = true; }

  details.total = Math.min(30, score);
  return { score: Math.min(30, score), details };
}

// ── CONVERSION (25 points max) ───────────────────────────────────────
function scoreConversion(htmlChecks: ConversionDetails): CategoryScore {
  let score = 0;
  const details: Record<string, any> = { ...htmlChecks };

  if (htmlChecks.no_cta_above_fold) score += 5;
  if (htmlChecks.no_online_booking) score += 5;
  if (htmlChecks.no_phone_in_header) score += 3;
  if (htmlChecks.no_contact_form) score += 3;
  if (htmlChecks.no_social_proof) score += 3;
  if (htmlChecks.no_email_signup) score += 3;
  if (htmlChecks.no_contact_in_nav) score += 3;

  details.total = Math.min(25, score);
  return { score: Math.min(25, score), details };
}

// ── MOBILE UX (20 points max) ────────────────────────────────────────
function scoreMobile(checks: MobileDetails): CategoryScore {
  let score = 0;
  const details: Record<string, any> = { ...checks };

  if (checks.no_viewport) score += 5;
  // mobile_experience: AI rating 1-10, inverted: (10-rating)*0.5
  const mobileAiScore = Math.round((10 - checks.mobile_experience) * 0.5 * 10) / 10;
  score += Math.max(0, Math.min(5, mobileAiScore));
  details.mobile_ai_score = mobileAiScore;
  if (checks.horizontal_scroll) score += 3;
  if (checks.small_buttons) score += 3;
  if (checks.slow_mobile_load) score += 4;

  details.total = Math.min(20, score);
  return { score: Math.min(20, score), details };
}

// ── TRUST (15 points max) ────────────────────────────────────────────
function scoreTrust(checks: TrustDetails): CategoryScore {
  let score = 0;
  const details: Record<string, any> = { ...checks };

  if (checks.http_not_https) score += 4;
  if (checks.no_team_page) score += 3;
  if (checks.no_google_reviews) score += 2;
  if (checks.old_copyright_year) score += 2;
  if (checks.no_privacy_policy) score += 2;
  if (checks.broken_links > 0) score += 2;

  details.total = Math.min(15, score);
  return { score: Math.min(15, score), details };
}

// ── TECH PERFORMANCE (10 points max) ─────────────────────────────────
function scoreTech(checks: TechDetails): CategoryScore {
  let score = 0;
  const details: Record<string, any> = { ...checks };

  if (checks.slow_load) score += 3;
  if (checks.no_sitemap) score += 1;
  if (checks.large_page) score += 2;
  if (checks.no_schema) score += 1;
  if (checks.high_lcp) score += 3;

  details.total = Math.min(10, score);
  return { score: Math.min(10, score), details };
}

// ── MAIN ANALYSIS ────────────────────────────────────────────────────
async function analyzeWebsite(
  page: Page,
  url: string,
  screenshotDir: string,
  slug: string,
  anthropic: Anthropic | null,
): Promise<Omit<AnalysisResult, 'lead' | 'analyzedAt'>> {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const desktopPath = path.join(screenshotDir, `${slug}-desktop.png`);
  const mobilePath = path.join(screenshotDir, `${slug}-mobile.png`);

  // ── Navigate (desktop) - wait longer for JS-rendered sites ──
  await page.setViewportSize({ width: 1280, height: 900 });
  const start = Date.now();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    // Fallback: try domcontentloaded if networkidle times out
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch { /* partial load ok */ }
  }
  // Wait extra for JS rendering (SPA sites, React, Angular, etc.)
  await page.waitForTimeout(5000);
  const loadTimeMs = Date.now() - start;

  // ── Desktop screenshot ──
  await page.screenshot({ path: desktopPath, fullPage: false });

  // ── One big page.evaluate for all HTML checks ──
  const htmlChecks = await page.evaluate((pageUrl: string) => {
    const html = document.documentElement.outerHTML;
    const htmlLower = html.toLowerCase();

    // CONVERSION checks
    const noCtaAboveFold = (() => {
      const btns = document.querySelectorAll('a, button');
      const ctaWords = /book|schedule|call|contact|get.*quote|free.*consult|appointment|get.*started|sign.*up|buy|order/i;
      return !Array.from(btns).some(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < 800 && ctaWords.test(el.textContent || '');
      });
    })();

    const bookingKeywords = /calendly|localmed|booking|appointment|schedule|acuity|zocdoc|mindbody/i;
    const noOnlineBooking = !bookingKeywords.test(html);

    const headerEl = document.querySelector('header, nav, [role="banner"]');
    const headerHtml = headerEl ? headerEl.innerHTML : '';
    const phonePattern = /tel:|(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
    const noPhoneInHeader = !phonePattern.test(headerHtml);

    const forms = document.querySelectorAll('form');
    const hasContactForm = Array.from(forms).some(f => {
      const fHtml = f.innerHTML.toLowerCase();
      return (fHtml.includes('email') || fHtml.includes('message') || fHtml.includes('name'));
    });
    const noContactForm = !hasContactForm;

    const proofKeywords = /review|testimonial|stars?[- ]rating|rating|★|⭐|google.*review/i;
    const noSocialProof = !proofKeywords.test(html);

    const signupKeywords = /newsletter|subscribe|email.*signup|mailing.*list|mailchimp|convertkit/i;
    const noEmailSignup = !signupKeywords.test(htmlLower);

    const navLinks = document.querySelectorAll('nav a, header a, [role="navigation"] a');
    const hasContactNav = Array.from(navLinks).some(a =>
      /contact/i.test(a.textContent || '') || /contact/i.test((a as HTMLAnchorElement).href || '')
    );
    const noContactInNav = !hasContactNav;

    // MOBILE check: viewport
    const hasViewport = !!document.querySelector('meta[name="viewport"]');

    // TRUST checks
    const isHttp = pageUrl.startsWith('http://');

    const allLinks = Array.from(document.querySelectorAll('a'));
    const teamPageKeywords = /about|team|staff|doctor|attorney|lawyer|our.*people|who.*we.*are/i;
    const noTeamPage = !allLinks.some(a =>
      teamPageKeywords.test(a.textContent || '') || teamPageKeywords.test((a as HTMLAnchorElement).href || '')
    );

    const googleReviewKeywords = /google.*review|g\.co\/kgs|maps\.google|elfsight.*google|trustindex/i;
    const noGoogleReviews = !googleReviewKeywords.test(html);

    const copyrightYearMatch = html.match(/©\s*(?:copyright\s*)?(\d{4})/i);
    const copyrightYear = copyrightYearMatch ? parseInt(copyrightYearMatch[1], 10) : null;
    const oldCopyrightYear = copyrightYear !== null && copyrightYear < 2024;

    const privacyKeywords = /privacy.*policy|terms.*(?:of|&).*(?:service|use|conditions)|legal/i;
    const noPrivacyPolicy = !allLinks.some(a =>
      privacyKeywords.test(a.textContent || '') || privacyKeywords.test((a as HTMLAnchorElement).href || '')
    );

    // Collect 3 random internal links for broken link check
    const internalLinks = allLinks
      .map(a => (a as HTMLAnchorElement).href)
      .filter(href => href && href.startsWith(window.location.origin) && !href.includes('#') && href !== window.location.href)
      .slice(0, 20);
    const shuffled = internalLinks.sort(() => Math.random() - 0.5).slice(0, 3);

    // TECH checks
    const hasSchema = htmlLower.includes('application/ld+json');
    const pageSize = new Blob([html]).size;

    // Contact email extraction
    const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const contactEmail = emailMatch ? emailMatch[0] : null;

    // Full HTML for copyright regex in visual scoring
    const fullHtml = html;

    return {
      conversion: {
        no_cta_above_fold: noCtaAboveFold,
        no_online_booking: noOnlineBooking,
        no_phone_in_header: noPhoneInHeader,
        no_contact_form: noContactForm,
        no_social_proof: noSocialProof,
        no_email_signup: noEmailSignup,
        no_contact_in_nav: noContactInNav,
      },
      trust: {
        http_not_https: isHttp,
        no_team_page: noTeamPage,
        no_google_reviews: noGoogleReviews,
        old_copyright_year: oldCopyrightYear,
        no_privacy_policy: noPrivacyPolicy,
      },
      tech: {
        no_schema: !hasSchema,
        large_page: pageSize > 2 * 1024 * 1024,
        page_size_bytes: pageSize,
      },
      mobile: {
        no_viewport: !hasViewport,
      },
      internalLinks: shuffled,
      contactEmail,
      fullHtml,
    };
  }, url).catch(() => ({
    conversion: {
      no_cta_above_fold: false, no_online_booking: false, no_phone_in_header: false,
      no_contact_form: false, no_social_proof: false, no_email_signup: false, no_contact_in_nav: false,
    },
    trust: {
      http_not_https: url.startsWith('http://'), no_team_page: false, no_google_reviews: false,
      old_copyright_year: false, no_privacy_policy: false,
    },
    tech: { no_schema: false, large_page: false, page_size_bytes: 0 },
    mobile: { no_viewport: false },
    internalLinks: [] as string[],
    contactEmail: null as string | null,
    fullHtml: '',
  }));

  // ── Check broken links ──
  let brokenLinks = 0;
  for (const link of htmlChecks.internalLinks) {
    try {
      const resp = await page.request.get(link, { timeout: 5000 });
      if (resp.status() >= 400) brokenLinks++;
    } catch { brokenLinks++; }
  }

  // ── Check sitemap ──
  let noSitemap = false;
  try {
    const origin = new URL(url).origin;
    const resp = await page.request.get(`${origin}/sitemap.xml`, { timeout: 5000 });
    noSitemap = resp.status() >= 400;
  } catch { noSitemap = true; }

  // ── LCP measurement ──
  let highLcp = false;
  try {
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) lcpValue = entries[entries.length - 1].startTime;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => { observer.disconnect(); resolve(lcpValue); }, 1000);
      });
    });
    highLcp = lcp > 2500;
  } catch { /* ignore */ }

  // ── Mobile screenshot ──
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: mobilePath, fullPage: false });

  // ── Mobile horizontal scroll check ──
  const horizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  }).catch(() => false);

  // ── Mobile load time (already loaded, use existing) ──
  const slowMobileLoad = loadTimeMs > 3000;

  // ── AI Analysis ──
  let desktopAI: VisualDetails | null = null;
  let mobileAI: { mobile_experience: number; small_buttons: boolean } | null = null;

  // AI ANALYSIS DISABLED - saving API credits. Using fallback scores.
  const SKIP_AI = true;
  if (anthropic && !SKIP_AI) {
    // Desktop AI call
    try {
      const desktopBase64 = fs.readFileSync(desktopPath).toString('base64');
      if (desktopBase64.length < 1000) {
        console.log(`      Desktop screenshot too small, skipping AI`);
      } else {
        desktopAI = await callAI(anthropic, desktopBase64,
          `Analyze this business website screenshot. Rate each 1-10 (1=terrible, 10=excellent):
1. visual_modernity - Does it look current (2024+) or outdated (pre-2018)?
2. image_quality - Sharp professional images or pixelated/stock?
3. layout_cleanliness - Spacious and organized or cluttered?
4. color_scheme - Modern and consistent or dated?
5. typography - Clean modern fonts or old-fashioned?

Answer Yes/No:
6. pre2018 - Does this look like it was designed before 2018?
7. trustworthy - Would you trust this business based on this website?

Reply ONLY as JSON: {"visual_modernity":N,"image_quality":N,"layout_cleanliness":N,"color_scheme":N,"typography":N,"pre2018":bool,"trustworthy":bool}`
        );
        if (desktopAI) console.log(`      AI Visual: modernity=${desktopAI.visual_modernity}, trustworthy=${desktopAI.trustworthy}`);
      }
    } catch (e: any) {
      console.log(`      Desktop AI failed: ${e.message?.slice(0, 80)}`);
      // Fallback: assume mediocre if AI fails
      desktopAI = { visual_modernity: 5, image_quality: 5, layout_cleanliness: 5, color_scheme: 5, typography: 5, pre2018: false, trustworthy: true, old_copyright: false };
    }

    // Mobile AI call
    try {
      const mobileBase64 = fs.readFileSync(mobilePath).toString('base64');
      if (mobileBase64.length < 1000) {
        console.log(`      Mobile screenshot too small, skipping AI`);
      } else {
        mobileAI = await callAI(anthropic, mobileBase64,
          `Analyze this mobile website screenshot (375x667). Rate:
1. mobile_experience - Overall mobile usability 1-10 (1=unusable, 10=excellent)
2. small_buttons - Are tap targets/buttons too small for mobile? (true/false)

Reply ONLY as JSON: {"mobile_experience":N,"small_buttons":bool}`
        );
        if (mobileAI) console.log(`      AI Mobile: experience=${mobileAI.mobile_experience}, small_buttons=${mobileAI.small_buttons}`);
      }
    } catch (e: any) {
      console.log(`      Mobile AI failed: ${e.message?.slice(0, 80)}`);
      mobileAI = { mobile_experience: 5, small_buttons: false };
    }
  }

  // ── Score each category ──
  const visual = scoreVisual(desktopAI, htmlChecks.fullHtml);
  const conversion = scoreConversion(htmlChecks.conversion as ConversionDetails);
  const mobile = scoreMobile({
    no_viewport: htmlChecks.mobile.no_viewport,
    mobile_experience: mobileAI?.mobile_experience ?? 5,
    horizontal_scroll: horizontalScroll,
    small_buttons: mobileAI?.small_buttons ?? false,
    slow_mobile_load: slowMobileLoad,
  });
  const trust = scoreTrust({
    ...htmlChecks.trust as Omit<TrustDetails, 'broken_links'>,
    broken_links: brokenLinks,
  });
  const tech = scoreTech({
    slow_load: loadTimeMs > 4000,
    no_sitemap: noSitemap,
    large_page: htmlChecks.tech.large_page,
    no_schema: htmlChecks.tech.no_schema,
    high_lcp: highLcp,
  });

  const outdatedScore = Math.min(100, visual.score + conversion.score + mobile.score + trust.score + tech.score);

  return {
    company: '',
    url,
    outdatedScore,
    breakdown: { visual, conversion, mobile, trust, tech },
    aiAnalysis: { desktop: desktopAI, mobile: mobileAI },
    contact_email: htmlChecks.contactEmail,
    screenshots: { desktop: desktopPath, mobile: mobilePath },
    screenshotPath: desktopPath,
    loadTimeMs,
  };
}

// ── BATCH ANALYSIS (called by pipeline.ts) ───────────────────────────
export async function analyze(inputPath: string): Promise<AnalysisResult[]> {
  const leads: Lead[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`\u{1F4CA} Analyzing ${leads.length} websites (5-category scoring)...`);

  let anthropic: Anthropic | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic();
  } else {
    console.log('   Warning: No ANTHROPIC_API_KEY - AI visual analysis disabled');
  }

  const browser = await chromium.launch({ headless: true });
  const results: AnalysisResult[] = [];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const slug = slugify(lead.name);
    console.log(`   [${i + 1}/${leads.length}] ${lead.name} - ${lead.website}`);

    const page = await browser.newPage();
    try {
      const result = await analyzeWebsite(
        page, lead.website,
        path.join('output', 'screenshots'),
        slug, anthropic,
      );
      result.company = lead.name;

      results.push({
        lead,
        ...result,
        analyzedAt: new Date().toISOString(),
      });

      const b = result.breakdown;
      console.log(`      Score: ${result.outdatedScore}/100 [V:${b.visual.score} C:${b.conversion.score} M:${b.mobile.score} T:${b.trust.score} P:${b.tech.score}] | ${result.loadTimeMs}ms`);
    } catch (err: any) {
      console.log(`      \u274C Failed: ${err.message}`);
      results.push({
        lead,
        company: lead.name,
        url: lead.website,
        outdatedScore: 0,
        breakdown: {
          visual: { score: 0, details: {} },
          conversion: { score: 0, details: {} },
          mobile: { score: 0, details: {} },
          trust: { score: 0, details: {} },
          tech: { score: 0, details: {} },
        },
        aiAnalysis: { desktop: null, mobile: null },
        contact_email: null,
        screenshots: { desktop: '', mobile: '' },
        screenshotPath: '',
        loadTimeMs: 0,
        analyzedAt: new Date().toISOString(),
        error: err.message,
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // Save results
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, '.json');
  const outputPath = path.join(dir, `${base}-analyzed.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`   Saved analysis to ${outputPath}`);

  return results;
}

// ── SINGLE URL ANALYSIS (CLI mode) ──────────────────────────────────
async function analyzeSingleUrl(url: string, name: string): Promise<void> {
  const slug = slugify(name);

  let anthropic: Anthropic | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic();
  } else {
    console.log('Warning: No ANTHROPIC_API_KEY - AI visual analysis disabled');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log(`Analyzing: ${name} - ${url}`);
    const result = await analyzeWebsite(
      page, url,
      path.join('output', 'screenshots'),
      slug, anthropic,
    );
    result.company = name;

    const output = {
      ...result,
      analyzedAt: new Date().toISOString(),
    };

    const outDir = path.join('output', 'leads');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${slug}-analysis.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

    const b = result.breakdown;
    console.log(`\nResult: ${result.outdatedScore}/100`);
    console.log(`  Visual:     ${b.visual.score}/30`);
    console.log(`  Conversion: ${b.conversion.score}/25`);
    console.log(`  Mobile:     ${b.mobile.score}/20`);
    console.log(`  Trust:      ${b.trust.score}/15`);
    console.log(`  Tech:       ${b.tech.score}/10`);
    console.log(`  Email:      ${result.contact_email || 'none'}`);
    console.log(`  Saved to:   ${outPath}`);
  } finally {
    await page.close();
    await browser.close();
  }
}

// ── CLI ENTRY POINT ──────────────────────────────────────────────────
if (require.main === module) {
  const { input, url, name } = parseArgs();

  if (url) {
    analyzeSingleUrl(url, name || 'unknown').catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
  } else if (input) {
    analyze(input).catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
  }
}
