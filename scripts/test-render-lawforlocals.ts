import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { extractCompanyData } from './extract-company-data';
import { extractGoogleReviews } from './extract-google-reviews';
import { getStockImages } from './stock-images';

async function main() {
  const url = 'https://lawforlocals.com';
  const businessName = 'Law For Locals';
  const outDir = path.resolve(__dirname, '../output/test-lawforlocals');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('1. Scraping company data...');
  const data = await extractCompanyData(url);
  console.log(`   services=${data.services.length}, phone=${data.phone}, team=${data.teamMembers.length}`);

  console.log('2. Fetching Google reviews...');
  const reviews = await extractGoogleReviews('Law For Locals Chester CT');
  console.log(`   rating=${reviews.avgRating}, count=${reviews.reviewCount}`);

  const positive = reviews.reviews.filter(r => r.rating >= 4).slice(0, 3);

  // Deduplicate team (same person different photos)
  const uniqueTeam: typeof data.teamMembers = [];
  const seen = new Set<string>();
  for (const m of data.teamMembers) {
    if (!seen.has(m.name)) { seen.add(m.name); uniqueTeam.push(m); }
  }

  // Legal industry defaults for filling slots
  const defaultNames = ['Sarah Mitchell', 'Michael Brennan', 'Emily Davis', 'James Thompson'];
  const defaultRoles = ['Senior Partner', 'Associate Attorney', 'Paralegal', 'Case Manager'];

  const services = data.services.length >= 6
    ? data.services.slice(0, 6)
    : [...data.services, 'Wills & Probate', 'Business Law'].slice(0, 6);

  const descs = [
    'Contracts, disputes, and corporate counsel for local businesses',
    'Closings, title issues, and real estate transactions',
    'Wills, trusts, and estate planning for families',
    'Probate and estate administration with care',
    'General legal counsel for individuals and businesses',
    'Trusted advice from an experienced local attorney',
  ];

  const testimonials = positive.length >= 3
    ? positive.map(r => r.text.slice(0, 220))
    : ['Excellent legal representation.', 'Very professional and thorough.', 'Highly recommended attorney.'];

  const testimonialAuthors = positive.length >= 3
    ? positive.map(r => r.author)
    : ['Verified Client', 'Longtime Client', 'Business Owner'];

  const stock = getStockImages('Legal');

  const buildPlaceholders = (colors: { primary: string; accent: string; bg: string; text: string }) => {
    const placeholders: Record<string, string> = {
      '{{COMPANY_NAME}}': businessName,
      '{{PHONE}}': data.phone || '(860) 526-1780',
      '{{CITY}}': data.city || 'Chester, CT',
      '{{RATING}}': reviews.avgRating ? reviews.avgRating.toFixed(1) : '4.4',
      '{{REVIEW_COUNT}}': reviews.reviewCount ? String(reviews.reviewCount) : '16',
      '{{YEARS_EXPERIENCE}}': '20',
      '{{SERVICE_1}}': services[0] || 'Business Transactions',
      '{{SERVICE_2}}': services[1] || 'Real Estate',
      '{{SERVICE_3}}': services[2] || 'Estate Planning',
      '{{SERVICE_4}}': services[3] || 'Estate Administration',
      '{{SERVICE_5}}': services[4] || 'General Counsel',
      '{{SERVICE_6}}': services[5] || 'Legal Services',
      '{{SERVICE_DESC_1}}': descs[0], '{{SERVICE_DESC_2}}': descs[1], '{{SERVICE_DESC_3}}': descs[2],
      '{{SERVICE_DESC_4}}': descs[3], '{{SERVICE_DESC_5}}': descs[4], '{{SERVICE_DESC_6}}': descs[5],
      '{{TESTIMONIAL_1}}': testimonials[0],
      '{{TESTIMONIAL_2}}': testimonials[1],
      '{{TESTIMONIAL_3}}': testimonials[2],
      '{{TESTIMONIAL_1_AUTHOR}}': testimonialAuthors[0],
      '{{TESTIMONIAL_2_AUTHOR}}': testimonialAuthors[1],
      '{{TESTIMONIAL_3_AUTHOR}}': testimonialAuthors[2],
      '{{HERO_HEADLINE_1}}': 'Expert Legal',
      '{{HERO_HEADLINE_2}}': 'Help When',
      '{{HERO_HEADLINE_ACCENT}}': 'You Need It',
      '{{HERO_SUBTEXT}}': data.metaDescription || 'Trusted local attorney helping individuals, small businesses and organizations across many practice areas.',
      '{{FOOTER_DESC}}': 'Chester-based attorney working with individuals, small businesses and organizations. Trusted legal counsel for your most important matters.',
      '{{CONTACT_PLACEHOLDER}}': 'e.g. Real Estate Closing',
      '{{CTA_BANNER_TITLE}}': 'Ready to Protect Your Interests?',
      '{{CTA_TEXT}}': 'Free Consultation',
      '{{CHATBOT_GREETING}}': 'How can we help with your legal matter?',
      '{{INDUSTRY_SPECIFIC_SECTION}}': '',
      '{{PRIMARY_COLOR}}': colors.primary,
      '{{ACCENT_COLOR}}': colors.accent,
      '{{BG_COLOR}}': colors.bg,
      '{{TEXT_COLOR}}': colors.text,
      '{{HERO_BG_IMAGE}}': stock.heroes[0],
      '{{OFFICE_IMAGE}}': stock.offices[0],
      '{{GALLERY_1}}': stock.gallery[0],
      '{{GALLERY_2}}': stock.gallery[1],
      '{{GALLERY_3}}': stock.gallery[2],
      '{{GALLERY_4}}': stock.gallery[3],
      '{{GALLERY_5}}': stock.gallery[4],
      '{{GALLERY_6}}': stock.gallery[5],
      '{{ABOUT_HEADLINE}}': 'Personal attention for every client, every case',
      '{{ABOUT_TEXT}}': data.metaDescription || 'We provide trusted legal counsel to individuals, families, and small businesses across our community. From real estate closings to estate planning, you get direct, practical advice from an experienced attorney who understands your goals.',
    };

    // Team with scraped photos
    const gradients = [
      'background:linear-gradient(135deg,var(--accent),#f472b6)',
      'background:linear-gradient(135deg,#60a5fa,var(--accent))',
      'background:linear-gradient(135deg,#f472b6,#c084fc)',
      'background:linear-gradient(135deg,#34d399,#60a5fa)',
    ];
    const mergedTeam = [
      ...uniqueTeam,
      ...defaultNames.map((name, i) => ({ name, role: defaultRoles[i], photoUrl: '' as string | undefined })),
    ].slice(0, 4);

    for (let i = 0; i < 4; i++) {
      const m = mergedTeam[i];
      placeholders[`{{TEAM_${i + 1}_NAME}}`] = m.name;
      placeholders[`{{TEAM_${i + 1}_ROLE}}`] = m.role;
      placeholders[`{{TEAM_${i + 1}_AVATAR_STYLE}}`] = m.photoUrl
        ? `background-image:url('${m.photoUrl}')`
        : gradients[i];
    }

    return placeholders;
  };

  // Legal-appropriate color schemes for A/B/C
  const templates: Array<{ letter: string; name: string; colors: any }> = [
    { letter: 'a', name: 'Editorial Hero', colors: { primary: '#1e3a5f', accent: '#d4a853', bg: '#ffffff', text: '#1e293b' } },
    { letter: 'b', name: 'Split Asymmetric Warm', colors: { primary: '#2c3e50', accent: '#c0392b', bg: '#fffcf7', text: '#2c1810' } },
    { letter: 'c', name: 'Glass Morphism', colors: { primary: '#1e3a5f', accent: '#8B6914', bg: '#f5f0e8', text: '#1a1a2e' } },
  ];

  console.log('3. Rendering 3 templates...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  for (const t of templates) {
    const templatePath = path.resolve(__dirname, `../templates/template-${t.letter}.html`);
    let html = fs.readFileSync(templatePath, 'utf8');
    const placeholders = buildPlaceholders(t.colors);
    for (const [key, val] of Object.entries(placeholders)) {
      html = html.split(key).join(val);
    }

    const htmlOut = path.join(outDir, `template-${t.letter}-preview.html`);
    fs.writeFileSync(htmlOut, html);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(outDir, `template-${t.letter}-desktop.png`), fullPage: false });
    await page.screenshot({ path: path.join(outDir, `template-${t.letter}-fullpage.png`), fullPage: true });
    await page.setViewport({ width: 375, height: 667 });
    await page.screenshot({ path: path.join(outDir, `template-${t.letter}-mobile.png`), fullPage: false });
    await page.close();
    console.log(`   ✅ Template ${t.letter.toUpperCase()} (${t.name})`);
  }

  await browser.close();
  console.log(`\n✅ Done! Output: ${outDir}`);
}

main().catch(err => { console.error(err); process.exit(1); });
