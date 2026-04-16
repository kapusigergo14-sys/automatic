/**
 * email-bodies.ts — Per-language subject + body templates for v5 dental
 *
 * Each language has 3 subject variants (rotation) and one body template
 * keyed by company name. Body uses inline styles + image preview link.
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
  (c: string) => `Quick chatbot idea for ${c}`,
  (c: string) => `${c} — missing chatbot?`,
  (c: string) => `Noticed something about ${c}'s site`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.6;font-size:15px">
<p style="margin:0 0 14px 0">Hi ${c} team,</p>

<p style="margin:0 0 14px 0">Geri here &mdash; I build AI chatbots for dental practices.</p>

<p style="margin:0 0 14px 0">Your site actually looks solid, but there's no chatbot yet &mdash; which is probably costing you a few patients a month in after-hours inquiries.</p>

<p style="margin:0 0 14px 0">I can install a branded one on your site in <strong>48 hours</strong>, everything included. Reply and I'll send over a short proposal with pricing and examples.</p>

<p style="margin:0 0 14px 0">If it's interesting, just reply. If not, no worries &mdash; delete this and I'll stop reaching out.</p>

<p style="margin:0 0 18px 0">Cheers,<br><strong>Geri</strong> &middot; <a href="https://smartflowdev.com" style="color:#6366F1;text-decoration:none">smartflowdev.com</a> &middot; <a href="https://smartflowdev.com/chatbot" style="color:#6366F1;text-decoration:none">See how the chatbot works</a></p>
</div>`;
};

// ─── Hungarian ───────────────────────────────────────────

const HU_SUBJECTS = [
  (c: string) => `Chatbot ötlet a(z) ${c} weboldalához`,
  (c: string) => `${c} — hiányzó chatbot?`,
  (c: string) => `Észrevétel a(z) ${c} oldaláról`,
];

const HU_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Tisztelt ${c} csapat,</p>

<p style="margin:0 0 14px 0">Geri vagyok &mdash; magyar fejlesztő, mesterséges intelligenciával működő chatbotokat építek fogorvosi praxisok weboldalaira.</p>

<p style="margin:0 0 14px 0">A(z) ${c} weboldala jól néz ki, de észrevettem, hogy nincs még chatbot rajta &mdash; ami pedig segíthetne elkapni az esti és hétvégi érdeklődőket, akik amúgy elvesznek mire visszahívják őket.</p>

<p style="margin:0 0 14px 0">Egy márkára szabott chatbotot <strong>48 óra alatt</strong> tudok telepíteni az oldalukra. Mindent tartalmaz, magyar nyelven. Csatoltam egy rövid összefoglalót PDF-ben.</p>

<p style="margin:0 0 14px 0">Ha érdekes, írjon vissza erre az emailre. Ha nem aktuális, semmi gond &mdash; nyugodtan törölje.</p>

<p style="margin:0 0 18px 0">Üdvözlettel,<br><strong>Geri</strong> &middot; <a href="https://smartflowdev.com" style="color:#6366F1;text-decoration:none">smartflowdev.com</a></p>

<p style="margin:0">
  <a href="https://smartflowdev.com" style="display:block;text-decoration:none">
    <img src="https://www.smartflowdev.com/chatbot-preview.png" alt="AI Chatbot Ajánlat — smartflowdev" width="420" style="display:block;width:100%;max-width:420px;height:auto;border-radius:10px;border:1px solid #e4e4e7" />
  </a>
</p>
</div>`;
};

// ─── German (placeholder, can extend later) ──────────────

const DE_SUBJECTS = [
  (c: string) => `Chatbot-Idee für ${c}`,
  (c: string) => `${c} — fehlender Chatbot?`,
  (c: string) => `Etwas zur Website von ${c}`,
];

const DE_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.6;font-size:15px">
<p>Hallo ${c} Team,</p>
<p>Geri hier — ich baue KI-Chatbots für Zahnarztpraxen.</p>
<p>Ihre Website sieht solide aus, aber es gibt noch keinen Chatbot — was wahrscheinlich pro Monat ein paar Patienten kostet, die nach Feierabend anfragen.</p>
<p>Ich kann einen markenspezifischen Chatbot in <strong>48 Stunden</strong> installieren. Kurze Übersicht als PDF anbei.</p>
<p>Bei Interesse einfach antworten. Falls nicht, kein Problem.</p>
<p>Beste Grüße,<br><strong>Geri</strong> · <a href="https://smartflowdev.com" style="color:#6366F1;text-decoration:none">smartflowdev.com</a></p>
</div>`;
};

// ─── Spanish (placeholder) ───────────────────────────────

const ES_SUBJECTS = [
  (c: string) => `Idea de chatbot para ${c}`,
  (c: string) => `${c} — ¿chatbot faltante?`,
  (c: string) => `Algo sobre el sitio de ${c}`,
];

const ES_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.6;font-size:15px">
<p>Hola equipo de ${c},</p>
<p>Soy Geri — construyo chatbots de IA para clínicas dentales.</p>
<p>Su sitio se ve bien, pero todavía no tiene chatbot — lo cual probablemente está costándoles algunos pacientes al mes que consultan fuera del horario.</p>
<p>Puedo instalar uno personalizado en <strong>48 horas</strong>. Resumen adjunto en PDF.</p>
<p>Si les interesa, respondan a este email. Si no, no se preocupen.</p>
<p>Saludos,<br><strong>Geri</strong> · <a href="https://smartflowdev.com" style="color:#6366F1;text-decoration:none">smartflowdev.com</a></p>
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
