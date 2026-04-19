'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Lead, Industry, PoolCounts } from '@/lib/data';

interface Props {
  initialLeads: Lead[];
  counts: PoolCounts[];
}

const INDUSTRIES: Industry[] = ['dentist', 'lawyer', 'plumber', 'hvac'];

interface Filters {
  q: string;                      // free-text search
  industries: Set<Industry>;       // selected industries
  modernMin: number;               // 0-3
  modernMax: number;
  hasNoBooking: boolean;
  hasNoChatbot: boolean;           // by definition: every lead in pool has no chatbot, but UI affordance kept
  copyrightMaxYear: number | null; // null = any
  neverSent: boolean;
  sentNoReply: boolean;            // sent but no follow-up trigger has fired (proxy for "no response")
  domain: string;                  // exact domain match
  country: string;                 // 2-letter
}

const DEFAULT_FILTERS: Filters = {
  q: '',
  industries: new Set(INDUSTRIES),
  modernMin: 0,
  modernMax: 3,
  hasNoBooking: false,
  hasNoChatbot: false,
  copyrightMaxYear: null,
  neverSent: false,
  sentNoReply: false,
  domain: '',
  country: '',
};

type SortKey = 'name' | 'industry' | 'city' | 'country' | 'modernScore' | 'sentAt' | 'collectedAt';

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function tagClass(industry: Industry): string {
  switch (industry) {
    case 'dentist': return 'tag tagDentist';
    case 'lawyer':  return 'tag tagLawyer';
    case 'plumber': return 'tag tagPlumber';
    case 'hvac':    return 'tag tagHvac';
  }
}

interface EnrichmentState {
  loading: boolean;
  data?: {
    ok: boolean;
    techStack: string[];
    copyrightYear: number | null;
    pageWeightKb: number | null;
    ctaCount: number;
    formCount: number;
    mobileResponsive: boolean;
    hasSsl: boolean;
    error?: string;
  };
}

