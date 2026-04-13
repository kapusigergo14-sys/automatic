/**
 * SEND TOMORROW — loads qualified leads from v4 collect and sends emails.
 * Run this tomorrow morning: npx ts-node scripts/send-dental-v4-tomorrow.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser } from 'playwright';
import { generatePdfV4 } from './generate-pdf-v4';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const OUT_DIR = path.resolve(__dirname, '../output/dental-campaign');
const STATE_FILE = path.resolve(__dirname, '../output/dental-campaign/send-state.json');
const LEADS_FILE = path.resolve(__dirname, '../output/leads/dental-v4-qualified.json');

interface Lead {
  name: string; website: string; phone?: string; city: string; country: string;
  email: string; psiScore: number; reasoning: string; screenshotPath: string;
}

const DENTAL_DATA: Record<string, string> = {
  '{{HERO_HEADLINE_1}}': 'Your', '{{HERO_HEADLINE_ACCENT}}': 'Smile', '{{HERO_HEADLINE_2}}': 'Our Priority',
  '{{HERO_SUBTEXT}}': 'Family dental care you can trust. Now with 24/7 online booking and AI-powered patient support.',
  '{{SERVICE_1}}': 'General Dentistry', '{{SERVICE_2}}': 'Dental Implants', '{{SERVICE_3}}': 'Teeth Whitening',
  '{{SERVICE_4}}': 'Orthodontics', '{{SERVICE_5}}': 'Emergency Care', '{{SERVICE_6}}': 'Cosmetic Dentistry',
  '{{SERVICE_DESC_1}}': 'Routine checkups and preventive care.', '{{SERVICE_DESC_2}}': 'Permanent tooth replacement.',
  '{{SERVICE_DESC_3}}': 'Professional whitening.', '{{SERVICE_DESC_4}}': 'Modern alignment options.',
  '{{SERVICE_DESC_5}}': 'Same-day emergency appointments.', '{{SERVICE_DESC_6}}': 'Smile makeovers.',
  '{{TESTIMONIAL_1}}': 'The best dental experience I\'ve ever had.', '{{TESTIMONIAL_AUTHOR_1}}': 'Sarah M.',
  '{{TESTIMONIAL_2}}': 'I actually look forward to my appointments!', '{{TESTIMONIAL_AUTHOR_2}}': 'James T.',
  '{{TESTIMONIAL_3}}': 'My whole family comes here.', '{{TESTIMONIAL_AUTHOR_3}}': 'Lisa K.',
  '{{CTA_TEXT}}': 'Book Your Free Consultation',
  '{{HERO_BG_IMAGE}}': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&h=500&fit=crop',
  '{{OFFICE_IMAGE}}': 'https://images.unsplash.com/photo-1629909615957-be38d6d18316?w=600&h=400&fit=crop',
  '{{GALLERY_1}}': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop',
  '{{GALLERY_2}}': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=300&fit=crop',
  '{{GALLERY_3}}': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=300&fit=crop',
  '{{GALLERY_4}}': 'https://images.unsplash.com/photo-1629909615957-be38d6d18316?w=400&h=300&fit=crop',
  '{{GALLERY_5}}': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop',
  '{{GALLERY_6}}': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=300&fit=crop',
  '{{ABOUT_TEXT}}': 'We believe everyone deserves a healthy, confident smile.',
  '{{TEAM_1_NAME}}': 'Dr. Smith', '{{TEAM_1_ROLE}}': 'Principal Dentist', '{{TEAM_1_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{TEAM_2_NAME}}': 'Dr. Johnson', '{{TEAM_2_ROLE}}': 'Associate Dentist', '{{TEAM_2_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{TEAM_3_NAME}}': 'Sarah', '{{TEAM_3_ROLE}}': 'Dental Hygienist', '{{TEAM_3_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{TEAM_4_NAME}}': 'Emily', '{{TEAM_4_ROLE}}': 'Practice Manager', '{{TEAM_4_AVATAR_STYLE}}': 'background:linear-gradient(135deg,#0d9488,#14b8a6)',
  '{{RATING}}': '4.8', '{{REVIEW_COUNT}}': '85', '{{YEARS_EXPERIENCE}}': '15',
};

function fillTemplate(html: string, lead: Lead): string {
  let r = html;
  const repl: Record<string, string> = {
    ...DENTAL_DATA,
    '{{COMPANY_NAME}}': lead.name, '{{COMPANY_SHORT_NAME}}': lead.name.split(' ').slice(0, 3).join(' '),
    '{{PRIMARY_COLOR}}': '#0d9488', '{{ACCENT_COLOR}}': '#0d9488', '{{BG_COLOR}}': '#ffffff', '{{TEXT_COLOR}}': '#1a1a2e',
    '{{PHONE}}': lead.phone || '', '{{CITY}}': lead.city,
  };
  for (const [k, v] of Object.entries(repl)) r = r.split(k).join(v);
  return r;
}

async function screenshotHtml(browser: Browser, html: string, outPath: string): Promise<string> {
  const tmp = outPath.replace('.png', '.tmp.html');
  fs.writeFileSync(tmp, html);
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 15000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: outPath });
  await p.close();
  try { fs.unlinkSync(tmp); } catch {}
  return outPath;
}

async function sendEmail(to: string, companyName: string, pdfPath: string): Promise<boolean> {
  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');
  const safeName = companyName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Geri <geri@smartflowdev.com>', to: [to], subject: `AI chatbot for ${safeName}?`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;color:#333;line-height:1.6;">
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
        <p style="margin:20px 0;"><a href="https://smartflowdev.com" style="display:inline-block;background:#667eea;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">See our work →</a></p>
        <p>Best regards,<br><strong>Geri</strong><br>AI Web Development Specialist<br><a href="https://smartflowdev.com" style="color:#667eea;">smartflowdev.com</a></p>
      </div>`,
      attachments: [{ filename: `${safeName}-AI-Chatbot-Proposal.pdf`, content: pdfBase64 }],
    }),
  });
  return res.ok;
}

async function main() {
  if (!fs.existsSync(LEADS_FILE)) {
    console.log('❌ No leads file. Run auto-dental-v4-collect.ts first.');
    return;
  }
  const leads: Lead[] = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  console.log(`📧 Sending to ${leads.length} qualified leads\n`);

  let sendState: Record<string, any> = {};
  if (fs.existsSync(STATE_FILE)) sendState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));

  const browser = await chromium.launch({ headless: true });
  const templateLetters = ['a', 'b', 'c'];
  let sent = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    if (sendState[lead.email]) { console.log(`⏭️ [${i + 1}] ${lead.name} — already sent`); continue; }

    console.log(`\n📧 [${i + 1}/${leads.length}] ${lead.name} (${lead.city}, ${lead.country})`);

    const tpl = templateLetters[sent % 3];
    const leadDir = path.join(OUT_DIR, lead.email.replace(/[^a-z0-9@.-]/gi, '_'));
    fs.mkdirSync(leadDir, { recursive: true });

    try {
      const desktops: Record<string, string> = {};
      const bookings: Record<string, string> = {};
      for (const l of ['a', 'b', 'c']) {
        desktops[l] = await screenshotHtml(browser, fillTemplate(fs.readFileSync(path.join(TEMPLATES_DIR, `dental-chatbot-${l}.html`), 'utf-8'), lead), path.join(leadDir, `d-${l}.png`));
        bookings[l] = await screenshotHtml(browser, fillTemplate(fs.readFileSync(path.join(TEMPLATES_DIR, `dental-booking-${l}.html`), 'utf-8'), lead), path.join(leadDir, `b-${l}.png`));
      }

      const currency = lead.country === 'AU' ? 'AUD' as const : lead.country === 'UK' ? 'GBP' as const : 'USD' as const;
      const pdfPath = path.join(leadDir, 'proposal.pdf');
      await generatePdfV4({
        lead: { name: lead.name.split(' ').slice(0, 4).join(' '), company: lead.name, city: lead.city, website: lead.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), phone: lead.phone, email: lead.email },
        industry: 'dental', currency,
        images: { currentSite: lead.screenshotPath, redesignA_desktop: desktops['a'], redesignA_mobile: desktops['a'], redesignB_desktop: desktops['b'], redesignB_mobile: desktops['b'], redesignC_desktop: desktops['c'], redesignC_mobile: desktops['c'], bookingA: bookings['a'], bookingB: bookings['b'], bookingC: bookings['c'] },
        outputPath: pdfPath,
      });

      const ok = await sendEmail(lead.email, lead.name, pdfPath);
      if (ok) {
        sent++;
        sendState[lead.email] = { sentAt: new Date().toISOString(), template: tpl, city: lead.city, country: lead.country, psiScore: lead.psiScore, visualReasoning: lead.reasoning };
        fs.writeFileSync(STATE_FILE, JSON.stringify(sendState, null, 2));
        console.log(`  ✅ SENT #${sent}`);
      } else {
        console.log(`  ❌ Send failed`);
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message?.slice(0, 60)}`);
    }
  }

  await browser.close();
  console.log(`\n${'═'.repeat(60)}\n✅ DONE: ${sent} new emails sent\n${'═'.repeat(60)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
