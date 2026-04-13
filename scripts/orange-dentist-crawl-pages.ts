import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const OUT = path.resolve(__dirname, '../output/mockups/orange-dentist-clone/pages');
const BASE = 'https://orangedentist.com.au';
const GCLID = '?gad_source=1&gad_campaignid=20973369018&gbraid=0AAAAA9R7Bnm98l80S9hV1u3sJxXJk961W&gclid=CjwKCAjw-dfOBhAjEiwAq0RwIwIgVFzCUq-apd2u5jX-pcZdmyVGTF1Ma2BBU-wekiHt1bseTOMtchoCYrIQAvD_BwE';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'about-us', path: '/about-us/' },
  { name: 'dental-services', path: '/dental-services/' },
  { name: 'contact-us', path: '/contact-us/' },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  for (const p of PAGES) {
    const url = BASE + p.path + GCLID;
    console.log(`📸 ${p.name} — ${BASE + p.path}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(6000);

      // Viewport screenshot
      await page.screenshot({ path: path.join(OUT, `${p.name}.png`) });
      console.log(`  ✅ ${p.name}.png`);

      // Full page screenshot
      await page.screenshot({ path: path.join(OUT, `${p.name}-full.png`), fullPage: true });
      console.log(`  ✅ ${p.name}-full.png`);
    } catch (err: any) {
      console.log(`  ❌ ${err.message?.slice(0, 60)}`);
    }
  }

  // Also discover any other nav links
  await page.goto(BASE + '/' + GCLID, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const links = await page.evaluate(() => {
    const anchors = document.querySelectorAll('a[href]');
    const hrefs = new Set<string>();
    anchors.forEach(a => {
      const href = (a as HTMLAnchorElement).href;
      if (href.includes('orangedentist.com.au') && !href.includes('#') && !href.includes('mailto:') && !href.includes('tel:')) {
        hrefs.add(new URL(href).pathname);
      }
    });
    return Array.from(hrefs);
  });
  console.log('\n📋 All internal links found:');
  links.forEach(l => console.log(`  ${l}`));

  await browser.close();
  console.log('\n✅ Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
