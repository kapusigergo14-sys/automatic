/**
 * email-bodies-redesign.ts — Per-language subject + body templates for
 * the website REDESIGN pitch (outdated dental sites).
 *
 * Same interface as email-bodies.ts so send-dental-redesign.ts can import
 * pickSubject + buildBody by swapping the import source.
 *
 * v1: only English bodies (pool is US/UK/AU). HU/DE/ES added later if needed.
 */

import type { LangCode } from './markets';

export interface EmailBody {
  subjects: Array<(company: string) => string>;
  body: (company: string) => string;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── English ─────────────────────────────────────────────

const EN_SUBJECTS = [
  (c: string) => `Quick note about ${c}'s website`,
  (c: string) => `${c} — website refresh idea`,
  (c: string) => `Noticed something about ${c}'s site`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.6;font-size:15px">
<p style="margin:0 0 14px 0">Hi ${c} team,</p>

<p style="margin:0 0 14px 0">Geri here &mdash; I run <a href="https://smartflowdev.com" style="color:#059669;text-decoration:none">smartflowdev.com</a>, a small studio that modernizes dental practice websites in 7 days.</p>

<p style="margin:0 0 14px 0">I came across your site and noticed a few things that could be costing you patients: slow mobile load, no HTTPS, or a dated visual design. Dental practices that modernize typically see <strong>30&ndash;50% more contact form submissions</strong> just from the credibility boost.</p>

<p style="margin:0 0 14px 0">We do full redesigns with flat pricing &mdash; Starter $800 (landing page), Standard $1,500 (full 4-page site), Premium $3,000 (10+ pages). Short proposal attached with our process and what's included.</p>

<p style="margin:0 0 14px 0">No obligation &mdash; if it's of interest, just reply with a quick "yes" and I'll send over 3 example dental sites we've built within the hour. If not, no worries &mdash; delete this and I'll stop reaching out.</p>

<p style="margin:0 0 18px 0">Cheers,<br><strong>Geri</strong> &middot; <a href="https://smartflowdev.com" style="color:#059669;text-decoration:none">smartflowdev.com</a></p>
</div>`;
};

// ─── Hungarian (placeholder — pool has no HU outdated leads yet) ──

const HU_SUBJECTS = [
  (c: string) => `Weboldal frissítés ötlet — ${c}`,
  (c: string) => `${c} — weboldal modernizáció?`,
  (c: string) => `Észrevétel a(z) ${c} oldaláról`,
];

const HU_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Tisztelt ${c} csapat,</p>

<p style="margin:0 0 14px 0">Geri vagyok &mdash; magyar fejlesztő, a <a href="https://smartflowdev.com" style="color:#059669;text-decoration:none">smartflowdev.com</a> alapítója. Fogorvosi praxisok weboldalait modernizáljuk 7 nap alatt.</p>

<p style="margin:0 0 14px 0">Rátaláltam az oldalukra, és észrevettem pár dolgot ami páciensekbe kerülhet: lassú mobil betöltés, nincs HTTPS, elavult design. Azok a fogorvosi praxisok akik modernizálják az oldalukat, általában <strong>30&ndash;50%-kal több kapcsolatfelvételt</strong> kapnak, pusztán a hitelesség növekedése miatt.</p>

<p style="margin:0 0 14px 0">Fix áras redesign csomagokat ajánlunk &mdash; Starter 290.000 Ft (landing), Standard 550.000 Ft (4 oldalas), Premium 1.090.000 Ft (10+ oldalas). Rövid ajánlat csatolva.</p>

<p style="margin:0 0 14px 0">Ha érdekli, egyszerűen írjon vissza erre az emailre. Ha nem aktuális, semmi gond.</p>

<p style="margin:0 0 18px 0">Üdvözlettel,<br><strong>Geri</strong> &middot; <a href="https://smartflowdev.com" style="color:#059669;text-decoration:none">smartflowdev.com</a></p>
</div>`;
};

// ─── German (placeholder, no DE outdated leads yet) ───────

const DE_SUBJECTS = [
  (c: string) => `Kurze Notiz zur Website von ${c}`,
  (c: string) => `${c} — Website-Modernisierung?`,
  (c: string) => `Etwas zur Website von ${c}`,
];

const DE_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.6;font-size:15px">
<p>Hallo ${c} Team,</p>
<p>Geri hier — ich betreibe <a href="https://smartflowdev.com" style="color:#059669;text-decoration:none">smartflowdev.com</a>, ein kleines Studio, das Zahnarztpraxis-Websites in 7 Tagen modernisiert.</p>
<p>Ihre Website hat einige Punkte, die Patienten kosten könnten: langsames Laden auf dem Handy, fehlendes HTTPS, veraltetes Design.</p>
<p>Festpreise: Starter €750, Standard €1.400, Premium €2.800. Kurzes Angebot als PDF anbei.</p>
<p>Bei Interesse einfach antworten.</p>
<p>Beste Grüße,<br><strong>Geri</strong> · <a href="https://smartflowdev.com" style="color:#059669;text-decoration:none">smartflowdev.com</a></p>
</div>`;
};

// ─── Spanish (placeholder) ───────────────────────────────

const ES_SUBJECTS = [
  (c: string) => `Nota rápida sobre el sitio de ${c}`,
  (c: string) => `${c} — ¿renovación de web?`,
  (c: string) => `Algo sobre el sitio de ${c}`,
];

const ES_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.6;font-size:15px">
<p>Hola equipo de ${c},</p>
<p>Soy Geri — dirijo <a href="https://smartflowdev.com" style="color:#059669;text-decoration:none">smartflowdev.com</a>, un pequeño estudio que moderniza sitios web de clínicas dentales en 7 días.</p>
<p>Su sitio tiene algunas cosas que podrían estar costándoles pacientes: carga lenta en móvil, sin HTTPS, diseño anticuado.</p>
<p>Precios fijos: Starter $800, Standard $1,500, Premium $3,000. Propuesta corta adjunta.</p>
<p>Si les interesa, respondan a este email.</p>
<p>Saludos,<br><strong>Geri</strong> · <a href="https://smartflowdev.com" style="color:#059669;text-decoration:none">smartflowdev.com</a></p>
</div>`;
};

// ─── Lookup ──────────────────────────────────────────────

export const EMAIL_BODIES: Record<LangCode, EmailBody> = {
  en: { subjects: EN_SUBJECTS, body: EN_BODY },
  hu: { subjects: HU_SUBJECTS, body: HU_BODY },
  de: { subjects: DE_SUBJECTS, body: DE_BODY },
  es: { subjects: ES_SUBJECTS, body: ES_BODY },
};

export function pickSubject(idx: number, company: string, lang: LangCode): string {
  const variants = EMAIL_BODIES[lang].subjects;
  return variants[idx % variants.length](company);
}

export function buildBody(company: string, lang: LangCode): string {
  return EMAIL_BODIES[lang].body(company);
}
