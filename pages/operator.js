import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import BreakdownTable from '../components/BreakdownTable';
import ViewDetailsModal from '../components/ViewDetailsModal';
import { formatMinutesHuman } from '../lib/formatters';

const PAGE_SIZE = 15;

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const icon = toast.type === 'error' ? '⛔' : toast.type === 'success' ? '✅' : 'ℹ️';
  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <div className="toast-inner">
        <div className="toast-icon" aria-hidden="true">{icon}</div>
        <div className="toast-text">
          <div className="toast-title">{toast.type === 'error' ? 'Error' : toast.type === 'success' ? 'Success' : 'Info'}</div>
          <div className="toast-msg">{toast.text}</div>
        </div>
        <button className="btn ghost small" onClick={onClose} aria-label="Close toast">✕</button>
      </div>
    </div>
  );
}

export default function OperatorDashboard() {
  const [user, setUser] = useState(null);
  const [breakdowns, setBreakdowns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [statusHistory, setStatusHistory] = useState({});

  const clearToast = () => setToast(null);

  const loadMyBreakdowns = async (pageIndex = 0) => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data?.user?.id) {
        setToast({ type: 'error', text: 'Not logged in' });
        setLoading(false);
        return;
      }

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('breakdowns')
        .select('*')
        .eq('reported_by', data.user.id)
        .order('occurred_on', { ascending: false })
        .order('start_time', { ascending: false })
        .range(from, to);

      if (statusFilter) query = query.eq('status', statusFilter);

      const { data: breakdownData, error } = await query;
      if (error) throw error;

      setBreakdowns(breakdownData || []);
      setHasMore((breakdownData?.length || 0) === PAGE_SIZE);
      setPage(pageIndex);
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const loadStatusHistory = async (breakdownId) => {
    try {
      const r = await fetch(`/api/breakdown-comments?breakdown_id=${breakdownId}&history=true`);
      if (!r.ok) throw new Error('Failed to load history');
      const { data } = await r.json();
      setStatusHistory(prev => ({ ...prev, [breakdownId]: data }));
    } catch (e) {
      console.error('Failed to load status history:', e);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user || null);
      if (data?.user?.id) {
        await loadMyBreakdowns(0);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (breakdowns.length > 0) {
      breakdowns.forEach(b => {
        if (!statusHistory[b.id]) {
          loadStatusHistory(b.id);
        }
      });
    }
  }, [breakdowns]);

  const handleViewDetails = (item) => {
    setViewingItem(item);
    if (!statusHistory[item.id]) {
      loadStatusHistory(item.id);
    }
  };

  const applyFilter = (e) => {
    e.preventDefault();
    loadMyBreakdowns(0);
  };

  const stats = {
    total: breakdowns.length,
    pending: breakdowns.filter(b => b.status === 'Pending').length,
    open: breakdowns.filter(b => b.status === 'Open').length,
    closed: breakdowns.filter(b => b.status === 'Closed').length,
  };

  return (
    <Layout
      title="My Breakdowns — Dishaba Mine"
      pageTitle="My Breakdowns"
      pageDescription="Track breakdowns you've logged"
      pageActions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/log" className="btn primary">Log new breakdown</Link>
        </div>
      }
    >
      <div className="admin-grid">
        <div className="card admin-card">
          <div className="admin-card-head">
            <div><h3 style={{ margin: 0 }}>Summary</h3></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <div>
              <div className="small admin-muted">Total</div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>{stats.total}</div>
            </div>
            <div>
              <div className="small admin-muted">Pending Review</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: '#FFA500' }}>{stats.pending}</div>
            </div>
            <div>
              <div className="small admin-muted">Open</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: '#0066cc' }}>{stats.open}</div>
            </div>
            <div>
              <div className="small admin-muted">Closed</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: '#4caf50' }}>{stats.closed}</div>
            </div>
          </div>
        </div>
      </div>

      <form className="filters" onSubmit={applyFilter}>
        <div className="filters-left">
          <div className="field">
            <label className="small admin-muted" htmlFor="statusFilter">Status</label>
            <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="Pending">Pending Review</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
        <div className="filters-right">
          <button type="submit" className="btn ghost" disabled={loading}>
            {loading ? 'Loading…' : 'Apply Filter'}
          </button>
        </div>
      </form>

      <div className="card admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head">
          <div>
            <h3 style={{ margin: 0 }}>Your Breakdowns</h3>
            <div className="small admin-muted">
              Page <strong>{page + 1}</strong> · Showing <strong>{breakdowns.length}</strong> records
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => loadMyBreakdowns(Math.max(0, page - 1))} disabled={page === 0 || loading}>
              Prev
            </button>
            <button className="btn ghost" onClick={() => loadMyBreakdowns(page + 1)} disabled={!hasMore || loading}>
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 12 }}><div className="skeleton shape-lg" /></div>
        ) : (
          <table className="table" role="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Date</th>
                <th>Equipment</th>
                <th>Category</th>
                <th>Downtime</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {breakdowns.map(b => (
                <tr key={b.id}>
                  <td data-label="Status">
                    {b.status === 'Pending' ? (
                      <span className="pill" style={{ background: '#FFA500', color: '#fff' }}>Pending Review</span>
                    ) : b.status === 'Open' ? (
                      <span className="pill open">Open</span>
                    ) : (
                      <span className="pill closed">Closed</span>
                    )}
                  </td>
                  <td data-label="Date">
                    <div className="small">{b.occurred_on}</div>
                    <div className="muted">{b.start_time || '—'}</div>
                  </td>
                  <td data-label="Equipment"><strong>{b.equipment_item}</strong></td>
                  <td data-label="Category"><span className="small">{b.category}</span></td>
                  <td data-label="Downtime">
                    {b.downtime_minutes ? (
                      <span className="badge">{formatMinutesHuman(b.downtime_minutes)}</span>
                    ) : (
                      <span className="small muted">—</span>
                    )}
                  </td>
                  <td data-label="Actions">
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => handleViewDetails(b)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && breakdowns.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div className="small muted">No breakdowns found</div>
            <Link href="/log" className="btn primary" style={{ marginTop: 12 }}>Log your first breakdown</Link>
          </div>
        )}
      </div>

      <ViewDetailsModal
        open={!!viewingItem}
        breakdown={viewingItem}
        onClose={() => setViewingItem(null)}
        statusHistory={viewingItem?.id ? statusHistory[viewingItem.id] : null}
      />

      <Toast toast={toast} onClose={clearToast} />
    </Layout>
  );
}
