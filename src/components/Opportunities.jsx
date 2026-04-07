import { useState, useEffect } from 'react';
import { API_BASE } from '../utils.js';

// ─── Helpers ────────────────────────────────────────────────
function fmt(n) {
  if (!n || n === 0) return null;
  if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + Math.round(n/1e3) + 'K';
  return '$' + Math.round(n).toLocaleString();
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return d;
}

function deadlineLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return null;
  if (d < 0) return { text: 'Closed', color: '#aaa' };
  if (d === 0) return { text: 'Due today', color: '#c0392b' };
  if (d <= 7)  return { text: `${d}d left`, color: '#c0392b' };
  if (d <= 14) return { text: `${d}d left`, color: '#e67e22' };
  if (d <= 30) return { text: `${d}d left`, color: '#BA7517' };
  return { text: new Date(dateStr).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), color: '#666' };
}

const CAT_COLORS = {
  housing:  { bg:'#E6F1FB', color:'#0C447C' },
  infra:    { bg:'#EAF3DE', color:'#27500A' },
  transit:  { bg:'#EEEDFE', color:'#3C3489' },
  climate:  { bg:'#E1F5EE', color:'#085041' },
  safety:   { bg:'#FAECE7', color:'#712B13' },
  other:    { bg:'#f0f0ee', color:'#5F5E5A' },
};

const CAT_LABELS = { housing:'Housing', infra:'Infrastructure', transit:'Transit', climate:'Climate', safety:'Safety', other:'Other' };
const SOURCE_LABELS = { federal:'Federal', state:'CA State', 'federal-passthrough':'Federal pass-through' };
const SOURCE_COLORS = {
  federal:              { bg:'#E6F1FB', color:'#0C447C' },
  state:                { bg:'#FAEEDA', color:'#633806' },
  'federal-passthrough':{ bg:'#EEEDFE', color:'#3C3489' },
};

// ─── Score bar ───────────────────────────────────────────────
function ScoreBar({ score }) {
  const color = score >= 70 ? '#1D9E75' : score >= 45 ? '#BA7517' : '#aaa';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, height:4, background:'#eee', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:color, borderRadius:2 }} />
      </div>
      <span style={{ fontSize:11, fontWeight:500, color, minWidth:28 }}>{score}</span>
    </div>
  );
}

