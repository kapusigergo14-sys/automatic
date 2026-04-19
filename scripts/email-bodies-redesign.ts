/**
 * email-bodies-redesign.ts — Cold email for outdated dental sites (redesign pitch).
 *
 * Short-form 50%-off + 72h live timer on the landing. Message-matches
 * the offer shown on smartflowdev.com/redesign.
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
  (c: string) => `${c} — 50% off website redesign this week`,
  (c: string) => `Website redesign for ${c} — 50% off, 72 hours`,
  (c: string) => `Quick one for ${c} — site redesign 50% off right now`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c},</p>

<p style="margin:0 0 14px 0">Pulled up your site on my phone this morning — slow load, no HTTPS, dated. The kind of stuff that costs new patients in the first 50ms.</p>

<p style="margin:0 0 14px 0">This week only: <strong>50% off every redesign plan.</strong> Starter <s style="color:#999">$700</s> <strong style="color:#FF3D2E">$350</strong>. Pro <s style="color:#999">$1,300</s> <strong style="color:#FF3D2E">$650</strong>. Premium <s style="color:#999">$1,900</s> <strong style="color:#FF3D2E">$950</strong>. First month of hosting/chatbot free.</p>

<p style="margin:0 0 14px 0">Worth a 10-min call? Reply <strong>Y</strong> or <strong>N</strong>.</p>

<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="https://smartflowdev.com/redesign" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/redesign</a></p>

<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px;line-height:1.6"><strong style="color:#1B1B1F">PS.</strong> A live 72-hour timer runs on the landing page &mdash; once it expires, prices revert to normal.</p>
</div>`;
};

// ─── Hungarian (placeholder) ────────────────────────────

const HU_SUBJECTS = [
  (c: string) => `${c} — 50% off weboldal redesignra`,
  (c: string) => `Weboldal redesign a ${c}-nek — 50% off, 72 óra`,
  (c: string) => `Gyors kérdés: weboldal redesign 50% off (${c})`,
];

const HU_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Tisztelt ${c} csapat,</p>
<p style="margin:0 0 14px 0">Megnéztem az oldalukat mobilon — lassú betöltés, nincs HTTPS, elavult dizájn. Ezeken bukik az új páciens már az első 50 ms-ben.</p>
<p style="margin:0 0 14px 0">Ezen a héten: <strong>50% kedvezmény minden redesign csomagra.</strong> Starter <s style="color:#999">$700</s> <strong style="color:#FF3D2E">$350</strong>. Pro <s style="color:#999">$1,300</s> <strong style="color:#FF3D2E">$650</strong>. Premium <s style="color:#999">$1,900</s> <strong style="color:#FF3D2E">$950</strong>. Első hónap hosting/chatbot ingyen.</p>
<p style="margin:0 0 14px 0">Megér egy 10 perces hívást? Válasz: <strong>I</strong> vagy <strong>N</strong>.</p>
<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="https://smartflowdev.com/redesign" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/redesign</a></p>
<p style="margin:0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px"><strong>UI.</strong> Az oldalon élő 72 órás countdown fut — lejárat után normál árakra áll vissza.</p>
</div>`;
};

// ─── German (placeholder) ───────

const DE_SUBJECTS = [
  (c: string) => `${c} — 50% Rabatt auf Website-Redesign diese Woche`,
  (c: string) => `Website-Redesign für ${c} — 50% off, 72 Stunden`,
  (c: string) => `Kurze Frage zu ${c} — Redesign 50% Rabatt`,
];

const DE_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p>Hallo ${c} Team,</p>
<p>Ihre Site auf dem Handy: langsam, kein HTTPS, veraltet. Das kostet Patienten in den ersten 50ms.</p>
<p>Diese Woche: <strong>50% Rabatt auf jedes Redesign-Paket.</strong> Starter <s style="color:#999">$700</s> <strong style="color:#FF3D2E">$350</strong>. Pro <s style="color:#999">$1,300</s> <strong style="color:#FF3D2E">$650</strong>. Premium <s style="color:#999">$1,900</s> <strong style="color:#FF3D2E">$950</strong>. Erster Monat Hosting/Chatbot gratis.</p>
<p>Lust auf 10 Minuten? Antworten Sie <strong>J</strong> oder <strong>N</strong>.</p>
<p>&mdash; Geri · <a href="https://smartflowdev.com/redesign" style="color:#1B1B1F">smartflowdev.com/redesign</a></p>
<p style="color:#6b7280;font-size:13.5px"><strong>PS.</strong> Live-72-Stunden-Timer auf der Landingpage — nach Ablauf gelten wieder normale Preise.</p>
</div>`;
};

// ─── Spanish (placeholder) ──────

const ES_SUBJECTS = [
  (c: string) => `${c} — 50% de descuento en rediseño web`,
  (c: string) => `Rediseño web para ${c} — 50% off, 72 horas`,
  (c: string) => `Pregunta rápida para ${c} — rediseño 50% off`,
];

const ES_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p>Hola equipo de ${c},</p>
<p>Vi su sitio en móvil: carga lenta, sin HTTPS, anticuado. Eso cuesta pacientes en los primeros 50ms.</p>
<p>Esta semana: <strong>50% de descuento en todos los planes de rediseño.</strong> Starter <s style="color:#999">$700</s> <strong style="color:#FF3D2E">$350</strong>. Pro <s style="color:#999">$1,300</s> <strong style="color:#FF3D2E">$650</strong>. Premium <s style="color:#999">$1,900</s> <strong style="color:#FF3D2E">$950</strong>. Primer mes de hosting/chatbot gratis.</p>
<p>¿Vale 10 minutos? Responde <strong>S</strong> o <strong>N</strong>.</p>
<p>&mdash; Geri · <a href="https://smartflowdev.com/redesign" style="color:#1B1B1F">smartflowdev.com/redesign</a></p>
<p style="color:#6b7280;font-size:13.5px"><strong>PD.</strong> Temporizador en vivo de 72 horas en la página — después expira y los precios vuelven a la normalidad.</p>
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
