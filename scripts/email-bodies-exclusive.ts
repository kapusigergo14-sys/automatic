/**
 * email-bodies-exclusive.ts — Per-language + per-pitch subject/body templates
 * for the re-engagement exclusive-offer campaign.
 *
 * Sent ONLY to recipients who opened a previous campaign mail but didn't
 * reply. 50% off all tiers, first month free, 72-hour rolling deadline
 * (per-recipient, computed at send time).
 *
 * Signature differs from other email-bodies files — takes an `expiresAt`
 * Date and renders a human-readable deadline inline.
 */

import type { LangCode } from './markets';

export type Pitch = 'chatbot' | 'redesign' | 'lawyer' | 'plumber' | 'hvac';

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Landing URLs per pitch ──────────────────────────────────────────
const LANDING: Record<Pitch, string> = {
  chatbot:  'https://smartflowdev.com/chatbot',
  redesign: 'https://smartflowdev.com/redesign',
  lawyer:   'https://smartflowdev.com/lawyer',
  plumber:  'https://smartflowdev.com/plumber',
  hvac:     'https://smartflowdev.com/hvac',
};

// ─── Deadline formatting ─────────────────────────────────────────────
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HU_WEEKDAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const HU_MONTHS_LONG = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const DE_WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DE_MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const ES_WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ES_MONTHS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];

