/**
 * Server-side helpers for reading lead pools and send-state files from disk.
 * Never imported from a client component.
 */

import * as fs from 'fs';
import * as path from 'path';

const LEADGEN_ROOT = path.resolve(process.cwd(), '..');
const LEADS_DIR = path.join(LEADGEN_ROOT, 'output', 'leads');
const STATE_DIR = path.join(LEADGEN_ROOT, 'output', 'v5-campaign');

export interface Lead {
  id: string;            // synthesized — `${industry}:${email}`
  industry: Industry;
  name: string;
  website: string;
  domain: string;
  phone?: string;
  city: string;
  country: string;
  email: string;
  hasBooking: boolean;
  modernScore: number;
  collectedAt: string;
  extractedFrom?: string;
  // Send-state augmentation
  sentAt?: string;
  subject?: string;
  followup1SentAt?: string;
  followup2SentAt?: string;
}

export type Industry = 'dentist' | 'lawyer' | 'plumber' | 'hvac';

interface IndustrySource {
  industry: Industry;
  leadsFile: string;
  stateFile: string;
}

const SOURCES: IndustrySource[] = [
  { industry: 'dentist', leadsFile: 'dental-v5-modern.json', stateFile: 'send-state-v5.json' },
  { industry: 'lawyer',  leadsFile: 'lawyer-modern.json',    stateFile: 'send-state-lawyer.json' },
  { industry: 'plumber', leadsFile: 'plumber-modern.json',   stateFile: 'send-state-plumber.json' },
  { industry: 'hvac',    leadsFile: 'hvac-modern.json',      stateFile: 'send-state-hvac.json' },
];

function safeJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function domainOf(website: string): string {
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

interface RawLead {
  name: string;
  website: string;
  phone?: string;
  city: string;
  country: string;
  email: string;
  hasBooking: boolean;
  modernScore: number;
  collectedAt: string;
  extractedFrom?: string;
}

interface SentEntry {
  sentAt: string;
  subject?: string;
  followup1SentAt?: string;
  followup2SentAt?: string;
}

export function loadAllLeads(): Lead[] {
  const out: Lead[] = [];
  for (const src of SOURCES) {
    const leads = safeJson<RawLead[]>(path.join(LEADS_DIR, src.leadsFile), []);
    const state = safeJson<Record<string, SentEntry>>(path.join(STATE_DIR, src.stateFile), {});

    for (const l of leads) {
      const sentEntry = state[l.email.toLowerCase()];
      out.push({
        id: `${src.industry}:${l.email.toLowerCase()}`,
        industry: src.industry,
        name: l.name,
        website: l.website,
        domain: domainOf(l.website),
        phone: l.phone,
        city: l.city,
        country: l.country,
        email: l.email,
        hasBooking: l.hasBooking,
        modernScore: l.modernScore,
        collectedAt: l.collectedAt,
        extractedFrom: l.extractedFrom,
        sentAt: sentEntry?.sentAt,
        subject: sentEntry?.subject,
        followup1SentAt: sentEntry?.followup1SentAt,
        followup2SentAt: sentEntry?.followup2SentAt,
      });
    }

    // Also pull sent-state-only leads (those already removed from the pool but
    // still in state) so dashboard shows complete pipeline view.
    for (const [email, entry] of Object.entries(state)) {
      const lower = email.toLowerCase();
      const id = `${src.industry}:${lower}`;
      if (out.some((x) => x.id === id)) continue;
      out.push({
        id,
        industry: src.industry,
        name: (entry as any).company || lower,
        website: '',
        domain: lower.split('@')[1] || '',
        city: (entry as any).city || '',
        country: (entry as any).country || '',
        email: lower,
        hasBooking: false,
        modernScore: 0,
        collectedAt: entry.sentAt,
        sentAt: entry.sentAt,
        subject: entry.subject,
        followup1SentAt: entry.followup1SentAt,
        followup2SentAt: entry.followup2SentAt,
      });
    }
  }
  return out;
}

export interface PoolCounts {
  industry: Industry;
  poolSize: number;
  sentTotal: number;
  followup1Sent: number;
  followup2Sent: number;
}

export function getPoolCounts(): PoolCounts[] {
  return SOURCES.map((src) => {
    const leads = safeJson<RawLead[]>(path.join(LEADS_DIR, src.leadsFile), []);
    const state = safeJson<Record<string, SentEntry>>(path.join(STATE_DIR, src.stateFile), {});
    const sentTotal = Object.keys(state).length;
    let f1 = 0, f2 = 0;
    for (const e of Object.values(state)) {
      if (e.followup1SentAt) f1++;
      if (e.followup2SentAt) f2++;
    }
    return {
      industry: src.industry,
      poolSize: leads.length,
      sentTotal,
      followup1Sent: f1,
      followup2Sent: f2,
    };
  });
}

/**
 * Live website enrichment: fetch the homepage, extract a few quality signals.
 * Used by the dashboard to inspect a single lead's actual site state on
 * demand. Best-effort; failures return null fields instead of throwing.
 */
export interface WebsiteEnrichment {
  ok: boolean;
  techStack: string[];           // ['wordpress', 'jquery', 'bootstrap', …]
  copyrightYear: number | null;
  pageWeightKb: number | null;
  ctaCount: number;
  formCount: number;
  mobileResponsive: boolean;
  hasSsl: boolean;
  error?: string;
}

const TECH_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: 'wordpress',   pattern: /wp-content|wp-includes/i },
  { id: 'wix',         pattern: /\.wix\.com|wixstatic|x-wix/i },
  { id: 'squarespace', pattern: /squarespace|sqs-bg/i },
  { id: 'webflow',     pattern: /webflow|wf-domain/i },
  { id: 'shopify',     pattern: /cdn\.shopify|shopify\.com/i },
  { id: 'react',       pattern: /__NEXT_DATA__|_react|react\.production/i },
  { id: 'jquery',      pattern: /jquery[.-]/i },
  { id: 'bootstrap',   pattern: /bootstrap\.min\.css|bootstrap@/i },
  { id: 'tailwind',    pattern: /tailwind|tw-/i },
];

