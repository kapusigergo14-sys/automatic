import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const OUT = path.resolve(__dirname, '../output/mockups/orange-dentist-clone');
const SITE = 'https://orangedentist.com.au/?gad_source=1&gad_campaignid=20973369018&gbraid=0AAAAA9R7Bnm98l80S9hV1u3sJxXJk961W&gclid=CjwKCAjw-dfOBhAjEiwAq0RwIwIgVFzCUq-apd2u5jX-pcZdmyVGTF1Ma2BBU-wekiHt1bseTOMtchoCYrIQAvD_BwE';

async function main() {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  const page = await context.newPage();
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Find all large images on the page
  const images = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs).map(img => ({
      src: img.src,
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight,
      classes: img.className,
    })).filter(i => i.width > 400);
  });

  console.log('Large images found:');
  images.forEach((img, i) => {
    console.log(`  [${i}] ${img.width}x${img.height} | alt="${img.alt}" | ${img.src.slice(0, 100)}`);
  });

  // Also check CSS background images on hero/slider elements
  const bgImages = await page.evaluate(() => {
    const results: string[] = [];
    const elements = document.querySelectorAll('[class*="slider"], [class*="hero"], [class*="banner"], [class*="slide"], [class*="background"], [class*="elementor-background"], .elementor-widget-container');
    elements.forEach(el => {
      const style = getComputedStyle(el);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        const match = style.backgroundImage.match(/url\("?(.+?)"?\)/);
        if (match) results.push(match[1]);
      }
    });
    return results;
  });

  console.log('\nBackground images:');
  bgImages.forEach((url, i) => console.log(`  [${i}] ${url.slice(0, 120)}`));

  await browser.close();
}

main().catch(console.error);
