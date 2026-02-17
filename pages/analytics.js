import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

function fmtMins(mins) {
  const m = Number(mins || 0);
  if (!m) return '0 min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} min`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

function safeDateOnly(v) {
  // expects yyyy-mm-dd
  if (!v || typeof v !== 'string') return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function tokenizeCause(text) {
  if (!text) return [];
  const lower = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!lower) return [];

  const stop = new Set([
    'the','and','or','to','of','in','on','for','with','a','an','is','was','were',
    'issue','issues','fault','breakdown','broke','down','machine','equipment',
    'fix','fixed','replace','replaced','check','checked','tested','test',
    'motor','belt','bearing','system','error','failure','leak','overheating',
    'repair','repaired','maintenance','planned','inspection'
  ]);

  return lower
    .split(' ')
    .filter(w => w.length >= 3 && !stop.has(w));
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  // Filters (editable)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filters (applied)
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const abortRef = useRef(null);

  const buildParams = () => {
    const params = new URLSearchParams({ page: '0', limit: '1200' }); // bigger page for analytics
    if (appliedStart) params.set('start_date', appliedStart);
    if (appliedEnd) params.set('end_date', appliedEnd);
    return params;
  };

  const fetchData = async () => {
    setError(null);
    setLoading(true);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error('Sign in required');

      const q = `/api/breakdowns?${buildParams().toString()}`;
      const r = await fetch(q, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!r.ok) {
        let serverMsg = '';
        try {
          const j = await r.json();
          serverMsg = j?.error || JSON.stringify(j);
        } catch (_) {
          serverMsg = await r.text().catch(() => r.statusText);
        }

        // Client fallback
        try {
          let query = supabase
            .from('breakdowns')
            .select('*')
            .order('occurred_on', { ascending: false })
            .limit(1200);

          if (appliedStart) query = query.gte('occurred_on', appliedStart);
          if (appliedEnd) query = query.lte('occurred_on', appliedEnd);

          const { data, error: clientErr } = await query;
          if (clientErr) throw clientErr;
          setRows(data || []);
          return;
        } catch (fallbackErr) {
          throw new Error(
            `Server: ${serverMsg || r.statusText} | Client fallback: ${
              fallbackErr?.message || String(fallbackErr)
            }`
          );
        }
      }

      const payload = await r.json();
      setRows(payload?.rows || []);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedStart, appliedEnd]);

  const agg = useMemo(() => {
    // Normalized rows for safety
    const data = (rows || []).map(r => ({
      ...r,
      occurred_on: r.occurred_on || null,
      category: r.category || 'Unspecified',
      equipment_item: r.equipment_item || 'Unknown',
      downtime_minutes: Number(r.downtime_minutes || 0),
      status: r.status || (r.is_closed ? 'Closed' : 'Open') || 'Open',
      description: r.description || '',
    }));

    // Count over time
    const byDate = {};
    // Counts by category
    const byCategoryCount = {};
    // Downtime mins by category
    const downtimeByCategory = {};
    // Downtime mins by equipment
    const downtimeByEquipment = {};
    // Open vs closed
    const statusCounts = { Open: 0, Closed: 0, Other: 0 };

    // Causes keyword freq
    const keywordCounts = {};

    let totalDowntime = 0;
    let closedDowntime = 0;
    let closedCount = 0;

    // For MTBF per equipment we need breakdown dates sorted by equipment
    const equipmentDates = {};

    for (const r of data) {
      const d = r.occurred_on || 'unknown';
      byDate[d] = (byDate[d] || 0) + 1;

      const c = r.category || 'Unspecified';
      byCategoryCount[c] = (byCategoryCount[c] || 0) + 1;

      const mins = Number(r.downtime_minutes || 0);
      downtimeByCategory[c] = (downtimeByCategory[c] || 0) + mins;

      const eq = r.equipment_item || 'Unknown';
      downtimeByEquipment[eq] = (downtimeByEquipment[eq] || 0) + mins;

      totalDowntime += mins;

      const status = r.status;
      if (status === 'Open') statusCounts.Open += 1;
      else if (status === 'Closed') statusCounts.Closed += 1;
      else statusCounts.Other += 1;

      if (status === 'Closed') {
        closedDowntime += mins;
        closedCount += 1;
      }

      // keyword causes
      for (const w of tokenizeCause(r.description)) {
        keywordCounts[w] = (keywordCounts[w] || 0) + 1;
      }

      // MTBF - store per equipment occurrence date
      const dt = safeDateOnly(r.occurred_on);
      if (dt) {
        equipmentDates[eq] = equipmentDates[eq] || [];
        equipmentDates[eq].push(dt.getTime());
      }
    }

    const dateLabels = Object.keys(byDate).filter(d => d !== 'unknown').sort();
    const dateCounts = dateLabels.map(d => byDate[d]);

    const categoryPairsCount = Object.entries(byCategoryCount).sort((a,b)=>b[1]-a[1]);
    const categoryLabels = categoryPairsCount.map(p=>p[0]);
    const categoryCounts = categoryPairsCount.map(p=>p[1]);

    const categoryPairsDowntime = Object.entries(downtimeByCategory).sort((a,b)=>b[1]-a[1]);
    const categoryDowntimeLabels = categoryPairsDowntime.map(p=>p[0]).slice(0, 8);
    const categoryDowntimeValues = categoryPairsDowntime.map(p=>p[1]).slice(0, 8);

    const equipPairs = Object.entries(downtimeByEquipment).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const equipLabels = equipPairs.map(p=>p[0]);
    const equipValues = equipPairs.map(p=>p[1]);

    const totalBreakdowns = data.length;
    const avgDowntime = totalBreakdowns ? Math.round(totalDowntime / totalBreakdowns) : 0;
    const topCategory = categoryPairsCount?.[0]?.[0] || '—';

    // MTTR (Mean Time To Repair): average downtime for CLOSED breakdowns
    const mttr = closedCount ? Math.round(closedDowntime / closedCount) : 0;

    // MTBF (Mean Time Between Failures): we approximate using average days between breakdown occurrences per equipment
    // Note: This is a reasonable “ops” estimate when you don’t have runtime hours.
    const mtbfByEquipment = [];
    for (const [eq, times] of Object.entries(equipmentDates)) {
      const sorted = [...times].sort((a,b)=>a-b);
      if (sorted.length < 2) continue;
      let sumDiffDays = 0;
      for (let i=1;i<sorted.length;i++) {
        const diffMs = sorted[i] - sorted[i-1];
        sumDiffDays += diffMs / (1000 * 60 * 60 * 24);
      }
      const avgDays = sumDiffDays / (sorted.length - 1);
      mtbfByEquipment.push([eq, avgDays]);
    }
    mtbfByEquipment.sort((a,b)=>b[1]-a[1]); // higher MTBF is better
    const overallMtbfDays = mtbfByEquipment.length
      ? (mtbfByEquipment.reduce((acc, x)=>acc + x[1], 0) / mtbfByEquipment.length)
      : 0;

    // Top causes
    const topCauses = Object.entries(keywordCounts)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,5);

    return {
      data,
      dateLabels,
      dateCounts,
      categoryLabels,
      categoryCounts,
      categoryDowntimeLabels,
      categoryDowntimeValues,
      equipPairs,
      equipLabels,
      equipValues,
      totalBreakdowns,
      totalDowntime,
      avgDowntime,
      topCategory,
      statusCounts,
      mttr,
      overallMtbfDays,
      mtbfByEquipment: mtbfByEquipment.slice(0, 6),
      topCauses,
    };
  }, [rows]);

  const chartOptions = useMemo(
    () => ({
      animation: { duration: 650 },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true },
      },
    }),
    []
  );

  const exportDashboardCSV = () => {
    const sections = [];

    sections.push(['Summary']);
    sections.push(['total_breakdowns', agg.totalBreakdowns]);
    sections.push(['total_downtime_minutes', agg.totalDowntime]);
    sections.push(['avg_downtime_minutes', agg.avgDowntime]);
    sections.push(['mttr_minutes', agg.mttr]);
    sections.push(['mtbf_days_estimated', agg.overallMtbfDays ? agg.overallMtbfDays.toFixed(2) : 0]);
    sections.push(['top_category', agg.topCategory]);
    sections.push(['open_count', agg.statusCounts.Open]);
    sections.push(['closed_count', agg.statusCounts.Closed]);
    sections.push([]);

    sections.push(['By Date']);
    sections.push(['date', 'count']);
    agg.dateLabels.forEach((d, i) => sections.push([d, agg.dateCounts[i]]));
    sections.push([]);

    sections.push(['By Category (count)']);
    sections.push(['category', 'count']);
    agg.categoryLabels.forEach((c, i) => sections.push([c, agg.categoryCounts[i]]));
    sections.push([]);

    sections.push(['By Category (downtime minutes)']);
    sections.push(['category', 'downtime_minutes']);
    agg.categoryDowntimeLabels.forEach((c, i) => sections.push([c, agg.categoryDowntimeValues[i]]));
    sections.push([]);

    sections.push(['Top Equipment Downtime (mins)']);
    sections.push(['equipment', 'downtime_minutes']);
    agg.equipPairs.forEach(p => sections.push([p[0], p[1]]));
    sections.push([]);

    sections.push(['Top Causes (keywords from descriptions)']);
    sections.push(['keyword', 'count']);
    agg.topCauses.forEach(p => sections.push([p[0], p[1]]));

    const csv = Papa.unparse(sections, { skipEmptyLines: false });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_dashboard_${appliedStart || 'all'}_${appliedEnd || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyFilters = () => {
    if (startDate && endDate && startDate > endDate) {
      setError('Start date cannot be after end date.');
      return;
    }
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStart('');
    setAppliedEnd('');
  };

  return (
    <Layout title="Analytics — Dishaba Mine" pageTitle="Analytics" pageDescription="Executive view: trends, downtime, reliability">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>Analytics</h2>
          <div className="small muted">Executive view: trends, downtime, reliability</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <button className="btn ghost" onClick={applyFilters} disabled={loading}>Apply</button>
          <button className="btn ghost" onClick={clearFilters} disabled={loading}>Clear</button>
          <button className="btn" onClick={exportDashboardCSV} disabled={loading || rows.length === 0}>Export CSV</button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div className="card">
          <div className="small muted">Total Breakdowns</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{loading ? '...' : agg.totalBreakdowns}</div>
        </div>
        <div className="card">
          <div className="small muted">Total Downtime</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{loading ? '...' : fmtMins(agg.totalDowntime)}</div>
        </div>
        <div className="card">
          <div className="small muted">Avg Downtime</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{loading ? '...' : fmtMins(agg.avgDowntime)}</div>
        </div>
        <div className="card">
          <div className="small muted">MTTR (Closed)</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{loading ? '...' : fmtMins(agg.mttr)}</div>
          <div className="small muted">Mean time to repair</div>
        </div>
        <div className="card">
          <div className="small muted">MTBF (Estimated)</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {loading ? '...' : `${agg.overallMtbfDays ? agg.overallMtbfDays.toFixed(1) : '0.0'} days`}
          </div>
          <div className="small muted">Mean time between failures</div>
        </div>
        <div className="card">
          <div className="small muted">Top Category</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{loading ? '...' : agg.topCategory}</div>
        </div>
      </div>

      {loading ? (
        <div className="card"><p style={{ margin: 0 }}>Loading analytics…</p></div>
      ) : error ? (
        <div className="card" style={{ border: '1px solid #ef4444' }}>
          <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No data found for the selected date range.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 18 }}>
          {/* LEFT COLUMN */}
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>Breakdowns Over Time</h3>
                <div className="small muted">
                  Showing {rows.length} record{rows.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ height: 300 }}>
                <Line
                  data={{
                    labels: agg.dateLabels,
                    datasets: [
                      {
                        label: 'Breakdowns',
                        data: agg.dateCounts,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37,99,235,0.10)',
                        tension: 0.35,
                        fill: true,
                        pointRadius: 2,
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginTop: 0 }}>Downtime by Category (mins)</h4>
              <div style={{ height: 300 }}>
                <Bar
                  data={{
                    labels: agg.categoryDowntimeLabels,
                    datasets: [
                      {
                        label: 'Downtime (min)',
                        data: agg.categoryDowntimeValues,
                        backgroundColor: '#f97316',
                      },
                    ],
                  }}
                  options={{ ...chartOptions }}
                />
              </div>
              <div className="small muted" style={{ marginTop: 8 }}>
                This shows where time is being lost, not just how often things fail.
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginTop: 0 }}>Reliability (MTBF by Equipment, estimated)</h4>
              <div className="small muted" style={{ marginBottom: 8 }}>
                Estimated from gaps between breakdown dates per equipment (needs runtime-hours for perfect MTBF).
              </div>

              {agg.mtbfByEquipment.length === 0 ? (
                <p className="small muted">Not enough history per equipment (need at least 2 breakdown dates).</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Equipment</th>
                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Avg days between failures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agg.mtbfByEquipment.map(([eq, days]) => (
                        <tr key={eq}>
                          <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{eq}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                            {days.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card">
              <h4 style={{ marginTop: 0 }}>Closed vs Open</h4>
              <div style={{ height: 240 }}>
                <Doughnut
                  data={{
                    labels: ['Closed', 'Open', 'Other'],
                    datasets: [
                      {
                        data: [agg.statusCounts.Closed, agg.statusCounts.Open, agg.statusCounts.Other],
                        backgroundColor: ['#22c55e', '#f59e0b', '#94a3b8'],
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
              <div className="small muted" style={{ marginTop: 8 }}>
                Helpful for backlog pressure and response discipline.
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginTop: 0 }}>Category Distribution (count)</h4>
              <div style={{ height: 260 }}>
                <Doughnut
                  data={{
                    labels: agg.categoryLabels.slice(0, 8),
                    datasets: [
                      {
                        data: agg.categoryCounts.slice(0, 8),
                        backgroundColor: ['#2563eb', '#06b6d4', '#f97316', '#ef4444', '#a855f7', '#22c55e', '#eab308', '#64748b'],
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginTop: 0 }}>Top Equipment Downtime (mins)</h4>
              <div style={{ height: 280 }}>
                <Bar
                  data={{
                    labels: agg.equipLabels,
                    datasets: [{ label: 'Downtime (min)', data: agg.equipValues, backgroundColor: '#06b6d4' }],
                  }}
                  options={{ ...chartOptions, indexAxis: 'y' }}
                />
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginTop: 0 }}>Top 5 Causes (from descriptions)</h4>
              {agg.topCauses.length === 0 ? (
                <p className="small muted">No descriptions found to extract causes.</p>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {agg.topCauses.map(([k, v]) => (
                    <li key={k} style={{ marginBottom: 6 }}>
                      <strong style={{ textTransform: 'capitalize' }}>{k}</strong>
                      <span className="small muted"> ({v})</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="small muted" style={{ marginTop: 8 }}>
                Tip: standardize description templates to improve accuracy.
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
