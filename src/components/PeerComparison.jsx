import { useState, useEffect, useRef } from 'react';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { API_BASE, fmtMoney } from '../utils.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const CAT_COLORS = { housing:'#185FA5', infra:'#3a7d44', transit:'#6b4fa0', climate:'#1D9E75', safety:'#c0392b', other:'#888' };
const CAT_LABELS = { housing:'Housing', infra:'Infrastructure', transit:'Transit', climate:'Climate', safety:'Safety', other:'Other' };

function fmt(n) {
  if (!n) return '$0';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + Math.round(n/1e3) + 'K';
  return '$' + Math.round(n);
}

export default function PeerComparison() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Loading all San Mateo County cities...');
  const [sortBy, setSortBy] = useState('total');
  const [view, setView] = useState('bar'); // 'bar' | 'table'
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    setStatus('Fetching grant data for all 20 San Mateo County cities...');
    fetch(`${API_BASE}/api/peer-grants`)
      .then(r => r.json())
      .then(d => {
        setData(d.results || []);
        setStatus(`Loaded grant data for ${d.results?.length || 0} cities · USAspending.gov`);
        setLoading(false);
      })
      .catch(e => {
        setStatus('Error: ' + e.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!data.length || view !== 'bar') return;
    const sorted = [...data].sort((a,b) => b[sortBy === 'total' ? 'total' : 'count'] - a[sortBy === 'total' ? 'total' : 'count']);
    const labels = sorted.map(d => d.city);
    const isSB = labels.map(l => l === 'San Bruno');

    if (chartInstance.current) chartInstance.current.destroy();
    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: sorted.map(d => sortBy === 'total' ? d.total : d.count),
          backgroundColor: isSB.map(sb => sb ? '#3266ad' : '#b0bfd8'),
          borderRadius: 3,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + (sortBy === 'total' ? fmt(ctx.raw) : ctx.raw + ' awards') } }
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font:{size:11}, color:'#888', callback: v => sortBy === 'total' ? fmt(v) : v }, border:{display:false} },
          y: { grid: { display:false }, ticks: { font:{size:11}, color: labels.map(l => l==='San Bruno'?'#3266ad':'#555') }, border:{display:false} }
        }
      }
    });
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [data, sortBy, view]);

  const sorted = [...data].sort((a,b) => b.total - a.total);
  const sbData = data.find(d => d.city === 'San Bruno');
  const sbRank = sorted.findIndex(d => d.city === 'San Bruno') + 1;
  const totalAll = data.reduce((s,d) => s + d.total, 0);
  const sbShare = totalAll ? ((sbData?.total || 0) / totalAll * 100).toFixed(1) : 0;

  const dotColor = loading ? '#BA7517' : '#1D9E75';

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: '#1a1a1a' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>San Mateo County — Federal grant comparison</h1>
        <p style={{ fontSize: 13, color: '#666' }}>All 20 incorporated cities · Source: USAspending.gov · Grants 2010–2025</p>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', background:'#f0f0ee', borderRadius:8, fontSize:12, color:'#666', marginBottom:'1.25rem' }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:dotColor, display:'inline-block' }} />
        {status}
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:'1.5rem' }}>
        {[
          { label: 'San Bruno total', value: fmt(sbData?.total), sub: '2010–2025' },
          { label: 'County rank', value: sbRank ? `#${sbRank} of ${data.length}` : '—', sub: 'by total awarded' },
          { label: 'San Bruno awards', value: sbData?.count || '—', sub: 'grant records' },
          { label: 'County share', value: sbShare + '%', sub: 'of all city grants' },
        ].map(c => (
          <div key={c.label} style={{ background:'#f0f0ee', borderRadius:8, padding:'0.9rem 1rem' }}>
            <div style={{ fontSize:11, color:'#888', marginBottom:5 }}>{c.label}</div>
            <div style={{ fontSize:22, fontWeight:500 }}>{c.value}</div>
            <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:8, marginBottom:'0.75rem', alignItems:'center' }}>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={sel}>
          <option value="total">Sort by total awarded</option>
          <option value="count">Sort by award count</option>
        </select>
        <button onClick={()=>setView(v=>v==='bar'?'table':'bar')} style={btn}>
          {view === 'bar' ? 'Table view' : 'Chart view'}
        </button>
      </div>

      {view === 'bar' ? (
        <div style={{ position:'relative', height: Math.max(400, data.length * 28) + 'px', marginBottom:'1.5rem' }}>
          <canvas ref={chartRef} />
        </div>
      ) : (
        <div style={{ border:'0.5px solid #ddd', borderRadius:12, overflow:'hidden', marginBottom:'1.5rem' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' }}>
            <thead>
              <tr style={{ background:'#f5f5f3' }}>
                {['Rank','City','Total awarded','Awards','Housing','Infrastructure','Transit','Climate','Safety'].map(h => (
                  <th key={h} style={{ padding:'9px 10px', textAlign: h==='City'?'left':'right', fontWeight:500, fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'.04em', borderBottom:'0.5px solid #eee', width: h==='City'?'20%':'10%' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr key={d.city} style={{ borderTop:'0.5px solid #eee', background: d.city==='San Bruno'?'#EEF4FF':undefined }}>
                  <td style={td}>{i+1}</td>
                  <td style={{ ...td, textAlign:'left', fontWeight: d.city==='San Bruno'?500:400, color: d.city==='San Bruno'?'#3266ad':'inherit' }}>{d.city}</td>
                  <td style={td}>{fmt(d.total)}</td>
                  <td style={td}>{d.count}</td>
                  {['housing','infra','transit','climate','safety'].map(cat => (
                    <td key={cat} style={td}>{fmt(d.byCategory[cat])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gap callout */}
      {sbData && sorted[0] && sorted[0].city !== 'San Bruno' && (
        <div style={{ background:'#EEF4FF', border:'0.5px solid #b0c8e8', borderRadius:8, padding:'1rem 1.25rem' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#0C447C', marginBottom:4 }}>
            Funding gap vs. top city
          </div>
          <div style={{ fontSize:13, color:'#333' }}>
            <strong>{sorted[0].city}</strong> received <strong>{fmt(sorted[0].total)}</strong> in federal grants since 2010 — <strong>{fmt(sorted[0].total - sbData.total)}</strong> more than San Bruno's <strong>{fmt(sbData.total)}</strong>.
          </div>
        </div>
      )}
    </div>
  );
}

const sel = { fontSize:12, padding:'5px 9px', border:'0.5px solid #ccc', borderRadius:8, background:'#fff', color:'#1a1a1a', cursor:'pointer' };
const btn = { fontSize:12, padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:8, background:'#fff', cursor:'pointer' };
const td  = { padding:'9px 10px', textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' };
