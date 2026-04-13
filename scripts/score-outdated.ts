import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium, Page } from 'playwright';

export interface OutdatedScore {
  score: number;                // 0-100, higher = more outdated
  breakdown: string;            // e.g. "wp=25;jq=15;psiPoor=15"
  signals: {
    wordpress: boolean;
    jquery: boolean;
    exposedDirListing: boolean;
    brokenBuilder: boolean;
    legacyPages: boolean;
    noViewport: boolean;
    psiMobileScore: number | null;
    // Modern signals (negative = NOT outdated)
    modernFramework: boolean;  // React/Next/Nuxt/Svelte
    tailwind: boolean;
    modernCms: boolean;        // Webflow/Squarespace/Wix
    noHttps: boolean;
    flashSilverlight: boolean;
  };
  observations: {
    jqueryVersion: string | null;        // "1.12.4"
    pageWeightMb: number | null;         // 3.2
    lcpSeconds: number | null;           // 4.8 (from PSI)
    renderBlockingCount: number | null;  // 7 (from PSI)
    unoptimizedImages: boolean;          // true
  };
  loadTime: number | null;      // seconds (DOM content loaded)
  blocked: boolean;             // true if site blocked our scraper
  error?: string;
}

function parseArgs(): { url: string; skipPsi: boolean } {
  const args = process.argv.slice(2);
  let url = '', skipPsi = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) url = args[i + 1];
    if (args[i] === '--no-psi') skipPsi = true;
  }
  if (!url) {
    console.error('Usage: npx ts-node scripts/score-outdated.ts --url https://example.com [--no-psi]');
    process.exit(1);
  }
  return { url, skipPsi };
}

