import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { extractCompanyData } from './extract-company-data';
import { extractGoogleReviews } from './extract-google-reviews';

async function main() {
  const url = 'http://www.laryngodent.hu';
  const businessName = 'Laryngodent';
  const outDir = path.resolve(__dirname, '../output/test-laryngodent');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('1. Scraping company data...');
  const data = await extractCompanyData(url);
  console.log(`   services=${data.services.length}, phone=${data.phone}, meta=${data.metaDescription ? 'yes' : 'no'}`);

  console.log('2. Fetching Google reviews...');
  const reviews = await extractGoogleReviews('Laryngodent Hajdúböszörmény');
  console.log(`   rating=${reviews.avgRating}, count=${reviews.reviewCount}, reviews=${reviews.reviews.length}`);

  // Filter only 4-5 star reviews for testimonials
  const positive = reviews.reviews.filter(r => r.rating >= 4).slice(0, 3);

  // Build placeholders (Hungarian dental defaults + real scraped data)
  const services = data.services.length >= 6
    ? data.services.slice(0, 6)
    : ['Fogimplantátum', 'Fogfehérítés', 'Fogszabályozás', 'Esztétikai fogászat', 'Koronák és hidak', 'Általános fogászat'];

  const descs = [
    'Tartós fogpótlás a legmodernebb implantátum technológiával',
    'Professzionális fehérítés a magabiztosabb mosolyért',
    'Fogszabályozó és láthatatlan sín a tökéletes fogsorért',
    'Héjak, ragasztás és mosoly átalakítás',
    'Egyedileg készített pótlások a sérült fogakra',
    'Megelőző kezelések és rendszeres fogászati ellenőrzés',
  ];

  const testimonials = positive.length >= 3
    ? positive.map(r => r.text.slice(0, 220))
    : [
        'Nagyon elégedett vagyok a munkájukkal. A doktornő közel 30 éve kezeli a fogaimat. Teljes biztonságban érzem magam.',
        'A nővér 16:30-kor hívtam a doktornőt, és még aznap estére időpontot kaptam. Nagyon kedves és segítőkész volt.',
        'Családom évek óta ide jár, mindannyian nagyon elégedettek vagyunk a modern, barátságos környezettel.',
      ];

  const testimonialAuthors = positive.length >= 3
    ? positive.map(r => r.author)
    : ['Elégedett páciens', 'Hűséges páciens', 'Boldog páciens'];

  const placeholders: Record<string, string> = {
    '{{COMPANY_NAME}}': businessName,
    '{{PHONE}}': data.phone || '+36 52 371 500',
    '{{CITY}}': data.city || 'Hajdúböszörmény',
    '{{RATING}}': reviews.avgRating ? reviews.avgRating.toFixed(1) : '4.1',
    '{{REVIEW_COUNT}}': reviews.reviewCount ? String(reviews.reviewCount) : '22',
    '{{YEARS_EXPERIENCE}}': '30',
    '{{SERVICE_1}}': services[0], '{{SERVICE_2}}': services[1], '{{SERVICE_3}}': services[2],
    '{{SERVICE_4}}': services[3], '{{SERVICE_5}}': services[4], '{{SERVICE_6}}': services[5],
    '{{SERVICE_DESC_1}}': descs[0], '{{SERVICE_DESC_2}}': descs[1], '{{SERVICE_DESC_3}}': descs[2],
    '{{SERVICE_DESC_4}}': descs[3], '{{SERVICE_DESC_5}}': descs[4], '{{SERVICE_DESC_6}}': descs[5],
    '{{TESTIMONIAL_1}}': testimonials[0],
    '{{TESTIMONIAL_2}}': testimonials[1],
    '{{TESTIMONIAL_3}}': testimonials[2],
    '{{TESTIMONIAL_1_AUTHOR}}': testimonialAuthors[0],
    '{{TESTIMONIAL_2_AUTHOR}}': testimonialAuthors[1],
    '{{TESTIMONIAL_3_AUTHOR}}': testimonialAuthors[2],
    // TEAM — use scraped data where available, fallback to defaults
    ...(() => {
      const defaults = [
        { name: 'Dr. Mészáros Ildikó', role: 'Fogorvos', photoUrl: '' },
        { name: 'Dr. Tóth Zoltán', role: 'Fül-orr-gégész', photoUrl: '' },
        { name: 'Dr. Tóth Anna', role: 'Fogorvos', photoUrl: '' },
        { name: 'Dr. Kovács Béla', role: 'Implantológus', photoUrl: '' },
      ];
      const gradients = [
        'background:linear-gradient(135deg,var(--accent),#f472b6)',
        'background:linear-gradient(135deg,#60a5fa,var(--accent))',
        'background:linear-gradient(135deg,#f472b6,#c084fc)',
        'background:linear-gradient(135deg,#34d399,#60a5fa)',
      ];
      const merged = [...data.teamMembers, ...defaults].slice(0, 4);
      const out: Record<string, string> = {};
      for (let i = 0; i < 4; i++) {
        const m = merged[i] || defaults[i];
        out[`{{TEAM_${i + 1}_NAME}}`] = m.name;
        out[`{{TEAM_${i + 1}_ROLE}}`] = m.role;
        out[`{{TEAM_${i + 1}_AVATAR_STYLE}}`] = m.photoUrl
          ? `background-image:url('${m.photoUrl}')`
          : gradients[i];
      }
      return out;
    })(),
    '{{HERO_HEADLINE_1}}': 'A mosolyod',
    '{{HERO_HEADLINE_2}}': 'megérdemli',
    '{{HERO_HEADLINE_ACCENT}}': 'a legjobbat',
    '{{HERO_SUBTEXT}}': data.metaDescription?.slice(0, 220).replace(/\s+/g, ' ').trim() || 'Modern, barátságos környezetben várjuk kedves betegeinket. A bejelentkezés telefonos egyeztetés alapján történik.',
    '{{FOOTER_DESC}}': 'Rögzített és kivehető fogpótlások, barázdazárás gyerekeknek. Modern, barátságos környezetben várjuk pácienseinket Hajdúböszörményben.',
    '{{CONTACT_PLACEHOLDER}}': 'pl. Fogimplantátum',
    '{{CTA_BANNER_TITLE}}': 'Készen állsz egy szebb mosolyra?',
    '{{CTA_TEXT}}': 'Időpont foglalás',
    '{{CHATBOT_GREETING}}': 'Miben segíthetünk?',
    '{{INDUSTRY_SPECIFIC_SECTION}}': '',
    '{{PRIMARY_COLOR}}': '#6366f1',
    '{{ACCENT_COLOR}}': '#8B5CF6',
    '{{BG_COLOR}}': '#f0ecf8',
    '{{TEXT_COLOR}}': '#1a1a2e',
  };

  console.log('3. Rendering template-c.html with real data...');
  const templatePath = path.resolve(__dirname, '../templates/template-c.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const [key, val] of Object.entries(placeholders)) {
    html = html.split(key).join(val);
  }

  const htmlOut = path.join(outDir, 'laryngodent-preview.html');
  fs.writeFileSync(htmlOut, html);
  console.log(`   HTML saved: ${htmlOut}`);

  console.log('4. Taking screenshot...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(outDir, 'laryngodent-desktop.png'), fullPage: false });
  await page.screenshot({ path: path.join(outDir, 'laryngodent-fullpage.png'), fullPage: true });
  await page.setViewport({ width: 375, height: 667 });
  await page.screenshot({ path: path.join(outDir, 'laryngodent-mobile.png'), fullPage: false });
  await browser.close();

  console.log('\n✅ Done! Check: ' + outDir);
  console.log('   - laryngodent-preview.html (open in browser)');
  console.log('   - laryngodent-desktop.png');
  console.log('   - laryngodent-fullpage.png');
  console.log('   - laryngodent-mobile.png');
}

main().catch(err => { console.error(err); process.exit(1); });
