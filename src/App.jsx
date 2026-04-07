import { useState, useEffect, useMemo } from 'react';
import { fetchGrants, fmtMoney, CAT_LABELS } from './utils.js';
import YearChart from './components/YearChart.jsx';

const CAT_COLORS = {
  housing:  { bg: '#E6F1FB', color: '#0C447C' },
  infra:    { bg: '#EAF3DE', color: '#27500A' },
  transit:  { bg: '#EEEDFE', color: '#3C3489' },
  climate:  { bg: '#E1F5EE', color: '#085041' },
  safety:   { bg: '#FAECE7', color: '#712B13' },
  other:    { bg: '#f0f0ee', color: '#5F5E5A' },
};

const PAGE_SIZE = 20;

function Badge({ cat }) {
  const s = CAT_COLORS[cat] || CAT_COLORS.other;
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, padding: '2px 8px',
      borderRadius: 4, fontWeight: 500, whiteSpace: 'nowrap',
      background: s.bg, color: s.color,
    }}>
      {CAT_LABELS[cat] || 'Other'}
    </span>
  );
}

function MetricCard({ label, value, sub }) {
  return (
    <div style={{ background: '#f0f0ee', borderRadius: 8, padding: '0.9rem 1rem' }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const [awards, setAwards]     = useState([]);
  const [status, setStatus]     = useState({ msg: 'Loading...', state: 'loading' });
  const [filterAg, setFilterAg] = useState('');
  const [filterYr, setFilterYr] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage]         = useState(1);

  useEffect(() => {
    fetchGrants({ city: 'San Bruno' })
      .then(data => {
        setAwards(data);
        setStatus({ msg: `Loaded ${data.length} federal grant awards · USAspending.gov`, state: 'ok' });
      })
      .catch(err => {
        setStatus({ msg: 'Error: ' + err.message, state: 'error' });
      });
  }, []);

  const agencies = useMemo(() => [...new Set(awards.map(a => a.agency).filter(Boolean))].sort(), [awards]);
  const years    = useMemo(() => [...new Set(awards.map(a => (a.start || '').substring(0, 4)).filter(Boolean))].sort().reverse(), [awards]);

  const filtered = useMemo(() => awards.filter(a =>
    (!filterAg  || a.agency === filterAg) &&
    (!filterYr  || (a.start || '').substring(0, 4) === filterYr) &&
    (!filterCat || a.cat === filterCat)
  ), [awards, filterAg, filterYr, filterCat]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalAwarded = awards.reduce((s, a) => s + a.amount, 0);
  const uniqueAgencies = new Set(awards.map(a => a.agency).filter(Boolean)).size;
  const biggest = awards.reduce((b, a) => (!b || a.amount > b.amount) ? a : b, null);

  function handleFilterChange(setter) {
    return e => { setter(e.target.value); setPage(1); };
  }

  const dotColor = { loading: '#BA7517', ok: '#1D9E75', error: '#E24B4A' }[status.state];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>San Bruno — Federal grant award history</h1>
        <p style={{ fontSize: 13, color: '#666' }}>Source: USAspending.gov &nbsp;·&nbsp; Grants &amp; financial assistance &nbsp;·&nbsp; Live data</p>
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#f0f0ee', borderRadius: 8, fontSize: 12, color: '#666', marginBottom: '1.25rem' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block' }} />
        {status.msg}
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: '1.5rem' }}>
        <MetricCard label="Total awarded"       value={fmtMoney(totalAwarded, true)} sub="all records" />
        <MetricCard label="Awards found"        value={awards.length.toLocaleString()} sub="grants & assistance" />
        <MetricCard label="Federal agencies"    value={uniqueAgencies} sub="unique grantors" />
        <MetricCard label="Largest single award" value={fmtMoney(biggest?.amount, true)} sub={(biggest?.agency || '').substring(0, 30)} />
      </div>

      {/* Year chart */}
      <YearChart awards={awards} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
        <select value={filterAg} onChange={handleFilterChange(setFilterAg)} style={selStyle}>
          <option value="">All agencies</option>
          {agencies.map(a => <option key={a} value={a}>{a.length > 45 ? a.substring(0, 45) + '…' : a}</option>)}
        </select>
        <select value={filterYr} onChange={handleFilterChange(setFilterYr)} style={selStyle}>
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterCat} onChange={handleFilterChange(setFilterCat)} style={selStyle}>
          <option value="">All categories</option>
          {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aaa' }}>{filtered.length} awards</span>
      </div>

      {/* Table */}
      <div style={{ border: '0.5px solid #ddd', borderRadius: 12, overflow: 'hidden', marginBottom: '0.75rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#f5f5f3' }}>
              <Th style={{ width: '13%' }}>Award ID</Th>
              <Th style={{ width: '26%' }}>Recipient</Th>
              <Th style={{ width: '21%' }}>Agency</Th>
              <Th style={{ width: '11%' }}>Category</Th>
              <Th style={{ width: '7%'  }}>Year</Th>
              <Th style={{ width: '13%', textAlign: 'right' }}>Amount</Th>
              <Th style={{ width: '9%',  textAlign: 'center' }}>Link</Th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: 13 }}>
                {status.state === 'loading' ? 'Loading…' : 'No awards match this filter.'}
              </td></tr>
            ) : pageData.map((a, i) => (
              <tr key={a.id + i} style={{ borderTop: '0.5px solid #eee' }}>
                <Td style={{ fontFamily: 'monospace', fontSize: 11 }} title={a.id}>{trunc(a.id, 14)}</Td>
                <Td title={a.recipient}>{trunc(a.recipient, 30)}</Td>
                <Td title={a.agency}>{trunc(a.agency, 26)}</Td>
                <Td><Badge cat={a.cat} /></Td>
                <Td>{(a.start || '—').substring(0, 4)}</Td>
                <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(a.amount)}</Td>
                <Td style={{ textAlign: 'center' }}>
                  {a.id ? <a href={`https://www.usaspending.gov/award/${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer" style={{ color: '#185FA5', fontSize: 12 }}>View ↗</a> : '—'}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnStyle}>← Prev</button>
        <span style={{ fontSize: 12, color: '#aaa' }}>Page {page} of {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btnStyle}>Next →</button>
      </div>

    </div>
  );
}

// Small style helpers
const selStyle = { fontSize: 12, padding: '5px 9px', border: '0.5px solid #ccc', borderRadius: 8, background: '#fff', color: '#1a1a1a', cursor: 'pointer' };
const btnStyle = { fontSize: 12, padding: '4px 12px', border: '0.5px solid #ccc', borderRadius: 8, background: '#fff', cursor: 'pointer' };
const thStyle  = { padding: '9px 10px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '0.5px solid #eee' };
const tdStyle  = { padding: '9px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' };

function Th({ children, style, ...props }) { return <th style={{ ...thStyle, ...style }} {...props}>{children}</th>; }
function Td({ children, style, title, ...props }) { return <td style={{ ...tdStyle, ...style }} title={title} {...props}>{children}</td>; }
function trunc(s, n) { return s && s.length > n ? s.substring(0, n) + '…' : (s || '—'); }
