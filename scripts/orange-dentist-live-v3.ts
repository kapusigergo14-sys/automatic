import { chromium } from 'playwright';
import * as path from 'path';

const OUT = path.resolve(__dirname, '../output/mockups/orange-dentist-clone');
// Use the URL with gclid that the user confirmed works
const SITE = 'https://orangedentist.com.au/?gad_source=1&gad_campaignid=20973369018&gbraid=0AAAAA9R7Bnm98l80S9hV1u3sJxXJk961W&gclid=CjwKCAjw-dfOBhAjEiwAq0RwIwIgVFzCUq-apd2u5jX-pcZdmyVGTF1Ma2BBU-wekiHt1bseTOMtchoCYrIQAvD_BwE';

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',
    javaScriptEnabled: true,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    (window as any).chrome = { runtime: {} };
    delete (navigator as any).__proto__.webdriver;
  });

  const page = await context.newPage();

  console.log('📸 Loading orangedentist.com.au...');

  // Navigate and wait
  const response = await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(`  Status: ${response?.status()}`);

  // Wait in small increments to avoid timeout issues
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => document.readyState);
    console.log(`  ${i+1}s — readyState: ${ready}`);
    if (ready === 'complete' && i >= 4) break;
  }

  const title = await page.title();
  console.log(`  Title: "${title}"`);

  // Test screenshot
  await page.screenshot({ path: path.join(OUT, 'test-live.png') });
  console.log('  ✅ test-live.png');

  // Check what we got
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) || 'empty');
  console.log(`  Body preview: ${bodyText.slice(0, 100)}...`);

  const hasImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    return { count: imgs.length, loaded: Array.from(imgs).filter(i => i.complete).length };
  });
  console.log(`  Images: ${hasImages.loaded}/${hasImages.count} loaded`);

  // If page looks good, inject features
  if (title.includes('Orange Dentist') || title.includes('Dentist')) {
    console.log('  ✅ Page loaded, injecting features...');

    // Hide popups
    await page.evaluate(() => {
      document.querySelectorAll('[class*="cookie"], [class*="popup"], [class*="consent"], [id*="cookie"]')
        .forEach(el => (el as HTMLElement).style.display = 'none');
    });

    // Inject "Book Online" button into nav
    await page.evaluate(() => {
      // Target the main horizontal nav (raven-nav-menu-main)
      const nav = document.querySelector('nav.raven-nav-menu-main');
      if (nav) {
        const ul = nav.querySelector('ul');
        if (ul) {
          const li = document.createElement('li');
          li.style.cssText = 'list-style: none; display: inline-block; margin-left: 12px; vertical-align: middle;';
          li.innerHTML = `<a href="#" style="
            background: #E9681D !important; color: white !important; padding: 10px 22px !important;
            border-radius: 6px !important; font-weight: 700 !important; font-size: 14px !important;
            text-decoration: none !important; display: inline-block !important;
            letter-spacing: 0.5px !important; font-family: inherit !important;
          ">📅 BOOK ONLINE</a>`;
          ul.appendChild(li);
        }
      }
    });

    // Inject chatbot
    await page.evaluate(() => {
      const w = document.createElement('div');
      w.id = 'sf-chatbot';
      w.innerHTML = `<div style="position:fixed;bottom:24px;right:24px;z-index:99999;width:370px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;filter:drop-shadow(0 8px 32px rgba(0,0,0,0.18))"><div style="background:white;border-radius:16px;overflow:hidden"><div style="background:#E9681D;padding:16px 20px;display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px">🦷</div><div><div style="color:white;font-weight:700;font-size:16px">Orange Dentist AI</div><div style="color:rgba(255,255,255,0.8);font-size:12px">● Online now</div></div></div><div style="padding:20px;display:flex;flex-direction:column;gap:12px;background:#fafafa;min-height:280px"><div style="display:flex;gap:8px;align-items:flex-start"><div style="width:28px;height:28px;background:#E9681D;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;flex-shrink:0">AI</div><div style="background:white;padding:12px 16px;border-radius:4px 16px 16px 16px;font-size:14px;color:#333;line-height:1.5;box-shadow:0 1px 3px rgba(0,0,0,0.06);max-width:260px">Hi! 👋 I'm the Orange Dentist AI assistant. How can I help you today?</div></div><div style="display:flex;justify-content:flex-end"><div style="background:#E9681D;color:white;padding:12px 16px;border-radius:16px 4px 16px 16px;font-size:14px;max-width:240px">I'd like to book a teeth cleaning</div></div><div style="display:flex;gap:8px;align-items:flex-start"><div style="width:28px;height:28px;background:#E9681D;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;flex-shrink:0">AI</div><div style="background:white;padding:12px 16px;border-radius:4px 16px 16px 16px;font-size:14px;color:#333;line-height:1.5;box-shadow:0 1px 3px rgba(0,0,0,0.06);max-width:260px">Sure! Our next available slot is <strong>Thursday at 2:00 PM</strong>. Would you like me to book that for you? 📋</div></div><div style="display:flex;justify-content:flex-end"><div style="background:#E9681D;color:white;padding:12px 16px;border-radius:16px 4px 16px 16px;font-size:14px">Yes please!</div></div><div style="display:flex;gap:8px;align-items:flex-start"><div style="width:28px;height:28px;background:#E9681D;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;flex-shrink:0">AI</div><div style="background:white;padding:12px 16px;border-radius:4px 16px 16px 16px;font-size:14px;color:#333;line-height:1.5;box-shadow:0 1px 3px rgba(0,0,0,0.06);max-width:260px">Done! ✅ Booked for <strong>Thu, April 10 at 2:00 PM</strong>. You'll get an SMS reminder 24h before.</div></div></div><div style="padding:12px 16px;border-top:1px solid #eee;display:flex;gap:8px;align-items:center;background:white"><input style="flex:1;border:1px solid #e0e0e0;border-radius:20px;padding:10px 16px;font-size:14px;outline:none;font-family:inherit" placeholder="Type your message..." /><div style="width:36px;height:36px;background:#E9681D;border-radius:50%;display:flex;align-items:center;justify-content:center"><span style="color:white;font-size:16px">➤</span></div></div><div style="text-align:center;padding:6px;font-size:10px;color:#bbb">Powered by smartflowdev</div></div></div>`;
      document.body.appendChild(w);
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, 'live-with-chatbot.png') });
    console.log('  ✅ live-with-chatbot.png');

    // Swap to booking
    await page.evaluate(() => {
      document.getElementById('sf-chatbot')?.remove();
      const o = document.createElement('div');
      o.innerHTML = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(27,40,57,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)"><div style="background:white;border-radius:20px;width:500px;box-shadow:0 25px 60px rgba(0,0,0,0.25);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="background:#E9681D;padding:24px 28px;color:white"><div style="font-size:24px;font-weight:800">📅 Book Your Appointment</div><div style="font-size:14px;opacity:0.9;margin-top:4px">Orange Dentist — Online Booking</div></div><div style="padding:28px"><div style="margin-bottom:18px"><div style="font-size:13px;font-weight:600;color:#1B2839;margin-bottom:6px">Service</div><div style="border:2px solid #E9681D;border-radius:8px;padding:12px 14px;font-size:15px;color:#1B2839;background:#FFF8F5">✓ General Check-up & Clean</div></div><div style="margin-bottom:18px"><div style="font-size:13px;font-weight:600;color:#1B2839;margin-bottom:6px">Select Date — April 2026</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center"><div style="font-size:11px;font-weight:600;color:#999;padding:4px">Mon</div><div style="font-size:11px;font-weight:600;color:#999;padding:4px">Tue</div><div style="font-size:11px;font-weight:600;color:#999;padding:4px">Wed</div><div style="font-size:11px;font-weight:600;color:#999;padding:4px">Thu</div><div style="font-size:11px;font-weight:600;color:#999;padding:4px">Fri</div><div style="font-size:11px;font-weight:600;color:#999;padding:4px">Sat</div><div style="font-size:11px;font-weight:600;color:#999;padding:4px">Sun</div><div></div><div></div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#ccc">1</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#ccc">2</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#ccc">3</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#ccc">4</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#ccc">5</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#ccc">6</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#ccc">7</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#ccc">8</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">9</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;background:#E9681D;color:white;font-weight:700">10</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">11</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">12</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">13</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">14</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">15</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">16</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">17</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">18</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">19</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">20</div><div style="padding:8px 4px;border-radius:8px;font-size:14px;color:#1B2839">21</div></div></div><div style="margin-bottom:20px"><div style="font-size:13px;font-weight:600;color:#1B2839;margin-bottom:6px">Available Times — Friday, April 10</div><div style="display:flex;gap:8px;flex-wrap:wrap"><div style="padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;background:#f5f5f5;color:#1B2839;border:1px solid #e0e0e0">9:00 AM</div><div style="padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;background:#f5f5f5;color:#1B2839;border:1px solid #e0e0e0">9:30 AM</div><div style="padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;background:#E9681D;color:white">10:00 AM</div><div style="padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;background:#f5f5f5;color:#1B2839;border:1px solid #e0e0e0">11:30 AM</div><div style="padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;background:#f5f5f5;color:#1B2839;border:1px solid #e0e0e0">2:00 PM</div><div style="padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;background:#f5f5f5;color:#1B2839;border:1px solid #e0e0e0">3:30 PM</div></div></div><button style="width:100%;padding:14px;background:#E9681D;color:white;border:none;border-radius:10px;font-size:16px;font-weight:700;font-family:inherit">Confirm Booking → Google Calendar</button><div style="text-align:center;margin-top:10px;font-size:11px;color:#999">✓ Google Calendar sync • ✓ SMS reminder 24h before • ✓ Easy reschedule</div></div></div></div>`;
      document.body.appendChild(o);
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, 'live-with-booking.png') });
    console.log('  ✅ live-with-booking.png');
  }

  await browser.close();
  console.log('\n✅ Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
