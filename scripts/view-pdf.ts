import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const PDF = 'C:/Users/geri/Downloads/Madison Donovan Group-Website-Redesign-Proposal.pdf';
const OUT = path.resolve(__dirname, '../output/mockups/tmp');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

  const fileUrl = 'file:///' + PDF.replace(/ /g, '%20');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4000);

  // Screenshot full view
  await page.screenshot({ path: path.join(OUT, 'madison-view.png'), fullPage: true });
  console.log('Done - madison-view.png');

  await browser.close();
}

main().catch(console.error);
