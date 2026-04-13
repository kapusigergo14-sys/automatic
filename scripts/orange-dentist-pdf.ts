import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const OUT = path.resolve(__dirname, '../output/mockups/orange-dentist-clone');
const PDF_PATH = path.resolve(__dirname, '../output/mockups/orange-dentist-proposal.pdf');

function imgB64(filename: string): string {
  const p = path.join(OUT, filename);
  if (!fs.existsSync(p)) { console.warn(`Missing: ${filename}`); return ''; }
  const buf = fs.readFileSync(p);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function main() {
  const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  @page { margin: 0; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1B2839; }

  .page { width: 210mm; min-height: 297mm; padding: 0; page-break-after: always; position: relative; overflow: hidden; }
  .page:last-child { page-break-after: auto; }

  /* Cover */
  .cover {
    background: linear-gradient(135deg, #1B2839 0%, #2a3d54 60%, #E9681D 100%);
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    text-align: center; color: white; padding: 60px 50px;
  }
  .cover h1 { font-size: 40px; font-weight: 800; margin-bottom: 12px; line-height: 1.2; }
  .cover .subtitle { font-size: 18px; opacity: 0.85; margin-bottom: 48px; line-height: 1.5; }
  .cover .badge { background: #E9681D; padding: 12px 32px; border-radius: 30px; font-size: 16px; font-weight: 700; margin-bottom: 48px; }
  .cover .meta { font-size: 14px; opacity: 0.6; }

  /* Content */
  .content-page { padding: 40px 50px; background: white; }
  .content-page h2 { font-size: 26px; font-weight: 800; color: #1B2839; margin-bottom: 8px; }
  .content-page .section-sub { font-size: 14px; color: #666; margin-bottom: 20px; line-height: 1.5; }
  .content-page .screenshot {
    width: 100%; border-radius: 10px; margin: 12px 0;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e8e8e8;
  }
  .content-page .desc { font-size: 14px; color: #444; line-height: 1.7; margin: 14px 0; }
  .feature-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
  .feature-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #444; }
  .feature-item .check {
    background: #E9681D; color: white; width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;
  }
  .divider { height: 2px; background: linear-gradient(90deg, #E9681D, transparent); margin: 24px 0; }

  /* Callout box */
  .callout {
    background: #FFF8F5; border-left: 4px solid #E9681D; padding: 16px 20px;
    border-radius: 0 8px 8px 0; margin: 16px 0;
  }
  .callout p { font-size: 14px; color: #444; line-height: 1.6; }

  /* Pricing */
  .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .price-card { border: 2px solid #e0e0e0; border-radius: 16px; padding: 28px; }
  .price-card.featured { border-color: #E9681D; }
  .price-card .label { font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 12px; }
  .price-card .amount { font-size: 40px; font-weight: 800; }
  .price-card .monthly { font-size: 18px; color: #E9681D; font-weight: 600; margin-top: 4px; }
  .price-card .includes { font-size: 13px; color: #666; margin-top: 12px; line-height: 1.7; }

  .page-footer {
    position: absolute; bottom: 20px; left: 50px; right: 50px;
    display: flex; justify-content: space-between; font-size: 11px; color: #999;
  }
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page cover">
  <img src="${imgB64('logo-white.png')}" style="height: 80px; margin-bottom: 24px;" />
  <h1>AI Chatbot & Booking<br>Proposal</h1>
  <div class="subtitle">
    A modern redesign with built-in AI Chatbot,<br>
    Online Booking & Phone Agent for Orange Dentist
  </div>
  <div class="badge">Prepared by smartflowdev</div>
  <div style="margin-top: auto;">
    <div class="meta">Prepared for: Nancy — Orange Dentist</div>
    <div class="meta" style="margin-top: 4px;">296 Anson St, Orange NSW 2800</div>
    <div class="meta" style="margin-top: 4px;">April 2026</div>
  </div>
</div>

<!-- PAGE 2: OVERVIEW + HERO MOCKUP + FEATURES -->
<div class="page content-page">
  <h2>A Fresh Look for Orange Dentist</h2>
  <div class="section-sub">
    Here's a concept of how your website could look with a built-in AI chatbot and online booking system — designed to help you capture more patients and save your team time.
  </div>

  <img src="${imgB64('mockup-hero-chatbot.png')}" class="screenshot" />

  <div class="desc">
    A mockup of your refreshed homepage — clean layout, modern typography, your branding colours, and an AI chat assistant ready to help patients 24/7.
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin: 16px 0;">
    <div style="background: #f8f9fa; padding: 16px; border-radius: 10px; border-top: 3px solid #E9681D;">
      <div style="font-size: 22px; margin-bottom: 4px;">🤖</div>
      <div style="font-weight: 700; font-size: 14px; color: #1B2839; margin-bottom: 4px;">AI Chat Assistant</div>
      <div style="font-size: 11px; color: #666; line-height: 1.5;">Answers patient questions 24/7, books appointments, knows your services & hours</div>
    </div>
    <div style="background: #f8f9fa; padding: 16px; border-radius: 10px; border-top: 3px solid #E9681D;">
      <div style="font-size: 22px; margin-bottom: 4px;">📅</div>
      <div style="font-weight: 700; font-size: 14px; color: #1B2839; margin-bottom: 4px;">Online Booking</div>
      <div style="font-size: 11px; color: #666; line-height: 1.5;">Patients self-book anytime, syncs to Google Calendar, SMS reminders 24h before</div>
    </div>
    <div style="background: #f8f9fa; padding: 16px; border-radius: 10px; border-top: 3px solid #E9681D;">
      <div style="font-size: 22px; margin-bottom: 4px;">📞</div>
      <div style="font-weight: 700; font-size: 14px; color: #1B2839; margin-bottom: 4px;">AI Phone Agent</div>
      <div style="font-size: 11px; color: #666; line-height: 1.5;">Answers calls after hours, books emergencies, emails summaries to reception</div>
    </div>
  </div>

  <div class="desc" style="font-size: 12px;">
    <strong>Why these matter:</strong> 85% of patients who can't reach a dental practice by phone will call a competitor. With an AI chatbot and phone agent, you capture every enquiry — even at 2 AM.
  </div>

  <div class="page-footer">
    <span>Orange Dentist — Website Refresh + AI Proposal</span>
    <span>Page 2 of 4</span>
  </div>
</div>

<!-- PAGE 4: BOOKING -->
<div class="page content-page">
  <h2>Online Booking System</h2>
  <div class="section-sub">Patients pick a date, time and service — you get a Google Calendar event + email notification instantly.</div>

  <img src="${imgB64('mockup-booking.png')}" class="screenshot" />

  <div class="desc">
    The built-in booking form. Patients select their preferred date, time slot and service — no phone call needed. You receive an instant notification and the appointment appears in your Google Calendar automatically.
  </div>

  <div class="feature-list">
    <div class="feature-item"><div class="check">✓</div> Patients self-book 24/7</div>
    <div class="feature-item"><div class="check">✓</div> Google Calendar auto-sync</div>
    <div class="feature-item"><div class="check">✓</div> SMS reminders 24h before</div>
    <div class="feature-item"><div class="check">✓</div> Easy reschedule & cancel</div>
    <div class="feature-item"><div class="check">✓</div> All your services listed</div>
    <div class="feature-item"><div class="check">✓</div> Reduces phone calls ~40%</div>
  </div>

  <div class="divider"></div>

  <div style="background: #f8f9fa; padding: 20px; border-radius: 12px;">
    <div style="display: flex; align-items: center; gap: 20px; font-size: 14px; color: #444; justify-content: center;">
      <div style="text-align: center;">
        <div style="font-size: 28px;">🌐</div>
        <div style="font-size: 12px; margin-top: 4px;">Patient books<br>on website</div>
      </div>
      <div style="font-size: 24px; color: #E9681D;">→</div>
      <div style="text-align: center;">
        <div style="font-size: 28px;">📅</div>
        <div style="font-size: 12px; margin-top: 4px;">Google Calendar<br>event created</div>
      </div>
      <div style="font-size: 24px; color: #E9681D;">→</div>
      <div style="text-align: center;">
        <div style="font-size: 28px;">📧</div>
        <div style="font-size: 12px; margin-top: 4px;">Email to<br>reception</div>
      </div>
      <div style="font-size: 24px; color: #E9681D;">→</div>
      <div style="text-align: center;">
        <div style="font-size: 28px;">📱</div>
        <div style="font-size: 12px; margin-top: 4px;">SMS reminder<br>to patient</div>
      </div>
    </div>
  </div>

  <div class="page-footer">
    <span>Orange Dentist — Website Refresh + AI Proposal</span>
    <span>Page 3 of 4</span>
  </div>
</div>

<!-- PAGE 5: PRICING -->
<div class="page content-page">
  <h2>Investment & Next Steps</h2>
  <div class="section-sub">Two phases — start with what makes sense, add more when you're ready.</div>

  <div class="pricing-grid">
    <div class="price-card featured">
      <div class="label" style="color: #E9681D;">PHASE 1 — WEBSITE + CHATBOT + BOOKING</div>
      <div class="amount">$800 <span style="font-size: 16px; font-weight: 400; color: #666;">setup</span></div>
      <div class="monthly">+ $59/month</div>
      <div class="includes">
        <strong>Includes:</strong><br>
        • Modern website redesign (your branding)<br>
        • AI chatbot trained on your practice<br>
        • Online booking with Google Calendar sync<br>
        • SMS appointment reminders<br>
        • Mobile-responsive design<br>
        • Ongoing support & updates
      </div>
    </div>
    <div class="price-card">
      <div class="label" style="color: #1B2839;">PHASE 2 — ADD AI PHONE AGENT</div>
      <div class="amount">+$500 <span style="font-size: 16px; font-weight: 400; color: #666;">setup</span></div>
      <div class="monthly">+ $30/month</div>
      <div class="includes">
        <strong>Includes:</strong><br>
        • AI voice agent trained on your practice<br>
        • After-hours call forwarding setup<br>
        • Emergency appointment booking<br>
        • Call transcripts emailed to reception<br>
        • Knowledge base maintenance<br>
        • Monthly usage reporting
      </div>
    </div>
  </div>

  <div style="
    background: #1B2839; color: white; border-radius: 12px; padding: 24px 28px;
    margin-top: 28px; text-align: center;
  ">
    <div style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Ready to get started?</div>
    <div style="font-size: 14px; opacity: 0.8; line-height: 1.6;">
      Reply to this email and we'll get started right away.<br>
      <strong>Chatbot live on your site within 48 hours</strong> · Full setup within 1 week · No long contracts — cancel anytime.
    </div>
  </div>

  <div style="margin-top: 24px; text-align: center; font-size: 13px; color: #999;">
    Questions? Email me at geri@smartflowdev.com<br>
    <span style="color: #E9681D; font-weight: 600;">smartflowdev.com</span>
  </div>

  <div class="page-footer">
    <span>Orange Dentist — Website Refresh + AI Proposal</span>
    <span>Page 4 of 4</span>
  </div>
</div>

</body>
</html>
  `;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.pdf({
    path: PDF_PATH, format: 'A4', printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
  await browser.close();
  console.log(`✅ PDF saved: ${PDF_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
