export default function Sparkline({ values = [], color = '#2563eb' }) {
  const w = 110;
  const h = 28;
  if (!values || values.length === 0) return <svg className="sparkline" width={w} height={h}></svg>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1 || 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const last = values[values.length - 1];
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(values.length-1)*step} cy={h - ((last-min)/range)*(h-4)-2} r="2.2" fill={color} />
    </svg>
  );
}
