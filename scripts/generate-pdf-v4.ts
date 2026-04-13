import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PdfV4Options {
  lead: {
    name: string;
    company: string;
    city: string;
    website: string;
    phone?: string;
    email?: string;
  };
  industry: 'dental' | 'legal' | 'roofing' | 'auto' | 'plumbing' | 'hvac' | 'chiropractic' | 'real_estate' | 'default';
  currency: 'USD' | 'GBP' | 'CAD' | 'AUD' | 'HUF';
  images: {
    currentSite: string;
    redesignA_desktop: string;
    redesignA_mobile: string;
    redesignB_desktop: string;
    redesignB_mobile: string;
    redesignC_desktop: string;
    redesignC_mobile: string;
    bookingA: string;
    bookingB: string;
    bookingC: string;
  };
  outputPath: string;
}

interface IndustryContent {
  serviceNames: string[];
  problems: string[];
  roiExample: string;
  roiValue: number;
  ctaText: string;
  stats?: { value: string; label: string }[];
  caseStudy?: { industry: string; beforeScore: number; afterScore: number; metric1: string; metric2: string; metric3: string; quote: string; attribution: string };
}

// Industry-specific "why this matters" statistics
const INDUSTRY_STATS: Record<string, { value: string; label: string }[]> = {
  dental:      [{ value: '87%', label: 'Google a dentist before calling' }, { value: '72%', label: 'of dental searches happen on mobile' }, { value: '68%', label: 'check multiple practices before deciding' }, { value: '1hr', label: 'response time = 7x higher conversion' }],
  legal:       [{ value: '87%', label: 'Google an attorney before calling' }, { value: '58%', label: 'of legal searches happen on mobile' }, { value: '74%', label: 'check multiple firms before deciding' }, { value: '1hr', label: 'response time = 7x higher conversion' }],
  roofing:     [{ value: '65%', label: 'of roofing leads come from mobile' }, { value: '88%', label: 'check reviews before requesting a quote' }, { value: '7x', label: 'conversion when responding in 1 hour' }, { value: '4.3x', label: 'more calls with clear service pages' }],
  plumbing:    [{ value: '82%', label: 'of emergency searches are mobile' }, { value: '3x', label: 'more bookings with 24/7 messaging' }, { value: '78%', label: 'hire whoever responds first' }, { value: '52%', label: 'leave if site loads slowly' }],
  hvac:        [{ value: '+250%', label: 'traffic spike in summer season' }, { value: '55%', label: 'of HVAC calls come from Google Maps' }, { value: '68%', label: 'want same-day service booking' }, { value: '4.5x', label: 'conversion with financing options shown' }],
  auto:        [{ value: '78%', label: 'check Google reviews before choosing a shop' }, { value: '45%', label: 'YoY growth in same-day bookings' }, { value: '63%', label: 'search on mobile while their car is stuck' }, { value: '2.8x', label: 'more calls when pricing is transparent' }],
  chiropractic:[{ value: '82%', label: 'of patients research before first visit' }, { value: '3.2x', label: 'more bookings with online scheduling' }, { value: '67%', label: 'check for testimonials and results' }, { value: '73%', label: 'prefer to book at night after work' }],
  real_estate: [{ value: '97%', label: 'of home buyers start search online' }, { value: '76%', label: 'drive by after finding online' }, { value: '2.1x', label: 'more leads with virtual tours' }, { value: '44%', label: 'search on phone during commute' }],
  default:     [{ value: '75%', label: 'research online before any purchase' }, { value: '62%', label: 'use mobile as primary search device' }, { value: '3x', label: 'more leads with clear CTAs' }, { value: '2.4s', label: 'max load time before visitors leave' }],
};

