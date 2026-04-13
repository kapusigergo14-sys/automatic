import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { generatePdfV4, PdfV4Options } from './generate-pdf-v4';
import { extractCompanyData, CompanyData } from './extract-company-data';
import { extractLogo, LogoResult } from './extract-logo';
import { extractGoogleReviews, GoogleReviewsResult } from './extract-google-reviews';
import { getStockImagesForTemplate } from './stock-images';
import { scoreOutdated, OutdatedScore } from './score-outdated';
import { generateObservation } from './generate-observation';
import { loadState, saveState, recordTouch, LeadState } from './outreach-state';

const RESEND_API_KEY = process.env.RESEND_API_KEY!;

interface Lead {
  name: string;
  website: string;
  contactUrl: string;
  country: string;
  industry: string;
  email?: string;  // optional: pre-known email (skip extraction)
}

interface ProcessedLead extends Omit<Lead, 'email'> {
  email: string | null;
  businessName: string;
  pdfPath?: string;
  status: 'sent' | 'skipped' | 'error';
  error?: string;
  outdatedScore?: number;
  outdatedBreakdown?: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Shorten company name for nav logo: cut at first separator (, | — - ·) or limit to ~25 chars / 3 words
function shortenCompanyName(name: string): string {
  if (!name) return name;
  // Cut at common separators first
  const sepIdx = name.search(/[,|·–—]|  -  |  \|  /);
  let short = sepIdx > 5 ? name.slice(0, sepIdx) : name;
  short = short.trim();
  // If still too long, take first 3-4 meaningful words
  if (short.length > 28) {
    const words = short.split(/\s+/);
    short = words.slice(0, 3).join(' ');
  }
  return short.trim();
}

// ─── INDUSTRY → TEMPLATE SET MAPPING ────────────────────────────────────────

type TemplateSet = 'elegant' | 'industrial';

const INDUSTRY_TEMPLATE_SET: Record<string, TemplateSet> = {
  'Dental':       'elegant',
  'Legal':        'elegant',
  'Chiropractic': 'elegant',
  'Real Estate':  'elegant',
  'Medical':      'elegant',
  'Roofing':      'industrial',
  'Construction': 'industrial',
  'HVAC':         'industrial',
  'Plumbing':     'industrial',
  'Auto':         'industrial',
  'Electrical':   'industrial',
};

function getTemplateSet(industry: string): TemplateSet {
  return INDUSTRY_TEMPLATE_SET[industry] || 'industrial'; // default to industrial for SMBs
}

function getTemplateLetters(industry: string): [string, string, string] {
  return getTemplateSet(industry) === 'elegant' ? ['a', 'b', 'c'] : ['d', 'e', 'f'];
}

// ─── INDUSTRY-SPECIFIC COLORS (per template) ────────────────────────────────

interface TemplateColors {
  primary: string;
  accent: string;
}

const INDUSTRY_COLORS: Record<string, Record<string, TemplateColors>> = {
  'Dental': {
    a: { primary: '#1e3a5f', accent: '#14B8A6' },
    b: { primary: '#1B3A5C', accent: '#14B8A6' },
    c: { primary: '#6366f1', accent: '#8B5CF6' },
  },
  'Legal': {
    a: { primary: '#1e293b', accent: '#3B82F6' },
    b: { primary: '#1e293b', accent: '#3B82F6' },
    c: { primary: '#4338ca', accent: '#6366f1' },
  },
  'Chiropractic': {
    a: { primary: '#1e3a5f', accent: '#22c55e' },
    b: { primary: '#1e3a5f', accent: '#22c55e' },
    c: { primary: '#065f46', accent: '#10b981' },
  },
  'Real Estate': {
    a: { primary: '#1e293b', accent: '#d4af37' },
    b: { primary: '#1e293b', accent: '#d4af37' },
    c: { primary: '#44403c', accent: '#d4af37' },
  },
  'Medical': {
    a: { primary: '#1e3a5f', accent: '#14B8A6' },
    b: { primary: '#1B3A5C', accent: '#14B8A6' },
    c: { primary: '#6366f1', accent: '#8B5CF6' },
  },
  'Roofing': {
    d: { primary: '#1a1a1a', accent: '#f97316' },
    e: { primary: '#f0f0ec', accent: '#eab308' },
    f: { primary: '#f4f5f7', accent: '#2563eb' },
  },
  'Construction': {
    d: { primary: '#1a1a1a', accent: '#f97316' },
    e: { primary: '#f0f0ec', accent: '#eab308' },
    f: { primary: '#f4f5f7', accent: '#2563eb' },
  },
  'Plumbing': {
    d: { primary: '#1a1a1a', accent: '#3B82F6' },
    e: { primary: '#f0f0ec', accent: '#2563eb' },
    f: { primary: '#f4f5f7', accent: '#0ea5e9' },
  },
  'Auto': {
    d: { primary: '#1a1a1a', accent: '#dc2626' },
    e: { primary: '#f0f0ec', accent: '#dc2626' },
    f: { primary: '#f4f5f7', accent: '#dc2626' },
  },
  'HVAC': {
    d: { primary: '#1a1a1a', accent: '#f97316' },
    e: { primary: '#f0f0ec', accent: '#f97316' },
    f: { primary: '#f4f5f7', accent: '#f97316' },
  },
  'Electrical': {
    d: { primary: '#1a1a1a', accent: '#eab308' },
    e: { primary: '#f0f0ec', accent: '#eab308' },
    f: { primary: '#f4f5f7', accent: '#eab308' },
  },
};

const DEFAULT_COLORS: Record<string, TemplateColors> = {
  d: { primary: '#1a1a1a', accent: '#3B82F6' },
  e: { primary: '#f0f0ec', accent: '#3B82F6' },
  f: { primary: '#f4f5f7', accent: '#3B82F6' },
};

function getColorsForTemplate(industry: string, letter: string): TemplateColors {
  return INDUSTRY_COLORS[industry]?.[letter] || DEFAULT_COLORS[letter] || { primary: '#1a1a1a', accent: '#3B82F6' };
}

// ─── INDUSTRY SERVICES ──────────────────────────────────────────────────────

const INDUSTRY_SERVICES: Record<string, string[]> = {
  'Dental':       ['Dental Implants', 'Teeth Whitening', 'Orthodontics', 'Cosmetic Dentistry', 'Crowns & Bridges', 'General Cleanings'],
  'Legal':        ['Personal Injury', 'Family Law', 'Criminal Defense', 'Estate Planning', 'Business Law', 'Immigration'],
  'Roofing':      ['Roof Repair', 'Roof Replacement', 'New Construction', 'Emergency Repair', 'Gutter Installation', 'Roof Inspection'],
  'Plumbing':     ['Emergency Plumbing', 'Pipe Repair', 'Water Heater', 'Drain Cleaning', 'Bathroom Remodel', 'Leak Detection'],
  'Auto':         ['Engine Repair', 'Brake Service', 'Oil Change', 'Diagnostics', 'Transmission', 'Air Conditioning'],
  'HVAC':         ['AC Repair', 'Heating Repair', 'Installation', 'Maintenance', 'Duct Cleaning', 'Emergency Service'],
  'Chiropractic': ['Spinal Adjustment', 'Sports Therapy', 'Pain Management', 'Posture Correction', 'Rehabilitation', 'Wellness Plans'],
  'Real Estate':  ['Property Sales', 'Property Management', 'Valuations', 'Rentals', 'Commercial', 'Consulting'],
  'Medical':      ['Primary Care', 'Urgent Care', 'Preventive Medicine', 'Lab Services', 'Telehealth', 'Specialist Referrals'],
  'Construction': ['New Construction', 'Remodeling', 'Commercial Build', 'Additions', 'Concrete Work', 'Project Management'],
  'Electrical':   ['Electrical Repair', 'Panel Upgrades', 'Wiring', 'Lighting Installation', 'Generator Service', 'Safety Inspections'],
};
const DEFAULT_SERVICES = ['Service One', 'Service Two', 'Service Three', 'Service Four', 'Service Five', 'Service Six'];

const SERVICE_DESCS: Record<string, string[]> = {
  'Dental':       ['Permanent tooth replacement with state-of-the-art implant technology', 'Professional whitening for a brighter, confident smile', 'Braces and clear aligners for perfectly aligned teeth', 'Veneers, bonding, and smile makeovers', 'Custom-crafted restorations for damaged teeth', 'Preventive care and routine dental checkups'],
  'Legal':        ['Aggressive representation for accident and injury claims', 'Divorce, custody, and family dispute resolution', 'Skilled defense for misdemeanor and felony charges', 'Wills, trusts, and probate administration', 'Contracts, disputes, and corporate counsel', 'Visa applications, green cards, and citizenship'],
  'Roofing':      ['Fix leaks, damage, and wear before they spread', 'Full tear-off and new roof installation', 'Roofing systems for new builds and additions', '24/7 storm and leak emergency response', 'Seamless gutters and downspout systems', 'Thorough assessment of your roof condition'],
  'Plumbing':     ['24/7 emergency plumbing when you need it most', 'Expert repair for burst, leaking, and corroded pipes', 'Installation, repair, and replacement services', 'Professional clearing of clogged drains and sewer lines', 'Full bathroom renovation and fixture installation', 'Advanced leak detection technology to find hidden leaks'],
  'Auto':         ['Complete engine diagnostics and repair services', 'Brake pad replacement, rotor resurfacing, and more', 'Quick and affordable oil change services', 'Computer diagnostics for check engine lights', 'Transmission repair and rebuild services', 'AC recharge, repair, and maintenance'],
  'HVAC':         ['Fast, reliable air conditioning repair services', 'Furnace and heat pump repair services', 'New system installation for homes and businesses', 'Scheduled maintenance to extend system life', 'Professional air duct cleaning for better air quality', '24/7 heating and cooling emergency service'],
  'Chiropractic': ['Gentle spinal adjustments for pain relief', 'Injury recovery and sports performance therapy', 'Holistic pain management without medication', 'Ergonomic and posture correction programs', 'Physical rehabilitation and recovery', 'Comprehensive wellness and preventive care'],
  'Real Estate':  ['Expert guidance for buying and selling properties', 'Full-service property management solutions', 'Accurate market valuations and appraisals', 'Residential and commercial rental services', 'Commercial property sales and leasing', 'Strategic real estate consulting'],
  'Medical':      ['Comprehensive primary care for all ages', 'Walk-in urgent care when you need it', 'Annual physicals and preventive screenings', 'On-site laboratory testing services', 'Virtual visits from the comfort of home', 'Coordinated referrals to top specialists'],
  'Construction': ['Ground-up residential and commercial construction', 'Kitchen, bathroom, and whole-home remodeling', 'Commercial building and tenant improvement', 'Room additions and home expansions', 'Foundations, driveways, and flatwork', 'End-to-end project coordination'],
  'Electrical':   ['Troubleshooting and repair of electrical issues', 'Upgrade your electrical panel for modern demands', 'New wiring for renovations and new construction', 'Indoor and outdoor lighting design and install', 'Backup generator installation and service', 'Comprehensive electrical safety inspections'],
};
const DEFAULT_DESCS = ['Professional service tailored to your needs', 'Expert solutions delivered with care', 'Quality work you can rely on', 'Comprehensive support for every project', 'Trusted by clients across the region', 'Dedicated to your satisfaction'];

const INDUSTRY_CTA: Record<string, string> = {
  'Dental': 'Book Appointment',
  'Legal': 'Free Consultation',
  'Roofing': 'Get Free Estimate',
  'Plumbing': 'Get Free Quote',
  'HVAC': 'Get Free Quote',
  'Auto': 'Book Service',
  'Chiropractic': 'Book Appointment',
  'Real Estate': 'Contact Us',
  'Medical': 'Book Appointment',
  'Construction': 'Get Free Estimate',
  'Electrical': 'Get Free Quote',
};
const DEFAULT_CTA = 'Contact Us';

const INDUSTRY_TESTIMONIALS: Record<string, string[]> = {
  'Dental':       ['Best dental experience ever. The staff is incredibly friendly and professional!', 'They transformed my smile. I can\'t stop smiling now!', 'The atmosphere is amazing. It doesn\'t even feel like a dentist office.'],
  'Legal':        ['Excellent legal representation. Won my case!', 'Very professional and kept me informed throughout.', 'Best lawyer in town. Highly recommended!'],
  'Roofing':      ['Amazing roof work, done on time and on budget!', 'Professional crew, cleaned up perfectly after the job.', 'Best roofing company we\'ve ever worked with.'],
  'Plumbing':     ['Fixed our emergency leak in under an hour!', 'Fair pricing and excellent workmanship.', 'Reliable, professional, and thorough service.'],
  'Auto':         ['Honest mechanics who don\'t overcharge. Finally!', 'Got my car running like new again.', 'Best auto shop in the area, hands down.'],
  'HVAC':         ['AC fixed same day. Lifesaver in summer!', 'Professional installation and great follow-up service.', 'Best HVAC company we\'ve ever used.'],
  'Chiropractic': ['Pain-free after just 3 sessions!', 'Dr. is amazing. Best chiropractor I\'ve been to.', 'Life-changing treatment. Can\'t recommend enough!'],
  'Real Estate':  ['Sold our house above asking price!', 'Made buying our first home stress-free.', 'Best real estate agent in the area.'],
  'Medical':      ['The doctors here truly care about their patients.', 'Short wait times and thorough exams every visit.', 'Best medical practice in the area.'],
  'Construction': ['They built our dream home on time and on budget!', 'Quality craftsmanship and attention to detail.', 'Best contractor we\'ve ever worked with.'],
  'Electrical':   ['Fast, clean work. Fixed our whole panel in one day!', 'Very knowledgeable and fair pricing.', 'Best electrician in the area. Highly recommend!'],
};
const DEFAULT_TESTIMONIALS = ['Great service! Highly recommended.', 'Professional, reliable, and affordable.', 'Best in the business. Will use again!'];

const INDUSTRY_CHATBOT: Record<string, string> = {
  'Dental': 'How can we help with your dental needs?',
  'Legal': 'How can we help with your legal matter?',
  'Roofing': 'Need a roof quote? Ask us!',
  'Plumbing': 'Plumbing emergency? We can help!',
  'Auto': 'Need auto repair? Ask us!',
  'HVAC': 'HVAC issue? Get help now!',
  'Chiropractic': 'Ready to feel better? Book today!',
  'Real Estate': 'Looking to buy or sell property?',
  'Medical': 'How can we help with your health needs?',
  'Construction': 'Need a construction quote? Ask us!',
  'Electrical': 'Electrical issue? We can help!',
};
const DEFAULT_CHATBOT = 'How can we help?';

// Industry-specific hero headlines (3-part: "PART1 ACCENT PART2")
const INDUSTRY_HERO: Record<string, { h1: string; accent: string; h2: string; sub: string; footer: string; placeholder: string; cta_banner: string }> = {
  'Dental':       { h1: 'Your Smile', accent: 'The Best', h2: 'Deserves', sub: 'Gentle, modern dentistry with a caring team you can trust. Book your visit today.', footer: 'Professional dental care trusted by patients across our community. Your smile is our passion.', placeholder: 'e.g. Dental Implants', cta_banner: 'Ready for a Beautiful Smile?' },
  'Legal':        { h1: 'Expert Legal', accent: 'You Need It', h2: 'Help When', sub: 'Trusted legal representation with a track record of results. Free consultation, no pressure.', footer: 'Experienced legal representation for families and businesses. We fight for what matters to you.', placeholder: 'e.g. Personal Injury', cta_banner: 'Ready to Protect Your Rights?' },
  'Roofing':      { h1: 'Quality Roofing', accent: 'Trust', h2: 'You Can', sub: 'Licensed, insured, and locally owned. Free inspections and upfront pricing on every project.', footer: 'Quality roofing services for homes and businesses. Licensed, insured, and locally owned.', placeholder: 'e.g. Roof Replacement', cta_banner: 'Ready to Protect Your Home?' },
  'Plumbing':     { h1: 'Plumbing Help', accent: 'Reliable', h2: 'Fast &', sub: 'Emergency service, fair pricing, and workmanship you can count on — 24/7.', footer: 'Expert plumbing services available 24/7. Upfront pricing, workmanship you can count on.', placeholder: 'e.g. Water Heater', cta_banner: 'Need Plumbing Help Now?' },
  'Auto':         { h1: 'Trusted Auto', accent: 'Experts', h2: 'Repair', sub: 'Honest diagnostics, fair pricing, and the kind of service that keeps customers coming back.', footer: 'Honest auto repair from a family-owned shop. Quality work, fair prices, no surprises.', placeholder: 'e.g. Brake Service', cta_banner: 'Ready to Book Service?' },
  'HVAC':         { h1: 'Comfort', accent: 'Simple', h2: 'Made', sub: 'Heating and cooling done right the first time. Fast response, transparent pricing.', footer: 'Comfortable homes start with reliable HVAC. Installation, repair, and maintenance done right.', placeholder: 'e.g. AC Repair', cta_banner: 'Ready for Reliable Comfort?' },
  'Chiropractic': { h1: 'Relief That', accent: 'Lasts', h2: 'Actually', sub: 'Personalized care plans designed to get you out of pain and back to your life.', footer: 'Personalized chiropractic care focused on lasting results. Get back to the life you love.', placeholder: 'e.g. Back Pain', cta_banner: 'Ready to Live Pain-Free?' },
  'Real Estate':  { h1: 'Your Next Move', accent: 'Simple', h2: 'Made', sub: 'Local expertise, honest advice, and a proven track record in your neighborhood.', footer: 'Local real estate experts helping families buy, sell, and invest with confidence.', placeholder: 'e.g. Home Buying', cta_banner: 'Ready to Make Your Move?' },
  'Medical':      { h1: 'Healthcare', accent: 'Understands', h2: 'That', sub: 'Compassionate primary and urgent care with modern facilities and short wait times.', footer: 'Compassionate primary and urgent care for the whole family. Accepting new patients.', placeholder: 'e.g. Annual Checkup', cta_banner: 'Ready to Book a Visit?' },
  'Construction': { h1: 'Built', accent: 'Last', h2: 'To', sub: 'Residential and commercial builds delivered on time, on budget, with quality that stands up.', footer: 'Quality construction for homes and businesses. On time, on budget, built to last.', placeholder: 'e.g. Home Remodel', cta_banner: 'Ready to Start Building?' },
  'Electrical':   { h1: 'Safe, Reliable', accent: 'Power', h2: 'Electrical', sub: 'Licensed electricians for repairs, upgrades, and new installations — done safely.', footer: 'Licensed electricians for homes and businesses. Safe work, fair prices, on-time service.', placeholder: 'e.g. Panel Upgrade', cta_banner: 'Ready to Upgrade Safely?' },
};
const DEFAULT_HERO = { h1: 'Quality Service', accent: 'Trust', h2: 'You Can', sub: 'Professional service delivered with care, every time.', footer: 'Professional service trusted by clients across our community.', placeholder: 'e.g. Service Needed', cta_banner: 'Ready to Get Started?' };

// Fallback team roles per industry (used if scraper fails)
const INDUSTRY_TEAM_ROLES: Record<string, string[]> = {
  'Dental':       ['Lead Dentist', 'Hygienist', 'Orthodontist', 'Office Manager'],
  'Legal':        ['Senior Partner', 'Associate Attorney', 'Paralegal', 'Case Manager'],
  'Roofing':      ['Owner / Foreman', 'Project Manager', 'Estimator', 'Crew Lead'],
  'Plumbing':     ['Master Plumber', 'Service Tech', 'Apprentice', 'Dispatcher'],
  'Auto':         ['Master Mechanic', 'Service Advisor', 'Technician', 'Shop Manager'],
  'HVAC':         ['Lead Installer', 'Service Tech', 'Estimator', 'Dispatcher'],
  'Chiropractic': ['Chiropractor', 'Massage Therapist', 'Wellness Coach', 'Office Manager'],
  'Real Estate':  ['Broker', 'Listing Agent', 'Buyer\'s Agent', 'Transaction Coordinator'],
  'Medical':      ['Physician', 'Nurse Practitioner', 'Medical Assistant', 'Office Manager'],
  'Construction': ['General Contractor', 'Project Manager', 'Site Supervisor', 'Designer'],
  'Electrical':   ['Master Electrician', 'Journeyman', 'Apprentice', 'Office Manager'],
};
const DEFAULT_TEAM_ROLES = ['Team Lead', 'Specialist', 'Senior Tech', 'Client Manager'];
const DEFAULT_TEAM_NAMES = ['Alex Morgan', 'Jordan Reed', 'Taylor Kim', 'Casey Lee'];

const SUBJECT_TEMPLATES = [
  'I created 3 free redesign concepts for {name}',
  "Quick idea for {name} website",
  '{name}: free website improvement concepts',
];

// ─── EMAIL EXTRACTION ───────────────────────────────────────────────────────

async function extractEmail(url: string, browser: any): Promise<string | null> {
  try {
    const page = await browser.newPage();
    await page.setDefaultTimeout(30000);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    const html = await page.content();
    await page.close();

    const emails = new Set<string>();

    // mailto: links
    const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
    let match;
    while ((match = mailtoRegex.exec(html)) !== null) {
      emails.add(match[1].toLowerCase());
    }

    // Email regex in page text
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    while ((match = emailRegex.exec(html)) !== null) {
      const email = match[0].toLowerCase();
      if (!email.includes('.png') && !email.includes('.jpg') && !email.includes('.webp') &&
          !email.includes('.svg') && !email.includes('.css') && !email.includes('.js') &&
          !email.includes('example.com') && !email.includes('sentry') && !email.includes('wixpress') &&
          !email.includes('wordpress') && !email.includes('w3.org') && !email.includes('schema.org') &&
          !email.includes('googleapis') && !email.includes('cloudflare')) {
        emails.add(email);
      }
    }

    const validEmails = Array.from(emails);
    return validEmails.length > 0 ? validEmails[0] : null;
  } catch {
    return null;
  }
}

async function extractBusinessName(url: string, browser: any): Promise<string> {
  try {
    const page = await browser.newPage();
    await page.setDefaultTimeout(20000);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    const title = await page.title();
    await page.close();

    if (title && title.length > 2 && title.length < 200) {
      return title
        .replace(/\s*[-–|]\s*Home.*$/i, '')
        .replace(/\s*[-–|]\s*Welcome.*$/i, '')
        .replace(/\s*[-–|]\s*Official.*$/i, '')
        .replace(/\s*[-–|].*$/, '')
        .trim() || title.trim();
    }
    return '';
  } catch {
    return '';
  }
}

// ─── SCREENSHOT CURRENT SITE ────────────────────────────────────────────────

async function screenshotCurrentSite(url: string, dir: string, browser: any, companyName: string): Promise<void> {
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: path.join(dir, 'current-site.png'), fullPage: false });
    await page.close();
  } catch {
    // Retry once
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      await page.screenshot({ path: path.join(dir, 'current-site.png'), fullPage: false });
      await page.close();
      return;
    } catch { /* fall through to fallback */ }

    // Generate fallback
    const fallbackHtml = `<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{width:1280px;height:900px;background:#f8fafc;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center}
      .card{background:white;border-radius:16px;padding:60px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:800px;text-align:center}
      h2{font-size:28px;color:#1e293b;margin-bottom:12px}
      .url{font-size:16px;color:#3b82f6;margin-bottom:24px}
      .issues{text-align:left;margin:0 auto;max-width:500px}
      .issue{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:15px;color:#475569}
      .x{color:#dc2626;font-weight:bold;font-size:18px}
    </style></head><body>
      <div class="card">
        <h2>${companyName}</h2>
        <div class="url">${url}</div>
        <div class="issues">
          <div class="issue"><span class="x">✕</span> Outdated website design</div>
          <div class="issue"><span class="x">✕</span> No AI chatbot</div>
          <div class="issue"><span class="x">✕</span> No online booking</div>
          <div class="issue"><span class="x">✕</span> Poor mobile optimization</div>
          <div class="issue"><span class="x">✕</span> Missing SEO basics</div>
        </div>
      </div>
    </body></html>`;
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setContent(fallbackHtml, { waitUntil: 'networkidle0' });
      await page.screenshot({ path: path.join(dir, 'current-site.png'), fullPage: false });
      await page.close();
    } catch { /* skip */ }
  }
}

