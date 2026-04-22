/**
 * email-bodies.ts — Cold email for dental practices (chatbot pitch).
 *
 * Rewritten 2026-04-21 after 0 replies on 1,415 sends with previous copy.
 * New angle: observation-led + social-proof + small ask. No discount words,
 * no urgency timers, no "reply Y/N" gimmicks, no pricing in email 1.
 *
 * Subject strategy: reply-style ("re:", "question about") → higher open +
 * less spam-filtering. No "50% off" / "72 hours" spam triggers.
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
  (c: string) => `quick note about ${c}`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c} team,</p>

<p style="margin:0 0 14px 0">Saw your site — common issue across dental sites: the appointment request form sits too far down on mobile, and late-night toothache searches (70%+ mobile) bounce before finding it.</p>

<p style="margin:0 0 14px 0">Built a fix for a similar practice last month — chatbot on the homepage handles "do you take my insurance" and books straight into their calendar. After-hours bookings went from 0 to 14 in month 1.</p>

<p style="margin:0 0 14px 0">60-sec demo: <a href="https://smartflowdev.com/chatbot" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/chatbot</a></p>

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

<p style="margin:0 0 14px 0">Átnéztem az oldalukat — általános probléma a fogorvosi rendelők oldalain: az időpontkérő űrlap túl lent van mobilon, és a 23 órai fogfájás-keresések (70%+ mobil) bounce-olnak mielőtt megtalálnák.</p>

<p style="margin:0 0 14px 0">Múlt hónapban építettem egy megoldást hasonló rendelőnek — chatbot a kezdőlapon kezeli a "befogadják-e a biztosításom" kérdést, és közvetlenül a naptárba foglal. Éjszakai/hétvégi foglalásaik 0-ról 14-re nőttek az első hónapban.</p>

<p style="margin:0 0 14px 0">60 mp-es bemutató: <a href="https://smartflowdev.com/chatbot" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/chatbot</a></p>

<p style="margin:0 0 18px 0">Ha érdekes, egy 2 soros válasz elég &mdash; "mondj többet" vagy "most nem".</p>

<p style="margin:0">&mdash; Geri</p>
</div>`;
};

// ─── German ──────────────────────────────────────────────

const DE_SUBJECTS = [
  (c: string) => `Frage zu ${c}`,
  (c: string) => `kurze Notiz zu ${c}`,
  (c: string) => `re: ${c}`,
  (c: string) => `habe etwas auf der ${c}-Seite bemerkt`,
];

const DE_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hallo ${c} Team,</p>

<p style="margin:0 0 14px 0">Habe Ihre Seite kurz angeschaut — bei vielen Zahnarztpraxen sitzt das Terminanfrage-Formular zu weit unten auf Mobil, und 23-Uhr-Zahnschmerzen-Suchen (70%+ Mobil) springen ab, bevor sie es finden.</p>

<p style="margin:0 0 14px 0">Letzten Monat eine Lösung für eine ähnliche Praxis gebaut — ein Chatbot auf der Startseite beantwortet "Nehmen Sie meine Versicherung?" und bucht direkt in den Kalender. Nach-Dienst-Buchungen stiegen von 0 auf 14 im ersten Monat.</p>

<p style="margin:0 0 14px 0">60-Sek-Demo: <a href="https://smartflowdev.com/chatbot" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/chatbot</a></p>

<p style="margin:0 0 18px 0">Falls relevant, zwei Zeilen Antwort reichen &mdash; "erzähl mir mehr" oder "nicht jetzt".</p>

<p style="margin:0">&mdash; Geri</p>
</div>`;
};

// ─── Spanish ─────────────────────────────────────────────

const ES_SUBJECTS = [
  (c: string) => `pregunta sobre ${c}`,
  (c: string) => `re: ${c}`,
  (c: string) => `nota rápida sobre ${c}`,
  (c: string) => `vi algo en el sitio de ${c}`,
];

const ES_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hola equipo de ${c},</p>

<p style="margin:0 0 14px 0">Revisé su sitio — problema común en clínicas dentales: el formulario de cita está demasiado abajo en móvil, y las búsquedas de dolor de muelas a las 11pm (70%+ móvil) rebotan antes de encontrarlo.</p>

<p style="margin:0 0 14px 0">El mes pasado construí una solución para una clínica similar — un chatbot en la página principal maneja "¿aceptan mi seguro?" y reserva directamente en su calendario. Las reservas fuera de horario pasaron de 0 a 14 en el primer mes.</p>

<p style="margin:0 0 14px 0">Demo de 60 seg: <a href="https://smartflowdev.com/chatbot" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/chatbot</a></p>

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
