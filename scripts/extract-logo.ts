import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface LogoResult {
  logoUrl: string | null;
  localPath: string | null;
  source: 'header-img' | 'favicon' | 'og-image' | 'apple-icon' | 'none';
}

function parseArgs(): { url: string; outDir: string } {
  const args = process.argv.slice(2);
  let url = '';
  let outDir = './logos';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) url = args[i + 1];
    if (args[i] === '--out' && args[i + 1]) outDir = args[i + 1];
  }
  if (!url) {
    console.error('Usage: npx ts-node scripts/extract-logo.ts --url https://example.com [--out ./logos]');
    process.exit(1);
  }
  return { url, outDir };
}

function resolveUrl(base: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function downloadImage(url: string, filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirect
        res.resume();
        downloadImage(resolveUrl(url, res.headers.location), filePath).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); resolve(false); return; }
      const file = fs.createWriteStream(filePath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(true)));
      file.on('error', () => resolve(false));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

export async function extractLogo(siteUrl: string, outDir: string = './logos'): Promise<LogoResult> {
  const result: LogoResult = { logoUrl: null, localPath: null, source: 'none' };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1200);

    const found = await page.evaluate(() => {
      const out: { url: string; source: string }[] = [];
      // 1. Header/nav <img> with alt or class containing logo
      const logoImgs = document.querySelectorAll('header img, nav img, [class*="logo"] img, img[alt*="logo" i], img[class*="logo" i], img[src*="logo" i]');
      for (const img of Array.from(logoImgs)) {
        const src = (img as HTMLImageElement).src || img.getAttribute('data-src') || '';
        if (src && !src.startsWith('data:')) {
          out.push({ url: src, source: 'header-img' });
          break;
        }
      }
      // 2. og:image
      const og = document.querySelector('meta[property="og:image"]');
      if (og) {
        const content = og.getAttribute('content') || '';
        if (content) out.push({ url: content, source: 'og-image' });
      }
      // 3. apple-touch-icon (high-res)
      const apple = document.querySelector('link[rel="apple-touch-icon"]');
      if (apple) {
        const href = apple.getAttribute('href') || '';
        if (href) out.push({ url: href, source: 'apple-icon' });
      }
      // 4. favicon
      const fav = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
      if (fav) {
        const href = fav.getAttribute('href') || '';
        if (href) out.push({ url: href, source: 'favicon' });
      }
      return out;
    });

    await browser.close();

    if (found.length === 0) return result;

    // Try each source in order
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const domain = new URL(siteUrl).hostname.replace(/[^a-z0-9]/gi, '_');

    for (const candidate of found) {
      const absUrl = resolveUrl(siteUrl, candidate.url);
      const ext = (absUrl.match(/\.(png|jpg|jpeg|svg|webp|ico|gif)(\?|$)/i)?.[1] || 'png').toLowerCase();
      const filePath = path.join(outDir, `${domain}_logo.${ext}`);
      const ok = await downloadImage(absUrl, filePath);
      if (ok && fs.statSync(filePath).size > 200) {
        result.logoUrl = absUrl;
        result.localPath = filePath;
        result.source = candidate.source as LogoResult['source'];
        return result;
      }
    }
    return result;
  } catch (err) {
    try { await browser.close(); } catch {}
    return result;
  }
}

if (require.main === module) {
  const { url, outDir } = parseArgs();
  console.log(`Extracting logo from ${url}...`);
  extractLogo(url, outDir).then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
