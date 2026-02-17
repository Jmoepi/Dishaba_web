import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import BreakdownTable from '../components/BreakdownTable';
import ConfirmModal from '../components/ConfirmModal';
import Layout from '../components/Layout';

const PAGE_SIZE = 20;

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

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [resolutionText, setResolutionText] = useState('');

  const [toast, setToast] = useState(null);

  const clearToast = () => setToast(null);

  // Derived labels
  const roleLabel = useMemo(() => {
    if (role === 'admin') return 'Admin';
    if (role === 'supervisor') return 'Supervisor';
    return 'Operator';
  }, [role]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      setUser(data.user || null);

      if (data?.user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          setRole('operator');
        } else {
          setRole(profile?.role || 'operator');
        }
      }

      await loadBreakdowns(0, statusFilter, categoryFilter, searchText);
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, searchText]);

  const loadBreakdowns = async (pageIndex = 0, status = '', category = '', search = '') => {
    setLoading(true);
    try {
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('breakdowns')
        .select('*')
        .order('occurred_on', { ascending: false })
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
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/';
  };

  const doExport = async () => {
    if (!user) return setToast({ type: 'error', text: 'Sign in first.' });
    if (!canExport(role)) return setToast({ type: 'error', text: 'Only supervisors/admins can export.' });

    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error('No session token.');

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
        try {
          body = await r.json();
        } catch (_) {
          body = await r.text().catch(() => null);
        }

        const msg =
          body?.error || (typeof body === 'string' ? body : null) || `${r.status} ${r.statusText}`;
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

      setToast({ type: 'success', text: 'Export started. Check your downloads.' });
    } catch (e) {
      setToast({ type: 'error', text: 'Export failed: ' + (e.message || e) });
    }
  };

  const onClose = async (row, resolution) => {
    if (!resolution || resolution.trim().length < 6) {
      setToast({ type: 'error', text: 'Please provide a short resolution (min 6 characters).' });
      return;
    }
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
        try {
          body = await r.json();
        } catch (_) {
          body = await r.text().catch(() => null);
        }
        const msg =
          body?.error || (typeof body === 'string' ? body : null) || `${r.status} ${r.statusText}`;
        console.error('Close failed response', r.status, r.statusText, body);
        throw new Error(msg || 'Close failed');
      }

      const payload = await r.json();
      setToast({
        type: 'success',
        text: `Closed. Downtime: ${payload.downtime_minutes ?? 'n/a'} minutes`,
      });

      await loadBreakdowns(page, statusFilter, categoryFilter, searchText);
    } catch (e) {
      setToast({ type: 'error', text: 'Failed to close: ' + (e.message || e) });
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

  const updateRole = async (newRole) => {
    if (!user?.id) return setToast({ type: 'error', text: 'Sign in first.' });

    // Only admin should change roles in a real system
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

  const applyFilters = () => loadBreakdowns(0, statusFilter, categoryFilter, searchText);

  const roleBadgeTone = role === 'admin' ? 'pill-danger' : role === 'supervisor' ? 'pill-warn' : 'pill-ok';

  return (
    <Layout
      title="Admin — Dishaba Mine"
      pageTitle="Admin"
      pageDescription="Control center: breakdowns, exports, permissions"
      pageActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {user ? (
            <>
              <span className={`pill ${roleBadgeTone}`}>{roleLabel}</span>
              <span className="small muted hide-sm">{user.email}</span>
              {canExport(role) && (
                <button className="btn primary" onClick={doExport}>
                  Export CSV
                </button>
              )}
              <button className="btn ghost" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="btn primary">
              Sign in
            </Link>
          )}
        </div>
      }
    >
      {/* Top panels */}
      <div className="admin-grid">
        <div className="card admin-card">
          <div className="admin-card-head">
            <div>
              <h3 style={{ margin: 0 }}>Role & access</h3>
              <div className="small admin-muted">
                Least-privilege rules. Restricted actions are enforced server-side.
              </div>
            </div>
            <span className="badge">RLS + RPC</span>
          </div>

          <div className="admin-row">
            <div className="admin-field">
              <div className="small admin-muted">Current role</div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{roleLabel}</div>
            </div>

            <div className="admin-field">
              <div className="small admin-muted">Change role (testing)</div>
              <div style={{ display: 'flex', gap: 8 }}>
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
                <button
                  className="btn ghost"
                  onClick={() =>
                    setToast({
                      type: 'info',
                      text: 'Roles are stored in profiles.role. RLS blocks restricted updates.',
                    })
                  }
                >
                  Help
                </button>
              </div>
              {!canManageRoles(role) && (
                <div className="small admin-muted" style={{ marginTop: 6 }}>
                  Only <strong>Admin</strong> can change roles in this UI.
                </div>
              )}
            </div>
          </div>

          <div className="callout">
            <div className="callout-icon" aria-hidden="true">
              🛡️
            </div>
            <div>
              <div style={{ fontWeight: 900 }}>Guardrails</div>
              <div className="small admin-muted">
                Export + close actions require <strong>Supervisor</strong> or <strong>Admin</strong>.
                Client checks are UX only, database policies are the real lock.
              </div>
            </div>
          </div>
        </div>

        <div className="card admin-card">
          <div className="admin-card-head">
            <div>
              <h3 style={{ margin: 0 }}>Export</h3>
              <div className="small admin-muted">CSV is generated server-side for security.</div>
            </div>
          </div>

          <div className="admin-actions">
            <button className="btn primary" onClick={doExport} disabled={!user || !canExport(role)}>
              Export CSV
            </button>
            <button
              className="btn ghost"
              onClick={() => setToast({ type: 'info', text: 'Uses /api/export with service role on server.' })}
            >
              How it works
            </button>
          </div>

          {!canExport(role) && (
            <div className="callout warn" style={{ marginTop: 12 }}>
              <div className="callout-icon" aria-hidden="true">
                🔒
              </div>
              <div className="small">
                Your role is <strong>{roleLabel}</strong>. Exports are limited to supervisors/admins.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filters-left">
          <div className="field">
            <label className="small admin-muted" htmlFor="statusFilter">
              Status
            </label>
            <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="field">
            <label className="small admin-muted" htmlFor="categoryFilter">
              Category
            </label>
            <select
              id="categoryFilter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Electrical">Electrical</option>
              <option value="Hydraulic">Hydraulic</option>
            </select>
          </div>

          <div className="field grow">
            <label className="small admin-muted" htmlFor="searchText">
              Equipment search
            </label>
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
          <button className="btn ghost" onClick={applyFilters} disabled={loading}>
            {loading ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head">
          <div>
            <h3 style={{ margin: 0 }}>Breakdowns</h3>
            <div className="small admin-muted">
              Page <strong>{page + 1}</strong> · Showing <strong>{rows.length}</strong> records
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onPrev} disabled={page === 0 || loading}>
              Prev
            </button>
            <button className="btn ghost" onClick={onNext} disabled={!hasMore || loading}>
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 12 }}>
            <div className="skeleton shape-lg" />
          </div>
        ) : (
          <BreakdownTable
            rows={rows}
            onClose={onClose}
            onRequestClose={handleRequestClose}
            currentUser={user}
            userRole={role}
          />
        )}
      </div>

      {/* Confirm close modal */}
      <ConfirmModal
        open={modalOpen}
        title={`Close ${selectedRow?.equipment_item || ''}`}
        onCancel={() => setModalOpen(false)}
        onConfirm={handleConfirmClose}
        confirmLabel="Close"
      >
        <div>
          <div className="small admin-muted">Describe the resolution (min 6 characters)</div>
          <textarea
            value={resolutionText}
            onChange={(e) => setResolutionText(e.target.value)}
            className="input"
            style={{ width: '100%', marginTop: 8, borderRadius: 10 }}
            rows={4}
          />
        </div>
      </ConfirmModal>

      <Toast toast={toast} onClose={clearToast} />
    </Layout>
  );
}
