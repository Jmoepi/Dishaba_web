import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import BreakdownTable from '../components/BreakdownTable';
import Layout from '../components/Layout';
import ViewDetailsModal from '../components/ViewDetailsModal';

const PAGE_SIZE = 15;

function canExport(role) {
  return ['supervisor', 'admin'].includes(role);
}

function canManageRoles(role) {
  return role === 'admin';
}

function Toast({ toast, onClose }) {
  if (!toast) return null;

  const icon =
    toast.type === 'error' ? '⛔' : toast.type === 'success' ? '✅' : 'ℹ️';

  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <div className="toast-inner">
        <div className="toast-icon" aria-hidden="true">
          {icon}
        </div>
        <div className="toast-text">
          <div className="toast-title">
            {toast.type === 'error' ? 'Error' : toast.type === 'success' ? 'Success' : 'Info'}
          </div>
          <div className="toast-msg">{toast.text}</div>
        </div>
        <button className="btn ghost small" onClick={onClose} aria-label="Close toast">
          ✕
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('operator');

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [statusFilter, setStatusFilter] = useState('Open');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const [toast, setToast] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);

  const clearToast = () => setToast(null);

  const roleLabel = useMemo(() => {
    if (role === 'admin') return 'Admin';
    if (role === 'supervisor') return 'Supervisor';
    return 'Operator';
  }, [role]);

  async function loadBreakdowns(pageIndex = 0, status = '', category = '', search = '') {
    setLoading(true);
    try {
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('breakdowns')
        .select('*')
        .order('occurred_on', { ascending: false })
        .order('start_time', { ascending: false })
        .range(from, to);

      if (status) query = query.eq('status', status);
      if (category) query = query.eq('category', category);
      if (search) query = query.ilike('equipment_item', `%${search}%`);

      const { data, error } = await query;
      if (error) throw error;

      setRows(data || []);
      setHasMore((data?.length || 0) === PAGE_SIZE);
      setPage(pageIndex);
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) setUser(data.user || null);

      if (data?.user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (mounted) {
          if (error) setRole('operator');
          else setRole(profile?.role || 'operator');
        }
      }

      await loadBreakdowns(0, statusFilter, categoryFilter, searchText);
    })();

    const handler = () => {
      loadBreakdowns(0, statusFilter, categoryFilter, searchText).catch(() => {});
    };
    window.addEventListener('breakdown:created', handler);

    return () => {
      mounted = false;
      window.removeEventListener('breakdown:created', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doExport = async () => {
    if (!user) return setToast({ type: 'error', text: 'Sign in first.' });
    if (!canExport(role)) return setToast({ type: 'error', text: 'Only supervisors/admins can export.' });

    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error('No session token.');

      const r = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ start_date: '1970-01-01', end_date: '2099-12-31' }),
      });

      if (!r.ok) {
        const msg = (await r.json().catch(() => r.text()))?.error || `${r.status} ${r.statusText}`;
        setToast({ type: 'error', text: 'Export failed: ' + msg });
        return;
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'breakdowns_export.csv';
      a.click();
      URL.revokeObjectURL(url);

      setToast({ type: 'success', text: 'Export started. Check your downloads.' });
    } catch (e) {
      setToast({ type: 'error', text: 'Export failed: ' + (e.message || e) });
    }
  };

  const updateRole = async (newRole) => {
    if (!user?.id) return setToast({ type: 'error', text: 'Sign in first.' });
    if (!canManageRoles(role)) {
      setToast({ type: 'error', text: 'Only Admin can change roles.' });
      return;
    }

    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
      if (error) throw error;
      setRole(newRole);
      setToast({ type: 'success', text: 'Role updated.' });
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    }
  };

  const onPrev = () => {
    if (page > 0) loadBreakdowns(page - 1, statusFilter, categoryFilter, searchText);
  };
  const onNext = () => {
    if (hasMore) loadBreakdowns(page + 1, statusFilter, categoryFilter, searchText);
  };

  const applyFilters = (e) => {
    e.preventDefault();
    loadBreakdowns(0, statusFilter, categoryFilter, searchText);
  };

  return (
    <Layout
      title="Breakdown Log — Dishaba Mine"
      pageTitle="Breakdown Log"
      pageDescription="Live breakdown and downtime logger"
      pageActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/log" className="btn primary">Log new breakdown</Link>
        </div>
      }
    >
      <div className="admin-grid">
        <div className="card admin-card">
          <div className="admin-card-head">
            <div><h3 style={{ margin: 0 }}>Permissions</h3></div>
          </div>
          <div className="admin-row">
            <div className="admin-field">
              <div className="small admin-muted">Your current role</div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{roleLabel}</div>
            </div>
            <div className="admin-field">
              <div className="small admin-muted">Change role (testing only)</div>
              <select
                value={role}
                onChange={(e) => updateRole(e.target.value)}
                className="input"
                disabled={!user || !canManageRoles(role)}
                title={!canManageRoles(role) ? 'Admin only' : ''}
              >
                <option value="operator">Operator</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card admin-card">
          <div className="admin-card-head">
            <div><h3 style={{ margin: 0 }}>Export</h3></div>
          </div>
          <div className="admin-actions">
            <button className="btn" onClick={doExport} disabled={!user || !canExport(role)}>
              Export as CSV
            </button>
          </div>
        </div>
      </div>

      <form className="filters" onSubmit={applyFilters}>
        <div className="filters-left">
          <div className="field">
            <label className="small admin-muted" htmlFor="statusFilter">Status</label>
            <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="field">
            <label className="small admin-muted" htmlFor="categoryFilter">Category</label>
            <select id="categoryFilter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Electrical">Electrical</option>
              <option value="Hydraulic">Hydraulic</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="field grow">
            <label className="small admin-muted" htmlFor="searchText">Equipment search</label>
            <input
              id="searchText"
              className="input"
              placeholder="e.g. Conveyor, Pump, Fan…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        <div className="filters-right">
          <button type="submit" className="btn ghost" disabled={loading}>
            {loading ? 'Loading…' : 'Apply Filters'}
          </button>
        </div>
      </form>

      <div className="card admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head">
          <div>
            <h3 style={{ margin: 0 }}>Breakdown history</h3>
            <div className="small admin-muted">
              Page <strong>{page + 1}</strong> · Showing <strong>{rows.length}</strong> records
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onPrev} disabled={page === 0 || loading}>Prev</button>
            <button className="btn ghost" onClick={onNext} disabled={!hasMore || loading}>Next</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 12 }}><div className="skeleton shape-lg" /></div>
        ) : (
          <BreakdownTable
            rows={rows}
            onViewDetails={setViewingItem}
            onReopen={async (row) => {
              try {
                const { error } = await supabase.from('breakdowns').update({ status: 'Open' }).eq('id', row.id);
                if (error) throw error;
                setToast({ type: 'success', text: 'Reopened.' });
                await loadBreakdowns(page, statusFilter, categoryFilter, searchText);
              } catch (e) {
                setToast({ type: 'error', text: 'Reopen failed: ' + (e.message || e) });
                throw e;
              }
            }}
            userRole={role}
            setToast={setToast}
          />
        )}
      </div>

      <Toast toast={toast} onClose={clearToast} />
      <ViewDetailsModal
        open={!!viewingItem}
        breakdown={viewingItem}
        onClose={() => setViewingItem(null)}
      />
    </Layout>
  );
}