// ─── Grant card ──────────────────────────────────────────────
function GrantCard({ grant, showScore }) {
  const [open, setOpen] = useState(false);
  const dl = deadlineLabel(grant.deadline);
  const catStyle = CAT_COLORS[grant.category] || CAT_COLORS.other;
  const srcStyle = SOURCE_COLORS[grant.source] || SOURCE_COLORS.federal;
  const awardRange = grant.awardMin || grant.awardMax
    ? [fmt(grant.awardMin), fmt(grant.awardMax)].filter(Boolean).join(' – ')
    : null;

  return (
    <div style={{ border:'0.5px solid #e0e0e0', borderRadius:10, padding:'1rem 1.25rem', background:'#fff', marginBottom:8 }}>
      {/* Header row */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:500, lineHeight:1.4, marginBottom:4 }}>{grant.title}</div>
          <div style={{ fontSize:12, color:'#666' }}>{grant.agency}</div>
        </div>
        {dl && (
          <div style={{ fontSize:12, fontWeight:500, color:dl.color, whiteSpace:'nowrap', paddingTop:2 }}>
            {dl.text}
          </div>
        )}
      </div>

      {/* Badges row */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4, fontWeight:500, background:catStyle.bg, color:catStyle.color }}>
          {CAT_LABELS[grant.category]||'Other'}
        </span>
        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4, fontWeight:500, background:srcStyle.bg, color:srcStyle.color }}>
          {SOURCE_LABELS[grant.source]||grant.source}
        </span>
        {grant.status === 'forecasted' && (
          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4, fontWeight:500, background:'#f5f5f3', color:'#888', border:'0.5px solid #ddd' }}>
            Forecasted
          </span>
        )}
        {grant.matchRequired && (
          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4, fontWeight:500, background:'#FEF9E7', color:'#9B7709', border:'0.5px solid #F0D060' }}>
            ⚠ Match required
          </span>
        )}
        {grant.scoreBreakdown?.peer_history > 0 && (
          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4, fontWeight:500, background:'#E8F8F0', color:'#0B6B3A', border:'0.5px solid #9ED4B8' }}>
            ✓ Peers have won this
          </span>
        )}
      </div>

      {/* Amount + score row */}
      <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom: open ? 12 : 0 }}>
        {awardRange && (
          <div style={{ fontSize:12, color:'#444' }}>
            <span style={{ color:'#aaa' }}>Award: </span>{awardRange}
          </div>
        )}
        {grant.fundingTotal > 0 && (
          <div style={{ fontSize:12, color:'#444' }}>
            <span style={{ color:'#aaa' }}>Total pool: </span>{fmt(grant.fundingTotal)}
          </div>
        )}
        {showScore && (
          <div style={{ flex:1, maxWidth:120, marginLeft:'auto' }}>
            <ScoreBar score={grant.relevanceScore} />
          </div>
        )}
      </div>

      {/* Expandable detail */}
      {open && (
        <div style={{ marginTop:8, paddingTop:12, borderTop:'0.5px solid #eee' }}>
          {grant.description && (
            <p style={{ fontSize:12, color:'#555', lineHeight:1.6, marginBottom:12 }}>
              {grant.description.length > 400 ? grant.description.substring(0,400)+'…' : grant.description}
            </p>
          )}
          {showScore && grant.scoreBreakdown && (
            <div style={{ fontSize:11, color:'#888', marginBottom:12 }}>
              <div style={{ fontWeight:500, marginBottom:4 }}>Score breakdown</div>
              {Object.entries(grant.scoreBreakdown).map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', maxWidth:280 }}>
                  <span>{k.replace(/_/g,' ')}</span><span>{v} pts</span>
                </div>
              ))}
            </div>
          )}
          {grant.deadline && (
            <div style={{ fontSize:12, color:'#666', marginBottom:8 }}>
              <span style={{ color:'#aaa' }}>Deadline: </span>
              {new Date(grant.deadline).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
            </div>
          )}
          {grant.eligibilityText && (
            <div style={{ fontSize:12, color:'#666', marginBottom:8 }}>
              <span style={{ color:'#aaa' }}>Eligible applicants: </span>{grant.eligibilityText}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display:'flex', gap:12, marginTop:8, alignItems:'center' }}>
        <button onClick={()=>setOpen(o=>!o)} style={{ fontSize:12, color:'#666', background:'none', border:'none', padding:0, cursor:'pointer' }}>
          {open ? 'Show less ↑' : 'Show more ↓'}
        </button>
        <a href={grant.url} target="_blank" rel="noreferrer"
           style={{ fontSize:12, color:'#185FA5', textDecoration:'none', marginLeft:'auto' }}>
          Apply / details ↗
        </a>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────
export default function Opportunities({ city = 'san-bruno' }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState('Loading available grants...');
  const [sortBy, setSortBy]     = useState('relevance'); // 'relevance' | 'deadline'
  const [filterCat, setFilterCat] = useState('');
  const [filterSrc, setFilterSrc] = useState('');
  const [showPartnership, setShowPartnership] = useState(false);
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/opportunities?city=${city}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setStatus(`Found ${d.summary?.directEligible||0} eligible grants · ${d.summary?.closingIn30Days||0} closing within 30 days`);
        setLoading(false);
      })
      .catch(e => { setStatus('Error: ' + e.message); setLoading(false); });
  }, [city]);

  const grants = showPartnership ? (data?.partnership||[]) : (data?.direct||[]);

  const filtered = grants.filter(g =>
    (!filterCat || g.category === filterCat) &&
    (!filterSrc || g.source === filterSrc || (filterSrc === 'state' && g.source === 'state') ||
      (filterSrc === 'federal' && (g.source === 'federal' || g.source === 'federal-passthrough')))
  );

  const sorted = [...filtered].sort((a,b) => {
    if (sortBy === 'deadline') {
      if (!a.deadline && !b.deadline) return b.relevanceScore - a.relevanceScore;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    }
    return b.relevanceScore - a.relevanceScore;
  });

  const dotColor = loading ? '#BA7517' : '#1D9E75';
  const s = data?.summary || {};

  return (
    <div style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color:'#1a1a1a' }}>

      {/* Header */}
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontSize:22, fontWeight:600, marginBottom:4 }}>Open grant opportunities — {data?.city||'San Bruno'}</h1>
        <p style={{ fontSize:13, color:'#666' }}>Federal & CA state grants eligible for city governments · Sorted by relevance to {data?.city||'San Bruno'}</p>
      </div>

      {/* Status */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', background:'#f0f0ee', borderRadius:8, fontSize:12, color:'#666', marginBottom:'1.25rem' }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:dotColor, display:'inline-block' }} />
        {status}
      </div>

      {/* Summary cards */}
      {data && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:'1.5rem' }}>
          {[
            { label:'Direct eligible',    value: s.directEligible||0,     sub:'city can apply solo' },
            { label:'Partnership grants', value: s.partnership||0,         sub:'need co-applicant' },
            { label:'Closing in 30 days', value: s.closingIn30Days||0,     sub:'act now' },
            { label:'Total funding pool', value: s.totalAvailableFunding ? (s.totalAvailableFunding>=1e9 ? '$'+(s.totalAvailableFunding/1e9).toFixed(1)+'B' : '$'+(s.totalAvailableFunding/1e6).toFixed(0)+'M') : '—', sub:'across all open grants' },
          ].map(c => (
            <div key={c.label} style={{ background:'#f0f0ee', borderRadius:8, padding:'0.9rem 1rem' }}>
              <div style={{ fontSize:11, color:'#888', marginBottom:5 }}>{c.label}</div>
              <div style={{ fontSize:22, fontWeight:500 }}>{c.value}</div>
              <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Source breakdown */}
      {data && (
        <div style={{ display:'flex', gap:8, marginBottom:'1rem', fontSize:12, color:'#666' }}>
          <span style={{ background:'#E6F1FB', color:'#0C447C', padding:'3px 10px', borderRadius:20, fontWeight:500 }}>
            {s.federal||0} Federal
          </span>
          <span style={{ background:'#FAEEDA', color:'#633806', padding:'3px 10px', borderRadius:20, fontWeight:500 }}>
            {s.state||0} CA State
          </span>
          <span style={{ background:'#EEEDFE', color:'#3C3489', padding:'3px 10px', borderRadius:20, fontWeight:500 }}>
            {s.passthrough||0} Pass-through
          </span>
        </div>
      )}

      {/* Controls */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:'1rem' }}>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={sel}>
          <option value="relevance">Sort: Relevance</option>
          <option value="deadline">Sort: Deadline</option>
        </select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={sel}>
          <option value="">All categories</option>
          {Object.entries(CAT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterSrc} onChange={e=>setFilterSrc(e.target.value)} style={sel}>
          <option value="">All sources</option>
          <option value="federal">Federal</option>
          <option value="state">CA State</option>
        </select>
        <button onClick={()=>setShowPartnership(p=>!p)} style={{ ...sel, background: showPartnership?'#E6F1FB':'#fff', color: showPartnership?'#0C447C':'#1a1a1a' }}>
          {showPartnership ? 'Showing: Partnership grants' : 'Showing: Direct eligible'}
        </button>
        <button onClick={()=>setShowScore(s=>!s)} style={{ ...sel, marginLeft:'auto' }}>
          {showScore ? 'Hide scores' : 'Show scores'}
        </button>
        <span style={{ fontSize:12, color:'#aaa' }}>{sorted.length} grants</span>
      </div>

      {/* Grant list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'#aaa', fontSize:13 }}>
          Loading grants from Grants.gov and CA Grants Portal...
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'#aaa', fontSize:13 }}>
          No grants match this filter.
        </div>
      ) : (
        sorted.map(g => <GrantCard key={g.id} grant={g} showScore={showScore} />)
      )}

      {/* Assumptions footer */}
      <div style={{ marginTop:'2rem', padding:'1rem 1.25rem', background:'#f8f8f6', borderRadius:8, fontSize:11, color:'#aaa', lineHeight:1.7 }}>
        <strong style={{ color:'#888' }}>Data notes:</strong> Eligibility is assessed programmatically and may not capture all edge cases.
        Grants requiring match funding are flagged but not excluded. Partnership grants require a county or regional co-applicant.
        Federal pass-through grants are state-administered but federally funded. Relevance scoring uses equal category weights —
        adjust after confirming {data?.city||'San Bruno'} CIP priorities. Data refreshes on each page load.
      </div>
    </div>
  );
}

const sel = { fontSize:12, padding:'5px 9px', border:'0.5px solid #ccc', borderRadius:8, background:'#fff', color:'#1a1a1a', cursor:'pointer' };