function pad2(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

/** e.g. "Wednesday, April 22 at 4:30 PM" (UTC, no TZ suffix on purpose). */
function formatDeadline(d: Date, lang: LangCode): string {
  const h24 = d.getUTCHours();
  const m = d.getUTCMinutes();
  const day = d.getUTCDate();
  const mo = d.getUTCMonth();
  const wd = d.getUTCDay();
  switch (lang) {
    case 'hu': {
      return `${HU_WEEKDAYS[wd]}, ${HU_MONTHS_LONG[mo]} ${day}. ${pad2(h24)}:${pad2(m)}`;
    }
    case 'de': {
      return `${DE_WEEKDAYS[wd]}, ${day}. ${DE_MONTHS[mo]} um ${pad2(h24)}:${pad2(m)} Uhr`;
    }
    case 'es': {
      return `${ES_WEEKDAYS[wd]}, ${day} de ${ES_MONTHS[mo]} a las ${pad2(h24)}:${pad2(m)}`;
    }
    case 'en':
    default: {
      const hour12 = ((h24 + 11) % 12) + 1;
      const ampm = h24 < 12 ? 'AM' : 'PM';
      return `${EN_WEEKDAYS[wd]}, ${EN_MONTHS[mo]} ${day} at ${hour12}:${pad2(m)} ${ampm}`;
    }
  }
}

function formatShortDate(d: Date, lang: LangCode): string {
  const day = d.getUTCDate();
  const mo = d.getUTCMonth();
  switch (lang) {
    case 'hu': return `${HU_MONTHS_LONG[mo]} ${day}.`;
    case 'de': return `${day}. ${DE_MONTHS[mo]}`;
    case 'es': return `${day} ${ES_MONTHS[mo]}`;
    case 'en':
    default:   return `${EN_MONTHS[mo]} ${day}`;
  }
}

// ─── Pitch-specific one-liner pain points ────────────────────────────
interface PitchCopy {
  en: string;  // the hook line ("your site doesn't have X…")
  hu: string;
  de: string;
  es: string;
}

const PITCH_HOOKS: Record<Pitch, PitchCopy> = {
  chatbot: {
    en: "I saw you opened my note about the 24/7 AI chatbot for your site.",
    hu: "Láttam, megnyitotta az üzenetemet a 24/7 AI chatbotról.",
    de: "Ich habe gesehen, dass Sie meine Nachricht zum 24/7-Chatbot geöffnet haben.",
    es: "Vi que abrió mi nota sobre el chatbot de IA 24/7 para su sitio.",
  },
  redesign: {
    en: "I saw you opened my note about the site redesign.",
    hu: "Láttam, megnyitotta az üzenetemet a weboldal redesign-ról.",
    de: "Ich habe gesehen, dass Sie meine Nachricht zum Website-Redesign geöffnet haben.",
    es: "Vi que abrió mi nota sobre el rediseño del sitio.",
  },
  lawyer: {
    en: "I saw you opened my note about the 24/7 AI chatbot + consult booking.",
    hu: "Láttam, megnyitotta az üzenetemet a 24/7 AI chatbotról és konzultáció-foglalásról.",
    de: "Ich habe gesehen, dass Sie meine Nachricht zum 24/7-Chatbot + Terminbuchung geöffnet haben.",
    es: "Vi que abrió mi nota sobre el chatbot de IA 24/7 y reserva de consultas.",
  },
  plumber: {
    en: "I saw you opened my note about the 24/7 booking + emergency chatbot.",
    hu: "Láttam, megnyitotta az üzenetemet a 24/7 foglalásról és vészhelyzet-chatbotról.",
    de: "Ich habe gesehen, dass Sie meine Nachricht zum 24/7-Notdienst-Chatbot geöffnet haben.",
    es: "Vi que abrió mi nota sobre el chatbot de emergencias + reservas 24/7.",
  },
  hvac: {
    en: "I saw you opened my note about the 24/7 AC-emergency chatbot + booking.",
    hu: "Láttam, megnyitotta az üzenetemet a 24/7 klíma-vészhelyzet chatbotról.",
    de: "Ich habe gesehen, dass Sie meine Nachricht zum 24/7-HLK-Notdienst-Chatbot geöffnet haben.",
    es: "Vi que abrió mi nota sobre el chatbot de emergencia HVAC + reservas.",
  },
};

// ─── Subject rotation ────────────────────────────────────────────────

export function pickSubject(idx: number, company: string, lang: LangCode, expiresAt: Date): string {
  const shortDate = formatShortDate(expiresAt, lang);
  const variants: Record<LangCode, Array<(c: string) => string>> = {
    en: [
      (c) => `One last thing for ${c}`,
      (c) => `${c} — 50% off, 72 hours only`,
      (c) => `Exclusive for ${c} (expires ${shortDate})`,
    ],
    hu: [
      (c) => `Egy utolsó dolog a(z) ${c} számára`,
      (c) => `${c} — 50% kedvezmény, csak 72 óráig`,
      (c) => `Exkluzív ajánlat a(z) ${c} számára (lejár: ${shortDate})`,
    ],
    de: [
      (c) => `Eine letzte Sache für ${c}`,
      (c) => `${c} — 50% Rabatt, nur 72 Stunden`,
      (c) => `Exklusiv für ${c} (läuft ab am ${shortDate})`,
    ],
    es: [
      (c) => `Una última cosa para ${c}`,
      (c) => `${c} — 50% de descuento, solo 72 horas`,
      (c) => `Exclusivo para ${c} (expira ${shortDate})`,
    ],
  };
  const pool = variants[lang] || variants.en;
  return pool[idx % pool.length](company);
}

// ─── Body ────────────────────────────────────────────────────────────

interface BodyArgs {
  company: string;
  lang: LangCode;
  pitch: Pitch;
  expiresAt: Date;
}

export function buildBody({ company, lang, pitch, expiresAt }: BodyArgs): string {
  const c = escHtml(company);
  const deadline = formatDeadline(expiresAt, lang);
  const landing = LANDING[pitch];
  const hook = PITCH_HOOKS[pitch][lang] || PITCH_HOOKS[pitch].en;
  const hookEsc = escHtml(hook);

  const shell = (inner: string) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">${inner}</div>`;

  switch (lang) {
    case 'hu': return shell(`
<p style="margin:0 0 14px 0">Tisztelt ${c},</p>
<p style="margin:0 0 14px 0">${hookEsc} De nem jött válasz — semmi baj, a cold email zavaró tud lenni.</p>
<p style="margin:0 0 14px 0">Egy utolsó dolog mielőtt lezárom az aktát: <strong>50% kedvezmény</strong> minden csomagra. Starter 700$ → <strong>350$</strong>. Pro 1300$ → 650$. Premium 1900$ → 950$. Első hónap ingyenes.</p>
<p style="margin:0 0 14px 0">Érvényes <strong>${deadline}</strong>-ig. Válasz <strong>I</strong> és ezen a héten megépítjük.</p>
<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="${landing}" style="color:#1B1B1F;text-decoration:underline">${landing.replace('https://','')}</a></p>
<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px"><strong>UI.</strong> ${deadline} után az árak visszaállnak és nem írok többet.</p>`);

    case 'de': return shell(`
<p style="margin:0 0 14px 0">Hallo ${c} Team,</p>
<p style="margin:0 0 14px 0">${hookEsc} Keine Antwort — kein Problem, Cold Mails sind nervig.</p>
<p style="margin:0 0 14px 0">Eine letzte Sache, bevor ich Ihre Akte schließe: <strong>50% Rabatt</strong> auf alle Pakete. Starter 700$ → <strong>350$</strong>. Pro 1300$ → 650$. Premium 1900$ → 950$. Erster Monat gratis.</p>
<p style="margin:0 0 14px 0">Gültig bis <strong>${deadline}</strong>. Antworten Sie <strong>J</strong> und wir bauen es diese Woche.</p>
<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="${landing}" style="color:#1B1B1F;text-decoration:underline">${landing.replace('https://','')}</a></p>
<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px"><strong>PS.</strong> Nach ${deadline} gelten wieder die normalen Preise und ich melde mich nicht mehr.</p>`);

    case 'es': return shell(`
<p style="margin:0 0 14px 0">Hola equipo de ${c},</p>
<p style="margin:0 0 14px 0">${hookEsc} No hubo respuesta — totalmente válido, el cold email es molesto.</p>
<p style="margin:0 0 14px 0">Una última cosa antes de cerrar su expediente: <strong>50% de descuento</strong> en todos los planes. Starter $700 → <strong>$350</strong>. Pro $1300 → $650. Premium $1900 → $950. Primer mes gratis.</p>
<p style="margin:0 0 14px 0">Válido hasta <strong>${deadline}</strong>. Responde <strong>S</strong> y lo construimos esta semana.</p>
<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="${landing}" style="color:#1B1B1F;text-decoration:underline">${landing.replace('https://','')}</a></p>
<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px"><strong>PD.</strong> Después de ${deadline} los precios vuelven a la normalidad y no volveré a escribir.</p>`);

    case 'en':
    default: return shell(`
<p style="margin:0 0 14px 0">Hey ${c},</p>
<p style="margin:0 0 14px 0">${hookEsc} No reply — totally fair, cold email is annoying.</p>
<p style="margin:0 0 14px 0">One last thing before I close your file: <strong>50% off</strong> every plan. Starter $700 → <strong>$350</strong>. Pro $1,300 → $650. Premium $1,900 → $950. First month free.</p>
<p style="margin:0 0 14px 0">Good through <strong>${deadline}</strong>. Reply <strong>Y</strong> and we build this week.</p>
<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="${landing}" style="color:#1B1B1F;text-decoration:underline">${landing.replace('https://','')}</a></p>
<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px"><strong>PS.</strong> After ${deadline} prices go back to normal and I won't email you again.</p>`);
  }
}
