import { chromium } from 'playwright';

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
  await page.waitForTimeout(5000);

  // Find nav structure
  const navInfo = await page.evaluate(() => {
    const results: string[] = [];
    // Check for nav elements
    const navs = document.querySelectorAll('nav');
    results.push(`<nav> elements: ${navs.length}`);
    navs.forEach((n, i) => results.push(`  nav[${i}] classes: ${n.className}, children: ${n.children.length}`));

    // Check for menu items with CONTACT US text
    const allLinks = document.querySelectorAll('a');
    allLinks.forEach(a => {
      if (a.textContent?.trim().includes('CONTACT')) {
        results.push(`CONTACT link: tag=${a.tagName}, class=${a.className}, parent=${a.parentElement?.tagName}.${a.parentElement?.className}, grandparent=${a.parentElement?.parentElement?.tagName}.${a.parentElement?.parentElement?.className}`);
      }
    });

    // Check header area
    const headers = document.querySelectorAll('header, [class*="header"], [class*="Header"]');
    results.push(`Header elements: ${headers.length}`);
    headers.forEach((h, i) => results.push(`  header[${i}] tag=${h.tagName}, class=${h.className?.toString().slice(0, 80)}`));

    // Check jet-menu
    const jetMenus = document.querySelectorAll('[class*="jet-menu"], [class*="elementor-nav"]');
    results.push(`Jet/Elementor menu elements: ${jetMenus.length}`);
    jetMenus.forEach((m, i) => results.push(`  menu[${i}] tag=${m.tagName}, class=${m.className?.toString().slice(0, 100)}`));

    return results.join('\n');
  });

  console.log(navInfo);
  await browser.close();
}

main().catch(console.error);
