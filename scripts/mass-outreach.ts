import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ─── COUNTRY CONFIGS ─────────────────────────────────────────────────────────

interface CountryConfig {
  country: string;
  lang: 'en' | 'de';
  cities: string[];
  currency: string;
  pricing: { starter: string; professional: string; premium: string };
}

const BATCHES: CountryConfig[] = [
  {
    country: 'US',
    lang: 'en',
    cities: [
      'Chattanooga Tennessee', 'Savannah Georgia', 'Huntsville Alabama',
      'Greenville South Carolina', 'Billings Montana', 'Duluth Minnesota',
      'Tyler Texas', 'Bowling Green Kentucky', 'Tuscaloosa Alabama',
      'Myrtle Beach South Carolina', 'Gainesville Florida', 'Fargo North Dakota',
      'Burlington Vermont', 'Casper Wyoming', 'Bismarck North Dakota',
    ],
    currency: 'USD',
    pricing: { starter: '$800', professional: '$1,500', premium: '$2,500' },
  },
];

const INDUSTRY = 'roofing contractor';
const TOP_N = 10;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

interface Lead {
  name: string;
  website: string;
  email: string | null;
  city: string;
  rating: number;
  reviewCount: number;
  outdatedScore: number;
  leadScore: number;
  loadTime?: number;
  hasChatbot?: boolean;
  isMobile?: boolean;
  hasSSL?: boolean;
  isOldTech?: boolean;
  pdfPath?: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── LANGUAGE HELPERS ────────────────────────────────────────────────────────

function getEmailSubject(lang: 'en' | 'de' | 'hu', name: string): string {
  if (lang === 'hu') return `3 ingyenes weboldal redesign koncepció a ${name} számára`;
  if (lang === 'de') return `Ich habe 3 Redesign-Konzepte für ${name} erstellt — kostenlos`;
  return `I redesigned ${name}'s website — 3 free concepts inside`;
}

function getEmailHtml(lang: 'en' | 'de' | 'hu', lead: Lead): string {
  if (lang === 'hu') {
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#333">
<p>Tisztelt ${lead.name}!</p>
<p>A ${lead.city}-i fogorvosi rendelők kutatása során találtam az Önök praxisára — és ${lead.reviewCount ? lead.reviewCount + '+ Google értékeléssel' : 'kiváló értékelésekkel'} egyértelmű, hogy pácienseik elégedettek.</p>
<p>Feltűnt, hogy a weboldaluk megérdemelne egy modern frissítést, ami jobban tükrözi a praxis minőségét. Ezért <strong>3 ingyenes redesign koncepciót</strong> készítettem kifejezetten az Önök rendelője számára. A mellékelt PDF-ben találják.</p>
<p><strong>Néhány fejlesztési lehetőség:</strong></p>
<ul style="color:#555;line-height:1.8">
<li>Modern, mobilbarát weboldal design</li>
<li>AI chatbot a páciensek kérdéseire 0-24</li>
<li>Online időpontfoglalás integráció</li>
<li>SEO optimalizálás a jobb Google találatokért</li>
</ul>
<p>Nyitottak lennének egy rövid, 10 perces beszélgetésre a lehetőségekről?</p>
<p>Üdvözlettel,<br><strong>Geri</strong><br>Webfejlesztő & AI specialista<br>smartflowdev.com</p>
<hr style="border:none;border-top:1px solid #eee;margin:20px 0">
<p style="font-size:12px;color:#999">Ezt az emailt azért kapta, mert úgy gondolom, hogy rendelőjük profitálhat egy modern webes jelenlétből. Ha nem érdekli, kérem hagyja figyelmen kívül.</p>
</div>`;
  }
  if (lang === 'de') {
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#333">
<p>Sehr geehrtes Team von ${lead.name},</p>
<p>bei meiner Recherche nach erstklassigen Zahnarztpraxen in ${lead.city.replace(/ (Germany|Switzerland)$/i, '')} bin ich auf Ihre Praxis gestoßen — und mit <strong>${lead.reviewCount}+ Google-Bewertungen und ${lead.rating} Sternen</strong> ist klar, dass Ihre Patienten Sie lieben.</p>
<p>Mir ist aufgefallen, dass Ihre Website ein modernes Update verdient hätte, das der Qualität Ihrer Praxis gerecht wird. Deshalb habe ich <strong>3 Redesign-Konzepte speziell für ${lead.name}</strong> erstellt. Sie finden sie im angehängten PDF.</p>
<p><strong>Einige Verbesserungsmöglichkeiten:</strong></p>
<ul style="color:#555;line-height:1.8">
<li>Modernes, mobilfreundliches Design</li>
<li>KI-Chatbot für Patientenanfragen rund um die Uhr</li>
<li>Online-Terminbuchung</li>
<li>SEO-Optimierung für bessere Google-Sichtbarkeit</li>
<li>Zweisprachige Website (DE/EN) für internationale Patienten</li>
</ul>
<p><strong>Ihre ${lead.reviewCount}+ Fünf-Sterne-Bewertungen verdienen eine Website, die das widerspiegelt.</strong></p>
<p>Hätten Sie Interesse an einem kurzen 10-minütigen Gespräch?</p>
<p>Mit freundlichen Grüßen,<br><strong>Geri</strong><br>Web-Entwicklung & KI-Spezialist<br>smartflowdev.com</p>
<hr style="border:none;border-top:1px solid #eee;margin:20px 0">
<p style="font-size:12px;color:#999">Falls Sie kein Interesse haben, ignorieren Sie diese E-Mail einfach — keine weiteren Nachrichten, es sei denn, Sie antworten.</p>
</div>`;
  }

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#333">
<p>Hi ${lead.name} team,</p>
<p>I came across your firm while researching top-rated lawyers in ${lead.city.replace(/ (US)$/i, '')} — and with <strong>${lead.reviewCount}+ Google reviews and a ${lead.rating}-star rating</strong>, your clients clearly trust you.</p>
<p>I noticed your website could use a modern refresh — a modern website builds trust for potential clients seeking legal representation. I created <strong>3 redesign concepts specifically for ${lead.name}</strong>. You'll find them in the attached PDF.</p>
<p><strong>A few quick improvements I identified:</strong></p>
<ul style="color:#555;line-height:1.8"><li>No online consultation booking — potential clients move on</li><li>Outdated design hurts credibility with prospective clients</li><li>No AI chatbot for after-hours inquiries</li><li>SEO optimization to rank higher for "${lead.city.replace(/ (US)$/i, '')} lawyer"</li></ul>
<p><strong>Your ${lead.reviewCount}+ five-star reviews deserve a website that reflects them.</strong></p>
<p>Would you be open to a quick 10-minute call to discuss?</p>
<p>Best regards,<br><strong>Geri</strong><br>AI Web Development Specialist<br>smartflowdev.com</p>
<hr style="border:none;border-top:1px solid #eee;margin:20px 0">
<p style="font-size:12px;color:#999">If you're not interested, simply ignore this email — no follow-ups unless you reply.</p>
</div>`;
}

function getRedesignPrompt(lang: 'en' | 'de' | 'hu', lead: Lead, style: { name: string; bg: string; accent: string; layout: string }): string {
  const cityClean = lead.city.replace(/ (UK|Australia|Germany|Switzerland|US|Hungary)$/i, '');

  if (lang === 'hu') {
    return `You are a senior web designer. Generate a complete single-file HTML page for:

Business: ${lead.name}
Industry: Fogorvosi rendelő (Dental practice)
City: ${cityClean}, Hungary
Rating: ${lead.rating}★ with ${lead.reviewCount} reviews
Services: Fogimplantátum, Fogfehérítés, Fogszabályozás, Esztétikai fogászat, Koronák, Általános fogászat

Design: ${style.name}
Background: ${style.bg}
Accent: ${style.accent}
LAYOUT: ${style.layout}

ALL TEXT MUST BE IN HUNGARIAN:
- Nav: Szolgáltatások, Rólunk, Vélemények, Kapcsolat
- CTA: "Időpont foglalás"
- Services: Fogimplantátum, Fogfehérítés, Fogszabályozás, Esztétikai fogászat, Koronák és hidak, Általános fogászat
- Testimonials in Hungarian: "Kiváló fogorvos, nagyon ajánlom!", "Profi csapat, barátságos légkör", "A legjobb fogászat ${cityClean}-ben!"
- Chatbot: "Miben segíthetünk?"
- Contact: "Kérjen időpontot" form
- Footer: Nyitvatartás, Szolgáltatások, Kapcsolat

Rules: 100% inline CSS, no external resources, Unicode emoji icons, responsive, 1280px optimized. Output ONLY HTML.`;
  }

  if (lang === 'de') {
    return `You are a senior web designer. Generate a complete single-file HTML page for:

Business: ${lead.name}
Industry: Zahnarztpraxis (Dental practice)
City: ${cityClean}
Phone: (from Google Maps listing)
Rating: ${lead.rating}★ with ${lead.reviewCount} reviews
Services: Zahnimplantate, Zahnaufhellung, Kieferorthopädie, Kronen, Prophylaxe, Ästhetische Zahnheilkunde

Design: ${style.name}
Background: ${style.bg}
Accent: ${style.accent}
LAYOUT STRUCTURE: ${style.layout}

CRITICAL: The layout structure above MUST be followed exactly. This determines the visual flow.

LANGUAGE: Main content in GERMAN. Include a DE/EN language switcher button in the navbar.

Nav items: Startseite, Leistungen, Über uns, Kontakt, Termin buchen
Hero CTA: "Termin buchen"
Services section title: "Unsere Leistungen"
Services: Zahnimplantate, Zahnaufhellung, Kieferorthopädie, Kronen, Prophylaxe
Testimonials in German: "Hervorragende Behandlung!", "Sehr professionelles Team", "Beste Zahnarztpraxis in ${cityClean}"
AI chatbot widget (bottom-right floating button) greeting: "Wie können wir Ihnen helfen?"
Contact section title: "Kontakt"
Footer with phone/email/address

Rules: 100% inline CSS, no external resources, Unicode emoji for icons, CSS gradients for visuals, responsive, 1280px optimized. Output ONLY HTML.`;
  }

  return `You are a senior web designer. Generate a complete single-file HTML page for:

Business: ${lead.name}
Industry: Law firm
City: ${cityClean}
Phone: (from Google Maps listing)
Rating: ${lead.rating}★ with ${lead.reviewCount} reviews
Services: Personal Injury, Family Law, Criminal Defense, Estate Planning, Business Law, Immigration

Design: ${style.name}
Background: ${style.bg}
Accent: ${style.accent}
LAYOUT STRUCTURE: ${style.layout}

CRITICAL: The layout structure above MUST be followed exactly. This determines the visual flow.

Sections: Practice Areas, Attorney Profiles, Case Results, Client Testimonials, Free Consultation CTA
Include: nav, hero with "Schedule Free Consultation" CTA, practice areas, attorney profiles, case results, testimonials (use "Excellent legal representation!", "Very professional team", "Best lawyer in ${cityClean}"), AI chatbot widget (bottom-right floating button, greeting: "How can we help with your legal matter?"), contact section, footer with phone/email/address.

Rules: 100% inline CSS, no external resources, Unicode emoji for icons, CSS gradients for visuals, responsive, 1280px optimized. Output ONLY HTML.`;
}

function getPdfHtml(lang: 'en' | 'de' | 'hu', lead: Lead, config: CountryConfig, images: Record<string, string>): string {
  const cityClean = lead.city.replace(/ (UK|Australia|Germany|Switzerland|US|Hungary)$/i, '');
  const { currentSite, aDesktop, aMobile, bDesktop, bMobile, cDesktop, cMobile } = images;

  const imgTag = (src: string, style: string, fallback: string) =>
    src ? `<img src="${src}" style="${style}">` : `<div style="${fallback}"></div>`;

  // ─── Localized strings ───
  const isDE = lang === 'de';
  const isHU = lang === 'hu';

  const coverTitle1 = isHU ? 'Weboldal Redesign' : isDE ? 'Website-Redesign' : 'Website Redesign';
  const coverTitle2 = isHU ? 'Javaslat' : isDE ? 'Vorschlag' : 'Proposal';
  const coverPrepared = isHU ? 'Készült a' : isDE ? 'Erstellt für' : 'Prepared exclusively for';
  const coverBy = isHU ? 'Készítette' : isDE ? 'Erstellt von' : 'Prepared by';

  const page2Title = isHU
    ? 'A jelenlegi weboldala<br><span style="color:#dc2626">pácienseket veszít</span>'
    : isDE
    ? 'Ihre aktuelle Website<br><span style="color:#dc2626">kostet Sie Patienten</span>'
    : 'Your Website is<br><span style="color:#dc2626">Losing You Clients</span>';
  const page2Sub = isHU
    ? 'Minden nap, amíg elavult a weboldala, potenciális páciensek a versenytársakat választják.'
    : isDE
    ? 'Jeden Tag mit einer veralteten Website entscheiden sich potenzielle Patienten für Ihre Konkurrenz.'
    : 'Every day with an outdated website, potential clients choose your competitors instead.';
  const issues = isHU
    ? ['Elavult design rontja az első benyomást', 'Nincs online időpontfoglalás', 'Nincs AI chatbot az éjszakai kérdésekre', 'Rossz mobil megjelenés', 'Hiányzó SEO optimalizálás']
    : isDE
    ? ['Veraltetes Design schadet dem ersten Eindruck', 'Keine Online-Terminbuchung', 'Kein KI-Chatbot für Anfragen außerhalb der Sprechzeiten', 'Schlechte mobile Darstellung', 'Fehlende SEO-Optimierung']
    : ['Outdated design hurts first impressions', 'No online consultation booking', 'No AI chatbot for after-hours inquiries', 'Poor mobile experience', 'Missing SEO optimization'];
  const credQuote = isHU
    ? '"A felhasználók 75%-a a weboldal designja alapján ítéli meg egy vállalkozás hitelességét" — Stanford Research'
    : isDE
    ? '„75 % der Nutzer beurteilen die Glaubwürdigkeit eines Unternehmens anhand des Website-Designs" — Stanford Research'
    : '"75% of users judge a business\'s credibility based on their website design" — Stanford Research';

  // Option labels
  const optA = { title: 'Option A: Premium Medical', sub: isDE ? 'Sauber, professionell, vertrauensbildend' : 'Clean, professional, trust-building', feats: isDE ? ['Zentriertes professionelles Layout', 'Vertrauensbildendes Design', 'KI-Chatbot inklusive'] : ['Centered professional layout', 'Trust-building design', 'AI chatbot included'] };
  const optB = { title: 'Option B: Modern Warm', sub: isDE ? 'Freundlich, einladend, familienorientiert' : 'Friendly, approachable, family-oriented', feats: isDE ? ['Warmes, einladendes Design', 'Horizontal scrollende Services', 'Familienfreundliches Gefühl'] : ['Warm, inviting design', 'Horizontal scroll services', 'Family-friendly feel'] };
  const optC = { title: 'Option C: Bold Dark', sub: isDE ? 'Premium, cineastisch, High-End' : 'Premium, cinematic, high-end', feats: isDE ? ['Premium-Dark-Ästhetik', 'Cineastische Hero-Sektion', 'Glas-Effekt-Navigation'] : ['Premium dark aesthetic', 'Cinematic hero section', 'Glass-effect navigation'] };

  // What's included
  const inclTitle = isDE ? 'Was Sie bekommen' : "What's Included";
  const features = isDE ? [
    { icon: '🌐', t: 'Moderne responsive Website', d: '5+ Seiten, mobile-first, schnell ladend' },
    { icon: '🤖', t: 'KI-Chatbot 24/7', d: 'Patientenfragen automatisch beantworten' },
    { icon: '📅', t: 'Online-Terminbuchung', d: 'Patienten buchen jederzeit, ohne Anruf' },
    { icon: '🔍', t: 'SEO-Optimierung', d: `Besser ranken für "Zahnarzt in ${cityClean}"` },
    { icon: '📱', t: 'Mobile-First Design', d: 'Perfekt auf jedem Gerät' },
    { icon: '🌍', t: 'Zweisprachige Website (DE/EN)', d: 'Internationale Patienten erreichen' },
    { icon: '📍', t: 'Google Maps Integration', d: 'Standort mit Wegbeschreibung' },
    { icon: '⭐', t: 'Bewertungen präsentieren', d: `Ihre ${lead.reviewCount}+ Bewertungen prominent anzeigen` },
  ] : [
    { icon: '⚖️', t: 'Practice Areas Showcase', d: 'Highlight all your legal services clearly' },
    { icon: '👔', t: 'Attorney Profiles', d: 'Professional bios that build client trust' },
    { icon: '🏆', t: 'Case Results Gallery', d: 'Showcase your track record of success' },
    { icon: '📋', t: 'Free Consultation Form', d: 'Clients book consultations online 24/7' },
    { icon: '🤖', t: 'AI Chatbot 24/7', d: 'Answer legal inquiries after hours' },
    { icon: '⭐', t: 'Client Testimonials', d: `Display your ${lead.reviewCount}+ reviews prominently` },
    { icon: '📝', t: 'Blog / Legal Resources', d: 'Build authority with helpful legal content' },
    { icon: '🔍', t: 'SEO Optimization', d: `Rank higher for "${cityClean} lawyer"` },
  ];

  // Pricing
  const pricingTitle = isDE ? 'Wählen Sie Ihr Paket' : 'Choose Your Package';
  const pricingSub = isDE ? 'Flexible Optionen für Ihre Praxis' : 'Flexible options for your practice';
  const starterFeats = isDE ? '✓ 5 individuelle Seiten<br>✓ Mobile responsive<br>✓ Basis-SEO<br>✓ Kontaktformular<br>✓ 30 Tage Support' : '✓ 5 custom pages<br>✓ Mobile responsive<br>✓ Basic SEO<br>✓ Contact form<br>✓ 30-day support';
  const proFeats = isDE ? '✓ 10 individuelle Seiten<br>✓ KI-Chatbot<br>✓ Online-Terminbuchung<br>✓ Erweiterte SEO<br>✓ 90 Tage Support' : '✓ 10 custom pages<br>✓ AI chatbot<br>✓ Online booking<br>✓ Advanced SEO<br>✓ 90-day support';
  const premFeats = isDE ? '✓ Unbegrenzte Seiten<br>✓ Alles oben genannte<br>✓ Individuelle Integrationen<br>✓ 12 Monate Support<br>✓ Monatliche Updates' : '✓ Unlimited pages<br>✓ Everything above<br>✓ Custom integrations<br>✓ 12-month support<br>✓ Monthly updates';
  const mostPopular = isDE ? 'BELIEBTESTE' : 'MOST POPULAR';

  // CTA
  const ctaTitle = isDE ? 'Bereit für ein Upgrade?' : 'Ready to upgrade your online presence?';
  const ctaSub = isDE ? 'Antworten Sie einfach auf diese E-Mail, um zu starten' : 'Simply reply to this email to get started';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page{size:1280px 720px;margin:0}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif}
.page{width:1280px;height:720px;overflow:hidden;position:relative;page-break-after:always}
.page:last-child{page-break-after:auto}
img{max-width:100%;display:block}
</style></head><body>

<!-- PAGE 1: COVER -->
<div class="page" style="background:linear-gradient(135deg,#0a1628,#1B3A5C);display:flex;align-items:center;justify-content:center;text-align:center;color:white">
  <div style="position:relative;z-index:1">
    <div style="font-size:13px;letter-spacing:4px;color:#64748b;margin-bottom:24px">PROFESSIONAL WEBSITE REDESIGN</div>
    <h1 style="font-size:52px;font-weight:300;letter-spacing:2px;margin-bottom:12px">${coverTitle1}</h1>
    <h1 style="font-size:52px;font-weight:300;letter-spacing:2px;margin-bottom:24px">${coverTitle2}</h1>
    <div style="width:80px;height:3px;background:linear-gradient(90deg,#14B8A6,#3B82F6);margin:0 auto 24px"></div>
    <p style="font-size:20px;opacity:0.8;margin-bottom:8px">${coverPrepared}</p>
    <p style="font-size:28px;font-weight:600">${lead.name}</p>
    <p style="font-size:16px;opacity:0.5;margin-top:24px">${cityClean} | April 2026</p>
    <p style="font-size:13px;opacity:0.4;margin-top:60px">${coverBy} <span style="color:#14B8A6">SmartFlow Dev</span> | smartflowdev.com</p>
  </div>
</div>

<!-- PAGE 2: CURRENT STATE -->
<div class="page" style="background:#f1f5f9;display:flex;padding:50px 60px;gap:50px">
  <div style="flex:1">
    <div style="font-size:13px;letter-spacing:3px;color:#64748b;margin-bottom:12px">${isDE ? 'AKTUELLER ZUSTAND' : 'CURRENT STATE'}</div>
    <h2 style="font-size:34px;color:#1e293b;margin-bottom:16px">${page2Title}</h2>
    <p style="color:#64748b;font-size:15px;margin-bottom:24px">${page2Sub}</p>
    ${issues.map(iss => `<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px"><span style="color:#dc2626;font-size:18px">✕</span><span style="color:#475569;font-size:14px">${iss}</span></div>`).join('\n    ')}
    <div style="margin-top:24px;padding:16px;background:rgba(220,38,38,0.08);border-left:3px solid #dc2626;border-radius:4px;font-size:13px;color:#64748b;font-style:italic">${credQuote}</div>
  </div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center">
    ${currentSite ? `<img src="${currentSite}" style="border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.15);border:2px solid #e5e7eb;max-height:560px">` : '<div style="width:500px;height:400px;background:#e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8">Current site screenshot</div>'}
  </div>
</div>

<!-- PAGE 3: OPTION A -->
<div class="page" style="background:#ffffff;padding:50px 60px">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px"><div style="width:36px;height:36px;background:#1B3A5C;border-radius:8px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">A</div><div><h2 style="font-size:28px;color:#1e293b">${optA.title}</h2><p style="font-size:14px;color:#94a3b8">${optA.sub}</p></div></div>
  <div style="display:flex;gap:24px">
    <div style="flex:3">${aDesktop ? `<img src="${aDesktop}" style="border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.1);border:1px solid #e5e7eb">` : ''}</div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:16px">
      <div style="width:140px;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.15);border:4px solid #1e293b">${aMobile ? `<img src="${aMobile}" style="width:100%">` : ''}</div>
      <div style="font-size:11px;color:#94a3b8">Mobile View</div>
    </div>
  </div>
  <div style="display:flex;gap:20px;margin-top:20px">
    ${optA.feats.map(f => `<div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#475569"><strong style="color:#1B3A5C">✓</strong> ${f}</div>`).join('\n    ')}
  </div>
</div>

<!-- PAGE 4: OPTION B -->
<div class="page" style="background:#FDF8F0;padding:50px 60px">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px"><div style="width:36px;height:36px;background:#C45D3E;border-radius:8px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">B</div><div><h2 style="font-size:28px;color:#2C1810">${optB.title}</h2><p style="font-size:14px;color:#8B7355">${optB.sub}</p></div></div>
  <div style="display:flex;gap:24px">
    <div style="flex:3">${bDesktop ? `<img src="${bDesktop}" style="border-radius:8px;box-shadow:0 4px 20px rgba(60,30,10,0.12);border:1px solid #e8ddd0">` : ''}</div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:16px">
      <div style="width:140px;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(60,30,10,0.15);border:4px solid #3D2B1F">${bMobile ? `<img src="${bMobile}" style="width:100%">` : ''}</div>
      <div style="font-size:11px;color:#8B7355">Mobile View</div>
    </div>
  </div>
  <div style="display:flex;gap:20px;margin-top:20px">
    ${optB.feats.map(f => `<div style="flex:1;padding:12px;background:rgba(196,93,62,0.08);border-radius:8px;font-size:13px;color:#5A4234"><strong style="color:#C45D3E">✓</strong> ${f}</div>`).join('\n    ')}
  </div>
</div>

<!-- PAGE 5: OPTION C -->
<div class="page" style="background:#0F172A;padding:50px 60px;color:#f8fafc">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px"><div style="width:36px;height:36px;background:#14B8A6;border-radius:8px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">C</div><div><h2 style="font-size:28px;color:#f8fafc">${optC.title}</h2><p style="font-size:14px;color:#64748b">${optC.sub}</p></div></div>
  <div style="display:flex;gap:24px">
    <div style="flex:3">${cDesktop ? `<img src="${cDesktop}" style="border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);border:1px solid #334155">` : ''}</div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:16px">
      <div style="width:140px;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.3);border:4px solid #0F172A">${cMobile ? `<img src="${cMobile}" style="width:100%">` : ''}</div>
      <div style="font-size:11px;color:#64748b">Mobile View</div>
    </div>
  </div>
  <div style="display:flex;gap:20px;margin-top:20px">
    ${optC.feats.map(f => `<div style="flex:1;padding:12px;background:rgba(20,184,166,0.1);border-radius:8px;font-size:13px;color:#94a3b8"><strong style="color:#14B8A6">✓</strong> ${f}</div>`).join('\n    ')}
  </div>
</div>

<!-- PAGE 6: WHAT'S INCLUDED -->
<div class="page" style="background:linear-gradient(135deg,#0a1628,#1e293b);padding:50px 60px;color:white">
  <div style="font-size:13px;letter-spacing:3px;color:#64748b;margin-bottom:12px">${isDE ? 'ALLES IM ÜBERBLICK' : 'EVERYTHING YOU GET'}</div>
  <h2 style="font-size:32px;margin-bottom:30px">${inclTitle}</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    ${features.map(f => `<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px"><div style="font-size:24px;margin-bottom:8px">${f.icon}</div><h3 style="font-size:16px;margin-bottom:4px">${f.t}</h3><p style="font-size:13px;color:#94a3b8">${f.d}</p></div>`).join('\n    ')}
  </div>
</div>

<!-- PAGE 7: PRICING -->
<div class="page" style="background:linear-gradient(135deg,#0d1b2a,#1B3A5C);padding:50px 60px;color:white">
  <div style="text-align:center;margin-bottom:30px"><h2 style="font-size:32px">${pricingTitle}</h2><p style="color:#94a3b8;margin-top:8px">${pricingSub}</p></div>
  <div style="display:flex;gap:20px;margin-bottom:30px">
    <div style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:30px;text-align:center">
      <h3 style="color:#94a3b8;font-size:14px;letter-spacing:2px">STARTER</h3>
      <div style="font-size:42px;font-weight:700;color:#3B82F6;margin:12px 0">${config.pricing.starter}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:20px">${isDE ? 'einmalig' : 'one-time'}</div>
      <div style="text-align:left;font-size:13px;color:#94a3b8;line-height:2">${starterFeats}</div>
    </div>
    <div style="flex:1;background:rgba(59,130,246,0.1);border:2px solid #3B82F6;border-radius:16px;padding:30px;text-align:center;position:relative">
      <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#3B82F6;color:white;padding:4px 16px;border-radius:20px;font-size:11px;font-weight:600">${mostPopular}</div>
      <h3 style="color:#e2e8f0;font-size:14px;letter-spacing:2px">PROFESSIONAL</h3>
      <div style="font-size:42px;font-weight:700;color:#3B82F6;margin:12px 0">${config.pricing.professional}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:20px">${isDE ? 'einmalig' : 'one-time'}</div>
      <div style="text-align:left;font-size:13px;color:#cbd5e1;line-height:2">${proFeats}</div>
    </div>
    <div style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:30px;text-align:center">
      <h3 style="color:#d4af37;font-size:14px;letter-spacing:2px">PREMIUM</h3>
      <div style="font-size:42px;font-weight:700;color:#d4af37;margin:12px 0">${config.pricing.premium}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:20px">${isDE ? 'einmalig' : 'one-time'}</div>
      <div style="text-align:left;font-size:13px;color:#94a3b8;line-height:2">${premFeats}</div>
    </div>
  </div>
</div>

<!-- PAGE 8: CTA -->
<div class="page" style="background:linear-gradient(135deg,#0a1628,#1B3A5C);display:flex;align-items:center;justify-content:center;text-align:center;color:white">
  <div>
    <div style="font-size:64px;margin-bottom:24px">🚀</div>
    <h2 style="font-size:40px;margin-bottom:16px">${ctaTitle}</h2>
    <p style="color:#94a3b8;font-size:18px;margin-bottom:32px">${ctaSub}</p>
    <div style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#14B8A6);padding:16px 48px;border-radius:12px;font-size:18px;font-weight:600">${isDE ? 'Auf diese E-Mail antworten' : 'Reply to this email'}</div>
    <p style="color:#64748b;font-size:13px;margin-top:40px">smartflowdev.com | ${isDE ? '100 % Zufriedenheitsgarantie' : '100% satisfaction guarantee'}</p>
  </div>
</div>

</body></html>`;
}

// ─── PIPELINE STEPS (per batch) ──────────────────────────────────────────────

async function discoverBatch(config: CountryConfig): Promise<Lead[]> {
  console.log(`\n  🔍 Discovering lawyers in ${config.cities.length} cities (${config.country})...\n`);
  const allLeads: Lead[] = [];

  for (let i = 0; i < config.cities.length; i++) {
    const city = config.cities[i];
    console.log(`    [${i + 1}/${config.cities.length}] ${city}...`);

    try {
      execSync(
        `npx ts-node scripts/pipeline.ts --industry "${INDUSTRY}" --city "${city}" --count 10`,
        { cwd: path.resolve(__dirname, '..'), stdio: 'pipe', timeout: 300000 }
      );

      const date = new Date().toISOString().split('T')[0];
      const slug = `${city.toLowerCase().replace(/\s+/g, '-')}-${INDUSTRY}`;
      const outFile = path.resolve(__dirname, `../output/leads/pipeline-${slug}-${date}.json`);

      if (fs.existsSync(outFile)) {
        const data = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        const leads = Array.isArray(data) ? data : (data.leads || []);
        leads.forEach((l: any) => {
          if (l.email && l.email.includes('@') && !l.email.includes('.png') && !l.email.includes('.webp') && l.email !== 'contact@mysite.com') {
            allLeads.push({ ...l, city });
          }
        });
        console.log(`      ✅ Found ${leads.length} leads, ${leads.filter((l: any) => l.email && l.email.includes('@')).length} with email`);
      }
    } catch (err: any) {
      console.log(`      ❌ Failed: ${err.message?.slice(0, 50)}`);
    }
  }

  return allLeads;
}

function selectTop(leads: Lead[]): Lead[] {
  console.log(`\n  📊 Selecting top ${TOP_N} from ${leads.length} leads...\n`);

  leads.sort((a, b) => (b.outdatedScore || 0) - (a.outdatedScore || 0));

  const seen = new Set<string>();
  const unique: Lead[] = [];
  for (const lead of leads) {
    const domain = lead.website?.replace(/https?:\/\//, '').replace(/www\./, '').split('/')[0];
    if (!seen.has(domain) && lead.outdatedScore >= 35) {
      seen.add(domain);
      unique.push(lead);
    }
  }

  const top = unique.slice(0, TOP_N);

  console.log('    Selected leads:');
  top.forEach((l, i) => {
    console.log(`    ${i + 1}. [Score:${l.outdatedScore}] ${l.name} (${l.city}) - ${l.email}`);
  });

  return top;
}

async function generateRedesigns(leads: Lead[], config: CountryConfig): Promise<void> {
  console.log(`\n  🎨 Generating redesigns (${config.lang.toUpperCase()}) for ${leads.length} leads...\n`);

  const Anthropic = require('@anthropic-ai/sdk');
  const puppeteer = require('puppeteer');
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const browser = await puppeteer.launch({ headless: true });

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const slug = slugify(lead.name);
    const dir = path.resolve(__dirname, `../output/redesigns/${slug}`);
    fs.mkdirSync(dir, { recursive: true });

    console.log(`    [${i + 1}/${leads.length}] ${lead.name} (${lead.city})...`);

    // Screenshot current site (30s timeout + retry + fallback)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(lead.website, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(8000);
        await page.screenshot({ path: path.join(dir, 'current-site.png'), fullPage: false });
        await page.close();
        console.log(`      ✅ Current site screenshot`);
        break;
      } catch {
        if (attempt === 1) {
          console.log(`      ⚠️ Screenshot attempt 1 failed, retrying...`);
        } else {
          console.log(`      ⚠️ Screenshot failed after 2 attempts, generating text fallback`);
          const fallbackHtml = `<!DOCTYPE html><html><head><style>
            *{margin:0;padding:0;box-sizing:border-box}
            body{width:1280px;height:900px;background:#f8fafc;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center}
            .card{background:white;border-radius:16px;padding:60px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:800px;text-align:center}
            h2{font-size:28px;color:#1e293b;margin-bottom:12px}
            .url{font-size:16px;color:#3b82f6;margin-bottom:24px}
            .issues{text-align:left;margin:0 auto;max-width:500px}
            .issue{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:15px;color:#475569}
            .x{color:#dc2626;font-weight:bold;font-size:18px}
            .score{margin-top:24px;font-size:48px;font-weight:700;color:#dc2626}
            .score-label{font-size:14px;color:#94a3b8}
          </style></head><body>
            <div class="card">
              <h2>${lead.name}</h2>
              <div class="url">${lead.website}</div>
              <div class="issues">
                <div class="issue"><span class="x">✕</span> Outdated website design</div>
                <div class="issue"><span class="x">✕</span> No AI chatbot</div>
                <div class="issue"><span class="x">✕</span> No online booking</div>
                <div class="issue"><span class="x">✕</span> Poor mobile optimization</div>
                <div class="issue"><span class="x">✕</span> Missing SEO basics</div>
              </div>
              <div class="score">${lead.outdatedScore}/100</div>
              <div class="score-label">Outdated Score</div>
            </div>
          </body></html>`;
          try {
            const fallbackPage = await browser.newPage();
            await fallbackPage.setViewport({ width: 1280, height: 900 });
            await fallbackPage.setContent(fallbackHtml, { waitUntil: 'networkidle0' });
            await fallbackPage.screenshot({ path: path.join(dir, 'current-site.png'), fullPage: false });
            await fallbackPage.close();
            console.log(`      ✅ Generated fallback screenshot`);
          } catch { console.log(`      ❌ Fallback also failed`); }
        }
      }
    }

    // Generate 3 styles using TEMPLATES (no AI needed - faster, cheaper, consistent)
    const templateDir = path.resolve(__dirname, '../templates');
    const styles = [
      { name: 'Centered Professional', file: 'style-a', template: 'template-a.html', primary: '#1e3a5f', accent: '#3B82F6', bg: '#ffffff', text: '#1e293b' },
      { name: 'Split Asymmetric', file: 'style-b', template: 'template-b.html', primary: '#1B3A5C', accent: '#14B8A6', bg: '#fffcf7', text: '#2c1810' },
      { name: 'Glass Morphism', file: 'style-c', template: 'template-c.html', primary: '#6366f1', accent: '#8B5CF6', bg: '#f0ecf8', text: '#1a1a2e' },
    ];

    const isHU = (config.lang as string) === 'hu';
    const isDE = (config.lang as string) === 'de';

    const placeholders: Record<string, string> = {
      '{{COMPANY_NAME}}': lead.name,
      '{{PHONE}}': (lead as any).phone || '',
      '{{CITY}}': lead.city?.replace(/ (UK|Australia|Germany|Switzerland|US|Hungary)$/i, '') || '',
      '{{RATING}}': String(lead.rating || '4.5'),
      '{{REVIEW_COUNT}}': String(lead.reviewCount || '100'),
      '{{SERVICE_1}}': isHU ? 'Fogimplantátum' : isDE ? 'Zahnimplantate' : 'Dental Implants',
      '{{SERVICE_2}}': isHU ? 'Fogfehérítés' : isDE ? 'Zahnaufhellung' : 'Teeth Whitening',
      '{{SERVICE_3}}': isHU ? 'Fogszabályozás' : isDE ? 'Kieferorthopädie' : 'Orthodontics',
      '{{SERVICE_4}}': isHU ? 'Esztétikai fogászat' : isDE ? 'Ästhetische Zahnheilkunde' : 'Cosmetic Dentistry',
      '{{SERVICE_5}}': isHU ? 'Koronák és hidak' : isDE ? 'Kronen & Brücken' : 'Crowns & Bridges',
      '{{SERVICE_6}}': isHU ? 'Általános fogászat' : isDE ? 'Allgemeine Zahnheilkunde' : 'General Cleanings',
      '{{SERVICE_DESC_1}}': isHU ? 'Tartós fogpótlás a legmodernebb implantátum technológiával' : 'Permanent tooth replacement with state-of-the-art implant technology',
      '{{SERVICE_DESC_2}}': isHU ? 'Professzionális fehérítés a magabiztosabb mosolyért' : 'Professional whitening for a brighter, confident smile',
      '{{SERVICE_DESC_3}}': isHU ? 'Fogszabályozó és láthatatlan sín a tökéletes fogsorért' : 'Braces and clear aligners for perfectly aligned teeth',
      '{{SERVICE_DESC_4}}': isHU ? 'Héjak, ragasztás és mosoly átalakítás' : 'Veneers, bonding, and smile makeovers',
      '{{SERVICE_DESC_5}}': isHU ? 'Egyedileg készített pótlások a sérült fogakra' : 'Custom-crafted restorations for damaged teeth',
      '{{SERVICE_DESC_6}}': isHU ? 'Megelőző kezelések és rendszeres fogászati ellenőrzés' : 'Preventive care and routine dental checkups',
      '{{TESTIMONIAL_1}}': isHU ? 'Kiváló fogorvos, nagyon ajánlom! Profi csapat és barátságos légkör.' : 'Best dental experience ever. The staff is incredibly friendly and professional!',
      '{{TESTIMONIAL_2}}': isHU ? 'Teljesen átalakította a mosolyomat. Nem bírom abbahagyni a mosolygást!' : 'They transformed my smile. I can\'t stop smiling now!',
      '{{TESTIMONIAL_3}}': isHU ? 'Csodálatos hangulat, nem is éreztem hogy fogorvosnál vagyok.' : 'The atmosphere is amazing. It doesn\'t even feel like a dentist office.',
      '{{TESTIMONIAL_1_AUTHOR}}': isHU ? 'Elégedett páciens' : isDE ? 'Zufriedener Patient' : 'Verified Patient',
      '{{TESTIMONIAL_2_AUTHOR}}': isHU ? 'Hűséges páciens' : isDE ? 'Treuer Patient' : 'Long-term Patient',
      '{{TESTIMONIAL_3_AUTHOR}}': isHU ? 'Boldog páciens' : isDE ? 'Glücklicher Patient' : 'Happy Patient',
      '{{TEAM_1_NAME}}': isHU ? 'Dr. Szabó Anna' : isDE ? 'Dr. Müller' : 'Dr. Smith',
      '{{TEAM_2_NAME}}': isHU ? 'Dr. Kovács Béla' : isDE ? 'Dr. Schmidt' : 'Dr. Johnson',
      '{{TEAM_3_NAME}}': isHU ? 'Dr. Nagy Eszter' : isDE ? 'Dr. Fischer' : 'Dr. Williams',
      '{{TEAM_4_NAME}}': isHU ? 'Dr. Tóth Péter' : isDE ? 'Dr. Weber' : 'Dr. Davis',
      '{{TEAM_1_ROLE}}': isHU ? 'Vezető fogorvos' : isDE ? 'Leitender Zahnarzt' : 'Lead Dentist',
      '{{TEAM_2_ROLE}}': isHU ? 'Fogszabályozó' : isDE ? 'Kieferorthopäde' : 'Orthodontist',
      '{{TEAM_3_ROLE}}': isHU ? 'Esztétikai fogász' : isDE ? 'Ästhetischer Zahnarzt' : 'Cosmetic Specialist',
      '{{TEAM_4_ROLE}}': isHU ? 'Implantológus' : isDE ? 'Implantologe' : 'Implant Surgeon',
      '{{HERO_HEADLINE_1}}': isHU ? 'A mosolyod' : isDE ? 'Dein Lächeln' : 'Your Smile',
      '{{HERO_HEADLINE_2}}': isHU ? 'megérdemli' : isDE ? 'verdient' : 'Deserves',
      '{{HERO_HEADLINE_ACCENT}}': isHU ? 'a legjobbat' : isDE ? 'das Beste' : 'The Best',
      '{{HERO_SUBTEXT}}': isHU ? 'Modern, gondoskodó fogászat a család minden tagjának. Foglalj időpontot még ma.' : isDE ? 'Moderne, einfühlsame Zahnheilkunde für die ganze Familie. Termin heute buchen.' : 'Gentle, modern dentistry with a caring team you can trust. Book your visit today.',
      '{{FOOTER_DESC}}': isHU ? 'Professzionális fogászati ellátás pácienseink bizalmával.' : isDE ? 'Professionelle Zahnpflege, der unsere Patienten vertrauen.' : 'Professional dental care trusted by patients in our community.',
      '{{CONTACT_PLACEHOLDER}}': isHU ? 'pl. Fogimplantátum' : isDE ? 'z.B. Zahnimplantate' : 'e.g. Dental Implants',
      '{{CTA_BANNER_TITLE}}': isHU ? 'Készen állsz egy szebb mosolyra?' : isDE ? 'Bereit für ein schöneres Lächeln?' : 'Ready for a Beautiful Smile?',
      '{{YEARS_EXPERIENCE}}': '15',
      '{{CTA_TEXT}}': isHU ? 'Időpont foglalás' : isDE ? 'Termin buchen' : 'Book Appointment',
      '{{CHATBOT_GREETING}}': isHU ? 'Miben segíthetünk?' : isDE ? 'Wie können wir Ihnen helfen?' : 'Hi! How can we help you today?',
      '{{INDUSTRY_SPECIFIC_SECTION}}': '',
    };

    for (const style of styles) {
      try {
        // Read template and replace placeholders
        let html = fs.readFileSync(path.join(templateDir, style.template), 'utf8');
        const styleData = {
          ...placeholders,
          '{{PRIMARY_COLOR}}': style.primary,
          '{{ACCENT_COLOR}}': style.accent,
          '{{BG_COLOR}}': style.bg,
          '{{TEXT_COLOR}}': style.text,
        };
        for (const [key, val] of Object.entries(styleData)) {
          html = html.split(key).join(val);
        }
        fs.writeFileSync(path.join(dir, `${style.file}.html`), html);

        // Desktop screenshot
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.screenshot({ path: path.join(dir, `${style.file}-desktop.png`), fullPage: false });

        // Mobile screenshot (375x667 viewport, fullPage: false)
        await page.setViewport({ width: 375, height: 667 });
        await page.screenshot({ path: path.join(dir, `${style.file}-mobile.png`), fullPage: false });
        await page.close();

        console.log(`      ✅ ${style.name}`);
      } catch (err: any) {
        console.log(`      ❌ ${style.name}: ${err.message?.slice(0, 50)}`);
      }
    }
  }

  await browser.close();
}

async function generatePDFs(leads: Lead[], config: CountryConfig): Promise<void> {
  console.log(`\n  📄 Generating PDFs (${config.lang.toUpperCase()}) for ${leads.length} leads...\n`);

  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true });

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const slug = slugify(lead.name);
    const dir = path.resolve(__dirname, `../output/redesigns/${slug}`);
    const proposalDir = path.resolve(__dirname, '../output/proposals');
    fs.mkdirSync(proposalDir, { recursive: true });

    console.log(`    [${i + 1}/${leads.length}] ${lead.name}...`);

    function img(filename: string): string {
      const fp = path.join(dir, filename);
      if (!fs.existsSync(fp)) return '';
      return 'data:image/png;base64,' + fs.readFileSync(fp).toString('base64');
    }

    const images = {
      currentSite: img('current-site.png'),
      aDesktop: img('style-a-desktop.png'),
      aMobile: img('style-a-mobile.png'),
      bDesktop: img('style-b-desktop.png'),
      bMobile: img('style-b-mobile.png'),
      cDesktop: img('style-c-desktop.png'),
      cMobile: img('style-c-mobile.png'),
    };

    const html = getPdfHtml(config.lang, lead, config, images);

    const htmlPath = path.join(proposalDir, `${slug}-proposal.html`);
    fs.writeFileSync(htmlPath, html);

    const pdfPath = path.join(proposalDir, `${slug}-proposal.pdf`);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      width: '1280px',
      height: '720px',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await page.close();

    lead.pdfPath = pdfPath;
    console.log(`      ✅ PDF: ${pdfPath}`);
  }

  await browser.close();
}

async function sendEmails(leads: Lead[], config: CountryConfig): Promise<void> {
  console.log(`\n  📧 Sending emails (${config.lang.toUpperCase()}) for ${leads.length} leads...\n`);

  const { Resend } = require('resend');
  const resend = new Resend(RESEND_API_KEY);

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    if (!lead.email || !lead.pdfPath) continue;

    const subject = getEmailSubject(config.lang, lead.name);
    const pdfBuffer = fs.readFileSync(lead.pdfPath);

    console.log(`    [${i + 1}/${leads.length}] ${lead.name} → ${lead.email}`);

    try {
      const { data, error } = await resend.emails.send({
        from: 'Geri <geri@smartflowdev.com>',
        replyTo: 'kapusicsgo@gmail.com',
        to: lead.email,
        subject,
        html: getEmailHtml(config.lang, lead),
        attachments: [{
          filename: `${lead.name.replace(/[^a-zA-Z0-9 ]/g, '')}-Website-Redesign-Proposal.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        }],
      });

      if (error) {
        console.log(`      ❌ ${JSON.stringify(error)}`);
      } else {
        console.log(`      ✅ Sent! ID: ${data?.id}`);
      }
    } catch (err: any) {
      console.log(`      ❌ ${err.message}`);
    }

    // 3 second delay between emails
    await new Promise(r => setTimeout(r, 3000));
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const allBatchResults: Array<{ country: string; leadsFound: number; emailsSent: number; leads: Lead[] }> = [];

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  MASS LAWYER OUTREACH - USA × 15 CITIES × TOP 10            ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║  US (EN) — 15 cities                                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  for (let b = 0; b < BATCHES.length; b++) {
    const config = BATCHES[b];
    const batchStart = Date.now();

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  BATCH ${b + 1}/${BATCHES.length}: ${config.country.toUpperCase()} (${config.lang.toUpperCase()})`);
    console.log(`${'═'.repeat(60)}`);

    // 1. Discover
    const allLeads = await discoverBatch(config);
    console.log(`\n  📊 Total leads with email: ${allLeads.length}`);

    // 2. Select top 10
    const topLeads = selectTop(allLeads);

    if (topLeads.length === 0) {
      console.log(`  ❌ No qualified leads found for ${config.country}. Skipping.`);
      allBatchResults.push({ country: config.country, leadsFound: allLeads.length, emailsSent: 0, leads: [] });
      continue;
    }

    // 3. Generate redesigns
    await generateRedesigns(topLeads, config);

    // 4. Generate PDFs
    await generatePDFs(topLeads, config);

    // 5. Send emails
    await sendEmails(topLeads, config);

    const batchElapsed = ((Date.now() - batchStart) / 1000 / 60).toFixed(1);
    const sent = topLeads.filter(l => l.pdfPath).length;
    console.log(`\n  ✅ ${config.country} batch complete: ${sent} emails sent in ${batchElapsed} min`);

    allBatchResults.push({ country: config.country, leadsFound: allLeads.length, emailsSent: sent, leads: topLeads });
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const totalLeads = allBatchResults.reduce((s, b) => s + b.leadsFound, 0);
  const totalSent = allBatchResults.reduce((s, b) => s + b.emailsSent, 0);

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  OUTREACH COMPLETE - ALL BATCHES                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  Total time: ${elapsed} minutes`);
  console.log(`  Countries: ${BATCHES.map(b => b.country).join(', ')}`);
  console.log(`  Cities searched: ${BATCHES.reduce((s, b) => s + b.cities.length, 0)}`);
  console.log(`  Total leads found: ${totalLeads}`);
  console.log(`  Total emails sent: ${totalSent}`);
  allBatchResults.forEach(b => {
    console.log(`    ${b.country}: ${b.emailsSent} emails (${b.leadsFound} leads found)`);
  });
  console.log(`  Reply-to: kapusicsgo@gmail.com`);
  console.log('');

  // Save log
  const logPath = path.resolve(__dirname, '../output/outreach-log-usa-lawyer.json');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify({
    date: new Date().toISOString(),
    batches: allBatchResults.map(b => ({
      country: b.country,
      leadsFound: b.leadsFound,
      emailsSent: b.emailsSent,
      leads: b.leads,
    })),
    totalLeads,
    totalEmailsSent: totalSent,
    industry: INDUSTRY,
  }, null, 2));
  console.log(`  Log saved: ${logPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
