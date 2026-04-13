import { chromium } from 'playwright';
import * as path from 'path';

const OUT = path.resolve(__dirname, '../output/mockups/orange-dentist-clone');
const SITE = 'https://orangedentist.com.au';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  // ═══ SCREENSHOT 1: Book Online Tab + Booking Widget ═══
  console.log('📸 Taking booking section screenshot...');
  const page1 = await context.newPage();
  await page1.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page1.waitForTimeout(3000);

  // Inject "Book Online" nav item + booking modal overlay
  await page1.evaluate(() => {
    // Add "Book Online" button to nav
    const nav = document.querySelector('nav') || document.querySelector('.menu') || document.querySelector('#menu') || document.querySelector('[class*="nav"]');
    if (nav) {
      const bookBtn = document.createElement('a');
      bookBtn.href = '#';
      bookBtn.textContent = '📅 Book Online';
      bookBtn.style.cssText = `
        background: #E9681D; color: white; padding: 10px 20px; border-radius: 6px;
        font-weight: 700; font-size: 15px; text-decoration: none; margin-left: 15px;
        display: inline-block; font-family: inherit;
      `;
      nav.appendChild(bookBtn);
    }

    // Create booking overlay
    const overlay = document.createElement('div');
    overlay.id = 'booking-overlay';
    overlay.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(27,40,57,0.6); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          background: white; border-radius: 16px; width: 520px; max-width: 90vw;
          box-shadow: 0 25px 60px rgba(0,0,0,0.3); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
          <!-- Header -->
          <div style="background: #E9681D; padding: 24px 28px; color: white;">
            <div style="font-size: 22px; font-weight: 700;">Book Your Appointment</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Orange Dentist — Online Booking</div>
          </div>

          <!-- Body -->
          <div style="padding: 28px;">
            <!-- Service Select -->
            <div style="margin-bottom: 20px;">
              <label style="display: block; font-size: 13px; font-weight: 600; color: #1B2839; margin-bottom: 6px;">Service</label>
              <div style="
                border: 2px solid #E9681D; border-radius: 8px; padding: 12px 14px;
                font-size: 15px; color: #1B2839; background: #FFF8F5;
              ">✓ General Check-up & Clean</div>
            </div>

            <!-- Date Grid -->
            <div style="margin-bottom: 20px;">
              <label style="display: block; font-size: 13px; font-weight: 600; color: #1B2839; margin-bottom: 6px;">Select Date — April 2026</label>
              <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; text-align: center;">
                ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d =>
                  `<div style="font-size: 11px; font-weight: 600; color: #999; padding: 4px;">${d}</div>`
                ).join('')}
                ${['','','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21'].map((d, i) => {
                  if (!d) return `<div></div>`;
                  const isSelected = d === '10';
                  const isPast = parseInt(d) < 9;
                  return `<div style="
                    padding: 8px 4px; border-radius: 8px; font-size: 14px; cursor: pointer;
                    ${isSelected ? 'background: #E9681D; color: white; font-weight: 700;' : ''}
                    ${isPast ? 'color: #ccc;' : 'color: #1B2839;'}
                  ">${d}</div>`;
                }).join('')}
              </div>
            </div>

            <!-- Time Slots -->
            <div style="margin-bottom: 24px;">
              <label style="display: block; font-size: 13px; font-weight: 600; color: #1B2839; margin-bottom: 6px;">Available Times — Friday, April 10</label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${['9:00 AM', '9:30 AM', '10:00 AM', '11:30 AM', '2:00 PM', '3:30 PM'].map((t, i) => `
                  <div style="
                    padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
                    ${i === 2 ? 'background: #E9681D; color: white;' : 'background: #f5f5f5; color: #1B2839; border: 1px solid #e0e0e0;'}
                  ">${t}</div>
                `).join('')}
              </div>
            </div>

            <!-- Confirm Button -->
            <button style="
              width: 100%; padding: 14px; background: #E9681D; color: white; border: none;
              border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer;
              font-family: inherit;
            ">Confirm Booking → Google Calendar</button>

            <div style="text-align: center; margin-top: 12px; font-size: 12px; color: #999;">
              ✓ Syncs with Google Calendar &nbsp;•&nbsp; ✓ SMS reminder 24h before &nbsp;•&nbsp; ✓ Easy reschedule
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  });

  await page1.waitForTimeout(500);
  await page1.screenshot({ path: path.join(OUT, 'booking-widget.png') });
  console.log('  ✅ booking-widget.png');
  await page1.close();

  // ═══ SCREENSHOT 2: AI Phone Agent Section ═══
  console.log('📸 Taking AI phone section screenshot...');
  const page2 = await context.newPage();
  // Create a standalone AI Phone section page
  await page2.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; }
      </style>
    </head>
    <body>
      <div style="max-width: 900px; margin: 40px auto; padding: 0 20px;">
        <!-- Header Badge -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="
            display: inline-block; background: #1B2839; color: white; padding: 8px 20px;
            border-radius: 20px; font-size: 13px; font-weight: 600; letter-spacing: 1px;
          ">PHASE 2 — AI PHONE AGENT</div>
        </div>

        <!-- Main Card -->
        <div style="
          background: white; border-radius: 20px; overflow: hidden;
          box-shadow: 0 4px 30px rgba(0,0,0,0.08);
        ">
          <!-- Hero Banner -->
          <div style="
            background: linear-gradient(135deg, #1B2839 0%, #2a3d54 100%);
            padding: 48px 40px; color: white; position: relative;
          ">
            <div style="font-size: 36px; font-weight: 800; margin-bottom: 8px;">
              🤖 After-Hours AI Phone Agent
            </div>
            <div style="font-size: 18px; opacity: 0.85; max-width: 500px;">
              Never miss a patient call — even at 2 AM
            </div>

            <!-- Phone visual -->
            <div style="
              position: absolute; right: 40px; top: 50%; transform: translateY(-50%);
              width: 200px; height: 200px; background: rgba(233,104,29,0.15);
              border-radius: 50%; display: flex; align-items: center; justify-content: center;
            ">
              <div style="font-size: 80px;">📞</div>
            </div>
          </div>

          <!-- Content -->
          <div style="padding: 40px;">
            <!-- How it works -->
            <div style="font-size: 20px; font-weight: 700; color: #1B2839; margin-bottom: 24px;">
              How It Works
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 36px;">
              <div style="background: #FFF8F5; padding: 24px; border-radius: 12px; border-left: 4px solid #E9681D;">
                <div style="font-size: 28px; margin-bottom: 8px;">📱</div>
                <div style="font-weight: 700; color: #1B2839; margin-bottom: 4px;">Patient Calls</div>
                <div style="font-size: 14px; color: #666; line-height: 1.5;">
                  After hours or when lines are busy, calls forward to the AI agent automatically
                </div>
              </div>
              <div style="background: #FFF8F5; padding: 24px; border-radius: 12px; border-left: 4px solid #E9681D;">
                <div style="font-size: 28px; margin-bottom: 8px;">🗣️</div>
                <div style="font-weight: 700; color: #1B2839; margin-bottom: 4px;">AI Answers</div>
                <div style="font-size: 14px; color: #666; line-height: 1.5;">
                  Natural voice AI handles FAQs, hours, services, and books appointments directly
                </div>
              </div>
              <div style="background: #FFF8F5; padding: 24px; border-radius: 12px; border-left: 4px solid #E9681D;">
                <div style="font-size: 28px; margin-bottom: 8px;">📋</div>
                <div style="font-weight: 700; color: #1B2839; margin-bottom: 4px;">You Get Notified</div>
                <div style="font-size: 14px; color: #666; line-height: 1.5;">
                  Call summary + transcript emailed to reception@orangedentist.com.au instantly
                </div>
              </div>
            </div>

            <!-- Conversation Example -->
            <div style="
              background: #1B2839; border-radius: 16px; padding: 32px;
              color: white; margin-bottom: 32px;
            ">
              <div style="font-size: 14px; font-weight: 600; opacity: 0.6; margin-bottom: 16px; letter-spacing: 1px;">
                EXAMPLE CALL — AFTER HOURS
              </div>

              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div style="display: flex; gap: 12px; align-items: flex-start;">
                  <div style="
                    background: #E9681D; color: white; width: 32px; height: 32px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
                  ">AI</div>
                  <div style="background: rgba(255,255,255,0.1); padding: 12px 16px; border-radius: 12px; font-size: 15px; line-height: 1.5;">
                    "Hello, you've reached Orange Dentist. I'm the after-hours AI assistant. How can I help you today?"
                  </div>
                </div>

                <div style="display: flex; gap: 12px; align-items: flex-start; justify-content: flex-end;">
                  <div style="background: rgba(233,104,29,0.2); padding: 12px 16px; border-radius: 12px; font-size: 15px; line-height: 1.5;">
                    "Hi, I have a toothache and I'd like to book an appointment as soon as possible."
                  </div>
                  <div style="
                    background: #555; color: white; width: 32px; height: 32px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
                  ">👤</div>
                </div>

                <div style="display: flex; gap: 12px; align-items: flex-start;">
                  <div style="
                    background: #E9681D; color: white; width: 32px; height: 32px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
                  ">AI</div>
                  <div style="background: rgba(255,255,255,0.1); padding: 12px 16px; border-radius: 12px; font-size: 15px; line-height: 1.5;">
                    "I'm sorry to hear that. I can see our next available emergency slot is tomorrow at 9:00 AM with Dr. Smith. Shall I book that for you? I'll also send a confirmation to your phone."
                  </div>
                </div>
              </div>
            </div>

            <!-- Stats Row -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center;">
              <div style="padding: 20px; background: #f8f9fa; border-radius: 12px;">
                <div style="font-size: 28px; font-weight: 800; color: #E9681D;">24/7</div>
                <div style="font-size: 13px; color: #666; margin-top: 4px;">Always Available</div>
              </div>
              <div style="padding: 20px; background: #f8f9fa; border-radius: 12px;">
                <div style="font-size: 28px; font-weight: 800; color: #E9681D;">< 1s</div>
                <div style="font-size: 13px; color: #666; margin-top: 4px;">Answer Time</div>
              </div>
              <div style="padding: 20px; background: #f8f9fa; border-radius: 12px;">
                <div style="font-size: 28px; font-weight: 800; color: #E9681D;">$0.05</div>
                <div style="font-size: 13px; color: #666; margin-top: 4px;">Per Minute</div>
              </div>
              <div style="padding: 20px; background: #f8f9fa; border-radius: 12px;">
                <div style="font-size: 28px; font-weight: 800; color: #E9681D;">100%</div>
                <div style="font-size: 13px; color: #666; margin-top: 4px;">Calls Answered</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `, { waitUntil: 'domcontentloaded' });

  await page2.screenshot({ path: path.join(OUT, 'ai-phone-agent.png') });
  console.log('  ✅ ai-phone-agent.png');
  await page2.close();

  // ═══ SCREENSHOT 3: Feature Overview (all 3 features side by side) ═══
  console.log('📸 Taking feature overview screenshot...');
  const page3 = await context.newPage();
  await page3.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; }
      </style>
    </head>
    <body>
      <div style="max-width: 1000px; margin: 40px auto; padding: 0 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <div style="font-size: 32px; font-weight: 800; color: #1B2839;">
            What We'll Build for Orange Dentist
          </div>
          <div style="font-size: 16px; color: #666; margin-top: 8px;">
            Three powerful tools to capture more patients and save staff time
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;">
          <!-- Chatbot -->
          <div style="
            border: 2px solid #E9681D; border-radius: 16px; overflow: hidden;
            transition: transform 0.2s;
          ">
            <div style="background: #E9681D; padding: 24px; color: white; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 8px;">💬</div>
              <div style="font-size: 20px; font-weight: 700;">AI Chatbot</div>
            </div>
            <div style="padding: 24px;">
              <ul style="list-style: none; padding: 0;">
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Answers patient questions 24/7
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Books appointments directly
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Knows your services & hours
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Orange Dentist branded
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444;">
                  ✅ Live on your website in 48h
                </li>
              </ul>
            </div>
          </div>

          <!-- Booking -->
          <div style="
            border: 2px solid #E9681D; border-radius: 16px; overflow: hidden;
          ">
            <div style="background: #E9681D; padding: 24px; color: white; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 8px;">📅</div>
              <div style="font-size: 20px; font-weight: 700;">Online Booking</div>
            </div>
            <div style="padding: 24px;">
              <ul style="list-style: none; padding: 0;">
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Patients book online anytime
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Syncs to Google Calendar
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ SMS reminders 24h before
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Easy reschedule/cancel
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444;">
                  ✅ Reduces phone calls by 40%
                </li>
              </ul>
            </div>
          </div>

          <!-- AI Phone -->
          <div style="
            border: 2px solid #1B2839; border-radius: 16px; overflow: hidden;
          ">
            <div style="background: #1B2839; padding: 24px; color: white; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 8px;">📞</div>
              <div style="font-size: 20px; font-weight: 700;">AI Phone Agent</div>
              <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">PHASE 2 — OPTIONAL</div>
            </div>
            <div style="padding: 24px;">
              <ul style="list-style: none; padding: 0;">
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Answers calls after hours
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Natural voice conversation
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Books emergency appointments
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0;">
                  ✅ Email summaries to reception
                </li>
                <li style="padding: 8px 0; font-size: 14px; color: #444;">
                  ✅ 24/7 — never miss a call
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Pricing -->
        <div style="
          margin-top: 40px; background: #f8f9fa; border-radius: 16px; padding: 32px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
        ">
          <div style="
            background: white; border-radius: 12px; padding: 28px;
            border: 2px solid #E9681D;
          ">
            <div style="font-size: 13px; font-weight: 600; color: #E9681D; letter-spacing: 1px; margin-bottom: 8px;">
              PHASE 1 — CHATBOT + BOOKING
            </div>
            <div style="font-size: 36px; font-weight: 800; color: #1B2839;">
              $1,000 <span style="font-size: 16px; font-weight: 400; color: #666;">setup</span>
            </div>
            <div style="font-size: 20px; color: #E9681D; font-weight: 600; margin-top: 4px;">
              + $69/month
            </div>
            <div style="font-size: 13px; color: #999; margin-top: 8px;">
              Includes: chatbot training, booking system, Google Calendar sync, branded widget, ongoing support
            </div>
          </div>

          <div style="
            background: white; border-radius: 12px; padding: 28px;
            border: 2px solid #1B2839;
          ">
            <div style="font-size: 13px; font-weight: 600; color: #1B2839; letter-spacing: 1px; margin-bottom: 8px;">
              PHASE 2 — ADD AI PHONE
            </div>
            <div style="font-size: 36px; font-weight: 800; color: #1B2839;">
              +$500 <span style="font-size: 16px; font-weight: 400; color: #666;">setup</span>
            </div>
            <div style="font-size: 20px; color: #E9681D; font-weight: 600; margin-top: 4px;">
              + $30/month <span style="font-size: 14px; color: #999;">+ usage</span>
            </div>
            <div style="font-size: 13px; color: #999; margin-top: 8px;">
              Includes: AI voice agent setup, call forwarding config, knowledge base training, call transcripts
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `, { waitUntil: 'domcontentloaded' });

  await page3.screenshot({ path: path.join(OUT, 'feature-overview.png'), fullPage: true });
  console.log('  ✅ feature-overview.png');
  await page3.close();

  await browser.close();
  console.log('\n✅ All screenshots done!');
}

main().catch(err => { console.error(err); process.exit(1); });
