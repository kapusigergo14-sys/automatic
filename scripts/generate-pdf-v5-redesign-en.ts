/**
 * generate-pdf-v5-redesign-en.ts — Website redesign pitch PDF (English)
 *
 * For outdated dental practice websites. Pitches a full redesign
 * (not chatbot add-on). Tiered pricing $800-$3000.
 *
 * Run: npx ts-node scripts/generate-pdf-v5-redesign-en.ts
 * Output: output/static/smartflowdev-dental-proposal-redesign-en.pdf
 */

import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';

const PAGE_W = 1280;
const PAGE_H = 720;
const OUT_DIR = path.resolve(__dirname, '../output/static');
const OUT_PATH = path.join(OUT_DIR, 'smartflowdev-dental-proposal-redesign-en.pdf');

function buildHtml(): string {
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${PAGE_W}px ${PAGE_H}px; margin: 0; }

    :root {
      --bg: #FAFAFA;
      --card: #FFFFFF;
      --ink: #0A0A0A;
      --ink-soft: #27272A;
      --ink-muted: #71717A;
      --ink-subtle: #A1A1AA;
      --border: #E4E4E7;
      --border-soft: #F4F4F5;

      /* Emerald accent to distinguish from chatbot (indigo) pitch */
      --accent: #059669;
      --accent-soft: #ECFDF5;
      --accent-dark: #047857;
      --accent-bright: #10B981;

      --lime: #84CC16;
      --amber: #F59E0B;
      --rose: #F43F5E;
    }

    body {
      margin: 0; padding: 0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--ink);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-feature-settings: 'cv11','ss01','ss03';
    }

    .page {
      width: ${PAGE_W}px;
      height: ${PAGE_H}px;
      overflow: hidden;
      position: relative;
      page-break-after: always;
      page-break-inside: avoid;
      background: var(--bg);
      padding: 72px 80px;
    }
    .page:last-child { page-break-after: auto; }

    .display {
      font-family: 'Inter', sans-serif;
      font-weight: 800;
      letter-spacing: -2.5px;
      line-height: 0.95;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--accent-soft);
      color: var(--accent);
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .pill-dot {
      width: 6px;
      height: 6px;
      background: var(--accent);
      border-radius: 50%;
    }

    .brand {
      position: absolute;
      top: 40px;
      left: 80px;
      font-weight: 800;
      font-size: 20px;
      letter-spacing: -0.5px;
      color: var(--ink);
    }
    .brand-accent { color: var(--accent); }

    .page-num {
      position: absolute;
      bottom: 40px;
      right: 80px;
      color: var(--ink-subtle);
      font-size: 12px;
      font-weight: 500;
    }

    /* ─── Page 1: Cover ──────────────────── */
    .cover {
      background: linear-gradient(135deg, #FAFAFA 0%, #ECFDF5 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 80px 100px;
    }
    .cover-headline {
      font-size: 88px;
      font-weight: 900;
      letter-spacing: -3.5px;
      line-height: 0.92;
      color: var(--ink);
      margin-bottom: 28px;
      max-width: 1000px;
    }
    .cover-headline span {
      color: var(--accent);
    }
    .cover-sub {
      font-size: 22px;
      line-height: 1.5;
      color: var(--ink-soft);
      max-width: 720px;
      margin-bottom: 48px;
    }
    .cover-pill {
      font-size: 14px;
      padding: 12px 24px;
      margin-bottom: 36px;
    }
    .cover-meta {
      display: flex;
      gap: 48px;
      color: var(--ink-muted);
      font-size: 14px;
      font-weight: 500;
    }
    .cover-meta strong {
      color: var(--ink);
      display: block;
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 2px;
    }

    /* ─── Page 2: Problem/Solution ──────── */
    .section-title {
      font-size: 56px;
      font-weight: 800;
      letter-spacing: -2px;
      line-height: 1;
      color: var(--ink);
      margin-bottom: 16px;
    }
    .section-sub {
      font-size: 18px;
      color: var(--ink-muted);
      line-height: 1.5;
      max-width: 760px;
      margin-bottom: 48px;
    }

    .compare-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 24px;
    }
    .compare-card {
      border-radius: 20px;
      padding: 32px;
      min-height: 380px;
    }
    .compare-card.bad {
      background: #FEF2F2;
      border: 1px solid #FECACA;
    }
    .compare-card.good {
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
    }
    .compare-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .compare-card.bad .compare-label { color: #DC2626; }
    .compare-card.good .compare-label { color: var(--accent); }
    .compare-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: var(--ink);
      margin-bottom: 20px;
      line-height: 1.15;
    }
    .compare-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .compare-list li {
      font-size: 15px;
      color: var(--ink-soft);
      padding-left: 28px;
      position: relative;
      line-height: 1.4;
    }
    .compare-list li::before {
      position: absolute;
      left: 0;
      top: 0;
      font-size: 18px;
      font-weight: 800;
    }
    .compare-card.bad .compare-list li::before { content: '✗'; color: #DC2626; }
    .compare-card.good .compare-list li::before { content: '✓'; color: var(--accent); }

    /* ─── Page 3: What we deliver ─── */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 16px;
    }
    .feature-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px 22px;
    }
    .feature-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--accent-soft);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 16px;
    }
    .feature-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--ink);
      letter-spacing: -0.2px;
      margin-bottom: 6px;
    }
    .feature-desc {
      font-size: 13px;
      color: var(--ink-muted);
      line-height: 1.5;
    }

    /* ─── Page 4: Process ──────────────── */
    .process-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-top: 24px;
    }
    .process-step {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px 24px;
      position: relative;
    }
    .process-num {
      display: inline-block;
      background: var(--accent);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 5px 12px;
      border-radius: 100px;
      margin-bottom: 16px;
    }
    .process-day {
      font-size: 22px;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .process-desc {
      font-size: 13px;
      color: var(--ink-muted);
      line-height: 1.5;
    }

    .guarantee-row {
      display: flex;
      gap: 18px;
      margin-top: 40px;
    }
    .guarantee-pill {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 22px;
      font-size: 13px;
      color: var(--ink-soft);
      font-weight: 500;
    }
    .guarantee-pill strong {
      color: var(--accent);
      font-weight: 700;
    }

    /* ─── Page 5: Trust ────────────────── */
    .trust-big {
      font-size: 44px;
      font-weight: 800;
      letter-spacing: -1.5px;
      line-height: 1.1;
      color: var(--ink);
      margin-top: 8px;
      margin-bottom: 32px;
      max-width: 1000px;
    }
    .trust-big span {
      color: var(--accent);
    }
    .trust-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 24px;
    }
    .trust-stat {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px 24px;
    }
    .trust-stat-num {
      font-size: 44px;
      font-weight: 900;
      letter-spacing: -2px;
      color: var(--accent);
      line-height: 1;
      margin-bottom: 10px;
    }
    .trust-stat-label {
      font-size: 14px;
      color: var(--ink-soft);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .trust-stat-desc {
      font-size: 12px;
      color: var(--ink-muted);
      line-height: 1.5;
    }

    /* ─── Page 6: Pricing ──────────────── */
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 24px;
    }
    .price-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px 28px;
      position: relative;
    }
    .price-card.featured {
      border: 2px solid var(--accent);
      background: linear-gradient(180deg, #FFFFFF 0%, #ECFDF5 100%);
    }
    .price-card.featured::before {
      content: '★ MOST POPULAR';
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      padding: 6px 14px;
      border-radius: 100px;
    }
    .price-tier {
      font-size: 14px;
      font-weight: 700;
      color: var(--ink-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .price-amount {
      font-size: 48px;
      font-weight: 900;
      letter-spacing: -2px;
      color: var(--ink);
      line-height: 1;
      margin-bottom: 6px;
    }
    .price-amount small {
      font-size: 18px;
      font-weight: 600;
      color: var(--ink-muted);
      letter-spacing: -0.3px;
    }
    .price-delivery {
      font-size: 13px;
      color: var(--accent);
      font-weight: 700;
      margin-bottom: 20px;
    }
    .price-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .price-list li {
      font-size: 13px;
      color: var(--ink-soft);
      padding-left: 22px;
      position: relative;
      line-height: 1.4;
    }
    .price-list li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: var(--accent);
      font-weight: 800;
    }

    /* ─── Page 7: CTA ──────────────────── */
    .cta {
      background: linear-gradient(135deg, #059669 0%, #10B981 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 80px 100px;
    }
    .cta .brand,
    .cta .page-num { color: rgba(255,255,255,0.75); }
    .cta .brand-accent { color: #fff; }
    .cta-headline {
      font-size: 80px;
      font-weight: 900;
      letter-spacing: -3px;
      line-height: 0.95;
      margin-bottom: 28px;
      max-width: 1000px;
    }
    .cta-sub {
      font-size: 20px;
      line-height: 1.5;
      margin-bottom: 48px;
      max-width: 760px;
      opacity: 0.95;
    }
    .cta-reply {
      background: #fff;
      color: var(--accent-dark);
      padding: 22px 36px;
      border-radius: 16px;
      font-size: 20px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      max-width: fit-content;
      box-shadow: 0 30px 80px rgba(0,0,0,0.15);
    }
    .cta-footer {
      margin-top: 48px;
      font-size: 14px;
      opacity: 0.85;
      line-height: 1.6;
    }
    .cta-footer strong { color: #fff; }
  `;

  const brand = `<div class="brand">smartflow<span class="brand-accent">dev</span></div>`;

  // Page 1: Cover
  const page1 = `
    <div class="page cover">
      ${brand}
      <div class="cover-pill pill"><span class="pill-dot"></span>Website redesign for dental practices</div>
      <h1 class="cover-headline">Modern dental websites<br><span>in 7 days.</span></h1>
      <p class="cover-sub">A focused small studio that redesigns dental practice websites with flat pricing — no agency retainer, no open-ended hours, no surprises.</p>
      <div class="cover-meta">
        <div><strong>$800 – $3,000</strong>Flat pricing</div>
        <div><strong>7 days</strong>Typical delivery</div>
        <div><strong>3 revisions</strong>Included</div>
      </div>
      <div class="page-num">01 / 07</div>
    </div>
  `;

  // Page 2: Problem / Solution
  const page2 = `
    <div class="page">
      ${brand}
      <div class="pill" style="margin-top:32px;margin-bottom:20px;"><span class="pill-dot"></span>Why modernize</div>
      <h2 class="section-title">An outdated site<br>costs you patients.</h2>
      <p class="section-sub">75% of visitors judge a practice's credibility from its website. If yours loads slow, breaks on mobile, or looks like 2012, new patients keep scrolling.</p>
      <div class="compare-grid">
        <div class="compare-card bad">
          <div class="compare-label">Today</div>
          <h3 class="compare-title">The slow, dated site</h3>
          <ul class="compare-list">
            <li>Not mobile responsive — breaks on phones</li>
            <li>Missing HTTPS — browsers show "Not Secure"</li>
            <li>Loads slowly (over 4 seconds)</li>
            <li>Looks like a 2012 template</li>
            <li>Contact form buried or broken</li>
            <li>No clear call-to-action</li>
          </ul>
        </div>
        <div class="compare-card good">
          <div class="compare-label">After 7 days</div>
          <h3 class="compare-title">The modern, fast site</h3>
          <ul class="compare-list">
            <li>Mobile-first design — perfect on any screen</li>
            <li>HTTPS, green padlock, full security</li>
            <li>Loads in under 2 seconds</li>
            <li>Clean, trustworthy, 2026-ready look</li>
            <li>Booking CTA visible above the fold</li>
            <li>Built-in SEO foundation for local search</li>
          </ul>
        </div>
      </div>
      <div class="page-num">02 / 07</div>
    </div>
  `;

  // Page 3: What we deliver
  const page3 = `
    <div class="page">
      ${brand}
      <div class="pill" style="margin-top:32px;margin-bottom:20px;"><span class="pill-dot"></span>What you get</div>
      <h2 class="section-title">Everything a modern<br>dental site needs.</h2>
      <p class="section-sub">Every redesign includes these essentials — no upsells, no "enterprise tier" gatekeeping.</p>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">◉</div>
          <div class="feature-title">Mobile-first responsive</div>
          <div class="feature-desc">Looks perfect on phones, tablets, desktop. 60% of your visitors are on mobile — they come first.</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <div class="feature-title">Fast load (&lt;2s)</div>
          <div class="feature-desc">Optimized images, minimal scripts, modern hosting. Google rewards fast sites with better rankings.</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <div class="feature-title">HTTPS + security</div>
          <div class="feature-desc">Free SSL certificate, HIPAA-aware contact forms, no data leaks. Your patients trust you because it's secure.</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">✎</div>
          <div class="feature-title">Easy content updates</div>
          <div class="feature-desc">You can edit text, photos, hours, and services without calling us. No technical skills required.</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">◎</div>
          <div class="feature-title">SEO foundation</div>
          <div class="feature-desc">Local schema markup, Google My Business integration, optimized titles. Show up when patients search nearby.</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">♿</div>
          <div class="feature-title">Accessibility (WCAG AA)</div>
          <div class="feature-desc">Readable contrast, screen reader friendly, keyboard navigation. Legal compliance + wider patient reach.</div>
        </div>
      </div>
      <div class="page-num">03 / 07</div>
    </div>
  `;

  // Page 4: Process
  const page4 = `
    <div class="page">
      ${brand}
      <div class="pill" style="margin-top:32px;margin-bottom:20px;"><span class="pill-dot"></span>How it works</div>
      <h2 class="section-title">From kick-off to live<br>in 7 days.</h2>
      <p class="section-sub">A focused week. No back-and-forth for months, no mystery timeline. You brief us Monday, your new site is live by Sunday.</p>
      <div class="process-row">
        <div class="process-step">
          <span class="process-num">DAY 1</span>
          <div class="process-day">Brief & assets</div>
          <div class="process-desc">30-min kickoff call. You share logo, brand colors, photos, service list, existing content. We handle the rest.</div>
        </div>
        <div class="process-step">
          <span class="process-num">DAY 2-5</span>
          <div class="process-day">Design + build</div>
          <div class="process-desc">We design mockups, then build the live site. You see progress mid-week, no surprises at reveal.</div>
        </div>
        <div class="process-step">
          <span class="process-num">DAY 6</span>
          <div class="process-day">Your feedback</div>
          <div class="process-desc">Full preview link. You give notes — up to 3 rounds of revisions included. We iterate same-day.</div>
        </div>
        <div class="process-step">
          <span class="process-num">DAY 7</span>
          <div class="process-day">Live on your domain</div>
          <div class="process-desc">We launch to your domain (or migrate from the old host), set up analytics, and hand off.</div>
        </div>
      </div>
      <div class="guarantee-row">
        <div class="guarantee-pill"><strong>30-day</strong> free bug fixes after launch</div>
        <div class="guarantee-pill"><strong>Source code</strong> is yours — no lock-in</div>
        <div class="guarantee-pill"><strong>3 revision rounds</strong> included in every tier</div>
      </div>
      <div class="page-num">04 / 07</div>
    </div>
  `;

  // Page 5: Trust / stats
  const page5 = `
    <div class="page">
      ${brand}
      <div class="pill" style="margin-top:32px;margin-bottom:20px;"><span class="pill-dot"></span>Why modernize matters</div>
      <h2 class="trust-big">Dental practices that modernize see <span>30-50% more<br>contact form submissions</span> within 60 days.</h2>
      <div class="trust-grid">
        <div class="trust-stat">
          <div class="trust-stat-num">75%</div>
          <div class="trust-stat-label">Judge credibility from the site</div>
          <div class="trust-stat-desc">Visitors form an opinion about your practice in under 50ms based purely on website design.</div>
        </div>
        <div class="trust-stat">
          <div class="trust-stat-num">53%</div>
          <div class="trust-stat-label">Abandon slow mobile sites</div>
          <div class="trust-stat-desc">If a page takes longer than 3 seconds to load on mobile, more than half your visitors leave.</div>
        </div>
        <div class="trust-stat">
          <div class="trust-stat-num">88%</div>
          <div class="trust-stat-label">Never return after bad UX</div>
          <div class="trust-stat-desc">A single confusing or dated visit is usually enough for a new patient to choose a different practice.</div>
        </div>
      </div>
      <div class="page-num">05 / 07</div>
    </div>
  `;

  // Page 6: Pricing
  const page6 = `
    <div class="page">
      ${brand}
      <div class="pill" style="margin-top:32px;margin-bottom:20px;"><span class="pill-dot"></span>Flat pricing — no surprises</div>
      <h2 class="section-title">Pick your tier.<br>Launch next week.</h2>
      <p class="section-sub">Flat rates. No hourly billing, no retainers, no add-on fees. What you see is what you pay — one invoice, end of the week.</p>
      <div class="pricing-grid">
        <div class="price-card">
          <div class="price-tier">Starter</div>
          <div class="price-amount">$800</div>
          <div class="price-delivery">5-day delivery</div>
          <ul class="price-list">
            <li>Single landing page</li>
            <li>Mobile responsive</li>
            <li>HTTPS + fast hosting</li>
            <li>Contact form + Google Maps</li>
            <li>1 revision round</li>
            <li>Best for: solo practitioners</li>
          </ul>
        </div>
        <div class="price-card featured">
          <div class="price-tier">Standard</div>
          <div class="price-amount">$1,500</div>
          <div class="price-delivery">7-day delivery</div>
          <ul class="price-list">
            <li>Full 4-page site (Home, About, Services, Contact)</li>
            <li>Everything in Starter, plus:</li>
            <li>SEO foundation + schema</li>
            <li>Content editing tools (you can update it)</li>
            <li>3 revision rounds</li>
            <li>Best for: small practices, 1-3 dentists</li>
          </ul>
        </div>
        <div class="price-card">
          <div class="price-tier">Premium</div>
          <div class="price-amount">$3,000</div>
          <div class="price-delivery">10-day delivery</div>
          <ul class="price-list">
            <li>10+ pages with service detail pages</li>
            <li>Everything in Standard, plus:</li>
            <li>Online booking widget integration</li>
            <li>Patient testimonial system</li>
            <li>Blog/news section</li>
            <li>Best for: multi-location groups</li>
          </ul>
        </div>
      </div>
      <div class="page-num">06 / 07</div>
    </div>
  `;

  // Page 7: CTA
  const page7 = `
    <div class="page cta">
      ${brand}
      <h2 class="cta-headline">Ready to see<br>some examples?</h2>
      <p class="cta-sub">Reply to this email with "yes" and I'll send over 3 dental sites we've built — real URLs, you can click around. Within the hour, not the week.</p>
      <div class="cta-reply">
        <span>→</span> Just reply: <strong style="margin-left:6px;">yes</strong>
      </div>
      <div class="cta-footer">
        <strong>Gergő Kapusi</strong> — smartflowdev.com<br>
        <a href="mailto:geri@smartflowdev.com" style="color:#fff;text-decoration:underline;">geri@smartflowdev.com</a>
      </div>
      <div class="page-num">07 / 07</div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SmartflowDev — Dental Website Redesign Proposal</title>
  <style>${css}</style>
</head>
<body>
  ${page1}
  ${page2}
  ${page3}
  ${page4}
  ${page5}
  ${page6}
  ${page7}
</body>
</html>`;
}

// ─── PDF Generation ──────────────────────────────────────────────────────

export async function generatePdfRedesignEn(outputPath: string = OUT_PATH): Promise<string> {
  const html = buildHtml();

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: PAGE_W, height: PAGE_H });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await new Promise((r) => setTimeout(r, 2000));

    await page.pdf({
      path: outputPath,
      width: `${PAGE_W}px`,
      height: `${PAGE_H}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    console.log(`✅ PDF generated: ${outputPath}`);
    return outputPath;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  generatePdfRedesignEn(OUT_PATH)
    .then((p) => {
      console.log(`\n📄 Redesign pitch PDF ready at:\n   ${p}\n`);
    })
    .catch((err) => {
      console.error('❌ PDF generation failed:', err);
      process.exit(1);
    });
}