export default function LeadsExplorer({ initialLeads, counts }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('collectedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrichments, setEnrichments] = useState<Record<string, EnrichmentState>>({});

  const filtered = useMemo(() => {
    const q = filters.q.toLowerCase().trim();
    return leads.filter((l) => {
      if (!filters.industries.has(l.industry)) return false;
      if (l.modernScore < filters.modernMin || l.modernScore > filters.modernMax) return false;
      if (filters.hasNoBooking && l.hasBooking) return false;
      if (filters.neverSent && l.sentAt) return false;
      if (filters.sentNoReply && (!l.sentAt || l.followup1SentAt || l.followup2SentAt)) return false;
      if (filters.domain && !l.domain.includes(filters.domain.toLowerCase())) return false;
      if (filters.country && l.country.toLowerCase() !== filters.country.toLowerCase()) return false;
      if (q) {
        const hay = `${l.name} ${l.email} ${l.domain} ${l.city} ${l.country}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, filters]);

  const sorted = useMemo(() => {
    const a = [...filtered];
    a.sort((x, y) => {
      const va = (x as any)[sortKey] ?? '';
      const vb = (y as any)[sortKey] ?? '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return a;
  }, [filtered, sortKey, sortDir]);

  const selected = sorted.find((l) => l.id === selectedId) || null;

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const toggleIndustry = (i: Industry) => {
    setFilters((f) => {
      const s = new Set(f.industries);
      if (s.has(i)) s.delete(i); else s.add(i);
      return { ...f, industries: s };
    });
  };

  // Enrichment for the currently-selected lead
  useEffect(() => {
    if (!selected || !selected.website) return;
    if (enrichments[selected.id]?.data || enrichments[selected.id]?.loading) return;
    setEnrichments((m) => ({ ...m, [selected.id]: { loading: true } }));
    fetch(`/api/enrich?url=${encodeURIComponent(selected.website)}`)
      .then((r) => r.json())
      .then((data) => setEnrichments((m) => ({ ...m, [selected.id]: { loading: false, data } })))
      .catch((e) => setEnrichments((m) => ({ ...m, [selected.id]: { loading: false, data: { ok: false, error: String(e), techStack: [], copyrightYear: null, pageWeightKb: null, ctaCount: 0, formCount: 0, mobileResponsive: false, hasSsl: false } } })));
  }, [selected?.id, selected?.website]);

  const handleAction = async (action: 'move' | 'block', target?: Industry) => {
    if (!selected) return;
    const body = action === 'move'
      ? { action: 'move', email: selected.email, from: selected.industry, to: target }
      : { action: 'block', email: selected.email, industry: selected.industry };
    const res = await fetch('/api/lead-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.ok) {
      // Optimistically remove or re-tag in local state
      if (action === 'block') {
        setLeads((arr) => arr.filter((l) => l.id !== selected.id));
      } else if (action === 'move' && target) {
        setLeads((arr) => arr.map((l) => l.id === selected.id ? { ...l, industry: target, id: `${target}:${l.email}` } : l));
      }
      setSelectedId(null);
    } else {
      alert(`Action failed: ${data.error}`);
    }
  };

  return (
    <div className="layout">
      {/* ── Sidebar — pool counts + filters ───────────── */}
      <aside className="sidebar">
        <div className="section">
          <h3>Pools</h3>
          {counts.map((c) => (
            <div key={c.industry} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ textTransform: 'capitalize' }}>{c.industry}</strong>
                <span className="tiny">{c.poolSize} pool · {c.sentTotal} sent</span>
              </div>
              <div className="bar"><span style={{ width: `${Math.min(100, (c.sentTotal / Math.max(1, c.poolSize + c.sentTotal)) * 100)}%` }} /></div>
              <div className="tiny">F1: {c.followup1Sent} · F2: {c.followup2Sent}</div>
            </div>
          ))}
        </div>

        <div className="section">
          <h3>Industries</h3>
          {INDUSTRIES.map((i) => (
            <label key={i}>
              <input type="checkbox" checked={filters.industries.has(i)} onChange={() => toggleIndustry(i)} />
              <span style={{ textTransform: 'capitalize' }}>{i}</span>
            </label>
          ))}
        </div>

        <div className="section">
          <h3>Modern score</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" min={0} max={3} value={filters.modernMin} onChange={(e) => setFilters({ ...filters, modernMin: +e.target.value })} />
            <input type="number" min={0} max={3} value={filters.modernMax} onChange={(e) => setFilters({ ...filters, modernMax: +e.target.value })} />
          </div>
          <div className="tiny">0 = bad, 3 = modern</div>
        </div>

        <div className="section">
          <h3>Quality</h3>
          <label><input type="checkbox" checked={filters.hasNoBooking} onChange={(e) => setFilters({ ...filters, hasNoBooking: e.target.checked })} /> No booking system</label>
          <label><input type="checkbox" checked={filters.neverSent} onChange={(e) => setFilters({ ...filters, neverSent: e.target.checked })} /> Never emailed</label>
          <label><input type="checkbox" checked={filters.sentNoReply} onChange={(e) => setFilters({ ...filters, sentNoReply: e.target.checked })} /> Sent, no follow-up yet</label>
        </div>

        <div className="section">
          <h3>Targeting</h3>
          <label className="tiny">Country (2-letter)</label>
          <input type="text" placeholder="US, UK, AU…" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value.toUpperCase() })} />
          <label className="tiny" style={{ marginTop: 8 }}>Domain contains</label>
          <input type="text" placeholder="e.g. .co.uk" value={filters.domain} onChange={(e) => setFilters({ ...filters, domain: e.target.value })} />
        </div>

        <div className="section">
          <button onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</button>
        </div>
      </aside>

      {/* ── Main — toolbar + table ─────────────────── */}
      <div className="main">
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search name / email / domain / city…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
          <span className="muted">{sorted.length} of {leads.length} leads</span>
          <span className="spacer" />
          <span className="tiny">Sort: <strong>{sortKey}</strong> {sortDir}</span>
        </div>

        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th onClick={() => onSort('name')} style={{ cursor: 'pointer' }}>Business</th>
                <th onClick={() => onSort('industry')} style={{ cursor: 'pointer' }}>Industry</th>
                <th onClick={() => onSort('city')} style={{ cursor: 'pointer' }}>City</th>
                <th onClick={() => onSort('country')} style={{ cursor: 'pointer' }}>Country</th>
                <th>Email</th>
                <th onClick={() => onSort('modernScore')} style={{ cursor: 'pointer' }}>Modern</th>
                <th>Booking?</th>
                <th onClick={() => onSort('sentAt')} style={{ cursor: 'pointer' }}>Sent</th>
                <th>F1</th>
                <th>F2</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 1000).map((l) => (
                <tr
                  key={l.id}
                  className={l.id === selectedId ? 'selected' : ''}
                  onClick={() => setSelectedId(l.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div>{l.name}</div>
                    <div className="tiny">{l.domain}</div>
                  </td>
                  <td><span className={tagClass(l.industry)}>{l.industry}</span></td>
                  <td>{l.city || '—'}</td>
                  <td>{l.country || '—'}</td>
                  <td className="tiny" style={{ wordBreak: 'break-all' }}>{l.email}</td>
                  <td>
                    <span className={`scoreCell ${l.modernScore >= 2 ? '' : ''}`}>
                      <span className={`tag ${l.modernScore >= 2 ? 'good' : l.modernScore === 1 ? 'warn' : 'bad'}`}>{l.modernScore}/3</span>
                    </span>
                  </td>
                  <td>{l.hasBooking ? <span className="tag warn">yes</span> : <span className="tag good">no</span>}</td>
                  <td className="tiny">{fmtDate(l.sentAt)}</td>
                  <td className="tiny">{fmtDate(l.followup1SentAt)}</td>
                  <td className="tiny">{fmtDate(l.followup2SentAt)}</td>
                </tr>
              ))}
              {sorted.length > 1000 && (
                <tr>
                  <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: 18 }}>
                    Showing first 1000 — narrow filters to see the rest.
                  </td>
                </tr>
              )}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    No leads match. Adjust filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────── */}
      <aside className="detail">
        {!selected && <div className="muted">Select a lead to inspect.</div>}
        {selected && (
          <>
            <div className="section">
              <div className="h1">{selected.name}</div>
              <div className="tiny">{selected.domain}</div>
              {selected.website && <div style={{ marginTop: 6 }}><a href={selected.website} target="_blank" rel="noreferrer">Open website ↗</a></div>}
            </div>

            <div className="section">
              <h3>Lead</h3>
              <dl className="kvList">
                <dt>Industry</dt><dd><span className={tagClass(selected.industry)}>{selected.industry}</span></dd>
                <dt>Email</dt><dd>{selected.email}</dd>
                <dt>Phone</dt><dd>{selected.phone || '—'}</dd>
                <dt>City</dt><dd>{selected.city || '—'}</dd>
                <dt>Country</dt><dd>{selected.country || '—'}</dd>
                <dt>Modern score</dt><dd>{selected.modernScore}/3</dd>
                <dt>Has booking</dt><dd>{selected.hasBooking ? 'yes' : 'no'}</dd>
                <dt>Email source</dt><dd>{selected.extractedFrom || '—'}</dd>
                <dt>Collected</dt><dd>{fmtDate(selected.collectedAt)}</dd>
                <dt>Sent</dt><dd>{fmtDate(selected.sentAt)}</dd>
                <dt>Subject</dt><dd>{selected.subject || '—'}</dd>
                <dt>Follow-up 1</dt><dd>{fmtDate(selected.followup1SentAt)}</dd>
                <dt>Follow-up 2</dt><dd>{fmtDate(selected.followup2SentAt)}</dd>
              </dl>
            </div>

            <div className="section">
              <h3>Live website signals</h3>
              {(() => {
                const e = enrichments[selected.id];
                if (!selected.website) return <div className="muted">No website on record.</div>;
                if (!e || e.loading) return <div className="muted">Fetching…</div>;
                if (!e.data?.ok) return <div className="muted">Fetch failed: {e.data?.error}</div>;
                return (
                  <dl className="kvList">
                    <dt>SSL</dt><dd>{e.data.hasSsl ? <span className="tag good">https</span> : <span className="tag bad">http</span>}</dd>
                    <dt>Mobile</dt><dd>{e.data.mobileResponsive ? <span className="tag good">viewport</span> : <span className="tag bad">no viewport</span>}</dd>
                    <dt>Tech stack</dt><dd>{e.data.techStack.length === 0 ? '—' : e.data.techStack.join(', ')}</dd>
                    <dt>Copyright</dt><dd>{e.data.copyrightYear ?? '—'}</dd>
                    <dt>Page weight</dt><dd>{e.data.pageWeightKb} KB</dd>
                    <dt>CTA verbs</dt><dd>{e.data.ctaCount}</dd>
                    <dt>Forms</dt><dd>{e.data.formCount}</dd>
                  </dl>
                );
              })()}
            </div>

            <div className="section">
              <h3>Actions</h3>
              <div className="actions">
                {INDUSTRIES.filter((i) => i !== selected.industry).map((i) => (
                  <button key={i} onClick={() => handleAction('move', i)}>Move to {i}</button>
                ))}
                <button onClick={() => handleAction('block')} title="Removes lead from active pool, archives it in do-not-contact.json">Block (do-not-contact)</button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