// ─── TEMPLATE RENDERING & SCREENSHOTS ───────────────────────────────────────

async function renderTemplateScreenshots(
  browser: any,
  templateDir: string,
  outputDir: string,
  lead: ProcessedLead,
  letters: [string, string, string],
  companyData?: CompanyData,
  googleReviews?: GoogleReviewsResult,
): Promise<void> {
  const defaultServices = INDUSTRY_SERVICES[lead.industry] || DEFAULT_SERVICES;
  const descs = SERVICE_DESCS[lead.industry] || DEFAULT_DESCS;
  const defaultTestimonials = INDUSTRY_TESTIMONIALS[lead.industry] || DEFAULT_TESTIMONIALS;
  const cta = INDUSTRY_CTA[lead.industry] || DEFAULT_CTA;
  const chatbot = INDUSTRY_CHATBOT[lead.industry] || DEFAULT_CHATBOT;
  const heroCfg = INDUSTRY_HERO[lead.industry] || DEFAULT_HERO;
  const teamRoles = INDUSTRY_TEAM_ROLES[lead.industry] || DEFAULT_TEAM_ROLES;

  // Merge scraped data: company data wins, fallback to industry defaults
  const scraped: CompanyData = companyData || {
    services: [], phone: null, address: null, city: null, hours: null,
    teamMembers: [], heroHeadline: null, metaDescription: null, aboutSnippet: null,
    images: [],
  };
  const services = scraped.services.length >= 6 ? scraped.services : [...scraped.services, ...defaultServices].slice(0, 6);
  const phone = scraped.phone || '';
  const city = scraped.city || lead.country;
  const teamMembers = scraped.teamMembers.length > 0
    ? scraped.teamMembers.concat(Array(4).fill(null).map((_, i) => ({ name: DEFAULT_TEAM_NAMES[i], role: teamRoles[i] }))).slice(0, 4)
    : DEFAULT_TEAM_NAMES.map((name, i) => ({ name, role: teamRoles[i] }));

  // Google reviews (if available) overrides generic testimonials
  const reviews = googleReviews?.reviews || [];
  const testimonials = reviews.length >= 3
    ? reviews.slice(0, 3).map(r => r.text.slice(0, 200))
    : defaultTestimonials;
  const testimonialAuthors = reviews.length >= 3
    ? reviews.slice(0, 3).map(r => r.author)
    : ['Verified Client', 'Satisfied Customer', 'Long-term Client'];
  const rating = googleReviews?.avgRating ? googleReviews.avgRating.toFixed(1) : '4.8';
  const reviewCount = googleReviews?.reviewCount ? String(googleReviews.reviewCount) : '50';

  const basePlaceholders: Record<string, string> = {
    '{{COMPANY_NAME}}': lead.businessName,
    '{{COMPANY_SHORT_NAME}}': shortenCompanyName(lead.businessName),
    '{{PHONE}}': phone,
    '{{CITY}}': city,
    '{{RATING}}': rating,
    '{{REVIEW_COUNT}}': reviewCount,
    '{{YEARS_EXPERIENCE}}': '10',
    '{{SERVICE_1}}': services[0],
    '{{SERVICE_2}}': services[1],
    '{{SERVICE_3}}': services[2],
    '{{SERVICE_4}}': services[3],
    '{{SERVICE_5}}': services[4],
    '{{SERVICE_6}}': services[5],
    '{{SERVICE_DESC_1}}': descs[0],
    '{{SERVICE_DESC_2}}': descs[1],
    '{{SERVICE_DESC_3}}': descs[2],
    '{{SERVICE_DESC_4}}': descs[3],
    '{{SERVICE_DESC_5}}': descs[4],
    '{{SERVICE_DESC_6}}': descs[5],
    '{{TESTIMONIAL_1}}': testimonials[0],
    '{{TESTIMONIAL_2}}': testimonials[1],
    '{{TESTIMONIAL_3}}': testimonials[2],
    '{{TESTIMONIAL_1_AUTHOR}}': testimonialAuthors[0],
    '{{TESTIMONIAL_2_AUTHOR}}': testimonialAuthors[1],
    '{{TESTIMONIAL_3_AUTHOR}}': testimonialAuthors[2],
    '{{TEAM_1_NAME}}': teamMembers[0]?.name || DEFAULT_TEAM_NAMES[0],
    '{{TEAM_2_NAME}}': teamMembers[1]?.name || DEFAULT_TEAM_NAMES[1],
    '{{TEAM_3_NAME}}': teamMembers[2]?.name || DEFAULT_TEAM_NAMES[2],
    '{{TEAM_4_NAME}}': teamMembers[3]?.name || DEFAULT_TEAM_NAMES[3],
    '{{TEAM_1_ROLE}}': teamMembers[0]?.role || teamRoles[0],
    '{{TEAM_2_ROLE}}': teamMembers[1]?.role || teamRoles[1],
    '{{TEAM_3_ROLE}}': teamMembers[2]?.role || teamRoles[2],
    '{{TEAM_4_ROLE}}': teamMembers[3]?.role || teamRoles[3],
    '{{CTA_TEXT}}': cta,
    '{{CHATBOT_GREETING}}': chatbot,
    '{{INDUSTRY_SPECIFIC_SECTION}}': '',
    '{{HERO_HEADLINE_1}}': heroCfg.h1,
    '{{HERO_HEADLINE_2}}': heroCfg.h2,
    '{{HERO_HEADLINE_ACCENT}}': heroCfg.accent,
    '{{HERO_SUBTEXT}}': scraped.metaDescription || heroCfg.sub,
    '{{FOOTER_DESC}}': heroCfg.footer,
    '{{CONTACT_PLACEHOLDER}}': heroCfg.placeholder,
    '{{CTA_BANNER_TITLE}}': heroCfg.cta_banner,
    ...(() => {
      // Prefer scraped images from company's own website; fallback to stock per template variant
      const scrapedImgs = scraped.images || [];
      const hasEnough = scrapedImgs.length >= 3;
      const stockA = getStockImagesForTemplate(lead.industry, 'a');
      // Use scraped images if we have 3+; else stock. For galleries, interleave scraped + stock.
      const hero = scrapedImgs[0] || stockA.hero;
      const office = scrapedImgs[1] || stockA.office;
      const galleryPool = hasEnough
        ? [...scrapedImgs.slice(2), ...scrapedImgs.slice(0, 2), ...stockA.gallery].slice(0, 6)
        : [...scrapedImgs, ...stockA.gallery].slice(0, 6);
      return {
        '{{HERO_BG_IMAGE}}': hero,
        '{{OFFICE_IMAGE}}': office,
        '{{GALLERY_1}}': galleryPool[0],
        '{{GALLERY_2}}': galleryPool[1] || galleryPool[0],
        '{{GALLERY_3}}': galleryPool[2] || galleryPool[0],
        '{{GALLERY_4}}': galleryPool[3] || galleryPool[0],
        '{{GALLERY_5}}': galleryPool[4] || galleryPool[0],
        '{{GALLERY_6}}': galleryPool[5] || galleryPool[0],
        '{{ABOUT_HEADLINE}}': `Personal attention for every ${lead.industry === 'Dental' ? 'patient' : lead.industry === 'Legal' ? 'client' : 'customer'}, every visit`,
        '{{ABOUT_TEXT}}': scraped.aboutSnippet || scraped.metaDescription || heroCfg.footer,
      };
    })(),
    ...(() => {
      // Team avatar styles — use scraped photo if available, else gradient
      const gradients = [
        'background:linear-gradient(135deg,var(--accent),#f472b6)',
        'background:linear-gradient(135deg,#60a5fa,var(--accent))',
        'background:linear-gradient(135deg,#f472b6,#c084fc)',
        'background:linear-gradient(135deg,#34d399,#60a5fa)',
      ];
      const out: Record<string, string> = {};
      for (let i = 0; i < 4; i++) {
        const m = teamMembers[i];
        const photo = (m as any)?.photoUrl;
        out[`{{TEAM_${i + 1}_AVATAR_STYLE}}`] = photo ? `background-image:url('${photo}')` : gradients[i];
      }
      return out;
    })(),
  };

  // Main pages: template-{letter}.html → desktop + mobile
  // Subpages: template-{letter}-services.html, template-{letter}-about.html, template-{letter}-contact.html → desktop only
  const subpageTypes = ['services', 'about', 'contact'];

  for (const letter of letters) {
    const colors = getColorsForTemplate(lead.industry, letter);
    // Per-template image rotation: each template gets a different hero + gallery order
    const scrapedImgs = scraped.images || [];
    const stockT = getStockImagesForTemplate(lead.industry, letter);
    const letterIdx = letter === 'a' ? 0 : letter === 'b' ? 1 : 2;
    const heroCandidate = scrapedImgs[letterIdx] || scrapedImgs[0] || stockT.hero;
    const officeCandidate = scrapedImgs[letterIdx + 1] || scrapedImgs[1] || stockT.office;
    // Rotate gallery start so A/B/C each show different images
    const poolBase = scrapedImgs.length >= 3 ? [...scrapedImgs, ...stockT.gallery] : [...scrapedImgs, ...stockT.gallery];
    const rotated = [...poolBase.slice(letterIdx * 2), ...poolBase.slice(0, letterIdx * 2)].slice(0, 6);
    const allPlaceholders = {
      ...basePlaceholders,
      '{{PRIMARY_COLOR}}': colors.primary,
      '{{ACCENT_COLOR}}': colors.accent,
      '{{BG_COLOR}}': '#f8fafc',
      '{{TEXT_COLOR}}': '#1e293b',
      '{{HERO_BG_IMAGE}}': heroCandidate,
      '{{OFFICE_IMAGE}}': officeCandidate,
      '{{GALLERY_1}}': rotated[0] || stockT.gallery[0],
      '{{GALLERY_2}}': rotated[1] || stockT.gallery[1] || rotated[0],
      '{{GALLERY_3}}': rotated[2] || stockT.gallery[2] || rotated[0],
      '{{GALLERY_4}}': rotated[3] || stockT.gallery[3] || rotated[0],
      '{{GALLERY_5}}': rotated[4] || stockT.gallery[4] || rotated[0],
      '{{GALLERY_6}}': rotated[5] || stockT.gallery[5] || rotated[0],
    };

    // Main page
    try {
      let html = fs.readFileSync(path.join(templateDir, `template-${letter}.html`), 'utf8');
      for (const [key, val] of Object.entries(allPlaceholders)) {
        html = html.split(key).join(val);
      }

      const page = await browser.newPage();

      // Desktop screenshot
      await page.setViewport({ width: 1280, height: 900 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.screenshot({ path: path.join(outputDir, `${letter}-desktop.png`), fullPage: false });

      // Mobile screenshot
      await page.setViewport({ width: 375, height: 667 });
      await page.screenshot({ path: path.join(outputDir, `${letter}-mobile.png`), fullPage: false });
      await page.close();
    } catch (err: any) {
      console.log(`    ⚠️ Template ${letter} main: ${err.message?.slice(0, 60)}`);
    }

    // Subpages (desktop only)
    for (const subpage of subpageTypes) {
      try {
        const templateFile = path.join(templateDir, `template-${letter}-${subpage}.html`);
        if (!fs.existsSync(templateFile)) {
          console.log(`    ⚠️ Missing template: template-${letter}-${subpage}.html`);
          continue;
        }
        let html = fs.readFileSync(templateFile, 'utf8');
        for (const [key, val] of Object.entries(allPlaceholders)) {
          html = html.split(key).join(val);
        }

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.screenshot({ path: path.join(outputDir, `${letter}-${subpage}.png`), fullPage: false });
        await page.close();
      } catch (err: any) {
        console.log(`    ⚠️ Template ${letter}-${subpage}: ${err.message?.slice(0, 60)}`);
      }
    }
  }
}

// ─── INDUSTRY-SPECIFIC EMAIL ────────────────────────────────────────────────

function getEmailHtml(lead: ProcessedLead, observation?: string): string {
  const services = INDUSTRY_SERVICES[lead.industry] || DEFAULT_SERVICES;
  const displayName = lead.businessName || lead.name;
  const industryLower = lead.industry.toLowerCase();

  // Industry-specific opening line
  const industryOpeners: Record<string, string> = {
    'Dental':       `I came across your dental practice while researching dentists in your area`,
    'Legal':        `I came across your law firm while researching legal practices in your area`,
    'Roofing':      `I came across your roofing company while researching contractors in your area`,
    'Plumbing':     `I came across your plumbing business while researching local plumbers`,
    'Auto':         `I came across your auto repair shop while researching mechanics in your area`,
    'HVAC':         `I came across your HVAC company while researching heating and cooling services`,
    'Chiropractic': `I came across your chiropractic practice while researching wellness providers`,
    'Real Estate':  `I came across your real estate business while researching agents in your area`,
    'Medical':      `I came across your medical practice while researching healthcare providers`,
    'Construction': `I came across your construction company while researching contractors in your area`,
    'Electrical':   `I came across your electrical business while researching electricians in your area`,
  };
  const opener = industryOpeners[lead.industry] || `I came across your ${industryLower} business while researching companies in your area`;

  // Industry-specific improvements
  const industryImprovements: Record<string, string> = {
    'Dental':       `<li>Modern design that builds patient trust from the first click</li>
<li>AI chatbot for after-hours appointment questions</li>
<li>Online booking for ${services[0]}, ${services[1]}, and more</li>
<li>SEO optimization to rank higher for "dentist near me"</li>`,
    'Legal':        `<li>Professional design that builds client confidence</li>
<li>AI chatbot for after-hours legal inquiries</li>
<li>Easy consultation booking for ${services[0]}, ${services[1]}, and more</li>
<li>SEO optimization to rank higher for "${industryLower} near me"</li>`,
    'Roofing':      `<li>Professional design that showcases your best work</li>
<li>AI chatbot for quick roofing quote requests</li>
<li>Online estimate request for ${services[0]}, ${services[1]}, and more</li>
<li>SEO optimization to rank higher for "roofer near me"</li>`,
    'Plumbing':     `<li>Clean design with prominent emergency contact info</li>
<li>AI chatbot for plumbing emergencies after hours</li>
<li>Online booking for ${services[0]}, ${services[2]}, and more</li>
<li>SEO optimization to rank higher for "plumber near me"</li>`,
    'Auto':         `<li>Modern design that builds trust with car owners</li>
<li>AI chatbot for service questions and scheduling</li>
<li>Online booking for ${services[0]}, ${services[1]}, and more</li>
<li>SEO optimization to rank higher for "auto repair near me"</li>`,
    'HVAC':         `<li>Professional design with emergency service prominently displayed</li>
<li>AI chatbot for HVAC questions and scheduling</li>
<li>Online booking for ${services[0]}, ${services[1]}, and more</li>
<li>SEO optimization to rank higher for "HVAC near me"</li>`,
  };
  const improvements = industryImprovements[lead.industry] ||
    `<li>Modern, mobile-friendly design to build instant trust</li>
<li>AI chatbot for after-hours inquiries</li>
<li>Online booking/contact system for ${services[0]}, ${services[1]}, etc.</li>
<li>SEO optimization to rank higher for "${industryLower} near me"</li>`;

  const obsSentence = observation
    ? `${opener} — and I noticed <strong>${observation}</strong>.`
    : `${opener} — and I noticed your website could use a modern refresh that better reflects the quality of your work.`;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#333">
<p>Hi ${displayName} team,</p>
<p>${obsSentence}</p>
<p>So I created <strong>3 redesign concepts specifically for ${displayName}</strong>. You'll find them in the attached PDF.</p>
<p><strong>A few quick improvements I identified:</strong></p>
<ul style="color:#555;line-height:1.8">
${improvements}
</ul>
<p>Would you be open to a quick 10-minute call to discuss?</p>
<p style="margin:28px 0"><a href="https://smartflowdev.com" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">See our work &rarr;</a></p>
<p>Best regards,<br><strong>Geri</strong><br>AI Web Development Specialist<br><a href="https://smartflowdev.com" style="color:#2563eb">smartflowdev.com</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:20px 0">
<p style="font-size:12px;color:#999">If you're not interested, simply ignore this email — no follow-ups unless you reply.</p>
</div>`;
}

// ─── MAP INDUSTRY TO PDF V4 INDUSTRY KEY ────────────────────────────────────

function toPdfIndustry(industry: string): PdfV4Options['industry'] {
  const map: Record<string, PdfV4Options['industry']> = {
    'Dental': 'dental',
    'Legal': 'legal',
    'Roofing': 'roofing',
    'Plumbing': 'plumbing',
    'Auto': 'auto',
    'HVAC': 'hvac',
    'Chiropractic': 'chiropractic',
    'Real Estate': 'real_estate',
    'Medical': 'default',
    'Construction': 'default',
    'Electrical': 'default',
  };
  return map[industry] || 'default';
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const puppeteer = require('puppeteer');

  // CLI args
  const args = process.argv.slice(2);
  let jsonPath = path.resolve(__dirname, '../output/leads/chatgpt-100-list-v2.json');
  let limit = Infinity;
  let dryRun = false;
  let minScore = 60;
  let noPsi = false;
  let noScore = false;
  let testEmail: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) jsonPath = path.resolve(process.cwd(), args[i + 1]);
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[i + 1], 10);
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--min-score' && args[i + 1]) minScore = parseInt(args[i + 1], 10);
    if (args[i] === '--no-psi') noPsi = true;
    if (args[i] === '--no-score') noScore = true;
    if (args[i] === '--test-email' && args[i + 1]) testEmail = args[i + 1];
  }
  if (testEmail) console.log(`🔹 TEST MODE — all emails will be sent to ${testEmail}`);

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const leads: Lead[] = (data.leads as Lead[]).slice(0, limit);
  if (dryRun) console.log('🔹 DRY RUN mode — PDFs will be generated, but NO emails sent');
  if (noScore) console.log('🔹 Skipping outdated-score filter (--no-score)');
  else console.log(`🔹 Outdated filter: min score ${minScore}${noPsi ? ' (no PSI)' : ''}`);

  // Filter out junk entries
  const validLeads = leads.filter(l =>
    l.industry !== 'Unknown' &&
    !l.website.includes('rfc-editor.org') &&
    !l.website.includes('builtwith.com') &&
    !l.website.includes('developer.chrome.com') &&
    !l.website.includes('chatgpt.com')
  );

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  CHATGPT LIST v2 OUTREACH - INDUSTRY TEMPLATE BASED          ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total leads: ${validLeads.length} (filtered from ${leads.length})                        ║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const templateDir = path.resolve(__dirname, '../templates');
  const results: ProcessedLead[] = [];

  for (let i = 0; i < validLeads.length; i++) {
    const lead = validLeads[i];
    const processed: ProcessedLead = { ...lead, email: null, businessName: lead.name, status: 'skipped' };

    try {
      // 1. Use pre-known email from lead JSON, or extract from contactUrl
      if (lead.email) {
        processed.email = lead.email;
      } else {
        processed.email = await extractEmail(lead.contactUrl, browser);
        // Also try main website if contactUrl didn't yield email
        if (!processed.email && lead.website !== lead.contactUrl) {
          processed.email = await extractEmail(lead.website, browser);
        }
      }

      // 2. Get real business name from <title> — only if it's meaningful (not 1-letter or garbage)
      const titleName = await extractBusinessName(lead.website, browser);
      if (titleName && titleName.length >= 4 && titleName.length <= 80 && /[a-zA-Z]{3,}/.test(titleName)) {
        processed.businessName = titleName;
      }

      if (!processed.email && !testEmail) {
        console.log(`  [${i + 1}/${validLeads.length}] ${processed.businessName} → No email found ⏭️`);
        results.push(processed);
        continue;
      }
      if (!processed.email && testEmail) {
        processed.email = testEmail; // test mode: fake it so pipeline continues
      }

      console.log(`  [${i + 1}/${validLeads.length}] ${processed.businessName} (${lead.industry}) → ${processed.email}`);

      // 2b. Outdated score check — skip modern sites
      let scoreResult: OutdatedScore | null = null;
      if (!noScore) {
        scoreResult = await scoreOutdated(lead.website, { skipPsi: noPsi });
        processed.outdatedScore = scoreResult.score;
        processed.outdatedBreakdown = scoreResult.breakdown;
        if (scoreResult.blocked) {
          console.log(`    ⚠️ Score blocked (${scoreResult.error}), sending anyway`);
        } else if (scoreResult.score < minScore) {
          console.log(`    ⏭️ Skipped: not outdated (score=${scoreResult.score}/${minScore} signals=${scoreResult.breakdown})`);
          processed.error = `not_outdated: score=${scoreResult.score} signals=${scoreResult.breakdown}`;
          results.push(processed);
          continue;
        } else {
          console.log(`    ✓ Outdated score: ${scoreResult.score}/100 (${scoreResult.breakdown})`);
        }
      }
      const observation = scoreResult && !scoreResult.blocked
        ? generateObservation(scoreResult, lead.industry)
        : undefined;
      if (observation) console.log(`    💡 Observation: ${observation.slice(0, 100)}...`);

      const slug = slugify(processed.businessName || lead.name);
      const dir = path.resolve(__dirname, `../output/redesigns/${slug}`);
      fs.mkdirSync(dir, { recursive: true });

      // 3. Screenshot current site (30s timeout + retry + fallback)
      await screenshotCurrentSite(lead.website, dir, browser, processed.businessName);

      // 3b. Extract company-specific data from their website (services, phone, team, city)
      let companyData: CompanyData | undefined;
      let googleReviews: GoogleReviewsResult | undefined;
      try {
        console.log(`    Extracting company data from ${lead.website}...`);
        companyData = await extractCompanyData(lead.website);
        console.log(`    ↳ ${companyData.services.length} services, phone: ${companyData.phone ? 'yes' : 'no'}, team: ${companyData.teamMembers.length}, city: ${companyData.city || 'none'}`);
      } catch (err) { /* fallback to industry defaults */ }

      // 3c. Fetch Google reviews (real testimonials + rating)
      try {
        const query = `${processed.businessName} ${lead.country}`;
        googleReviews = await extractGoogleReviews(query);
        if (googleReviews.reviews.length > 0) {
          console.log(`    ↳ ${googleReviews.reviews.length} Google reviews, ${googleReviews.avgRating}★ (${googleReviews.reviewCount} total)`);
        }
      } catch (err) { /* fallback to generic testimonials */ }

      // 4. Get correct template letters based on industry
      const letters = getTemplateLetters(lead.industry);
      console.log(`    Templates: ${letters.join(', ').toUpperCase()} (${getTemplateSet(lead.industry)})`);

      // 5. Generate 3 redesigns + 9 subpages from correct template set
      await renderTemplateScreenshots(browser, templateDir, dir, processed, letters, companyData, googleReviews);

      // 6. Generate v4 PDF using generate-pdf-v4.ts
      const proposalDir = path.resolve(__dirname, '../output/proposals');
      fs.mkdirSync(proposalDir, { recursive: true });

      const pdfPath = path.join(proposalDir, `${slug}-proposal.pdf`);
      const [l1, l2, l3] = letters;

      const pdfOptions: PdfV4Options = {
        lead: {
          name: processed.businessName,
          company: processed.businessName,
          city: lead.country,
          website: lead.website,
          email: processed.email || undefined,
        },
        industry: toPdfIndustry(lead.industry),
        currency: 'USD',
        images: {
          currentSite: path.join(dir, 'current-site.png'),
          redesignA_desktop: path.join(dir, `${l1}-desktop.png`),
          redesignA_mobile: path.join(dir, `${l1}-mobile.png`),
          redesignB_desktop: path.join(dir, `${l2}-desktop.png`),
          redesignB_mobile: path.join(dir, `${l2}-mobile.png`),
          redesignC_desktop: path.join(dir, `${l3}-desktop.png`),
          redesignC_mobile: path.join(dir, `${l3}-mobile.png`),
          subpageA_services: path.join(dir, `${l1}-services.png`),
          subpageA_about: path.join(dir, `${l1}-about.png`),
          subpageA_contact: path.join(dir, `${l1}-contact.png`),
          subpageB_services: path.join(dir, `${l2}-services.png`),
          subpageB_about: path.join(dir, `${l2}-about.png`),
          subpageB_contact: path.join(dir, `${l2}-contact.png`),
          subpageC_services: path.join(dir, `${l3}-services.png`),
          subpageC_about: path.join(dir, `${l3}-about.png`),
          subpageC_contact: path.join(dir, `${l3}-contact.png`),
        },
        outputPath: pdfPath,
      };

      await generatePdfV4(pdfOptions);
      processed.pdfPath = pdfPath;

      // 7. Send email via Resend with PDF attachment (skip if --dry-run)
      if (dryRun) {
        console.log(`    📄 PDF ready (dry-run, no email sent): ${pdfPath}`);
        processed.status = 'sent';
        results.push(processed);
        continue;
      }
      const { Resend } = require('resend');
      const resend = new Resend(RESEND_API_KEY);

      const subjectIdx = i % SUBJECT_TEMPLATES.length;
      const subject = SUBJECT_TEMPLATES[subjectIdx].replace('{name}', processed.businessName);

      const pdfBuffer = fs.readFileSync(pdfPath);

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'Geri <geri@smartflowdev.com>',
        replyTo: 'kapusicsgo@gmail.com',
        to: testEmail || processed.email,
        subject,
        html: getEmailHtml(processed, observation),
        attachments: [{
          filename: `${processed.businessName.replace(/[^a-zA-Z0-9 ]/g, '')}-Website-Redesign-Proposal.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        }],
      });

      if (emailError) {
        console.log(`    ❌ Email error: ${JSON.stringify(emailError)}`);
        processed.status = 'error';
        processed.error = JSON.stringify(emailError);
      } else {
        console.log(`    ✅ Sent! ID: ${emailData?.id}`);
        processed.status = 'sent';
        // Record touch in outreach-state.json for follow-up tracking
        try {
          const state = loadState();
          const leadInit: Omit<LeadState, 'touches' | 'nextTouchAt' | 'nextSeq' | 'replied' | 'bounced' | 'completed' | 'lastReplyCheck'> = {
            email: processed.email!,
            businessName: processed.businessName,
            website: lead.website,
            contactUrl: lead.contactUrl,
            industry: lead.industry,
            country: lead.country,
            outdatedScore: processed.outdatedScore ?? null,
            outdatedBreakdown: processed.outdatedBreakdown ?? null,
            observation: observation || null,
          };
          recordTouch(state, leadInit, {
            seq: 1,
            sentAt: new Date().toISOString(),
            messageId: emailData?.id || null,
            subject,
          });
          saveState(state);
        } catch (stateErr: any) {
          console.log(`    ⚠️ State save failed: ${stateErr.message?.slice(0, 60)}`);
        }
      }

      // 3 second delay between emails
      await new Promise(r => setTimeout(r, 3000));

    } catch (err: any) {
      console.log(`    ❌ Error: ${err.message?.slice(0, 80)}`);
      processed.status = 'error';
      processed.error = err.message;
    }

    results.push(processed);
  }

  await browser.close();

  // Save log to v2
  const logPath = path.resolve(__dirname, '../output/outreach-log-chatgpt-v2.json');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const sent = results.filter(r => r.status === 'sent').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;

  fs.writeFileSync(logPath, JSON.stringify({
    date: new Date().toISOString(),
    totalProcessed: results.length,
    sent,
    skipped,
    errors,
    results: results.map(r => ({
      name: r.name,
      businessName: r.businessName,
      website: r.website,
      email: r.email,
      industry: r.industry,
      country: r.country,
      status: r.status,
      outdatedScore: r.outdatedScore,
      outdatedBreakdown: r.outdatedBreakdown,
      error: r.error,
    })),
  }, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  OUTREACH COMPLETE                                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Total time: ${elapsed} minutes`);
  console.log(`  Processed: ${results.length}`);
  console.log(`  Sent: ${sent}`);
  console.log(`  Skipped (no email): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Log: ${logPath}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
