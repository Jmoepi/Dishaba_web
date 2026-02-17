import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import BreakdownTable from '../components/BreakdownTable';
import ConfirmModal from '../components/ConfirmModal';
import Layout from '../components/Layout';
import Papa from 'papaparse';

const PAGE_SIZE = 20;

export default function Admin() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('operator');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [resolutionText, setResolutionText] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user || null);
      // fetch profile role
      if (data?.user?.id) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
        setRole(profile?.role || 'operator');
      }
      await loadBreakdowns(0, statusFilter, categoryFilter, searchText);
    })();
    return () => { mounted = false };
  }, []);

  const loadBreakdowns = async (pageIndex = 0, status = '', category = '', search = '') => {
    setLoading(true);
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase.from('breakdowns').select('*').order('occurred_on', { ascending: false }).range(from, to);
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('equipment_item', `%${search}%`);

    const resp = await query;
    const data = resp.data;
    const error = resp.error;
    if (error) alert(error.message || String(error));
    else {
      setRows(data || []);
      setHasMore((data?.length || 0) === PAGE_SIZE);
      setPage(pageIndex);
    }
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/';
  };

  const doExport = async () => {
    if (!user) return alert('Sign in first');
    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) return alert('No session token');

      // Call server-side endpoint which uses service role key
      const r = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ start_date: '1970-01-01', end_date: '2099-12-31' }),
      });
      if (!r.ok) {
        let body = null;
        try { body = await r.json(); } catch(_) { body = await r.text().catch(()=>null); }
        const msg = body?.error || (typeof body === 'string' ? body : null) || `${r.status} ${r.statusText}`;
        console.error('Export failed response', r.status, r.statusText, body);
        throw new Error(msg || 'Export failed');
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'breakdowns_export.csv';
      a.click();
      URL.revokeObjectURL(url);
      setToast({type:'success', text:'Export started — check downloads.'});
    } catch (e) {
      setToast({type:'error', text:'Export failed: ' + (e.message || e)});
    }
  };

  const onClose = async (row, resolution) => {
    if (!resolution || resolution.trim().length < 6) return alert('Provide a short resolution');
    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      const r = await fetch('/api/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: row.id, resolution }),
      });
      if (!r.ok) {
        let body = null;
        try { body = await r.json(); } catch(_) { body = await r.text().catch(()=>null); }
        const msg = body?.error || (typeof body === 'string' ? body : null) || `${r.status} ${r.statusText}`;
        console.error('Close failed response', r.status, r.statusText, body);
        throw new Error(msg || 'Close failed');
      }
      const payload = await r.json();
      alert('Closed — downtime: ' + (payload.downtime_minutes ?? 'n/a') + ' minutes');
      await loadBreakdowns(page, statusFilter, categoryFilter, searchText);
    } catch (e) {
      alert('Failed to close: ' + (e.message || e));
    }
  };

  const handleRequestClose = (row) => {
    setSelectedRow(row);
    setResolutionText('');
    setModalOpen(true);
  };

  const handleConfirmClose = async () => {
    setModalOpen(false);
    if (!selectedRow) return;
    await onClose(selectedRow, resolutionText);
    setSelectedRow(null);
    setResolutionText('');
  };

  const [toast, setToast] = useState(null);
  const clearToast = () => setToast(null);

  const updateRole = async (newRole) => {
    if (!user?.id) return setToast({type:'error', text:'Sign in first'});
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
      if (error) throw error;
      setRole(newRole);
      setToast({type:'success', text:'Role updated'});
    } catch (e) {
      setToast({type:'error', text: e.message || String(e)});
    }
  };

  const onPrev = () => { if (page>0) loadBreakdowns(page-1, statusFilter, categoryFilter, searchText); };
  const onNext = () => { if (hasMore) loadBreakdowns(page+1, statusFilter, categoryFilter, searchText); };

  const applyFilters = () => loadBreakdowns(0, statusFilter, categoryFilter, searchText);

  return (
    <Layout title="Admin — Dishaba Mine" pageTitle="Admin" pageDescription="Control center: exports, roles and guardrails">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div>
          <h2 style={{margin:0}}>Admin Dashboard</h2>
          <div className="small muted">Manage breakdowns, exports and administrative actions</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {user ? (
            <>
              <div className="small muted">{user.email}</div>
              <button className="btn ghost" onClick={signOut}>Sign out</button>
              {['supervisor','admin'].includes(role) && (
                <button className="btn primary" style={{marginLeft:8}} onClick={doExport}>Export CSV</button>
              )}
            </>
          ) : (
            <a className="nav-link" href="/login">Sign in</a>
          )}
        </div>
      </div>

      {/* Role management + guardrails */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:12,marginBottom:12}}>
        <div className="card">
          <h3 style={{marginTop:0}}>Role management</h3>
          <div className="small muted">Change your role for testing (this updates your profile)</div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <select value={role} onChange={(e)=>updateRole(e.target.value)} className="input">
              <option value="operator">Operator</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn ghost" onClick={()=>setToast({type:'info', text:'Roles updated via profile table'})}>Help</button>
          </div>
        </div>

        <div>
          <div className="card">
            <h4 style={{marginTop:0}}>Export</h4>
            <div className="small muted">Export incident data as CSV. Recommended for reporting.</div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn primary" onClick={doExport} disabled={!user}>Export CSV</button>
              <button className="btn ghost" onClick={()=>setToast({type:'info', text:'Exports are generated server-side.'})}>How it works</button>
            </div>
          </div>

          <div className="card" style={{marginTop:12}}>
            <h4 style={{marginTop:0}}>Guardrails</h4>
            <div className="small muted">Restricted actions are indicated where appropriate. Only supervisors and admins may export data.</div>
          </div>
        </div>
      </div>

      <div className="controls" style={{marginBottom:12}}>
        <label className="visually-hidden" htmlFor="statusFilter">Status</label>
        <select id="statusFilter" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
        </select>
        <label className="visually-hidden" htmlFor="categoryFilter">Category</label>
        <select id="categoryFilter" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
          <option value="">All Category</option>
          <option value="Mechanical">Mechanical</option>
          <option value="Electrical">Electrical</option>
          <option value="Hydraulic">Hydraulic</option>
        </select>
        <label className="visually-hidden" htmlFor="searchText">Search</label>
        <input id="searchText" className="input" placeholder="Search equipment" value={searchText} onChange={e=>setSearchText(e.target.value)} />
        <button className="btn ghost" onClick={applyFilters}>Apply</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <>
          <BreakdownTable rows={rows} onClose={onClose} onRequestClose={handleRequestClose} currentUser={user} role={role} />
          <ConfirmModal open={modalOpen} title={`Close ${selectedRow?.equipment_item || ''}`} onCancel={()=>setModalOpen(false)} onConfirm={handleConfirmClose} confirmLabel="Close">
            <div>
              <div className="small muted">Describe the resolution (min 6 characters)</div>
              <textarea value={resolutionText} onChange={e=>setResolutionText(e.target.value)} className="input" style={{width:'100%',marginTop:8,borderRadius:8}} rows={4} />
            </div>
          </ConfirmModal>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:12,alignItems:'center'}}>
            <div>
              <button className="btn ghost" onClick={onPrev} disabled={page===0}>Prev</button>
              <button className="btn ghost" onClick={onNext} disabled={!hasMore} style={{marginLeft:8}}>Next</button>
            </div>
            <div className="small">Page {page+1}</div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',right:12,bottom:12,background: toast.type==='error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)',color:'#fff',padding:12,borderRadius:8,boxShadow:'0 8px 30px rgba(2,6,23,0.4)'}} role="status">
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontWeight:700}}>{toast.type==='error' ? 'Error' : toast.type==='success' ? 'Success' : 'Info'}</div>
            <div style={{marginLeft:8}}>{toast.text}</div>
            <button style={{marginLeft:12}} className="btn" onClick={clearToast}>✕</button>
          </div>
        </div>
      )}
    </Layout>
  );
}
