/**
 * email-bodies-hvac.ts — Cold email for HVAC contractors (chatbot pitch).
 *
 * Rewritten 2026-04-21. Observation-led (urgency-triage angle),
 * social-proof-backed, no pricing / discount / urgency-timer gimmicks.
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
  (c: string) => `your AC inquiry flow`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c} team,</p>

<p style="margin:0 0 14px 0">Took a quick look — common issue across HVAC sites: the "request service" form is the same whether someone's asking a billing question or AC-down-in-heatwave. High-intent seasonal leads drown in the low-intent inquiries.</p>

<p style="margin:0 0 14px 0">Built a fix for an HVAC company last month — chatbot triages urgency (emergency vs routine vs quote) and books accordingly. Summer emergency bookings up 1.8x in month 1.</p>

<p style="margin:0 0 14px 0">60-sec demo: <a href="https://smartflowdev.com/hvac" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/hvac</a></p>

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

<p style="margin:0 0 14px 0">Átnéztem az oldalukat — általános probléma a klíma- és fűtésszerelő oldalakon: a "szerviz-kérés" űrlap ugyanaz számlázási kérdésre mint hőhullám-közbeni AC-hibára. A magas-intent szezonális lead-ek elvesznek a low-intent megkeresések közt.</p>

<p style="margin:0 0 14px 0">Múlt hónapban építettem egy megoldást — chatbot szétválogatja a sürgősséget (vész vs rutin vs árajánlat) és ennek megfelelően foglal. Nyári vész-foglalások 1.8×-re nőttek az első hónapban.</p>

<p style="margin:0 0 14px 0">60 mp-es bemutató: <a href="https://smartflowdev.com/hvac" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/hvac</a></p>

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

<p style="margin:0 0 14px 0">Habe Ihre Seite angeschaut — bei vielen HLK-Firmen ist das Service-Formular dasselbe, egal ob jemand eine Rechnungsfrage hat oder die Klima in der Hitzewelle ausfällt. High-Intent-Leads gehen zwischen Low-Intent-Anfragen unter.</p>

<p style="margin:0 0 14px 0">Letzten Monat eine Lösung gebaut — Chatbot triagiert Dringlichkeit (Notfall vs. Routine vs. Angebot) und bucht entsprechend. Sommer-Notfallbuchungen stiegen im ersten Monat um das 1,8-fache.</p>

<p style="margin:0 0 14px 0">60-Sek-Demo: <a href="https://smartflowdev.com/hvac" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/hvac</a></p>

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

<p style="margin:0 0 14px 0">Revisé su sitio — problema común en sitios HVAC: el formulario de "solicitar servicio" es el mismo ya sea para una consulta de facturación o aire acondicionado fallando en ola de calor. Los leads de alta intención se ahogan entre las consultas de baja intención.</p>

<p style="margin:0 0 14px 0">El mes pasado construí una solución — chatbot triagea urgencia (emergencia vs rutina vs presupuesto) y reserva según eso. Las reservas de emergencia de verano subieron 1,8× en el primer mes.</p>

<p style="margin:0 0 14px 0">Demo de 60 seg: <a href="https://smartflowdev.com/hvac" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/hvac</a></p>

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