async function fetchHtmlSignals(page: Page): Promise<{ signals: Partial<OutdatedScore['signals']>; jqueryVersion: string | null }> {
  const html = await page.content();

  const wordpress = /wp-content|wp-includes|wp-json/i.test(html);
  const jquery = /jquery(\.min)?\.js|wp-includes\/js\/jquery/i.test(html);

  // jQuery version detection. Common patterns:
  //   jquery/jquery.min.js?ver=3.7.1
  //   jquery-1.12.4(.min).js
  //   jquery/3.5.1/jquery.min.js
  let jqueryVersion: string | null = null;
  const jqPatterns = [
    /jquery(?:[\/\-\.]min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i,
    /jquery[\/\-](\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i,
    /jquery\/(\d+\.\d+(?:\.\d+)?)\//i,
  ];
  for (const re of jqPatterns) {
    const m = html.match(re);
    if (m) { jqueryVersion = m[1]; break; }
  }

  // Broken builder: raw shortcodes leaking in content, WP debug warnings, Divi/VC fragments
  const brokenBuilder = /\[\/?et_pb_[a-z_]+\]|\[\/?vc_[a-z_]+\]|\[\/?cs_[a-z_]+\]|WordPress database error|PHP (Warning|Notice|Fatal error)|Web Hosting by Turbify|Powered by Yahoo/i.test(html);

  // Legacy page patterns in links
  const legacyPages = /href=["'][^"']*\.(html|php|htm)(\?[^"']*)?["']/i.test(html);

  // Viewport check
  const noViewport = !/name=["']viewport["']/i.test(html);

  // Modern framework detection (negative signals)
  const modernFramework = /__NEXT_DATA__|__NUXT__|data-reactroot|svelte-|_app\.js/i.test(html);
  const tailwind = /tailwindcss|tw-/i.test(html);
  const modernCms = /Webflow|Squarespace|wix\.com|webflow\.com/i.test(html);
  const flashSilverlight = /<(object|embed)[^>]*(flash|silverlight|swf)/i.test(html);

  return {
    signals: { wordpress, jquery, brokenBuilder, legacyPages, noViewport, modernFramework, tailwind, modernCms, flashSilverlight },
    jqueryVersion,
  };
}

async function checkExposedDirListing(origin: string): Promise<boolean> {
  // Try common WP asset paths that sometimes have auto-index enabled
  const paths = [
    '/wp-includes/js/jquery/',
    '/wp-content/uploads/',
    '/wp-includes/js/',
    '/wp-content/plugins/',
  ];
  for (const p of paths) {
    try {
      const res = await fetch(origin + p, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadAuditBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (/<title>Index of \//i.test(text) || /<h1>Index of \//i.test(text)) {
        return true;
      }
    } catch { /* skip */ }
  }
  return false;
}

interface PsiDetails {
  score: number | null;
  lcpSeconds: number | null;
  renderBlockingCount: number | null;
  unoptimizedImages: boolean;
}

async function getPsiDetails(url: string): Promise<PsiDetails> {
  const empty: PsiDetails = { score: null, lcpSeconds: null, renderBlockingCount: null, unoptimizedImages: false };
  const key = process.env.PSI_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  apiUrl.searchParams.set('url', url);
  apiUrl.searchParams.set('strategy', 'mobile');
  apiUrl.searchParams.set('category', 'performance');
  if (key) apiUrl.searchParams.set('key', key);
  try {
    const res = await fetch(apiUrl.toString(), { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return empty;
    const data: any = await res.json();
    const perf = data?.lighthouseResult?.categories?.performance?.score;
    const score = typeof perf === 'number' ? Math.round(perf * 100) : null;
    const audits = data?.lighthouseResult?.audits || {};
    const lcpMs = audits['largest-contentful-paint']?.numericValue;
    const lcpSeconds = typeof lcpMs === 'number' ? Math.round(lcpMs / 100) / 10 : null;
    const renderBlockingCount = audits['render-blocking-resources']?.details?.items?.length ?? null;
    const uopt = audits['uses-optimized-images']?.score;
    const uwebp = audits['modern-image-formats']?.score ?? audits['uses-webp-images']?.score;
    const unoptimizedImages = (typeof uopt === 'number' && uopt < 1) || (typeof uwebp === 'number' && uwebp < 1);
    return { score, lcpSeconds, renderBlockingCount, unoptimizedImages };
  } catch {
    return empty;
  }
}

export async function scoreOutdated(url: string, opts: { skipPsi?: boolean } = {}): Promise<OutdatedScore> {
  const result: OutdatedScore = {
    score: 0,
    breakdown: '',
    signals: {
      wordpress: false, jquery: false, exposedDirListing: false, brokenBuilder: false,
      legacyPages: false, noViewport: false, psiMobileScore: null,
      modernFramework: false, tailwind: false, modernCms: false, noHttps: false, flashSilverlight: false,
    },
    observations: {
      jqueryVersion: null, pageWeightMb: null, lcpSeconds: null,
      renderBlockingCount: null, unoptimizedImages: false,
    },
    loadTime: null,
    blocked: false,
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // Track total transferred bytes via response listener
  let totalBytes = 0;
  page.on('response', async (resp) => {
    try {
      const cl = resp.headers()['content-length'];
      if (cl) {
        const n = parseInt(cl, 10);
        if (!isNaN(n)) totalBytes += n;
      }
    } catch { /* skip */ }
  });

  try {
    const t0 = Date.now();
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    result.loadTime = (Date.now() - t0) / 1000;

    if (!resp || resp.status() >= 400) {
      result.blocked = true;
      result.error = `HTTP ${resp?.status() || 'no-response'}`;
      await browser.close();
      return result;
    }

    // Allow a bit more time for assets to land
    await page.waitForTimeout(1500);

    // HTML signals from live page
    const { signals: htmlSignals, jqueryVersion } = await fetchHtmlSignals(page);
    Object.assign(result.signals, htmlSignals);
    // Check if site is HTTP only (no HTTPS)
    result.signals.noHttps = url.startsWith('http://') && !url.startsWith('https://');
    result.observations.jqueryVersion = jqueryVersion;

    // Page weight (transferred content-length sum)
    if (totalBytes > 0) {
      result.observations.pageWeightMb = Math.round((totalBytes / 1024 / 1024) * 10) / 10;
    }

    // Exposed directory listing check (separate requests)
    try {
      const origin = new URL(url).origin;
      result.signals.exposedDirListing = await checkExposedDirListing(origin);
    } catch { /* skip */ }

    await browser.close();
  } catch (err: any) {
    try { await browser.close(); } catch {}
    result.blocked = true;
    result.error = err.message?.slice(0, 100);
    return result;
  }

  // PageSpeed Insights (separate API call, optional)
  if (!opts.skipPsi) {
    const psi = await getPsiDetails(url);
    result.signals.psiMobileScore = psi.score;
    result.observations.lcpSeconds = psi.lcpSeconds;
    result.observations.renderBlockingCount = psi.renderBlockingCount;
    result.observations.unoptimizedImages = psi.unoptimizedImages;
  }

  // ═══ SCORE v2 — Calculate outdated score ═══
  const parts: string[] = [];
  let score = 0;

  // --- Positive signals (outdated) ---
  // WordPress (lowered from 25 — modern WP themes exist)
  if (result.signals.wordpress) { score += 15; parts.push('wp=15'); }

  // jQuery — differentiated by version
  if (result.observations.jqueryVersion) {
    if (/^1\./.test(result.observations.jqueryVersion)) {
      score += 20; parts.push(`jq1x=20(${result.observations.jqueryVersion})`);
    } else if (/^2\./.test(result.observations.jqueryVersion)) {
      score += 10; parts.push(`jq2x=10(${result.observations.jqueryVersion})`);
    } else {
      score += 5; parts.push(`jq3x=5(${result.observations.jqueryVersion})`);
    }
  } else if (result.signals.jquery) {
    score += 5; parts.push('jq=5');
  }

  if (result.signals.exposedDirListing) { score += 15; parts.push('dir=15'); }
  if (result.signals.brokenBuilder)     { score += 20; parts.push('broken=20'); }
  if (result.signals.legacyPages)       { score += 10; parts.push('legacy=10'); }
  if (result.signals.noViewport)        { score += 15; parts.push('noviewport=15'); }

  // PSI mobile
  if (typeof result.signals.psiMobileScore === 'number') {
    if (result.signals.psiMobileScore < 30) {
      score += 20; parts.push(`psiCritical=20(${result.signals.psiMobileScore})`);
    } else if (result.signals.psiMobileScore < 50) {
      score += 10; parts.push(`psiPoor=10(${result.signals.psiMobileScore})`);
    }
  }

  // Slow load
  if (result.loadTime !== null && result.loadTime > 5) {
    score += 10; parts.push(`slow=10(${result.loadTime.toFixed(1)}s)`);
  }

  // Heavy page
  if (result.observations.pageWeightMb !== null) {
    if (result.observations.pageWeightMb >= 6) {
      score += 15; parts.push(`heavy=15(${result.observations.pageWeightMb}MB)`);
    } else if (result.observations.pageWeightMb >= 4) {
      score += 10; parts.push(`heavy=10(${result.observations.pageWeightMb}MB)`);
    }
  }

  // Render-blocking
  if (result.observations.renderBlockingCount !== null && result.observations.renderBlockingCount >= 5) {
    score += 5; parts.push(`blocking=5(${result.observations.renderBlockingCount})`);
  }

  // LCP
  if (result.observations.lcpSeconds !== null && result.observations.lcpSeconds >= 4) {
    score += 10; parts.push(`slowLcp=10(${result.observations.lcpSeconds}s)`);
  }

  // No HTTPS
  if (result.signals.noHttps) { score += 10; parts.push('noHttps=10'); }

  // Flash/Silverlight (ancient tech)
  if (result.signals.flashSilverlight) { score += 15; parts.push('flash=15'); }

  // --- Negative signals (modern = NOT outdated) ---
  if (result.signals.modernFramework) { score -= 15; parts.push('modern=-15'); }
  if (result.signals.tailwind) { score -= 10; parts.push('tailwind=-10'); }
  if (result.signals.modernCms) { score -= 10; parts.push('modernCms=-10'); }

  result.score = Math.max(0, Math.min(100, score));
  result.breakdown = parts.join(';') || 'no_signals';
  return result;
}

if (require.main === module) {
  const { url, skipPsi } = parseArgs();
  console.log(`Scoring outdated signals for ${url}${skipPsi ? ' (skipping PSI)' : ''}...`);
  scoreOutdated(url, { skipPsi }).then(result => {
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nOutdated score: ${result.score}/100`);
    console.log(`Signals: ${result.breakdown}`);
    console.log(`Verdict: ${result.score >= 40 ? '✓ OUTDATED — email it' : '✗ MODERN — skip'}`);
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
