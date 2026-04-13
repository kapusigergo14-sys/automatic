/**
 * build-pdf-preview.ts — renders a proposal cover preview PNG
 *
 * Output: smartflowdev/public/chatbot-preview.png
 * Used in: v5 cold email body as inline image (hosted URL)
 *
 * Run: npx ts-node scripts/build-pdf-preview.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

const OUT_PATH = path.resolve(__dirname, '../../smartflowdev/public/chatbot-preview.png');

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: 'Inter', system-ui, sans-serif; }

  body {
    width: 1200px;
    height: 675px;
    background: #FAFAFA;
    position: relative;
    overflow: hidden;
  }

  /* Aurora gradient background */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(900px 700px at 85% 8%, rgba(236, 72, 153, 0.22), transparent 60%),
      radial-gradient(800px 650px at 15% 25%, rgba(99, 102, 241, 0.24), transparent 60%),
      radial-gradient(1000px 800px at 70% 80%, rgba(14, 165, 233, 0.2), transparent 60%);
  }

  .browser {
    position: absolute;
    inset: 60px;
    background: #FFFFFF;
    border: 1px solid #E4E4E7;
    border-radius: 20px;
    box-shadow:
      0 60px 120px rgba(99, 102, 241, 0.15),
      0 30px 80px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .browser-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 22px;
    background: #F4F4F5;
    border-bottom: 1px solid #E4E4E7;
    flex-shrink: 0;
  }

  .dots { display: flex; gap: 7px; }
  .dots span {
    width: 12px; height: 12px; border-radius: 50%; display: block;
  }
  .dots span:nth-child(1) { background: #ff5f57; }
  .dots span:nth-child(2) { background: #febc2e; }
  .dots span:nth-child(3) { background: #28c840; }

  .live-badge {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    background: rgba(16, 185, 129, 0.12);
    color: #059669;
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 100px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
  }

  .live-dot {
    width: 6px; height: 6px;
    background: #10b981;
    border-radius: 50%;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 56px 72px;
    position: relative;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 16px;
    background: #EEF2FF;
    border-radius: 100px;
    font-size: 13px;
    font-weight: 600;
    color: #6366F1;
    letter-spacing: 0.3px;
    align-self: flex-start;
    margin-bottom: 28px;
  }

  .pill-dot {
    width: 6px; height: 6px;
    background: #6366F1;
    border-radius: 50%;
  }

  h1 {
    font-size: 88px;
    font-weight: 800;
    letter-spacing: -4px;
    line-height: 0.95;
    color: #0A0A0A;
    margin-bottom: 24px;
  }

  .gradient {
    background: linear-gradient(120deg, #6366F1 0%, #A855F7 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 22px;
    font-weight: 400;
    color: #71717A;
    max-width: 700px;
    line-height: 1.5;
    margin-bottom: 48px;
  }

  .feature-row {
    display: flex;
    gap: 48px;
    padding-top: 32px;
    border-top: 1px solid #E4E4E7;
  }

  .feature {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .feature-icon {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366F1, #A855F7);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .feature-text {
    font-size: 14px;
    font-weight: 600;
    color: #27272A;
    letter-spacing: -0.2px;
  }

  .feature-text .sub {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #A1A1AA;
    margin-top: 2px;
  }

  .brand {
    position: absolute;
    top: 56px;
    right: 72px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 700;
    color: #0A0A0A;
    letter-spacing: -0.4px;
  }

  .brand-mark {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: linear-gradient(135deg, #6366F1, #A855F7);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .brand-accent {
    background: linear-gradient(120deg, #6366F1, #818CF8);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
</style>
</head>
<body>
  <div class="browser">
    <div class="browser-bar">
      <div class="dots"><span></span><span></span><span></span></div>
      <div class="live-badge"><span class="live-dot"></span>PROPOSAL</div>
    </div>
    <div class="content">
      <div class="brand">
        <div class="brand-mark">
          <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
            <path d="M7 15 Q13 9, 20 15 T33 15" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.55"/>
            <path d="M7 25 Q13 19, 20 25 T33 25" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>
        smartflow<span class="brand-accent">dev</span>
      </div>

      <div class="pill"><span class="pill-dot"></span> For dental practices</div>

      <h1>
        AI Chatbot<br>
        <span class="gradient">done right.</span>
      </h1>

      <p class="subtitle">
        Custom-built. Brand-matched. Live in 48 hours. A complete proposal for adding a branded chatbot to your practice website.
      </p>

      <div class="feature-row">
        <div class="feature">
          <div class="feature-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div class="feature-text">Branded chatbot<span class="sub">Trained on your services</span></div>
        </div>
        <div class="feature">
          <div class="feature-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div class="feature-text">Online booking<span class="sub">Google Calendar sync</span></div>
        </div>
        <div class="feature">
          <div class="feature-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="feature-text">48-hour turnaround<span class="sub">Live on your site fast</span></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

async function main() {
  console.log('Rendering PDF preview image...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
  await page.setContent(HTML, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // let fonts settle
  await page.screenshot({ path: OUT_PATH, type: 'png', omitBackground: false });
  await browser.close();
  const stat = fs.statSync(OUT_PATH);
  console.log(`✅ Saved: ${OUT_PATH}`);
  console.log(`   Size: ${(stat.size / 1024).toFixed(0)} KB`);
}

main().catch(err => { console.error(err); process.exit(1); });
