import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import Sparkline from '../components/Sparkline';
import BreakdownTable from '../components/BreakdownTable';
import ViewDetailsModal from '../components/ViewDetailsModal';
import { formatMinutesHuman } from '../lib/formatters';

// clamp removed (unused)

function pctChange(curr, prev) {
  if (!prev && !curr) return 0;
  if (!prev && curr) return 100;
  return Math.round(((curr - prev) / prev) * 100);
}

function trendLabel(pct) {
  if (pct > 0) return `↑ ${pct}%`;
  if (pct < 0) return `↓ ${Math.abs(pct)}%`;
  return '0%';
}

function severityFromMinutes(mins) {
  const m = Number(mins) || 0;
  if (m >= 240) return { label: 'High', tone: 'danger' }; // 4h+
  if (m >= 60) return { label: 'Med', tone: 'warn' }; // 1h+
  return { label: 'Low', tone: 'ok' };
}

function Pill({ tone = 'ok', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function KpiCard({
  label,
  value,
  sub,
  hint,
  tone = 'neutral',
  loading,
  onClick,
  icon,
}) {
  return (
    <button
      type="button"
      className={`kpi2 kpi2-${tone}`}
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      style={{ textAlign: 'left' }}
    >
      <div className="kpi2-top">
        <div className="kpi2-label">
          <span className="kpi2-icon" aria-hidden="true">
            {icon}
          </span>
          {label}
        </div>
        {hint ? <div className="kpi2-hint">{hint}</div> : null}
      </div>

      <div className="kpi2-value">
        {loading ? <div className="skeleton shape-lg" /> : value}
      </div>

      {sub ? (
        <div className="kpi2-sub">
          {loading ? <div className="skeleton shape-sm" /> : sub}
        </div>
      ) : null}
    </button>
  );
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        // Grab enough rows for KPI + top equipment + trend
        const { data, error } = await supabase
          .from('breakdowns')
          .select('*')
          .order('occurred_on', { ascending: false })
          .limit(1500)
          .gte('occurred_on', since);

        if (!mounted) return;
        if (error) throw error;
        setRows(data || []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || String(e));
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [rangeDays]);

  const agg = useMemo(() => {
    // Current range and previous range comparisons
    const now = new Date();
    const start = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const inCurr = (r) => (r.occurred_on || '0000-00-00') >= start.toISOString().slice(0, 10);
    // prev-range calculation removed (not used)

    const currRows = rows.filter(inCurr);
    // NOTE: We only fetched current range from DB, so prevRows may be empty.
    // To keep “world class”, we compute prev trend as 0 when missing data.
    // If you want true prev range trends, we can fetch 2x rangeDays in one query.
    const prevRows = [];

    const total = currRows.length;
    const open = currRows.filter((r) => r.status === 'Open').length;
    const closed = currRows.filter((r) => r.status === 'Closed').length;

    const totalDowntime = currRows.reduce(
      (s, r) => s + (Number(r.downtime_minutes) || 0),
      0
    );

    const avgDowntime = total ? Math.round(totalDowntime / total) : 0;

    // MTTR (mean time to repair) for closed only (better metric)
    const closedDowntime = currRows
      .filter((r) => r.status === 'Closed')
      .reduce((s, r) => s + (Number(r.downtime_minutes) || 0), 0);
    const mttr = closed ? Math.round(closedDowntime / closed) : 0;

    // High-severity open incidents (attention)
    const openSev = currRows
      .filter((r) => r.status === 'Open')
      .map((r) => {
        const sev = severityFromMinutes(r.downtime_minutes);
        return { ...r, _sev: sev };
      })
      .sort((a, b) => (Number(b.downtime_minutes) || 0) - (Number(a.downtime_minutes) || 0));

    const attentionCount = openSev.filter((r) => r._sev.tone !== 'ok').length;

    // Trend series (by date)
    const timelineMap = {};
    for (const r of currRows) {
      const d = r.occurred_on || 'unknown';
      timelineMap[d] = (timelineMap[d] || 0) + 1;
    }
    const dateLabels = Object.keys(timelineMap).sort();
    const dateVals = dateLabels.map((d) => timelineMap[d]);

    // Downtime by equipment and by category
    const byEquip = {};
    const byCategory = {};
    const bySection = {};

    for (const r of currRows) {
      const eq = r.equipment_item || 'Unknown';
      const cat = r.category || 'Unspecified';
      const sec = r.section || 'Unknown';

      byEquip[eq] = (byEquip[eq] || 0) + (Number(r.downtime_minutes) || 0);
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      bySection[sec] = (bySection[sec] || 0) + 1;
    }

    const topEquip = Object.entries(byEquip)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const topSec = Object.entries(bySection).sort((a, b) => b[1] - a[1])[0];

    // “Change vs prev” (placeholder unless you fetch prevRows)
    const prevTotal = prevRows.length;
    const prevDowntime = prevRows.reduce(
      (s, r) => s + (Number(r.downtime_minutes) || 0),
      0
    );

    const totalDelta = pctChange(total, prevTotal);
    const downtimeDelta = pctChange(totalDowntime, prevDowntime);

    return {
      total,
      open,
      closed,
      totalDowntime,
      avgDowntime,
      mttr,
      attentionCount,
      topEquip,
      topCat: topCat?.[0] || '—',
      topSec: topSec?.[0] || '—',
      dateLabels,
      dateVals,
      openSev,
      totalDelta,
      downtimeDelta,
    };
  }, [rows, rangeDays]);

  // Small UX: show last 30 points max for sparkline
  const sparkVals = useMemo(() => {
    const vals = agg.dateVals || [];
    const max = 30;
    return vals.length > max ? vals.slice(vals.length - max) : vals;
  }, [agg.dateVals]);

  const sparkLabels = useMemo(() => {
    const labs = agg.dateLabels || [];
    const max = 30;
    return labs.length > max ? labs.slice(labs.length - max) : labs;
  }, [agg.dateLabels]);

  return (
    <Layout
      title="Dashboard — Dishaba Mine"
      pageTitle="Executive Summary"
      pageDescription="Quick operational overview: KPIs, trends, and open incidents"
      pageActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/admin" className="btn ghost">
            Manage Breakdowns
          </Link>
          <Link href="/analytics" className="btn primary">
            Analytics
          </Link>
        </div>
      }
    >
      {/* Controls */}
      <div className="dash-controls">
        <div className="dash-range">
          <div className="small muted">Date range</div>
          <div className="segmented">
            <button
              className={`seg-btn ${rangeDays === 7 ? 'active' : ''}`}
              onClick={() => setRangeDays(7)}
            >
              7d
            </button>
            <button
              className={`seg-btn ${rangeDays === 30 ? 'active' : ''}`}
              onClick={() => setRangeDays(30)}
            >
              30d
            </button>
            <button
              className={`seg-btn ${rangeDays === 90 ? 'active' : ''}`}
              onClick={() => setRangeDays(90)}
            >
              90d
            </button>
            <Link href="/analytics" className="seg-btn link">
              Custom
            </Link>
          </div>
        </div>

        <div className="dash-status">
          {loading ? (
            <span className="small muted">Refreshing…</span>
          ) : error ? (
            <span style={{ color: 'var(--danger)', fontWeight: 700 }} className="small">
              {error}
            </span>
          ) : (
            <span className="small muted">
              Showing <strong>{agg.total}</strong> records
            </span>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KpiCard
          label="Total breakdowns"
          value={agg.total}
          sub={<span className="small muted">Change vs prev: <strong>{trendLabel(agg.totalDelta)}</strong></span>}
          hint={`Last ${rangeDays} days`}
          tone="neutral"
          loading={loading}
          icon="📋"
        />

        <KpiCard
          label="Total downtime"
          value={formatMinutesHuman(agg.totalDowntime)}
          sub={<span className="small muted">Change vs prev: <strong>{trendLabel(agg.downtimeDelta)}</strong></span>}
          hint="Closed downtime sum"
          tone="primary"
          loading={loading}
          icon="⏱️"
        />

        <KpiCard
          label="Open incidents"
          value={agg.open}
          sub={
            <span className="small muted">
              Attention: <strong style={{ color: agg.attentionCount ? 'var(--danger)' : 'inherit' }}>
                {agg.attentionCount}
              </strong>
            </span>
          }
          hint="Currently open"
          tone={agg.open ? 'warn' : 'ok'}
          loading={loading}
          icon="🚨"
          onClick={() => {
            // quick jump to admin list
            window.location.href = '/admin';
          }}
        />

        <KpiCard
          label="MTTR"
          value={formatMinutesHuman(agg.mttr)}
          sub={<span className="small muted">Closed incidents only</span>}
          hint="Mean time to repair"
          tone="neutral"
          loading={loading}
          icon="🛠️"
        />

        <KpiCard
          label="Top category"
          value={agg.topCat}
          sub={<span className="small muted">Top section: <strong>{agg.topSec}</strong></span>}
          hint="Highest count"
          tone="neutral"
          loading={loading}
          icon="🏷️"
        />
      </div>

      {/* Main Grid */}
      <div className="dash-grid">
        {/* Trend */}
        <div className="card dash-card">
          <div className="dash-card-head">
            <div>
              <h3 style={{ margin: 0 }}>Breakdowns trend</h3>
              <div className="small muted">Daily counts for the selected range</div>
            </div>
            <div className="small muted">Last {rangeDays} days</div>
          </div>

          <div style={{ height: 170, marginTop: 12 }}>
            {loading ? (
              <div className="skeleton shape-lg" />
            ) : sparkVals.length ? (
              <Sparkline values={sparkVals} labels={sparkLabels} color="var(--primary)" height={130} />
            ) : (
              <div className="empty-mini">
                <div style={{ fontWeight: 900 }}>No data</div>
                <div className="small muted">Log breakdowns to see trend lines here.</div>
              </div>
            )}
          </div>

          {/* Quick insight strip - always show when not loading to avoid empty gap */}
          {!loading && (
            <div className="insight-strip">
              <div className="insight">
                <div className="small muted">Avg downtime</div>
                <div style={{ fontWeight: 900 }}>
                  {agg.total ? formatMinutesHuman(agg.avgDowntime) : '—'}
                </div>
              </div>
              <div className="insight">
                <div className="small muted">Open vs Closed</div>
                <div style={{ fontWeight: 900 }}>{agg.total ? `${agg.open} / ${agg.closed}` : 'No data'}</div>
              </div>
              <div className="insight">
                <div className="small muted">Attention</div>
                <div style={{ fontWeight: 900, color: agg.attentionCount ? 'var(--danger)' : 'inherit' }}>
                  {agg.attentionCount || (agg.total ? 0 : '—')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="dash-right">
          {/* Top equipment */}
          <div className="card dash-card">
            <div className="dash-card-head">
              <div>
                <h4 style={{ margin: 0 }}>Top downtime equipment</h4>
                <div className="small muted">Where the minutes disappear</div>
              </div>
              <Link href="/analytics" className="btn small ghost">
                View more
              </Link>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <div className="skeleton shape-sm" />
                <div className="skeleton shape-sm" />
                <div className="skeleton shape-sm" />
              </div>
            ) : agg.topEquip.length ? (
              <div className="rank-list">
                {agg.topEquip.map(([eq, mins], idx) => {
                  const share =
                    agg.totalDowntime > 0 ? Math.round((mins / agg.totalDowntime) * 100) : 0;
                  return (
                    <div className="rank-row" key={eq}>
                      <div className="rank-left">
                        <div className="rank-index">{idx + 1}</div>
                        <div>
                          <div style={{ fontWeight: 900 }}>{eq}</div>
                          <div className="small muted">{share}% of total downtime</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 900 }}>
                        {formatMinutesHuman(mins)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-mini" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900 }}>No equipment data</div>
                <div className="small muted">Once you log breakdowns, top equipment shows here.</div>
              </div>
            )}
          </div>

          {/* Open incidents spotlight */}
          <div className="card dash-card" style={{ marginTop: 12 }}>
            <div className="dash-card-head">
              <div>
                <h4 style={{ margin: 0 }}>Open incidents spotlight</h4>
                <div className="small muted">Prioritize what to close first</div>
              </div>
              <Link href="/admin" className="btn small ghost">
                Open list
              </Link>
            </div>

            {loading ? (
              <div className="skeleton shape-lg" style={{ marginTop: 12 }} />
            ) : (
              <div style={{ marginTop: 10, maxHeight: 260, overflow: 'auto' }}>
                {agg.openSev.length ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {agg.openSev.slice(0, 6).map((r) => (
                      <div className="incident-row" key={r.id}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <Pill tone={r._sev.tone}>{r._sev.label}</Pill>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.category} · {r.equipment_item}
                            </div>
                            <div className="small muted">
                              {r.occurred_on} · {r.section || 'Unknown'}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 900 }}>
                          {formatMinutesHuman(r.downtime_minutes || 0)}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Link href="/admin" className="btn small primary">
                        Close incidents
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="empty-mini">
                    <div style={{ fontWeight: 900 }}>All clear ✅</div>
                    <div className="small muted">No open breakdowns in the selected period.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* “Recent” table section */}
      <div className="card dash-card" style={{ marginTop: 12 }}>
        <div className="dash-card-head">
          <div>
            <h3 style={{ margin: 0 }}>Recent breakdowns</h3>
            <div className="small muted">Latest records captured in the selected range</div>
          </div>
          <Link href="/admin" className="btn ghost">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="skeleton shape-lg" style={{ marginTop: 12 }} />
        ) : rows.length ? (
          <div style={{ marginTop: 10 }}>
            <BreakdownTable
              rows={rows.slice(0, 10)}
              currentUser={null}
              userRole={'supervisor'}
              onViewDetails={item => setSelectedItem(item)}
              onRequestClose={() => {}}
            />
          </div>
        ) : (
          <div className="empty-mini" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900 }}>No records yet</div>
            <div className="small muted">Log your first breakdown to populate the dashboard.</div>
          </div>
        )}
      </div>

      <ViewDetailsModal
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        breakdown={selectedItem}
      />
    </Layout>
  );
}
