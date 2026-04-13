import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { generatePdfV4, PdfV4Options } from './generate-pdf-v4';

const TEMPLATES = path.resolve(__dirname, '../templates');
const OUT = path.resolve(__dirname, '../output/mockups/test-dental');

// Test company data — fills the template placeholders
const REPLACEMENTS: Record<string, string> = {
  '{{COMPANY_NAME}}': 'Sunrise Dental Clinic',
  '{{COMPANY_SHORT_NAME}}': 'Sunrise Dental',
  '{{PRIMARY_COLOR}}': '#0d9488',
  '{{ACCENT_COLOR}}': '#0d9488',
  '{{BG_COLOR}}': '#ffffff',
  '{{TEXT_COLOR}}': '#1a1a2e',
  '{{HERO_BG_IMAGE}}': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&h=500&fit=crop',
  '{{HERO_HEADLINE_1}}': 'Your',
  '{{HERO_HEADLINE_ACCENT}}': 'Smile',
  '{{HERO_HEADLINE_2}}': 'Our Priority',
  '{{HERO_SUBTEXT}}': 'Family dental care in Brisbane. Now with 24/7 online booking and AI-powered patient support.',
  '{{SERVICE_1}}': 'General Dentistry',
  '{{SERVICE_2}}': 'Dental Implants',
  '{{SERVICE_3}}': 'Teeth Whitening',
  '{{SERVICE_4}}': 'Orthodontics',
  '{{SERVICE_5}}': 'Emergency Care',
  '{{SERVICE_6}}': 'Cosmetic Dentistry',
  '{{SERVICE_DESC_1}}': 'Routine checkups, cleanings, and preventive care for the whole family.',
  '{{SERVICE_DESC_2}}': 'Permanent tooth replacement that looks and feels natural.',
  '{{SERVICE_DESC_3}}': 'Professional whitening for a brighter, more confident smile.',
  '{{SERVICE_DESC_4}}': 'Straighter teeth with modern, discreet alignment options.',
  '{{SERVICE_DESC_5}}': 'Same-day emergency appointments for urgent dental issues.',
  '{{SERVICE_DESC_6}}': 'Veneers, bonding, and smile makeovers tailored to you.',
  '{{RATING}}': '4.9',
  '{{REVIEW_COUNT}}': '127',
  '{{YEARS_EXPERIENCE}}': '15',
  '{{PHONE}}': '(07) 3456 7890',
  '{{CITY}}': 'Brisbane, QLD',
  '{{TESTIMONIAL_1}}': 'The best dental experience I\'ve ever had. The team is incredibly friendly and professional.',
  '{{TESTIMONIAL_AUTHOR_1}}': 'Sarah M.',
  '{{TESTIMONIAL_2}}': 'I was terrified of dentists until I came here. Now I actually look forward to my appointments!',
  '{{TESTIMONIAL_AUTHOR_2}}': 'James T.',
  '{{TESTIMONIAL_3}}': 'My whole family comes here. The kids love it and the results speak for themselves.',
  '{{TESTIMONIAL_AUTHOR_3}}': 'Lisa K.',
  '{{CTA_TEXT}}': 'Book Your Free Consultation',
  '{{OFFICE_IMAGE}}': 'https://images.unsplash.com/photo-1629909615957-be38d6d18316?w=600&h=400&fit=crop',
  '{{GALLERY_1}}': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop',
  '{{GALLERY_2}}': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=300&fit=crop',
  '{{GALLERY_3}}': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=300&fit=crop',
  '{{GALLERY_4}}': 'https://images.unsplash.com/photo-1629909615957-be38d6d18316?w=400&h=300&fit=crop',
  '{{GALLERY_5}}': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop',
  '{{GALLERY_6}}': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=300&fit=crop',
  '{{TEAM_1_NAME}}': 'Dr. Emma Chen',
  '{{TEAM_1_ROLE}}': 'Principal Dentist',
  '{{TEAM_1_AVATAR_STYLE}}': 'background: linear-gradient(135deg, #0d9488, #14b8a6)',
  '{{TEAM_2_NAME}}': 'Dr. Michael Park',
  '{{TEAM_2_ROLE}}': 'Cosmetic Dentist',
  '{{TEAM_2_AVATAR_STYLE}}': 'background: linear-gradient(135deg, #0d9488, #14b8a6)',
  '{{TEAM_3_NAME}}': 'Sophie Williams',
  '{{TEAM_3_ROLE}}': 'Dental Hygienist',
  '{{TEAM_3_AVATAR_STYLE}}': 'background: linear-gradient(135deg, #0d9488, #14b8a6)',
  '{{TEAM_4_NAME}}': 'Nancy Liu',
  '{{TEAM_4_ROLE}}': 'Practice Manager',
  '{{TEAM_4_AVATAR_STYLE}}': 'background: linear-gradient(135deg, #0d9488, #14b8a6)',
  '{{ABOUT_TEXT}}': 'At Sunrise Dental Clinic, we believe everyone deserves a healthy, confident smile. Our team combines years of experience with the latest technology to provide gentle, comprehensive dental care for the whole family.',
};

