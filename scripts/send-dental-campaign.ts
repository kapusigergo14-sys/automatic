/**
 * Dental Chatbot Campaign Sender
 *
 * For each lead:
 * 1. Screenshot their current website
 * 2. Fill templates A/B/C with their company data
 * 3. Screenshot the filled templates (desktop + booking)
 * 4. Generate personalized PDF via generate-pdf-v4
 * 5. Send email with PDF attachment via Resend
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser } from 'playwright';
import { generatePdfV4, PdfV4Options } from './generate-pdf-v4';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-send-list.json');
const OUT_DIR = path.resolve(__dirname, '../output/dental-campaign');
const STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');

// ── Template placeholder data per industry ──
const DENTAL_DATA: Record<string, string> = {
  '{{HERO_HEADLINE_1}}': 'Your',
  '{{HERO_HEADLINE_ACCENT}}': 'Smile',
  '{{HERO_HEADLINE_2}}': 'Our Priority',
  '{{HERO_SUBTEXT}}': 'Family dental care you can trust. Now with 24/7 online booking and AI-powered patient support.',
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
  '{{TESTIMONIAL_1}}': 'The best dental experience I\'ve ever had. The team is incredibly friendly and professional.',
  '{{TESTIMONIAL_AUTHOR_1}}': 'Sarah M.',
  '{{TESTIMONIAL_2}}': 'I was terrified of dentists until I came here. Now I actually look forward to my appointments!',
  '{{TESTIMONIAL_AUTHOR_2}}': 'James T.',
  '{{TESTIMONIAL_3}}': 'My whole family comes here. The kids love it and the results speak for themselves.',
  '{{TESTIMONIAL_AUTHOR_3}}': 'Lisa K.',
  '{{CTA_TEXT}}': 'Book Your Free Consultation',
  '{{HERO_BG_IMAGE}}': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&h=500&fit=crop',
  '{{OFFICE_IMAGE}}': 'https://images.unsplash.com/photo-1629909615957-be38d6d18316?w=600&h=400&fit=crop',
  '{{GALLERY_1}}': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop',
  '{{GALLERY_2}}': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=300&fit=crop',
  '{{GALLERY_3}}': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=300&fit=crop',
  '{{GALLERY_4}}': 'https://images.unsplash.com/photo-1629909615957-be38d6d18316?w=400&h=300&fit=crop',
  '{{GALLERY_5}}': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop',
  '{{GALLERY_6}}': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=300&fit=crop',
  '{{ABOUT_TEXT}}': 'We believe everyone deserves a healthy, confident smile. Our team combines years of experience with the latest technology to provide gentle, comprehensive dental care for the whole family.',
  '{{TEAM_1_NAME}}': 'Dr. Smith', '{{TEAM_1_ROLE}}': 'Principal Dentist',
  '{{TEAM_1_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{TEAM_2_NAME}}': 'Dr. Johnson', '{{TEAM_2_ROLE}}': 'Associate Dentist',
  '{{TEAM_2_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{TEAM_3_NAME}}': 'Sarah', '{{TEAM_3_ROLE}}': 'Dental Hygienist',
  '{{TEAM_3_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{TEAM_4_NAME}}': 'Emily', '{{TEAM_4_ROLE}}': 'Practice Manager',
  '{{TEAM_4_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
};

interface Lead {
  name: string;
  website: string;
  phone?: string;
  city: string;
  country: string;
  email: string;
  outdatedScore?: number;
  signals?: string[];
  screenshot?: string;
}

interface SendState {
  [email: string]: { sentAt: string; template: string; pdfPath: string };
}

// ── Helpers ──

function loadState(): SendState {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch { return {}; }
  }
  return {};
}

function saveState(state: SendState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function fillTemplate(html: string, lead: Lead, extraReplacements: Record<string, string> = {}): string {
  let result = html;
  const replacements: Record<string, string> = {
    ...DENTAL_DATA,
    '{{COMPANY_NAME}}': lead.name,
    '{{COMPANY_SHORT_NAME}}': lead.name.split(' ').slice(0, 3).join(' '),
    '{{PRIMARY_COLOR}}': '#0d9488',
    '{{ACCENT_COLOR}}': '#0d9488',
    '{{BG_COLOR}}': '#ffffff',
    '{{TEXT_COLOR}}': '#1a1a2e',
    '{{PHONE}}': lead.phone || '(000) 000-0000',
    '{{CITY}}': lead.city,
    '{{RATING}}': '4.8',
    '{{REVIEW_COUNT}}': '85',
    '{{YEARS_EXPERIENCE}}': '15',
    ...extraReplacements,
  };
  for (const [key, val] of Object.entries(replacements)) {
    result = result.split(key).join(val);
  }
  return result;
}

async function screenshotHtml(browser: Browser, html: string, outPath: string, width = 1280, height = 900): Promise<string> {
  const tmpFile = outPath.replace('.png', '.tmp.html');
  fs.writeFileSync(tmpFile, html);
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto('file:///' + tmpFile.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: outPath });
  await page.close();
  try { fs.unlinkSync(tmpFile); } catch {}
  return outPath;
}

async function screenshotWebsite(browser: Browser, url: string, outPath: string): Promise<string> {
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: outPath });
    await page.close();
  } catch {
    // Create placeholder
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(`<div style="width:1280px;height:900px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#999">Screenshot unavailable</div>`);
    await page.screenshot({ path: outPath });
    await page.close();
  }
  return outPath;
}

async function sendEmail(to: string, companyName: string, pdfPath: string): Promise<boolean> {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');
  const safeName = companyName.replace(/[^a-zA-Z0-9 ]/g, '').trim();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Geri <geri@smartflowdev.com>',
      to: [to],
      subject: `AI chatbot for ${safeName}?`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;color:#333;line-height:1.6;">
          <p>Hi ${safeName} team,</p>
          <p>I came across your dental practice while researching clinics in your area — and I noticed your website could benefit from an <strong>AI chatbot and online booking system</strong>.</p>
          <p>So I put together <strong>3 design concepts specifically for ${safeName}</strong>. You'll find them in the attached PDF.</p>
          <p><strong>A few quick improvements I identified:</strong></p>
          <ul style="padding-left:20px;margin:12px 0;">
            <li>AI chatbot for instant patient answers 24/7</li>
            <li>Online booking system with Google Calendar sync</li>
            <li>SMS appointment reminders</li>
            <li>After-hours AI phone agent</li>
          </ul>
          <p>Would you be open to a quick 10-minute call to discuss?</p>
          <p style="margin:20px 0;">
            <a href="https://smartflowdev.com" style="display:inline-block;background:#667eea;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">See our work →</a>
          </p>
          <p>Best regards,<br><strong>Geri</strong><br>AI Web Development Specialist<br><a href="https://smartflowdev.com" style="color:#667eea;">smartflowdev.com</a></p>
        </div>
      `,
      attachments: [{
        filename: `${safeName}-AI-Chatbot-Proposal.pdf`,
        content: pdfBase64,
      }],
    }),
  });

  const data = await res.json() as any;
  if (res.ok) {
    console.log(`    ✅ Email sent! ID: ${data.id}`);
    return true;
  } else {
    console.log(`    ❌ Email failed: ${data.message || JSON.stringify(data)}`);
    return false;
  }
}

// ── Main ──

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const leads: Lead[] = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  const state = loadState();
  const templateLetters = ['a', 'b', 'c'];

  console.log(`🦷 Dental Chatbot Campaign — ${leads.length} leads\n`);

  const browser = await chromium.launch({ headless: true });

  let sent = 0;
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];

    // Skip already sent
    if (state[lead.email]) {
      console.log(`⏭️  ${i + 1}. ${lead.name} — already sent`);
      continue;
    }

    const tplLetter = templateLetters[i % 3]; // rotate A/B/C
    const leadDir = path.join(OUT_DIR, lead.email.replace(/[^a-z0-9@.-]/gi, '_'));
    fs.mkdirSync(leadDir, { recursive: true });

    console.log(`\n📧 ${i + 1}/${leads.length} — ${lead.name} (${lead.city}, template ${tplLetter.toUpperCase()})`);

    // 1. Screenshot their current website
    console.log('  📸 Screenshotting current website...');
    const currentSitePath = path.join(leadDir, 'current-site.png');
    await screenshotWebsite(browser, lead.website, currentSitePath);

    // 2. Fill & screenshot templates A/B/C
    console.log('  🎨 Generating design mockups...');
    const desktopPaths: Record<string, string> = {};
    const bookingPaths: Record<string, string> = {};

    for (const letter of templateLetters) {
      const chatbotHtml = fillTemplate(
        fs.readFileSync(path.join(TEMPLATES_DIR, `dental-chatbot-${letter}.html`), 'utf-8'),
        lead
      );
      desktopPaths[letter] = await screenshotHtml(browser, chatbotHtml, path.join(leadDir, `design-${letter}-desktop.png`));

      const bookingHtml = fillTemplate(
        fs.readFileSync(path.join(TEMPLATES_DIR, `dental-booking-${letter}.html`), 'utf-8'),
        lead
      );
      bookingPaths[letter] = await screenshotHtml(browser, bookingHtml, path.join(leadDir, `design-${letter}-booking.png`));
    }

    // 3. Generate PDF
    console.log('  📄 Generating PDF...');
    const pdfPath = path.join(leadDir, `${lead.name.replace(/[^a-zA-Z0-9 ]/g, '')}-Proposal.pdf`);

    const currency = lead.country === 'AU' ? 'AUD' as const : 'USD' as const;

    await generatePdfV4({
      lead: {
        name: lead.name.split(' ').slice(0, 3).join(' '),
        company: lead.name,
        city: lead.city,
        website: lead.website.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        phone: lead.phone,
        email: lead.email,
      },
      industry: 'dental',
      currency,
      images: {
        currentSite: currentSitePath,
        redesignA_desktop: desktopPaths['a'],
        redesignA_mobile: desktopPaths['a'], // not used anymore but required
        redesignB_desktop: desktopPaths['b'],
        redesignB_mobile: desktopPaths['b'],
        redesignC_desktop: desktopPaths['c'],
        redesignC_mobile: desktopPaths['c'],
        bookingA: bookingPaths['a'],
        bookingB: bookingPaths['b'],
        bookingC: bookingPaths['c'],
      },
      outputPath: pdfPath,
    });

    // 4. Send email
    console.log('  📬 Sending email...');
    const success = await sendEmail(lead.email, lead.name, pdfPath);

    if (success) {
      state[lead.email] = {
        sentAt: new Date().toISOString(),
        template: tplLetter,
        pdfPath,
      };
      saveState(state);
      sent++;
    }

    // Rate limit — wait 3 seconds between sends
    await new Promise(r => setTimeout(r, 3000));
  }

  await browser.close();

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Campaign complete: ${sent}/${leads.length} emails sent`);
  console.log(`${'═'.repeat(50)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
