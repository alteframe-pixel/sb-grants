import { useEffect, useRef } from 'react';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { fmtMoney } from '../utils.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export default function YearChart({ awards }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!awards.length) return;

    const byYear = {};
    awards.forEach(a => {
      const yr = (a.start || '').substring(0, 4);
      if (yr && yr !== 'null') byYear[yr] = (byYear[yr] || 0) + a.amount;
    });
    const years = Object.keys(byYear).sort();
    const vals  = years.map(y => byYear[y]);

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [{
          data: vals,
          backgroundColor: '#3266ad',
          borderRadius: 3,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + fmtMoney(ctx.raw) } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#888' }, border: { display: false } },
          y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 11 }, color: '#888', callback: v => fmtMoney(v, true) }, border: { display: false } },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [awards]);

  return (
    <div style={{ position: 'relative', height: 200, marginBottom: '1.5rem' }}>
      <canvas ref={ref} />
    </div>
  );
}