function fillTemplate(html: string): string {
  let result = html;
  for (const [key, val] of Object.entries(REPLACEMENTS)) {
    result = result.split(key).join(val);
  }
  return result;
}

async function screenshotTemplate(browser: any, templateFile: string, outName: string, width: number, height: number): Promise<string> {
  const html = fillTemplate(fs.readFileSync(path.join(TEMPLATES, templateFile), 'utf-8'));
  const page = await browser.newPage({ viewport: { width, height } });

  // Write temp file for file:// loading (so images work)
  const tmpFile = path.join(OUT, `_tmp_${outName}.html`);
  fs.writeFileSync(tmpFile, html);
  await page.goto('file:///' + tmpFile.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000); // Wait for images

  const imgPath = path.join(OUT, outName);
  await page.screenshot({ path: imgPath });
  await page.close();
  fs.unlinkSync(tmpFile); // cleanup
  console.log(`  ✅ ${outName}`);
  return imgPath;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  console.log('📸 Taking screenshots of templates...');

  // Desktop screenshots (1280x900)
  const [aDesktop, bDesktop, cDesktop] = await Promise.all([
    screenshotTemplate(browser, 'dental-chatbot-a.html', 'a-desktop.png', 1280, 900),
    screenshotTemplate(browser, 'dental-chatbot-b.html', 'b-desktop.png', 1280, 900),
    screenshotTemplate(browser, 'dental-chatbot-c.html', 'c-desktop.png', 1280, 900),
  ]);

  // Mobile screenshots (375x667)
  const [aMobile, bMobile, cMobile] = await Promise.all([
    screenshotTemplate(browser, 'dental-chatbot-a.html', 'a-mobile.png', 375, 667),
    screenshotTemplate(browser, 'dental-chatbot-b.html', 'b-mobile.png', 375, 667),
    screenshotTemplate(browser, 'dental-chatbot-c.html', 'c-mobile.png', 375, 667),
  ]);

  // Booking screenshots (1280x900)
  const [aBooking, bBooking, cBooking] = await Promise.all([
    screenshotTemplate(browser, 'dental-booking-a.html', 'a-booking.png', 1280, 900),
    screenshotTemplate(browser, 'dental-booking-b.html', 'b-booking.png', 1280, 900),
    screenshotTemplate(browser, 'dental-booking-c.html', 'c-booking.png', 1280, 900),
  ]);

  // Current site placeholder (use a simple gray image)
  const currentSitePath = path.join(OUT, 'current-site.png');
  const placeholderPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await placeholderPage.setContent(`
    <div style="width:1280px;height:900px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#999;font-size:24px;">
      Current Website Screenshot<br>(will be replaced with actual site screenshot)
    </div>
  `);
  await placeholderPage.screenshot({ path: currentSitePath });
  await placeholderPage.close();

  await browser.close();
  console.log('\n📄 Generating PDF...');

  const options: PdfV4Options = {
    lead: {
      name: 'Dr. Emma Chen',
      company: 'Sunrise Dental Clinic',
      city: 'Brisbane, QLD Australia',
      website: 'www.sunrisedental.com.au',
      phone: '(07) 3456 7890',
      email: 'info@sunrisedental.com.au',
    },
    industry: 'dental',
    currency: 'USD',
    images: {
      currentSite: currentSitePath,
      redesignA_desktop: aDesktop,
      redesignA_mobile: aMobile,
      redesignB_desktop: bDesktop,
      redesignB_mobile: bMobile,
      redesignC_desktop: cDesktop,
      redesignC_mobile: cMobile,
      bookingA: aBooking,
      bookingB: bBooking,
      bookingC: cBooking,
    },
    outputPath: path.join(OUT, 'Sunrise-Dental-Clinic-Proposal.pdf'),
  };

  await generatePdfV4(options);
  console.log(`\n✅ PDF ready: ${options.outputPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
