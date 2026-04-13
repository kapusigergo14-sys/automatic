import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const OUT = path.resolve(__dirname, '../output/mockups/orange-dentist-clone');
const MOCKUP = path.resolve(__dirname, '../output/mockups/orange-dentist-mockup.html');

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Full page with chatbot visible
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const fileUrl = 'file:///' + MOCKUP.replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'load', timeout: 10000 });
  await page.waitForTimeout(2000);

  // Screenshot 1: Hero + chatbot (top of page)
  await page.screenshot({ path: path.join(OUT, 'mockup-hero-chatbot.png') });
  console.log('✅ mockup-hero-chatbot.png');

  // Screenshot 2: Features section
  await page.evaluate(() => {
    const features = document.querySelector('.features');
    if (features) features.scrollIntoView({ behavior: 'instant' });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'mockup-features.png') });
  console.log('✅ mockup-features.png');

  // Screenshot 3: Booking section
  await page.evaluate(() => {
    const booking = document.querySelector('.booking');
    if (booking) booking.scrollIntoView({ behavior: 'instant' });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'mockup-booking.png') });
  console.log('✅ mockup-booking.png');

  // Screenshot 4: Full page
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'mockup-fullpage.png'), fullPage: true });
  console.log('✅ mockup-fullpage.png');

  await browser.close();
  console.log('\n✅ All mockup screenshots done!');
}

main().catch(err => { console.error(err); process.exit(1); });
