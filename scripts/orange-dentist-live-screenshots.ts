import { chromium } from 'playwright';
import * as path from 'path';

const OUT = path.resolve(__dirname, '../output/mockups/orange-dentist-clone');
const SITE = 'https://orangedentist.com.au';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // ═══ SCREENSHOT 1: Live site + Chatbot widget ═══
  console.log('📸 1/3 — Live site with chatbot...');
  const page1 = await context.newPage();
  await page1.goto(SITE, { waitUntil: 'networkidle', timeout: 30000 });
  await page1.waitForTimeout(3000);

  // Inject chatbot widget onto the LIVE site
  await page1.evaluate(() => {
    // Remove any cookie banners or popups
    document.querySelectorAll('[class*="cookie"], [class*="popup"], [class*="modal"], [id*="cookie"]').forEach(el => (el as HTMLElement).style.display = 'none');

    const widget = document.createElement('div');
    widget.innerHTML = `
      <div style="
        position: fixed; bottom: 24px; right: 24px; z-index: 99999;
        width: 370px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        filter: drop-shadow(0 8px 32px rgba(0,0,0,0.18));
      ">
        <!-- Chat Window -->
        <div style="
          background: white; border-radius: 16px; overflow: hidden;
        ">
          <!-- Header -->
          <div style="background: #E9681D; padding: 16px 20px; display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">🦷</div>
            <div>
              <div style="color: white; font-weight: 700; font-size: 16px;">Orange Dentist AI</div>
              <div style="color: rgba(255,255,255,0.8); font-size: 12px;">● Online now</div>
            </div>
          </div>

          <!-- Messages -->
          <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px; background: #fafafa; min-height: 280px;">
            <!-- Bot -->
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <div style="width: 28px; height: 28px; background: #E9681D; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; flex-shrink: 0;">AI</div>
              <div style="background: white; padding: 12px 16px; border-radius: 4px 16px 16px 16px; font-size: 14px; color: #333; line-height: 1.5; box-shadow: 0 1px 3px rgba(0,0,0,0.06); max-width: 260px;">
                Hi! 👋 I'm the Orange Dentist AI assistant. How can I help you today?
              </div>
            </div>

            <!-- User -->
            <div style="display: flex; justify-content: flex-end;">
              <div style="background: #E9681D; color: white; padding: 12px 16px; border-radius: 16px 4px 16px 16px; font-size: 14px; max-width: 240px;">
                I'd like to book a teeth cleaning
              </div>
            </div>

            <!-- Bot -->
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <div style="width: 28px; height: 28px; background: #E9681D; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; flex-shrink: 0;">AI</div>
              <div style="background: white; padding: 12px 16px; border-radius: 4px 16px 16px 16px; font-size: 14px; color: #333; line-height: 1.5; box-shadow: 0 1px 3px rgba(0,0,0,0.06); max-width: 260px;">
                Sure! Our next available slot for a cleaning is <strong>Thursday at 2:00 PM</strong>. Would you like me to book that for you? 📋
              </div>
            </div>

            <!-- User -->
            <div style="display: flex; justify-content: flex-end;">
              <div style="background: #E9681D; color: white; padding: 12px 16px; border-radius: 16px 4px 16px 16px; font-size: 14px;">
                Yes please!
              </div>
            </div>

            <!-- Bot -->
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <div style="width: 28px; height: 28px; background: #E9681D; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; flex-shrink: 0;">AI</div>
              <div style="background: white; padding: 12px 16px; border-radius: 4px 16px 16px 16px; font-size: 14px; color: #333; line-height: 1.5; box-shadow: 0 1px 3px rgba(0,0,0,0.06); max-width: 260px;">
                Done! ✅ Your cleaning appointment is booked for <strong>Thursday, April 10 at 2:00 PM</strong>. You'll receive an SMS reminder 24h before.
              </div>
            </div>
          </div>

          <!-- Input -->
          <div style="padding: 12px 16px; border-top: 1px solid #eee; display: flex; gap: 8px; align-items: center; background: white;">
            <input style="flex: 1; border: 1px solid #e0e0e0; border-radius: 20px; padding: 10px 16px; font-size: 14px; outline: none; font-family: inherit;" placeholder="Type your message..." />
            <div style="width: 36px; height: 36px; background: #E9681D; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <span style="color: white; font-size: 16px;">➤</span>
            </div>
          </div>

          <div style="text-align: center; padding: 6px; font-size: 10px; color: #bbb;">Powered by smartflowdev</div>
        </div>
      </div>
    `;
    document.body.appendChild(widget);
  });

  await page1.waitForTimeout(500);
  await page1.screenshot({ path: path.join(OUT, 'live-with-chatbot.png') });
  console.log('  ✅ live-with-chatbot.png');

  // Scroll down a bit to show more of the site
  await page1.evaluate(() => window.scrollBy(0, 400));
  await page1.waitForTimeout(500);
  await page1.screenshot({ path: path.join(OUT, 'live-with-chatbot-scrolled.png') });
  console.log('  ✅ live-with-chatbot-scrolled.png');
  await page1.close();

  // ═══ SCREENSHOT 2: Live site + Booking overlay ═══
  console.log('📸 2/3 — Live site with booking...');
  const page2 = await context.newPage();
  await page2.goto(SITE, { waitUntil: 'networkidle', timeout: 30000 });
  await page2.waitForTimeout(3000);

  await page2.evaluate(() => {
    document.querySelectorAll('[class*="cookie"], [class*="popup"], [class*="modal"], [id*="cookie"]').forEach(el => (el as HTMLElement).style.display = 'none');

    const overlay = document.createElement('div');
    overlay.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(27,40,57,0.55); z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(3px);
      ">
        <div style="
          background: white; border-radius: 20px; width: 500px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.25); overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
          <div style="background: #E9681D; padding: 24px 28px; color: white;">
            <div style="font-size: 24px; font-weight: 800;">📅 Book Your Appointment</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Orange Dentist — Online Booking</div>
          </div>
          <div style="padding: 28px;">
            <div style="margin-bottom: 18px;">
              <div style="font-size: 13px; font-weight: 600; color: #1B2839; margin-bottom: 6px;">Service</div>
              <div style="border: 2px solid #E9681D; border-radius: 8px; padding: 12px 14px; font-size: 15px; color: #1B2839; background: #FFF8F5;">
                ✓ General Check-up & Clean
              </div>
            </div>
            <div style="margin-bottom: 18px;">
              <div style="font-size: 13px; font-weight: 600; color: #1B2839; margin-bottom: 6px;">Select Date — April 2026</div>
              <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;">
                ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d =>
                  `<div style="font-size: 11px; font-weight: 600; color: #999; padding: 4px;">${d}</div>`
                ).join('')}
                ${['','','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21'].map(d => {
                  if (!d) return '<div></div>';
                  const sel = d === '10';
                  const past = parseInt(d) < 9;
                  return `<div style="padding: 8px 4px; border-radius: 8px; font-size: 14px;
                    ${sel ? 'background: #E9681D; color: white; font-weight: 700;' : ''}
                    ${past ? 'color: #ccc;' : 'color: #1B2839;'}
                  ">${d}</div>`;
                }).join('')}
              </div>
            </div>
            <div style="margin-bottom: 20px;">
              <div style="font-size: 13px; font-weight: 600; color: #1B2839; margin-bottom: 6px;">Available Times — Friday, April 10</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${['9:00 AM','9:30 AM','10:00 AM','11:30 AM','2:00 PM','3:30 PM'].map((t, i) => `
                  <div style="padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 500;
                    ${i === 2 ? 'background: #E9681D; color: white;' : 'background: #f5f5f5; color: #1B2839; border: 1px solid #e0e0e0;'}
                  ">${t}</div>
                `).join('')}
              </div>
            </div>
            <button style="width: 100%; padding: 14px; background: #E9681D; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; font-family: inherit;">
              Confirm Booking → Google Calendar
            </button>
            <div style="text-align: center; margin-top: 10px; font-size: 11px; color: #999;">
              ✓ Syncs with Google Calendar &nbsp;•&nbsp; ✓ SMS reminder 24h before &nbsp;•&nbsp; ✓ Easy reschedule
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  });

  await page2.waitForTimeout(500);
  await page2.screenshot({ path: path.join(OUT, 'live-with-booking.png') });
  console.log('  ✅ live-with-booking.png');
  await page2.close();

  await browser.close();
  console.log('\n✅ All live screenshots done!');
}

main().catch(err => { console.error(err); process.exit(1); });