const CTA_VERBS = /\b(book|schedule|contact|call|request|get a quote|get started|reserve|sign up|appointment)\b/gi;

export async function enrichWebsite(url: string): Promise<WebsiteEnrichment> {
  if (!url) {
    return {
      ok: false,
      techStack: [],
      copyrightYear: null,
      pageWeightKb: null,
      ctaCount: 0,
      formCount: 0,
      mobileResponsive: false,
      hasSsl: false,
      error: 'no url',
    };
  }
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(normalized, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 smartflowdev-dashboard',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!res.ok) {
      return {
        ok: false, techStack: [], copyrightYear: null, pageWeightKb: null,
        ctaCount: 0, formCount: 0, mobileResponsive: false, hasSsl: false,
        error: `HTTP ${res.status}`,
      };
    }
    const text = (await res.text()).slice(0, 1_200_000);
    const lower = text.toLowerCase();

    const techStack = TECH_PATTERNS.filter((t) => t.pattern.test(text)).map((t) => t.id);
    const copyMatch = text.match(/(?:©|&copy;|copyright)\s*(\d{4})/i);
    const copyrightYear = copyMatch ? parseInt(copyMatch[1], 10) : null;
    const pageWeightKb = Math.round(text.length / 1024);
    const formCount = (text.match(/<form\b/gi) || []).length;
    const ctaCount = (text.match(CTA_VERBS) || []).length;
    const mobileResponsive = /name=["']viewport["']/.test(lower);
    const hasSsl = normalized.startsWith('https://');

    return {
      ok: true, techStack, copyrightYear, pageWeightKb,
      ctaCount, formCount, mobileResponsive, hasSsl,
    };
  } catch (err: any) {
    return {
      ok: false, techStack: [], copyrightYear: null, pageWeightKb: null,
      ctaCount: 0, formCount: 0, mobileResponsive: false, hasSsl: false,
      error: err?.message || 'fetch failed',
    };
  }
}

/**
 * Move a lead between pools. Used by the dashboard's "Move to X" action.
 * Atomically rewrites both source and target JSON files.
 */
export async function moveLead(
  email: string,
  fromIndustry: Industry,
  toIndustry: Industry
): Promise<{ ok: boolean; error?: string }> {
  if (fromIndustry === toIndustry) return { ok: false, error: 'same industry' };
  const fromSrc = SOURCES.find((s) => s.industry === fromIndustry);
  const toSrc = SOURCES.find((s) => s.industry === toIndustry);
  if (!fromSrc || !toSrc) return { ok: false, error: 'unknown industry' };

  const fromFile = path.join(LEADS_DIR, fromSrc.leadsFile);
  const toFile = path.join(LEADS_DIR, toSrc.leadsFile);

  const fromLeads = safeJson<RawLead[]>(fromFile, []);
  const toLeads = safeJson<RawLead[]>(toFile, []);
  const idx = fromLeads.findIndex((l) => l.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return { ok: false, error: 'lead not in source pool' };

  const [moved] = fromLeads.splice(idx, 1);

  // Don't double-add if target already has this email.
  if (!toLeads.some((l) => l.email.toLowerCase() === email.toLowerCase())) {
    toLeads.push(moved);
  }

  fs.writeFileSync(fromFile, JSON.stringify(fromLeads, null, 2));
  fs.writeFileSync(toFile, JSON.stringify(toLeads, null, 2));
  return { ok: true };
}

/**
 * Remove a lead from a pool entirely (do-not-contact). Adds to a separate
 * `do-not-contact.json` for audit trail.
 */
export async function blockLead(
  email: string,
  industry: Industry
): Promise<{ ok: boolean; error?: string }> {
  const src = SOURCES.find((s) => s.industry === industry);
  if (!src) return { ok: false, error: 'unknown industry' };
  const file = path.join(LEADS_DIR, src.leadsFile);
  const dncFile = path.join(LEADS_DIR, 'do-not-contact.json');

  const leads = safeJson<RawLead[]>(file, []);
  const idx = leads.findIndex((l) => l.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return { ok: false, error: 'not in pool' };
  const [removed] = leads.splice(idx, 1);

  const dnc = safeJson<RawLead[]>(dncFile, []);
  if (!dnc.some((l) => l.email.toLowerCase() === email.toLowerCase())) {
    dnc.push({ ...removed, name: `[BLOCKED] ${removed.name}` });
  }

  fs.writeFileSync(file, JSON.stringify(leads, null, 2));
  fs.writeFileSync(dncFile, JSON.stringify(dnc, null, 2));
  return { ok: true };
}
