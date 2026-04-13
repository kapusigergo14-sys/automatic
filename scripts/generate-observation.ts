import { OutdatedScore } from './score-outdated';

/**
 * Picks the strongest/most specific observation from a site's OutdatedScore result.
 * Priority order: most concrete + most credible first.
 * Returns a single-sentence observation suitable for the email body.
 */
export function generateObservation(score: OutdatedScore, industry?: string): string {
  const obs = score.observations;
  const sig = score.signals;
  const ind = (industry || 'business').toLowerCase();
  const industryWord = ind === 'dental' ? 'patients'
    : ind === 'legal' ? 'clients'
    : ind === 'roofing' || ind === 'plumbing' || ind === 'hvac' || ind === 'electrical' ? 'homeowners'
    : ind === 'auto' ? 'drivers'
    : ind === 'real estate' ? 'buyers'
    : ind === 'medical' ? 'patients'
    : 'customers';

  // 1. Page weight (very concrete, hard to argue with)
  if (obs.pageWeightMb !== null && obs.pageWeightMb >= 4) {
    return `your homepage downloads ${obs.pageWeightMb}MB on mobile — most ${industryWord} bail before it finishes loading`;
  }

  // 2. LCP (from PSI — user-felt slowness)
  if (obs.lcpSeconds !== null && obs.lcpSeconds >= 4) {
    return `your largest content takes ${obs.lcpSeconds}s to appear on mobile, and Google uses that number in search rankings`;
  }

  // 3. PSI score (very concrete, validatable)
  if (sig.psiMobileScore !== null && sig.psiMobileScore < 40) {
    return `Google's PageSpeed gives your mobile site ${sig.psiMobileScore}/100 — and mobile is where most ${industryWord} search`;
  }

  // 4. Ancient jQuery version
  if (obs.jqueryVersion && /^1\./.test(obs.jqueryVersion)) {
    return `your site is running jQuery ${obs.jqueryVersion} — that version shipped in 2012 and stopped getting security fixes years ago`;
  }

  // 5. Slow load
  if (score.loadTime !== null && score.loadTime > 5) {
    return `your homepage took ${score.loadTime.toFixed(1)}s to load in our audit — mobile visitors usually bounce after 3s`;
  }

  // 6. Exposed directory listing (security flag)
  if (sig.exposedDirListing) {
    return `your /wp-includes/ folder is publicly browsable — a security flag worth closing this week`;
  }

  // 7. Broken builder shortcodes visible
  if (sig.brokenBuilder) {
    return `there are raw page-builder shortcodes showing on your public pages — they should render as content`;
  }

  // 8. No viewport meta (mobile broken)
  if (sig.noViewport) {
    return `your pages don't declare a viewport tag, so mobile browsers render them at desktop width`;
  }

  // 9. Unoptimized images
  if (obs.unoptimizedImages) {
    return `your images aren't using modern formats (WebP/AVIF), which Google flags as a speed issue`;
  }

  // 10. Render-blocking resources
  if (obs.renderBlockingCount !== null && obs.renderBlockingCount >= 5) {
    return `${obs.renderBlockingCount} scripts are blocking your page from rendering on mobile — this hurts first-impression speed`;
  }

  // 11. WordPress + jQuery generic
  if (sig.wordpress && sig.jquery) {
    return `your site runs on an older WordPress stack with jQuery, which is slower and harder to maintain than modern options`;
  }

  // 12. Just WordPress
  if (sig.wordpress) {
    return `your WordPress theme looks dated compared to what competitors are rolling out this year`;
  }

  // Fallback — generic
  return `your site's design looks dated compared to what ${industryWord} see on competitor sites`;
}

// CLI test
if (require.main === module) {
  const mockScore: OutdatedScore = {
    score: 65,
    breakdown: 'wp=25;jq=15;legacy=10;heavy=15(6MB)',
    signals: {
      wordpress: true, jquery: true, exposedDirListing: false, brokenBuilder: false,
      legacyPages: true, noViewport: false, psiMobileScore: null,
      modernFramework: false, tailwind: false, modernCms: false, noHttps: false, flashSilverlight: false,
    },
    observations: {
      jqueryVersion: '3.7.1', pageWeightMb: 6, lcpSeconds: null,
      renderBlockingCount: null, unoptimizedImages: false,
    },
    loadTime: 0.9, blocked: false,
  };
  console.log('Observation:', generateObservation(mockScore, 'Dental'));
}
