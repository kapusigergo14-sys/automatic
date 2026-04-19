/**
 * email-bodies-plumber.ts — Per-language subject + body templates for plumber chatbot pitch
 *
 * Short-form ("reply Y/N" + time-limited offer) — designed to lift reply rate
 * over the previous 5-paragraph version. Bump OFFER_DEADLINE every 7-10 days.
 */

import type { LangCode } from './markets';

export interface EmailBody {
  subjects: Array<(company: string) => string>;
  body: (company: string) => string;
}

const OFFER_DEADLINE = 'April 25';

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── English ─────────────────────────────────────────────

const EN_SUBJECTS = [
  (c: string) => `Noticed something about ${c}'s site`,
  (c: string) => `${c} — what happens when someone calls at 2am with a leak?`,
  (c: string) => `Quick one for ${c}`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c},</p>

<p style="margin:0 0 14px 0">Quick one — your site doesn't have a way for someone with a midnight leak to book a tech without calling. We build that in 5 days. $700 setup, $49/mo.</p>

<p style="margin:0 0 14px 0">Worth a 10-min call this week? Reply <strong>Y</strong> or <strong>N</strong>.</p>

<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="https://smartflowdev.com/plumber" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/plumber</a></p>

<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px;line-height:1.6"><strong style="color:#1B1B1F">PS.</strong> If you reply by ${OFFER_DEADLINE}, setup is $500 and the first month is free.</p>
</div>`;
};

// ─── Hungarian (placeholder) ────────────────────────────

const HU_SUBJECTS = [
  (c: string) => `Chatbot ötlet a(z) ${c} weboldalához`,
  (c: string) => `${c} — éjszakai vízszerelő hívások?`,
  (c: string) => `Gyors kérdés: ${c}`,
];

const HU_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Tisztelt ${c},</p>
<p style="margin:0 0 14px 0">Gyors kérdés — az oldalukon nincs mód arra, hogy egy éjszakai csőtörést szenvedett ügyfél időpontot foglaljon hívás nélkül. 5 nap alatt megépítjük. 700$ setup, 49$/hó.</p>
<p style="margin:0 0 14px 0">Megér egy 10 perces hívást? Válasz: <strong>I</strong> vagy <strong>N</strong>.</p>
<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="https://smartflowdev.com/plumber" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/plumber</a></p>
<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px"><strong>UI.</strong> Ha ${OFFER_DEADLINE}-ig válaszol, a setup 500$ és az első hónap ingyenes.</p>
</div>`;
};

// ─── German (placeholder) ───────────────────────────────

const DE_SUBJECTS = [
  (c: string) => `Chatbot-Idee für ${c}`,
  (c: string) => `${c} — Wer bucht den Notdienst um 2 Uhr morgens?`,
  (c: string) => `Kurze Frage zu ${c}`,
];

const DE_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p>Hallo ${c} Team,</p>
<p>Kurz: Auf Ihrer Website kann niemand mit nächtlichem Wasserschaden einen Techniker buchen, ohne anzurufen. Wir bauen das in 5 Tagen. 700$ Setup, 49$/Monat.</p>
<p>Lust auf 10 Minuten diese Woche? Antworten Sie <strong>J</strong> oder <strong>N</strong>.</p>
<p>&mdash; Geri · <a href="https://smartflowdev.com/plumber" style="color:#1B1B1F">smartflowdev.com/plumber</a></p>
<p style="color:#6b7280;font-size:13.5px"><strong>PS.</strong> Antwort bis ${OFFER_DEADLINE}: Setup 500$, erster Monat gratis.</p>
</div>`;
};

// ─── Spanish (placeholder) ──────────────────────────────

const ES_SUBJECTS = [
  (c: string) => `Idea de chatbot para ${c}`,
  (c: string) => `${c} — ¿quién reserva fugas a las 2am?`,
  (c: string) => `Pregunta rápida para ${c}`,
];

const ES_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p>Hola equipo de ${c},</p>
<p>Rápido: su sitio no permite que alguien con una fuga nocturna reserve sin llamar. Lo construimos en 5 días. $700 setup, $49/mes.</p>
<p>¿Vale 10 minutos esta semana? Responde <strong>S</strong> o <strong>N</strong>.</p>
<p>&mdash; Geri · <a href="https://smartflowdev.com/plumber" style="color:#1B1B1F">smartflowdev.com/plumber</a></p>
<p style="color:#6b7280;font-size:13.5px"><strong>PD.</strong> Respuesta antes del ${OFFER_DEADLINE}: setup $500, primer mes gratis.</p>
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