// Case study data per industry
const INDUSTRY_CASE_STUDY: Record<string, { industry: string; beforeScore: number; afterScore: number; metric1: string; metric2: string; metric3: string; quote: string; attribution: string }> = {
  dental:       { industry: 'dental practice', beforeScore: 38, afterScore: 89, metric1: '+142% qualified leads', metric2: '4.1x consultation bookings', metric3: '8 weeks to ROI', quote: 'The chatbot captures patients we used to lose after hours. Bookings went up immediately.', attribution: 'Similar-size dental practice · 2024' },
  legal:        { industry: 'law firm', beforeScore: 38, afterScore: 89, metric1: '+142% qualified leads', metric2: '4.1x consultation bookings', metric3: '8 weeks to ROI', quote: 'The site finally matches the quality of work we do. Calls went up immediately.', attribution: 'Small law firm · 2024' },
  roofing:      { industry: 'roofing company', beforeScore: 45, afterScore: 92, metric1: '+93% estimate requests', metric2: '2.8x local search rank', metric3: '5 weeks to ROI', quote: 'We booked out 3 months of jobs from the new site in the first month.', attribution: 'Roofing contractor · 2024' },
  plumbing:     { industry: 'plumbing business', beforeScore: 41, afterScore: 90, metric1: '+118% emergency calls', metric2: '3.2x mobile conversions', metric3: '4 weeks to ROI', quote: 'Emergency calls tripled. The 24/7 chat widget was a game-changer.', attribution: 'Plumbing service · 2024' },
  hvac:         { industry: 'HVAC company', beforeScore: 44, afterScore: 91, metric1: '+87% service bookings', metric2: '2.6x financing applications', metric3: '6 weeks to ROI', quote: 'Booked an extra $140k in installs during the first summer.', attribution: 'HVAC contractor · 2024' },
  auto:         { industry: 'auto repair shop', beforeScore: 39, afterScore: 88, metric1: '+104% service appointments', metric2: '3.1x new customers', metric3: '5 weeks to ROI', quote: 'Customers told us the new site is why they picked us over 3 other shops.', attribution: 'Auto repair shop · 2024' },
  chiropractic: { industry: 'chiropractic clinic', beforeScore: 43, afterScore: 90, metric1: '+76% new patients', metric2: '3.5x online bookings', metric3: '7 weeks to ROI', quote: 'Filled our schedule in the evenings — people book when they get home from work.', attribution: 'Chiropractic clinic · 2024' },
  real_estate:  { industry: 'real estate team', beforeScore: 40, afterScore: 89, metric1: '+132% buyer leads', metric2: '4.2x listing inquiries', metric3: '6 weeks to ROI', quote: 'The site does the selling before I even pick up the phone.', attribution: 'Real estate agent · 2024' },
  default:      { industry: 'small business', beforeScore: 42, afterScore: 90, metric1: '+85% qualified leads', metric2: '3.0x mobile conversions', metric3: '6 weeks to ROI', quote: 'The new site paid for itself within the first month.', attribution: 'Similar business · 2024' },
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_W = 1280;
const PAGE_H = 720;

const currencySymbols: Record<PdfV4Options['currency'], string> = {
  USD: '$',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  HUF: 'Ft',
};

const pricing: Record<PdfV4Options['currency'], { starter: number; professional: number; premium: number }> = {
  USD: { starter: 500, professional: 1000, premium: 1800 },
  GBP: { starter: 400, professional: 800, premium: 1400 },
  CAD: { starter: 700, professional: 1400, premium: 2500 },
  AUD: { starter: 750, professional: 1500, premium: 2700 },
  HUF: { starter: 200000, professional: 400000, premium: 720000 },
};

const industryContent: Record<PdfV4Options['industry'], IndustryContent> = {
  dental: {
    serviceNames: ['General Dentistry', 'Dental Implants', 'Teeth Whitening', 'Orthodontics', 'Emergency Care', 'Cosmetic Dentistry'],
    problems: [
      'No way to book appointments online',
      'Missed calls after hours = lost patients',
      'No instant answers to patient questions',
      'Patients call competitors when they can\'t reach you',
      'No 24/7 availability on your website',
    ],
    roiExample: '1 dental implant = $3,000+. Your new website just needs to bring in 1 new patient to pay for itself.',
    roiValue: 3000,
    ctaText: 'Start Attracting More Patients Today',
  },
  legal: {
    serviceNames: ['Personal Injury', 'Family Law', 'Criminal Defense', 'Estate Planning', 'Business Law', 'Immigration'],
    problems: [
      'Generic template destroys credibility with potential clients',
      'No clear calls-to-action for free consultations',
      'Difficult to navigate practice area pages',
      'Missing attorney bios and credentials',
      'No client testimonials or case results visible',
    ],
    roiExample: '1 personal injury case = $5,000+ in fees. A single new client pays for your website many times over.',
    roiValue: 5000,
    ctaText: 'Start Winning More Clients Today',
  },
  roofing: {
    serviceNames: ['Roof Replacement', 'Roof Repair', 'Storm Damage', 'Commercial Roofing', 'Gutter Installation', 'Roof Inspection'],
    problems: [
      'Outdated site makes your company look unestablished',
      'No before/after project gallery to showcase work',
      'No online quote request form = lost leads',
      'Competitors with better sites are stealing your jobs',
      'Not ranking locally — homeowners can\'t find you',
    ],
    roiExample: '1 roof replacement = $8,000+. A single job from your new website covers the investment several times over.',
    roiValue: 8000,
    ctaText: 'Start Getting More Roofing Jobs Today',
  },
  auto: {
    serviceNames: ['Oil Change & Tune-Up', 'Brake Service', 'Engine Diagnostics', 'Transmission Repair', 'AC Service', 'Tire Service'],
    problems: [
      'Outdated website makes customers question your expertise',
      'No online appointment scheduling available',
      'Service descriptions are vague or missing',
      'No customer reviews or trust signals visible',
      'Poor mobile experience — customers search on the go',
    ],
    roiExample: '1 new regular customer = $1,500+/year in service revenue. Just 1 new customer each month transforms your business.',
    roiValue: 1500,
    ctaText: 'Start Filling Your Bays Today',
  },
  plumbing: {
    serviceNames: ['Emergency Plumbing', 'Drain Cleaning', 'Water Heater Service', 'Pipe Repair', 'Sewer Line Service', 'Fixture Installation'],
    problems: [
      'Customers can\'t find your emergency number quickly',
      'No online booking for non-emergency services',
      'Site doesn\'t show your service area clearly',
      'Missing licensing and insurance information',
      'No customer reviews to build trust',
    ],
    roiExample: '1 water heater installation = $2,500+. One job from your website pays for the entire investment.',
    roiValue: 2500,
    ctaText: 'Start Getting More Service Calls Today',
  },
  hvac: {
    serviceNames: ['AC Installation', 'Furnace Repair', 'HVAC Maintenance', 'Duct Cleaning', 'Heat Pump Service', 'Indoor Air Quality'],
    problems: [
      'Seasonal customers can\'t book online during peak times',
      'No maintenance plan sign-up on website',
      'Site doesn\'t highlight emergency 24/7 service',
      'Missing energy efficiency certifications',
      'Competitors dominate local search results',
    ],
    roiExample: '1 new HVAC installation = $6,000+. A single system install covers your website investment and then some.',
    roiValue: 6000,
    ctaText: 'Start Booking More Installs Today',
  },
  chiropractic: {
    serviceNames: ['Spinal Adjustment', 'Sports Injury', 'Prenatal Care', 'Pediatric Chiropractic', 'Massage Therapy', 'Rehabilitation'],
    problems: [
      'Website doesn\'t convey a healing, welcoming atmosphere',
      'No online appointment scheduling available',
      'Patient testimonials and success stories are missing',
      'Insurance and pricing information hard to find',
      'Not optimized for "chiropractor near me" searches',
    ],
    roiExample: '1 new patient with a 12-visit plan = $1,800+. Just one new patient a month covers your investment easily.',
    roiValue: 1800,
    ctaText: 'Start Growing Your Practice Today',
  },
  real_estate: {
    serviceNames: ['Residential Sales', 'Luxury Properties', 'Commercial Real Estate', 'Property Management', 'First-Time Buyers', 'Investment Properties'],
    problems: [
      'No IDX/property search integration on current site',
      'Agent profile doesn\'t build personal brand',
      'Missing neighborhood guides and market data',
      'No lead capture for buyer/seller inquiries',
      'Site doesn\'t showcase sold properties and success stories',
    ],
    roiExample: '1 home sale commission = $10,000+. A single closed deal from your website is a massive return on investment.',
    roiValue: 10000,
    ctaText: 'Start Attracting More Listings Today',
  },
  default: {
    serviceNames: ['Core Service', 'Premium Service', 'Consultation', 'Maintenance', 'Custom Solutions', 'Support Plans'],
    problems: [
      'Outdated design undermines your credibility',
      'No clear call-to-action for visitors',
      'Not mobile-friendly — losing over half your traffic',
      'Slow loading speed hurts search rankings',
      'No social proof or testimonials visible',
    ],
    roiExample: '1 new customer = significant lifetime value. Your new website just needs to bring in 1 new customer to pay for itself.',
    roiValue: 2000,
    ctaText: 'Start Growing Your Business Today',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadImageAsBase64(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) {
      return placeholderDataUri();
    }
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return placeholderDataUri();
  }
}

function placeholderDataUri(): string {
  // 1x1 transparent PNG as ultimate fallback - the CSS gradient will show through
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
}

function formatPrice(amount: number, currency: PdfV4Options['currency']): string {
  const sym = currencySymbols[currency];
  if (currency === 'HUF') {
    return `${amount.toLocaleString('en-US')} ${sym}`;
  }
  return `${sym}${amount.toLocaleString('en-US')}`;
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── HTML Builder ────────────────────────────────────────────────────────────

function buildHtml(opts: PdfV4Options): string {
  const { lead, industry, currency, images } = opts;
  const ic = industryContent[industry];
  const prices = pricing[currency];
  const sym = currencySymbols[currency];

  // Pre-load all images
  const img = {
    currentSite: loadImageAsBase64(images.currentSite),
    redesignA_desktop: loadImageAsBase64(images.redesignA_desktop),
    redesignA_mobile: loadImageAsBase64(images.redesignA_mobile),
    redesignB_desktop: loadImageAsBase64(images.redesignB_desktop),
    redesignB_mobile: loadImageAsBase64(images.redesignB_mobile),
    redesignC_desktop: loadImageAsBase64(images.redesignC_desktop),
    redesignC_mobile: loadImageAsBase64(images.redesignC_mobile),
    bookingA: loadImageAsBase64(images.bookingA),
    bookingB: loadImageAsBase64(images.bookingB),
    bookingC: loadImageAsBase64(images.bookingC),
  };

  const roiReturn = ic.roiValue * 12;

  // ── Shared CSS ──
  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${PAGE_W}px ${PAGE_H}px; margin: 0; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page {
      width: ${PAGE_W}px; height: ${PAGE_H}px;
      overflow: hidden; position: relative;
      page-break-after: always; page-break-inside: avoid;
    }
    .page:last-child { page-break-after: auto; }
    .placeholder-img {
      background: linear-gradient(135deg, #667eea33, #764ba233);
      display: flex; align-items: center; justify-content: center;
      color: #999; font-size: 14px;
    }
  `;

  // ── PAGE 1: COVER ──
  const page1 = `
    <div class="page" style="background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: #fff;">
      <div style="position:absolute;top:-80px;left:-80px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(102,126,234,0.15),transparent);"></div>
      <div style="position:absolute;bottom:-60px;right:-60px;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,rgba(118,75,162,0.15),transparent);"></div>
      <div style="position:absolute;top:40px;right:120px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(102,126,234,0.08),transparent);"></div>
      <div style="z-index:1;">
        <div style="font-size:16px;letter-spacing:4px;text-transform:uppercase;color:#667eea;margin-bottom:24px;">SmartFlow Dev</div>
        <h1 style="font-size:52px;font-weight:800;line-height:1.15;margin-bottom:20px;">Website Redesign<br>Proposal</h1>
        <p style="font-size:28px;color:#8ec5fc;margin-bottom:12px;">Prepared exclusively for ${esc(lead.name)}</p>
        <p style="font-size:18px;color:rgba(255,255,255,0.6);margin-bottom:6px;">${esc(lead.company)}</p>
        <p style="font-size:16px;color:rgba(255,255,255,0.45);">${esc(lead.city)} &bull; ${formatDate()}</p>
      </div>
      <div style="position:absolute;bottom:32px;display:flex;align-items:center;gap:10px;color:rgba(255,255,255,0.4);font-size:13px;">
        <span style="font-weight:700;color:#667eea;font-size:15px;">SmartFlow Dev</span>
        <span>&bull;</span>
        <span>smartflowdev.com</span>
      </div>
    </div>`;

  // ── PAGE 2: THE PROBLEM ──
  const problemItems = ic.problems.map(p => `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;">
      <span style="color:#e74c3c;font-size:18px;flex-shrink:0;">&#10060;</span>
      <span style="font-size:17px;color:#333;line-height:1.4;">${esc(p)}</span>
    </div>`).join('');

  const page2 = `
    <div class="page" style="background:#f5f5f5;display:flex;flex-direction:column;padding:48px 56px 0 56px;">
      <div style="display:flex;flex:1;gap:40px;">
        <div style="width:55%;display:flex;align-items:center;">
          <div style="width:100%;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid #ddd;">
            <img src="${img.currentSite}" style="width:100%;height:auto;display:block;background:linear-gradient(135deg,#eee,#ddd);" />
          </div>
        </div>
        <div style="width:40%;display:flex;flex-direction:column;justify-content:center;">
          <h2 style="font-size:34px;font-weight:800;color:#e74c3c;margin-bottom:8px;">The Problem</h2>
          <p style="font-size:14px;color:#888;margin-bottom:24px;">${esc(lead.website)}</p>
          ${problemItems}
        </div>
      </div>
      <div style="background:#1a1a2e;margin:0 -56px;padding:18px 56px;display:flex;align-items:center;gap:12px;margin-top:auto;">
        <span style="font-size:14px;color:rgba(255,255,255,0.85);font-style:italic;">&ldquo;75% of users judge a business&rsquo;s credibility by their website design.&rdquo;</span>
        <span style="font-size:12px;color:rgba(255,255,255,0.45);margin-left:auto;white-space:nowrap;">— Stanford Research</span>
      </div>
    </div>`;

  // ── Helper: Option page (3, 5, 7) ──
  function optionPage(
    title: string, bg: string,
    desktopImg: string, mobileImg: string,
    bullets: string[]
  ): string {
    const bulletHtml = bullets.map(b => `
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        <span style="color:#667eea;font-size:16px;flex-shrink:0;">&#10003;</span>
        <span style="font-size:15px;color:#444;line-height:1.4;">${esc(b)}</span>
      </div>`).join('');

    return `
    <div class="page" style="background:${bg};padding:40px 56px;display:flex;flex-direction:column;">
      <h2 style="font-size:32px;font-weight:800;color:#1a1a2e;margin-bottom:20px;">${esc(title)}</h2>
      <div style="display:flex;flex:1;gap:32px;align-items:center;">
        <div style="width:68%;">
          <div style="border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.15);">
            <img src="${desktopImg}" style="width:100%;height:auto;display:block;background:linear-gradient(135deg,#eee,#ddd);" />
          </div>
        </div>
        <div style="width:28%;display:flex;flex-direction:column;justify-content:center;gap:10px;">
          ${bulletHtml}
        </div>
      </div>
    </div>`;
  }

  // ── Helper: Booking page (4, 6, 8) ──
  function bookingPage(bg: string, bookingImg: string): string {
    return `
    <div class="page" style="background:${bg};padding:44px 56px;display:flex;flex-direction:column;">
      <h2 style="font-size:28px;font-weight:800;color:#1a1a2e;margin-bottom:6px;">AI Chatbot &amp; Online Booking System</h2>
      <p style="font-size:15px;color:#777;margin-bottom:28px;">Patients book appointments online, get instant answers from the AI chatbot — 24/7</p>
      <div style="display:flex;gap:32px;flex:1;align-items:center;">
        <div style="width:65%;">
          <div style="border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.12);border:1px solid #e0e0e0;">
            <img src="${bookingImg}" style="width:100%;height:auto;display:block;background:linear-gradient(135deg,#eee,#ddd);" />
          </div>
        </div>
        <div style="width:30%;display:flex;flex-direction:column;gap:16px;">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="color:#667eea;font-size:20px;flex-shrink:0;">&#10003;</span>
            <div>
              <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">Online Booking</div>
              <div style="font-size:13px;color:#777;line-height:1.4;">Patients pick a date, time &amp; service. Syncs to Google Calendar instantly.</div>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="color:#667eea;font-size:20px;flex-shrink:0;">&#10003;</span>
            <div>
              <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">AI Chat Assistant</div>
              <div style="font-size:13px;color:#777;line-height:1.4;">Answers questions, handles emergencies, books appointments — even at 2 AM.</div>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="color:#667eea;font-size:20px;flex-shrink:0;">&#10003;</span>
            <div>
              <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">SMS Reminders</div>
              <div style="font-size:13px;color:#777;line-height:1.4;">Automated reminders 24h before. Reduces no-shows by up to 40%.</div>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="color:#667eea;font-size:20px;flex-shrink:0;">&#10003;</span>
            <div>
              <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">After-Hours Phone Agent</div>
              <div style="font-size:13px;color:#777;line-height:1.4;">AI voice agent answers calls when you're closed. Never miss a patient.</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  const page3 = optionPage(
    'Option A: Centered Professional', '#ffffff',
    img.redesignA_desktop, img.redesignA_mobile,
    ['Clean, centered layout with gradient hero', 'Professional trust indicators', 'Optimized for conversions']
  );

  const page4 = bookingPage('#fafafa', img.bookingA);

  const page5 = optionPage(
    'Option B: Split Asymmetric', '#fffcf7',
    img.redesignB_desktop, img.redesignB_mobile,
    ['Bold split-screen layout with animated elements', 'Warm, approachable design', 'Horizontal scrolling service showcase']
  );

  const page6 = bookingPage('#fafafa', img.bookingB);

  const page7 = optionPage(
    'Option C: Glass Morphism', '#f5f0ff',
    img.redesignC_desktop, img.redesignC_mobile,
    ['Modern glassmorphism with animated orbs', 'Floating card design with blur effects', 'Premium, cutting-edge aesthetic']
  );

  const page8 = bookingPage('#fafafa', img.bookingC);

  // ── PAGE 8b: INDUSTRY STATISTICS ──
  const stats = INDUSTRY_STATS[industry] || INDUSTRY_STATS.default;
  const statsGrid = stats.map(s => `
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:32px 28px;">
      <div style="font-size:56px;font-weight:800;color:#667eea;line-height:1;margin-bottom:14px;letter-spacing:-1.5px;">${s.value}</div>
      <div style="font-size:15px;color:rgba(255,255,255,0.75);line-height:1.4;">${esc(s.label)}</div>
    </div>`).join('');
  const pageStats = `
    <div class="page" style="background:#13131f;padding:48px 56px;display:flex;flex-direction:column;">
      <div style="font-size:12px;font-weight:700;color:#667eea;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Why This Matters</div>
      <h2 style="font-size:36px;font-weight:800;color:#fff;margin-bottom:10px;">The Numbers Behind<br>${ic.serviceNames[0]} Decisions</h2>
      <p style="font-size:16px;color:rgba(255,255,255,0.55);margin-bottom:36px;max-width:720px;">Your customers behave predictably. Here's what the data says about how they choose.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex:1;align-content:center;">
        ${statsGrid}
      </div>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:rgba(255,255,255,0.35);">Sources: Google Consumer Insights, BrightLocal, HubSpot Research 2024</div>
    </div>`;

  // ── PAGE 8c: CASE STUDY ──
  const cs = INDUSTRY_CASE_STUDY[industry] || INDUSTRY_CASE_STUDY.default;
  const pageCase = `
    <div class="page" style="background:linear-gradient(135deg,#1e1e2e,#0f3460);padding:48px 56px;display:flex;flex-direction:column;color:#fff;">
      <div style="font-size:12px;font-weight:700;color:#f5a623;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Case Study</div>
      <h2 style="font-size:36px;font-weight:800;margin-bottom:10px;">A Similar ${esc(cs.industry)}<br>We Helped Grow</h2>
      <p style="font-size:16px;color:rgba(255,255,255,0.6);margin-bottom:32px;">Real results from a comparable business with similar starting conditions.</p>
      <div style="display:flex;gap:24px;flex:1;align-items:stretch;">
        <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;display:flex;flex-direction:column;">
          <div style="font-size:11px;font-weight:700;color:#ff6b6b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">Before</div>
          <div style="font-size:72px;font-weight:800;line-height:1;color:#ff6b6b;margin-bottom:8px;">${cs.beforeScore}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.55);">Website quality score (out of 100)</div>
          <div style="margin-top:auto;padding-top:20px;">
            <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Outdated template · No mobile optimization · No clear CTAs · Slow load</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 4px;">
          <div style="font-size:44px;color:rgba(255,255,255,0.4);">&rarr;</div>
        </div>
        <div style="flex:1;background:linear-gradient(135deg,rgba(102,126,234,0.25),rgba(118,75,162,0.15));border:1px solid rgba(102,126,234,0.4);border-radius:16px;padding:28px;display:flex;flex-direction:column;">
          <div style="font-size:11px;font-weight:700;color:#8ec5ff;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">After</div>
          <div style="font-size:72px;font-weight:800;line-height:1;color:#8ec5ff;margin-bottom:8px;">${cs.afterScore}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.55);">Website quality score (out of 100)</div>
          <div style="margin-top:auto;padding-top:20px;display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:13px;color:#fff;font-weight:600;">&#10003; ${esc(cs.metric1)}</div>
            <div style="font-size:13px;color:#fff;font-weight:600;">&#10003; ${esc(cs.metric2)}</div>
            <div style="font-size:13px;color:#fff;font-weight:600;">&#10003; ${esc(cs.metric3)}</div>
          </div>
        </div>
      </div>
      <div style="margin-top:24px;padding:20px 24px;background:rgba(255,255,255,0.04);border-left:3px solid #f5a623;border-radius:0 10px 10px 0;">
        <div style="font-size:15px;font-style:italic;color:rgba(255,255,255,0.85);line-height:1.5;margin-bottom:8px;">&ldquo;${esc(cs.quote)}&rdquo;</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);">&mdash; ${esc(cs.attribution)}</div>
      </div>
    </div>`;

  // ── PAGE 9: WHAT'S INCLUDED ──
  const features = [
    { icon: '🌐', name: 'Modern Website', desc: 'Custom-built with latest technology' },
    { icon: '🤖', name: 'AI Chatbot', desc: 'Engage visitors 24/7 automatically' },
    { icon: '📅', name: 'Online Booking', desc: 'Let customers book appointments' },
    { icon: '🔍', name: 'SEO Optimization', desc: 'Rank higher on Google searches' },
    { icon: '📱', name: 'Mobile-First Design', desc: 'Perfect on every device size' },
    { icon: '📍', name: 'Google Maps Integration', desc: 'Help customers find your location' },
    { icon: '⭐', name: 'Reviews Section', desc: 'Showcase your best testimonials' },
    { icon: '📝', name: 'Blog Setup', desc: 'Build authority with content' },
    { icon: '📊', name: 'Analytics Dashboard', desc: 'Track visitors and conversions' },
    { icon: '💻', name: 'Source Code Ownership', desc: 'You own everything we build' },
  ];

  const featureGrid = features.map(f => `
    <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 16px;">
      <span style="font-size:28px;flex-shrink:0;">${f.icon}</span>
      <div>
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:3px;">${f.name}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.55);">${f.desc}</div>
      </div>
    </div>`).join('');

  const page9 = `
    <div class="page" style="background:#1a1a2e;padding:48px 56px;display:flex;flex-direction:column;">
      <h2 style="font-size:36px;font-weight:800;color:#fff;margin-bottom:6px;">Everything You Need</h2>
      <p style="font-size:16px;color:rgba(255,255,255,0.5);margin-bottom:36px;">Your complete digital presence, ready to launch</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;flex:1;align-content:start;">
        ${featureGrid}
      </div>
    </div>`;

  // ── PAGE 10: ROI ──
  const investmentAmount = prices.professional;
  const barMaxH = 280;
  const investBarH = 100;
  const returnBarH = barMaxH;

  const page10 = `
    <div class="page" style="background:linear-gradient(135deg,#667eea,#764ba2);padding:48px 56px;display:flex;flex-direction:column;color:#fff;">
      <h2 style="font-size:36px;font-weight:800;margin-bottom:16px;">What Is a New Website Worth<br>to Your Business?</h2>
      <p style="font-size:20px;color:rgba(255,255,255,0.85);margin-bottom:40px;max-width:700px;line-height:1.5;">${esc(ic.roiExample)}</p>
      <div style="display:flex;align-items:flex-end;gap:80px;flex:1;padding:0 80px;padding-bottom:20px;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
          <span style="font-size:22px;font-weight:700;">${formatPrice(investmentAmount, currency)}</span>
          <div style="width:140px;height:${investBarH}px;background:rgba(255,255,255,0.25);border-radius:10px 10px 4px 4px;display:flex;align-items:center;justify-content:center;">
          </div>
          <span style="font-size:15px;color:rgba(255,255,255,0.7);">Investment</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
          <span style="font-size:22px;font-weight:700;">${formatPrice(roiReturn, currency)}</span>
          <div style="width:140px;height:${returnBarH}px;background:rgba(255,255,255,0.35);border-radius:10px 10px 4px 4px;display:flex;align-items:center;justify-content:center;">
          </div>
          <span style="font-size:15px;color:rgba(255,255,255,0.7);">Potential Return (Year 1)</span>
        </div>
      </div>
      <p style="font-size:20px;font-weight:700;text-align:center;margin-top:auto;">Pays for itself in the first month</p>
    </div>`;

  // ── PAGE 11: PRICING ──
  const tiers = [
    {
      name: 'Starter',
      price: prices.starter,
      badge: '',
      features: ['AI Chatbot setup', 'Basic booking form', 'Mobile responsive', '30-day support', '7–10 day delivery'],
      highlight: false,
    },
    {
      name: 'Professional',
      price: prices.professional,
      badge: 'RECOMMENDED',
      features: ['AI Chatbot + full training', 'Booking + Google Calendar sync', 'SMS appointment reminders', 'Analytics dashboard', '90-day support', '5–7 day delivery'],
      highlight: true,
    },
    {
      name: 'Premium',
      price: prices.premium,
      badge: '',
      features: ['Everything in Professional', 'AI Phone Agent', 'Custom integrations', 'Priority support channel', '12-month support', '3–5 day delivery'],
      highlight: false,
    },
  ];

  const tierCards = tiers.map(t => {
    const border = t.highlight ? 'border:2px solid #667eea;' : 'border:1px solid #3a3a4e;';
    const scale = t.highlight ? 'transform:scale(1.04);z-index:1;' : '';
    const badgeHtml = t.badge
      ? `<div style="position:absolute;top:-1px;right:-1px;background:linear-gradient(135deg,#f5a623,#f7c948);color:#1a1a2e;font-size:10px;font-weight:800;padding:4px 14px;border-radius:0 10px 0 10px;letter-spacing:1px;">${t.badge}</div>`
      : '';
    const featureList = t.features.map(f => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="color:#667eea;font-size:14px;">&#10003;</span>
        <span style="font-size:13px;color:rgba(255,255,255,0.75);">${esc(f)}</span>
      </div>`).join('');

    return `
      <div style="flex:1;background:#2a2a3e;border-radius:12px;padding:28px 24px;position:relative;${border}${scale}">
        ${badgeHtml}
        <h3 style="font-size:20px;font-weight:700;color:#fff;margin-bottom:16px;">${t.name}</h3>
        <div style="font-size:36px;font-weight:800;color:#fff;margin-bottom:20px;">${formatPrice(t.price, currency)}</div>
        <div>${featureList}</div>
      </div>`;
  }).join('');

  const page11 = `
    <div class="page" style="background:#1e1e2e;padding:44px 56px;display:flex;flex-direction:column;color:#fff;">
      <h2 style="font-size:36px;font-weight:800;text-align:center;margin-bottom:32px;">Choose Your Plan</h2>
      <div style="display:flex;gap:24px;flex:1;align-items:center;">
        ${tierCards}
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:32px;margin-top:20px;">
        <span style="font-size:14px;color:rgba(255,255,255,0.7);">&#128176; Money-back guarantee</span>
        <span style="color:rgba(255,255,255,0.3);">|</span>
        <span style="font-size:14px;color:rgba(255,255,255,0.7);">Pay in 2 installments available</span>
      </div>
    </div>`;

  // ── PAGE 12: NEXT STEPS ──
  const steps = [
    { num: '1', title: 'Reply', desc: 'Reply to this email to confirm your interest' },
    { num: '2', title: 'Choose Design', desc: 'Pick your favorite from the 3 options' },
    { num: '3', title: 'We Build', desc: 'Your new website delivered in days, not months' },
  ];

  const stepCircles = steps.map((s, i) => {
    const arrow = i < 2 ? `<div style="width:80px;height:2px;background:rgba(255,255,255,0.15);margin:0 4px;"></div>` : '';
    return `
      <div style="display:flex;align-items:center;">
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;width:200px;">
          <div style="width:64px;height:64px;border-radius:50%;background:#667eea;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;margin-bottom:14px;">${s.num}</div>
          <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:6px;">${s.title}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.4;">${s.desc}</div>
        </div>
        ${arrow}
      </div>`;
  }).join('');

  const page12 = `
    <div class="page" style="background:linear-gradient(135deg,#0f3460,#1a1a2e);padding:48px 56px;display:flex;flex-direction:column;align-items:center;color:#fff;">
      <h2 style="font-size:40px;font-weight:800;margin-bottom:52px;">Let&rsquo;s Get Started</h2>
      <div style="display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:52px;">
        ${stepCircles}
      </div>
      <div style="background:#667eea;padding:18px 48px;border-radius:12px;font-size:20px;font-weight:700;margin-bottom:40px;">
        Reply to this email to get started &rarr;
      </div>
      <div style="margin-top:auto;text-align:center;">
        <p style="font-size:14px;color:rgba(255,255,255,0.5);font-style:italic;margin-bottom:12px;">&ldquo;The best investment we made for our practice.&rdquo; — Happy Client</p>
        <p style="font-size:13px;color:rgba(255,255,255,0.35);">smartflowdev.com</p>
      </div>
    </div>`;

  // ── Assemble ──
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${css}</style></head>
<body>${page1}${page2}${page3}${page4}${page5}${page6}${page7}${page8}${pageStats}${pageCase}${page9}${page10}${page11}${page12}</body></html>`;
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

export async function generatePdfV4(options: PdfV4Options): Promise<string> {
  const html = buildHtml(options);
  const outputDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: PAGE_W, height: PAGE_H });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: options.outputPath,
      width: `${PAGE_W}px`,
      height: `${PAGE_H}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    console.log(`PDF generated: ${options.outputPath}`);
    return options.outputPath;
  } finally {
    await browser.close();
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const testOptions: PdfV4Options = {
    lead: {
      name: 'Dr. John Smith',
      company: 'Smith Family Dental',
      city: 'Austin, TX',
      website: 'www.smithfamilydental.com',
      phone: '(512) 555-0123',
      email: 'john@smithfamilydental.com',
    },
    industry: 'dental',
    currency: 'USD',
    images: {
      currentSite: './output/screenshots/current-site.png',
      redesignA_desktop: './output/redesigns/a-desktop.png',
      redesignA_mobile: './output/redesigns/a-mobile.png',
      redesignB_desktop: './output/redesigns/b-desktop.png',
      redesignB_mobile: './output/redesigns/b-mobile.png',
      redesignC_desktop: './output/redesigns/c-desktop.png',
      redesignC_mobile: './output/redesigns/c-mobile.png',
      bookingA: './output/redesigns/a-booking.png',
      bookingB: './output/redesigns/b-booking.png',
      bookingC: './output/redesigns/c-booking.png',
    },
    outputPath: './output/proposals/test-proposal-v4.pdf',
  };

  generatePdfV4(testOptions)
    .then(p => console.log(`Done: ${p}`))
    .catch(err => { console.error('Failed:', err); process.exit(1); });
}
