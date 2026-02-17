import { useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function Sparkline({ values = [], labels = [], color = '#2563eb', height = 110 }) {
  const chartRef = useRef(null);
  const [hover, setHover] = useState(null);

  const labelsMemo = useMemo(() => (labels && labels.length ? labels : values.map((_, i) => i + 1)), [labels, values]);

  const resolveColor = (col) => {
    try {
      if (typeof window !== 'undefined' && typeof col === 'string' && col.startsWith('var(')) {
        const name = col.slice(4, -1).trim();
        const v = getComputedStyle(document.documentElement).getPropertyValue(name) || col;
        return v.trim();
      }
    } catch (e) {
      // ignore - fallback to provided color
    }
    return col;
  };

  const resolvedColor = useMemo(() => resolveColor(color), [color]);
  const resolvedMuted = useMemo(() => resolveColor('var(--muted)'), []);

  const data = useMemo(() => ({
    labels: labelsMemo,
    datasets: [
      {
        label: 'Breakdowns',
        data: values,
        fill: true,
        backgroundColor: (ctx) => {
          const toRgba = (col, a) => {
            if (!col) return `rgba(15,99,255,${a})`;
            col = col.trim();
            if (col.startsWith('#')) {
              const hex = col.slice(1);
              let r = 0;
              let g = 0;
              let b = 0;
              if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
              } else if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
              }
              return `rgba(${r},${g},${b},${a})`;
            }
            if (col.startsWith('rgb')) {
              const nums = col.replace(/rgba?\(|\)/g, '').split(',').map((s) => s.trim());
              const [r, g, b] = nums;
              return `rgba(${r},${g},${b},${a})`;
            }
            return col;
          };

          const base = resolvedColor;
          const grd = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
          grd.addColorStop(0, toRgba(base, 0.14));
          grd.addColorStop(1, toRgba(base, 0.03));
          return grd;
        },
        borderColor: resolvedColor,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
      },
    ],
  }), [labelsMemo, values, resolvedColor]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 8,
        cornerRadius: 6,
      },
    },
    layout: {
      padding: { top: 6, bottom: 2, left: 0, right: 0 },
    },
    scales: {
      x: {
        display: true,
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, color: resolvedMuted || '#94a3b8', padding: 2, font: { size: 11 } },
        grid: { display: false, drawBorder: false },
      },
      y: { display: false, beginAtZero: true },
    },
    elements: {
      point: { radius: 2, hoverRadius: 5 },
    },
    onHover: (evt, elements) => {
      if (elements && elements.length) {
        const el = elements[0];
        const idx = el.index;
        setHover({ index: idx, label: labelsMemo[idx], value: values[idx] });
      } else {
        setHover(null);
      }
    },
  }), [labelsMemo, values, resolvedMuted]);

  return (
    <div style={{ height }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontWeight: 800 }}>Trend</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{hover ? `${hover.label} — ${hover.value}` : 'Hover chart to inspect'}</div>
      </div>
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}
