/**
 * email-bodies-lawyer.ts — Per-language subject + body templates for lawyer chatbot pitch
 *
 * Each language has 3 subject variants (rotation) and one body template
 * keyed by company name. Body uses inline styles.
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
  (c: string) => `Noticed something about ${c}'s site`,
  (c: string) => `${c} — what happens when a client visits your site at 11pm?`,
  (c: string) => `Honest question about ${c}'s website`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c},</p>

<p style="margin:0 0 14px 0">Quick one: I checked your site and you don't have a chatbot yet. That means every potential client who visits after 5pm &mdash; and there are more than you'd think &mdash; hits a wall. No way to ask about your practice areas, consultation fees, or availability. They bounce, Google the next firm, and you never know they existed.</p>

<p style="margin:0 0 14px 0">I build AI chatbots specifically for law firms. It answers client questions 24/7, schedules consultations through conversation, and sounds like your front desk &mdash; not a robot.</p>

<p style="margin:0 0 14px 0">Live on your site in <strong>5 days</strong>. Flat pricing, no monthly surprises.</p>

<p style="margin:0 0 14px 0">Want to see how it works? Reply <strong>&ldquo;show me&rdquo;</strong> and I'll send a 2-minute demo.</p>

<p style="margin:0 0 18px 0">&mdash; Geri<br><a href="https://smartflowdev.com" style="color:#6366F1;text-decoration:none">smartflowdev.com</a> &middot; <a href="https://smartflowdev.com/chatbot" style="color:#6366F1;text-decoration:none">See how the chatbot works</a></p>

<p style="margin:0 0 6px 0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13.5px;line-height:1.6"><strong style="color:#6366F1">PS.</strong> The chatbot pays for itself after 2-3 new consultations it catches after hours. Most firms see that within the first month.</p>
</div>`;
};

// ─── Hungarian (placeholder) ────────────────────────────

const HU_SUBJECTS = [
  (c: string) => `Chatbot ötlet a(z) ${c} weboldalához`,
  (c: string) => `${c} — hiányzó chatbot?`,
  (c: string) => `Észrevétel a(z) ${c} oldaláról`,
];

const HU_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Tisztelt ${c},</p>

<p style="margin:0 0 14px 0">Geri vagyok &mdash; magyar fejlesztő, mesterséges intelligenciával működő chatbotokat építek ügyvédi irodák weboldalaira.</p>

<p style="margin:0 0 14px 0">A(z) ${c} weboldala jól néz ki, de észrevettem, hogy nincs még chatbot rajta &mdash; ami pedig segíthetne elkapni az esti és hétvégi érdeklődőket, akik amúgy elvesznek mire visszahívják őket.</p>

<p style="margin:0 0 14px 0">Egy márkára szabott chatbotot <strong>5 nap alatt</strong> tudok telepíteni az oldalukra. Fix ár, nincsenek meglepetések.</p>

<p style="margin:0 0 14px 0">Ha érdekes, írjon vissza erre az emailre. Ha nem aktuális, semmi gond.</p>

<p style="margin:0 0 18px 0">Üdvözlettel,<br><strong>Geri</strong> &middot; <a href="https://smartflowdev.com" style="color:#6366F1;text-decoration:none">smartflowdev.com</a></p>
</div>`;
};

// ─── German (placeholder) ───────────────────────────────

const DE_SUBJECTS = [
  (c: string) => `Chatbot-Idee für ${c}`,
  (c: string) => `${c} — fehlender Chatbot?`,
  (c: string) => `Etwas zur Website von ${c}`,
];

const DE_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.6;font-size:15px">
<p>Hallo ${c} Team,</p>
<p>Geri hier — ich baue KI-Chatbots für Anwaltskanzleien.</p>
<p>Ihre Website sieht solide aus, aber es gibt noch keinen Chatbot — was wahrscheinlich pro Monat ein paar Mandanten kostet, die nach Feierabend anfragen.</p>
<p>Ich kann einen markenspezifischen Chatbot in <strong>5 Tagen</strong> installieren. Feste Preise, keine Überraschungen.</p>
<p>Bei Interesse einfach antworten. Falls nicht, kein Problem.</p>
<p>Beste Grüße,<br><strong>Geri</strong> · <a href="https://smartflowdev.com" style="color:#6366F1;text-decoration:none">smartflowdev.com</a></p>
</div>`;
};

// ─── Spanish (placeholder) ──────────────────────────────

const ES_SUBJECTS = [
  (c: string) => `Idea de chatbot para ${c}`,
  (c: string) => `${c} — ¿chatbot faltante?`,
  (c: string) => `Algo sobre el sitio de ${c}`,
];

const ES_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.6;font-size:15px">
<p>Hola equipo de ${c},</p>
<p>Soy Geri — construyo chatbots de IA para bufetes de abogados.</p>
<p>Su sitio se ve bien, pero todavía no tiene chatbot — lo cual probablemente está costándoles algunos clientes al mes que consultan fuera del horario.</p>
<p>Puedo instalar uno personalizado en <strong>5 días</strong>. Precio fijo, sin sorpresas.</p>
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
