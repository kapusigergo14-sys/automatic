/**
 * email-bodies-lawyer.ts — Cold email for law firms (chatbot pitch).
 *
 * Rewritten 2026-04-21. Observation-led, social-proof-backed, no pricing
 * in email 1, no discount spam-triggers, small ask only.
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
  (c: string) => `question about ${c}`,
  (c: string) => `noticed something on ${c}'s site`,
  (c: string) => `re: ${c}`,
  (c: string) => `quick note about ${c}'s consult flow`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c} team,</p>

<p style="margin:0 0 14px 0">Took a quick look — common issue across law firm sites: the consultation request form asks for too many fields before anyone commits, and around 60% of personal-injury inquiries bounce at that friction.</p>

<p style="margin:0 0 14px 0">Built a fix for a PI firm last month — chatbot qualifies the case type in 3 questions and books a 15-min intake. Inbound consult requests up 2.3x in month 1.</p>

<p style="margin:0 0 14px 0">60-sec demo: <a href="https://smartflowdev.com/lawyer" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/lawyer</a></p>

<p style="margin:0 0 18px 0">If that sounds relevant, a 2-line reply is enough &mdash; "tell me more" or "not now".</p>

<p style="margin:0">&mdash; Geri</p>
</div>`;
};

// ─── Hungarian ───────────────────────────────────────────

const HU_SUBJECTS = [
  (c: string) => `kérdés a ${c} oldaláról`,
  (c: string) => `észrevétel a ${c} oldalán`,
  (c: string) => `re: ${c}`,
  (c: string) => `gyors megjegyzés a ${c} kapcsán`,
];

const HU_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Tisztelt ${c} csapat,</p>

<p style="margin:0 0 14px 0">Átnéztem az oldalukat — általános probléma az ügyvédi oldalakon: a konzultáció-kérő űrlap túl sok mezőt kér, mielőtt bárki elköteleződne, és a személyi sérüléses megkeresések kb. 60%-a itt bounce-ol.</p>

<p style="margin:0 0 14px 0">Múlt hónapban építettem egy megoldást egy PI-irodának — chatbot 3 kérdésben kvalifikálja az ügy-típust és 15 perces intake hívást foglal. Bejövő konzultáció-kérések 2.3×-ra nőttek az első hónapban.</p>

<p style="margin:0 0 14px 0">60 mp-es bemutató: <a href="https://smartflowdev.com/lawyer" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/lawyer</a></p>

<p style="margin:0 0 18px 0">Ha érdekes, egy 2 soros válasz elég &mdash; "mondj többet" vagy "most nem".</p>

<p style="margin:0">&mdash; Geri</p>
</div>`;
};

// ─── German ──────────────────────────────────────────────

const DE_SUBJECTS = [
  (c: string) => `Frage zu ${c}`,
  (c: string) => `kurze Notiz zu ${c}`,
  (c: string) => `re: ${c}`,
];

const DE_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hallo ${c} Team,</p>

<p style="margin:0 0 14px 0">Habe Ihre Seite angeschaut — bei vielen Kanzleien fragt das Beratungsformular zu viele Felder ab, bevor jemand sich festlegt, und etwa 60% der Personenschaden-Anfragen springen bei dieser Hürde ab.</p>

<p style="margin:0 0 14px 0">Letzten Monat eine Lösung gebaut — ein Chatbot qualifiziert den Fall-Typ in 3 Fragen und bucht ein 15-Min-Erstgespräch. Eingehende Anfragen sind im ersten Monat um das 2,3-fache gestiegen.</p>

<p style="margin:0 0 14px 0">60-Sek-Demo: <a href="https://smartflowdev.com/lawyer" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/lawyer</a></p>

<p style="margin:0 0 18px 0">Falls relevant, zwei Zeilen Antwort reichen &mdash; "erzähl mir mehr" oder "nicht jetzt".</p>

<p style="margin:0">&mdash; Geri</p>
</div>`;
};

// ─── Spanish ─────────────────────────────────────────────

const ES_SUBJECTS = [
  (c: string) => `pregunta sobre ${c}`,
  (c: string) => `re: ${c}`,
  (c: string) => `nota rápida sobre ${c}`,
];

const ES_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hola equipo de ${c},</p>

<p style="margin:0 0 14px 0">Revisé su sitio — problema común en despachos de abogados: el formulario de consulta pide demasiados campos antes de que alguien se comprometa, y alrededor del 60% de las consultas de lesiones personales rebotan en esa fricción.</p>

<p style="margin:0 0 14px 0">El mes pasado construí una solución para un despacho PI — un chatbot cualifica el tipo de caso en 3 preguntas y reserva una consulta de 15 min. Las consultas entrantes subieron 2,3× en el primer mes.</p>

<p style="margin:0 0 14px 0">Demo de 60 seg: <a href="https://smartflowdev.com/lawyer" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/lawyer</a></p>

<p style="margin:0 0 18px 0">Si suena relevante, dos líneas de respuesta bastan &mdash; "cuéntame más" o "ahora no".</p>

<p style="margin:0">&mdash; Geri</p>
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
