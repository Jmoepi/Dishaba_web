import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import Sparkline from '../components/Sparkline';
import BreakdownTable from '../components/BreakdownTable';
import { formatMinutesHuman } from '../lib/formatters';

export default function Home() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // fetch a larger sample for dashboard calculations
        const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
        const q = supabase.from('breakdowns').select('*').order('occurred_on', { ascending: false }).limit(1200).gte('occurred_on', since);
        const { data, error } = await q;
        if (!mounted) return;
        if (error) throw error;
        setRows(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [rangeDays]);

  const agg = useMemo(() => {
    const total = rows.length;
    const open = rows.filter(r=>r.status === 'Open').length;
    const totalDowntime = rows.reduce((s,r)=>s + (Number(r.downtime_minutes)||0),0);
    const avgDowntime = total ? Math.round(totalDowntime/total) : 0;
    const byEquip = {};
    const byCategory = {};
    const timelineMap = {};
    for (const r of rows) {
      byEquip[r.equipment_item] = (byEquip[r.equipment_item]||0) + (Number(r.downtime_minutes)||0);
      byCategory[r.category] = (byCategory[r.category]||0) + 1;
      timelineMap[r.occurred_on] = (timelineMap[r.occurred_on]||0) + 1;
    }
    const topEquip = Object.entries(byEquip).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const topCat = Object.entries(byCategory).sort((a,b)=>b[1]-a[1])[0];
    const dateLabels = Object.keys(timelineMap).sort();
    const dateVals = dateLabels.map(d=>timelineMap[d]);
    return { total, open, totalDowntime, avgDowntime, topEquip, topCat: topCat?.[0] || '—', dateLabels, dateVals };
  }, [rows]);

  return (
    <Layout title="Dashboard — Dishaba Mine" pageTitle="Executive Summary" pageDescription="Quick operational overview: KPIs, trends and open incidents">
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:12}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div className="small muted">Date range</div>
            <div style={{display:'flex',gap:8}}>
              <button className={`btn ${rangeDays===7?'primary':''}`} onClick={()=>setRangeDays(7)}>7d</button>
              <button className={`btn ${rangeDays===30?'primary':''}`} onClick={()=>setRangeDays(30)}>30d</button>
              <button className={`btn ${rangeDays===90?'primary':''}`} onClick={()=>setRangeDays(90)}>90d</button>
              <Link href="/analytics" className="btn ghost">Custom</Link>
            </div>
          </div>
          <div>
            <Link href="/admin" className="btn ghost">Manage Breakdowns</Link>
          </div>
        </div>

        <div className="kpi-row">
          <div className="kpi">
            <div className="small muted">Total Breakdowns</div>
            <div className="value">{loading ? <div className="skeleton shape-lg"></div> : agg.total}</div>
          </div>
          <div className="kpi">
            <div className="small muted">Total Downtime</div>
            <div className="value">{loading ? <div className="skeleton shape-lg"></div> : formatMinutesHuman(agg.totalDowntime)}</div>
          </div>
          <div className="kpi">
            <div className="small muted">Open</div>
            <div className="value">{loading ? <div className="skeleton shape-lg"></div> : agg.open}</div>
          </div>
          <div className="kpi">
            <div className="small muted">Avg downtime</div>
            <div className="value">{loading ? <div className="skeleton shape-lg"></div> : formatMinutesHuman(agg.avgDowntime)}</div>
          </div>
          <div className="kpi">
            <div className="small muted">Top category</div>
            <div className="value">{loading ? <div className="skeleton shape-lg"></div> : agg.topCat}</div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:12}}>
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{margin:0}}>Breakdowns trend</h3>
              <div className="small muted">Last {rangeDays} days</div>
            </div>
            <div style={{height:160,marginTop:12}}>
              {loading ? <div className="skeleton shape-lg"></div> : (
                <Sparkline values={agg.dateVals.length?agg.dateVals.slice(-30):[]} color="var(--primary)" />
              )}
            </div>
          </div>

          <div>
            <div className="card">
              <h4 style={{marginTop:0}}>Top downtime equipment</h4>
              {loading ? (
                <div style={{display:'grid',gap:8}}>
                  <div className="skeleton shape-sm"></div>
                  <div className="skeleton shape-sm"></div>
                  <div className="skeleton shape-sm"></div>
                </div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <tbody>
                    {agg.topEquip.map(([eq, mins]) => (
                      <tr key={eq}>
                        <td style={{padding:8}}><strong>{eq}</strong></td>
                        <td style={{padding:8,textAlign:'right'}}>{formatMinutesHuman(mins)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card" style={{marginTop:12}}>
              <h4 style={{marginTop:0}}>Open breakdowns</h4>
              {loading ? <div className="skeleton shape-lg"></div> : (
                <div style={{maxHeight:220,overflow:'auto'}}>
                  <BreakdownTable rows={rows.filter(r=>r.status==='Open').slice(0,8)} currentUser={null} role={'supervisor'} onRequestClose={()=>{}} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
