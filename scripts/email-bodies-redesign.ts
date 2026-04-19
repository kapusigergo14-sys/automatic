/**
 * email-bodies-redesign.ts — Per-language subject + body templates for the
 * website REDESIGN pitch (outdated dental sites).
 *
 * Short-form (free design concept hook + reply Y/N CTA). Replaces the
 * 5-paragraph version after 0 replies. Bump OFFER_DEADLINE every 7-10 days.
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
  (c: string) => `Honest take on ${c}'s website`,
  (c: string) => `${c} — free redesign concept?`,
  (c: string) => `Quick one for ${c}`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c},</p>

<p style="margin:0 0 14px 0">Pulled up your site on my phone this morning — slow load, no HTTPS, dated. The kind of stuff that costs new patients in the first 50ms.</p>

<p style="margin:0 0 14px 0">I'll build you a <strong>free design concept</strong> with your real practice name and brand colors — no obligation, no sales call. Yours to keep either way. Reply <strong>Y</strong> if you want one.</p>

<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="https://smartflowdev.com/proposal" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/proposal</a></p>

<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px;line-height:1.6"><strong style="color:#1B1B1F">PS.</strong> If you reply by ${OFFER_DEADLINE}, the full redesign starts at $500 (normally $700) and the first month of hosting/chatbot is free.</p>
</div>`;
};

// ─── Hungarian (placeholder) ──

const HU_SUBJECTS = [
  (c: string) => `Weboldal frissítés ötlet — ${c}`,
  (c: string) => `${c} — ingyenes design koncepció?`,
  (c: string) => `Gyors kérdés: ${c}`,
];

const HU_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Tisztelt ${c} csapat,</p>
<p style="margin:0 0 14px 0">Megnéztem az oldalukat mobilon — lassú betöltés, nincs HTTPS, elavult dizájn. Ezeken bukik az új páciens már az első 50 ms-ben.</p>
<p style="margin:0 0 14px 0"><strong>Ingyen készítek egy design koncepciót</strong> a praxis valódi nevével és márkaszíneivel — nincs kötöttség. Válasz <strong>I</strong> ha kell egy.</p>
<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="https://smartflowdev.com/proposal" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/proposal</a></p>
<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px"><strong>UI.</strong> Ha ${OFFER_DEADLINE}-ig válaszol, a teljes redesign 500$-ról indul (normál ár 700$).</p>
</div>`;
};

// ─── German (placeholder) ───────

const DE_SUBJECTS = [
  (c: string) => `Kurze Notiz zur Website von ${c}`,
  (c: string) => `${c} — kostenloses Design-Konzept?`,
  (c: string) => `Kurze Frage zu ${c}`,
];

const DE_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p>Hallo ${c} Team,</p>
<p>Ihre Site auf dem Handy: langsam, kein HTTPS, veraltet. Das kostet Patienten in den ersten 50ms.</p>
<p>Ich baue Ihnen <strong>kostenlos ein Design-Konzept</strong> — mit echtem Praxisnamen und Markenfarben. Antworten Sie <strong>J</strong>, wenn Sie eines möchten.</p>
<p>&mdash; Geri · <a href="https://smartflowdev.com/proposal" style="color:#1B1B1F">smartflowdev.com/proposal</a></p>
<p style="color:#6b7280;font-size:13.5px"><strong>PS.</strong> Antwort bis ${OFFER_DEADLINE}: Redesign ab 500$ (statt 700$).</p>
</div>`;
};

// ─── Spanish (placeholder) ──────

const ES_SUBJECTS = [
  (c: string) => `Nota rápida sobre el sitio de ${c}`,
  (c: string) => `${c} — ¿concepto de diseño gratis?`,
  (c: string) => `Pregunta rápida para ${c}`,
];

const ES_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p>Hola equipo de ${c},</p>
<p>Vi su sitio en móvil: carga lenta, sin HTTPS, anticuado. Eso cuesta pacientes en los primeros 50ms.</p>
<p>Les construyo <strong>un concepto de diseño gratis</strong>, con su nombre real y colores de marca. Responde <strong>S</strong> si quieren uno.</p>
<p>&mdash; Geri · <a href="https://smartflowdev.com/proposal" style="color:#1B1B1F">smartflowdev.com/proposal</a></p>
<p style="color:#6b7280;font-size:13.5px"><strong>PD.</strong> Respuesta antes del ${OFFER_DEADLINE}: rediseño desde $500 (normal $700).</p>
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
