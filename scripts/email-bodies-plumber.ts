/**
 * email-bodies-plumber.ts — Cold email for plumbing services (chatbot pitch).
 *
 * Rewritten 2026-04-21. Observation-led (sticky-emergency-number angle),
 * social-proof-backed, no pricing / discount / urgency gimmicks.
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
  (c: string) => `your emergency number on mobile`,
];

const EN_BODY = (companyRaw: string): string => {
  const c = escHtml(companyRaw);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#2b2b2b;line-height:1.65;font-size:15px">
<p style="margin:0 0 14px 0">Hey ${c} team,</p>

<p style="margin:0 0 14px 0">Saw your site — common issue across plumber sites: the emergency number isn't sticky on mobile scroll, so 2am leak calls bounce before finding it.</p>

<p style="margin:0 0 14px 0">Built a fix for a plumber last month — sticky emergency-call button + chatbot that captures address + leak type for after-hours. Callback requests doubled in month 1.</p>

<p style="margin:0 0 14px 0">60-sec demo: <a href="https://smartflowdev.com/plumber" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/plumber</a></p>

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

<p style="margin:0 0 14px 0">Átnéztem az oldalukat — általános probléma a víz-gázszerelő oldalakon: a vészhívó szám nem sticky mobilon görgetéskor, így a hajnal 2-es csőtörés hívások bounce-olnak mielőtt megtalálnák.</p>

<p style="margin:0 0 14px 0">Múlt hónapban építettem egy megoldást — sticky vészhívó gomb + chatbot ami rögzíti a címet és a hiba típusát munkaidőn kívül. Visszahívási kérések megduplázódtak az első hónapban.</p>

<p style="margin:0 0 14px 0">60 mp-es bemutató: <a href="https://smartflowdev.com/plumber" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/plumber</a></p>

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

<p style="margin:0 0 14px 0">Habe Ihre Seite angeschaut — bei vielen Klempnerei-Seiten ist die Notfallnummer auf Mobil nicht sticky, daher springen 2-Uhr-Notanrufe ab, bevor sie sie finden.</p>

<p style="margin:0 0 14px 0">Letzten Monat eine Lösung gebaut — sticky Notfall-Knopf + Chatbot, der Adresse und Schaden-Typ für nach Feierabend erfasst. Rückruf-Anfragen haben sich im ersten Monat verdoppelt.</p>

<p style="margin:0 0 14px 0">60-Sek-Demo: <a href="https://smartflowdev.com/plumber" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/plumber</a></p>

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

<p style="margin:0 0 14px 0">Revisé su sitio — problema común en sitios de fontanería: el número de emergencia no es sticky al hacer scroll en móvil, así que las llamadas por fugas a las 2am rebotan antes de encontrarlo.</p>

<p style="margin:0 0 14px 0">El mes pasado construí una solución — botón de emergencia sticky + chatbot que captura dirección y tipo de fuga fuera de horario. Las solicitudes de callback se duplicaron en el primer mes.</p>

<p style="margin:0 0 14px 0">Demo de 60 seg: <a href="https://smartflowdev.com/plumber" style="color:#1B1B1F;text-decoration:underline">smartflowdev.com/plumber</a></p>

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
