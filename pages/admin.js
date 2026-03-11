import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import BreakdownTable from '../components/BreakdownTable';
import Layout from '../components/Layout';
import ViewDetailsModal from '../components/ViewDetailsModal';

const PAGE_SIZE = 15;

// Debounce hook for search input
function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Toast component with auto-dismiss
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    if (toast.type === 'success' || toast.type === 'info') {
      const timer = setTimeout(onClose, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  const icon =
    toast.type === 'error' ? '⛔' : toast.type === 'success' ? '✅' : 'ℹ️';

  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <div className="toast-inner">
        <div className="toast-icon" aria-hidden="true">{icon}</div>
        <div className="toast-text">
          <div className="toast-title">
            {toast.type === 'error' ? 'Error' : toast.type === 'success' ? 'Success' : 'Info'}
          </div>
          <div className="toast-msg">{toast.text}</div>
        </div>
        <button className="btn ghost small" onClick={onClose} aria-label="Close notification">✕</button>
      </div>
    </div>
  );
}

// Filter presets hook (SSR-safe)
function useFilterPresets() {
  const [presets, setPresets] = useState({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('breakdown_presets');
      setPresets(JSON.parse(saved || '{}'));
    } catch {
      setPresets({});
    }
  }, []);

  const savePreset = (name, filters) => {
    const updated = { ...presets, [name]: filters };
    setPresets(updated);
    try {
      localStorage.setItem('breakdown_presets', JSON.stringify(updated));
    } catch {
      // silently fail if localStorage unavailable
    }
  };

  const deletePreset = (name) => {
    const updated = { ...presets };
    delete updated[name];
    setPresets(updated);
    try {
      localStorage.setItem('breakdown_presets', JSON.stringify(updated));
    } catch {
      // silently fail
    }
  };

  return { presets, savePreset, deletePreset };
}

// Main Admin Component
export default function Admin() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('operator');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Separate loading states for different operations
  const [tableLoading, setTableLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Consolidated filter state (single source of truth)
  const [filters, setFilters] = useState({
    status: 'Pending',
    category: '',
    search: '',
    supervisor: '',
    eventType: '',
    minDowntime: '',
    maxDowntime: '',
    startDate: '',
    endDate: '',
  });

  // Debounce search to reduce API requests
  const debouncedSearch = useDebounce(filters.search, 350);

  // UI state
  const [toast, setToast] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [statusHistory, setStatusHistory] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [presetName, setPresetName] = useState('');

  // Presets management
  const { presets, savePreset, deletePreset } = useFilterPresets();

  // Focus management for accessibility
  const modalTriggerRef = useRef(null);

  const clearToast = () => setToast(null);

  const roleLabel = useMemo(() => {
    if (role === 'admin') return 'Admin';
    if (role === 'supervisor') return 'Supervisor';
    return 'Operator';
  }, [role]);

  // Calculate filter statistics
  const hasActiveFilters = () => {
    return (
      filters.supervisor ||
      filters.eventType ||
      filters.minDowntime ||
      filters.maxDowntime ||
      filters.startDate ||
      filters.endDate
    );
  };

  const filterCount = () => {
    let count = 0;
    if (filters.status && filters.status !== 'Pending') count++;
    if (filters.category) count++;
    if (filters.search) count++;
    if (filters.supervisor) count++;
    if (filters.eventType) count++;
    if (filters.minDowntime || filters.maxDowntime) count++;
    if (filters.startDate || filters.endDate) count++;
    return count;
  };

  // Load breakdowns with object parameter (cleaner API)
  async function loadBreakdowns(options = {}) {
    const {
      page: pageIndex = 0,
      status = '',
      category = '',
      search = '',
      supervisor = '',
      eventType = '',
      minDowntime = '',
      maxDowntime = '',
      startDate = '',
      endDate = '',
    } = options;

    setTableLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      params.append('page', pageIndex);
      if (status) params.append('status', status);
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      if (supervisor) params.append('supervisor', supervisor);
      if (eventType) params.append('event_type', eventType);
      if (minDowntime) params.append('min_downtime', minDowntime);
      if (maxDowntime) params.append('max_downtime', maxDowntime);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await fetch(`/api/breakdowns?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load breakdowns');
      }

      const data = await res.json();
      setRows(data.rows || []);
      setHasMore(data.hasMore || false);
      setPage(pageIndex);
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setTableLoading(false);
    }
  }

  // Update a single filter
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      status: 'Pending',
      category: '',
      search: '',
      supervisor: '',
      eventType: '',
      minDowntime: '',
      maxDowntime: '',
      startDate: '',
      endDate: '',
    });
    setPage(0);
  };

  // Authentication and initial role fetch
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) setUser(data.user || null);

      if (data?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (mounted) {
          setRole(profile?.role || 'operator');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Load breakdowns when filters or page changes
  // This is now the ONLY place where loadBreakdowns is called from effects
  useEffect(() => {
    loadBreakdowns({
      page: 0,
      status: filters.status,
      category: filters.category,
      search: debouncedSearch,
      supervisor: filters.supervisor,
      eventType: filters.eventType,
      minDowntime: filters.minDowntime,
      maxDowntime: filters.maxDowntime,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  }, [
    filters.status,
    filters.category,
    debouncedSearch,
    filters.supervisor,
    filters.eventType,
    filters.minDowntime,
    filters.maxDowntime,
    filters.startDate,
    filters.endDate,
  ]);

  // Handle breakdown creation event (with stable callback)
  useEffect(() => {
    const handler = () => {
      loadBreakdowns({
        page: 0,
        ...filters,
        search: debouncedSearch,
      });
    };

    window.addEventListener('breakdown:created', handler);
    return () => window.removeEventListener('breakdown:created', handler);
  }, [filters, debouncedSearch]);

  // Export respects current filters
  const doExport = async () => {
    if (!user) return setToast({ type: 'error', text: 'Sign in first.' });
    if (role !== 'supervisor' && role !== 'admin') {
      return setToast({ type: 'error', text: 'Only supervisors/admins can export.' });
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error('No session token.');

      const payload = {
        status: filters.status || '',
        category: filters.category || '',
        search: filters.search || '',
        supervisor: filters.supervisor || '',
        event_type: filters.eventType || '',
        min_downtime: filters.minDowntime || '',
        max_downtime: filters.maxDowntime || '',
        start_date: filters.startDate || '1970-01-01',
        end_date: filters.endDate || '2099-12-31',
      };

      const r = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
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
      a.download = `breakdowns_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setToast({ type: 'success', text: 'Export downloaded.' });
    } catch (e) {
      setToast({ type: 'error', text: 'Export failed: ' + (e.message || e) });
    }
  };

  // Role management (dev only, hidden in production)
  const updateRole = async (newRole) => {
    if (process.env.NODE_ENV === 'production') {
      return setToast({ type: 'error', text: 'Role switching disabled in production.' });
    }
    if (!user?.id) return setToast({ type: 'error', text: 'Sign in first.' });
    if (role !== 'admin') {
      return setToast({ type: 'error', text: 'Only Admin can change roles.' });
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

  // Load status history
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

  const handleViewDetails = (item) => {
    setViewingItem(item);
    if (!statusHistory[item.id]) {
      loadStatusHistory(item.id);
    }
  };

  // Pagination
  const onPrev = () => {
    if (page > 0) {
      const newPage = page - 1;
      setPage(newPage);
      loadBreakdowns({
        page: newPage,
        ...filters,
        search: debouncedSearch,
      });
    }
  };

  const onNext = () => {
    if (hasMore) {
      const newPage = page + 1;
      setPage(newPage);
      loadBreakdowns({
        page: newPage,
        ...filters,
        search: debouncedSearch,
      });
    }
  };

  // Edit breakdown
  const startEdit = (breakdown) => {
    setEditingItem(breakdown);
    setEditFormData({ ...breakdown });
    modalTriggerRef.current = document.activeElement;
  };

  const handleEditChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const submitEdit = async () => {
    if (!user?.id) return setToast({ type: 'error', text: 'Sign in first.' });
    if (role !== 'admin') return setToast({ type: 'error', text: 'Only admins can approve breakdowns.' });

    try {
      setSaveLoading(true);
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error('Not authenticated.');

      const r = await fetch('/api/admin-close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingItem.id,
          data: editFormData,
        }),
      });

      const result = await r.json();
      if (!r.ok) {
        throw new Error(result.error || `${r.status} ${r.statusText}`);
      }

      setToast({ type: 'success', text: 'Breakdown approved and closed.' });
      setEditingItem(null);

      // Reload with all current filters preserved
      loadBreakdowns({
        page,
        ...filters,
        search: debouncedSearch,
      });

      // Restore focus
      if (modalTriggerRef.current) modalTriggerRef.current.focus();
    } catch (e) {
      setToast({ type: 'error', text: 'Save failed: ' + (e.message || e) });
    } finally {
      setSaveLoading(false);
    }
  };

  // Reopen via API (for auditability)
  const handleReopen = async (row) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const r = await fetch('/api/reopen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: row.id }),
      });

      if (!r.ok) {
        const error = await r.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to reopen');
      }

      setToast({ type: 'success', text: 'Reopened.' });
      loadBreakdowns({
        page,
        ...filters,
        search: debouncedSearch,
      });
    } catch (e) {
      setToast({ type: 'error', text: 'Reopen failed: ' + (e.message || e) });
    }
  };

  // Save filter preset
  const handleSavePreset = () => {
    if (!presetName.trim()) {
      setToast({ type: 'error', text: 'Please enter a preset name.' });
      return;
    }

    savePreset(presetName, filters);
    setPresetName('');
    setToast({ type: 'success', text: `Preset saved: "${presetName}"` });
  };

  // Load filter preset
  const handleLoadPreset = (name) => {
    setFilters(presets[name]);
    setPage(0);
    setToast({ type: 'success', text: `Loaded preset: "${name}"` });
  };

  // Empty state
  const showEmpty = !tableLoading && rows.length === 0;

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
      {/* Header Cards */}
      <div className="admin-grid">
        {process.env.NODE_ENV !== 'production' && (
          <div className="card admin-card">
            <div className="admin-card-head">
              <div><h3 style={{ margin: 0 }}>Dev Tools</h3></div>
            </div>
            <div className="admin-row">
              <div className="admin-field">
                <div className="small admin-muted">Current role</div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{roleLabel}</div>
              </div>
              <div className="admin-field">
                <div className="small admin-muted">Change role (dev only)</div>
                <select
                  value={role}
                  onChange={(e) => updateRole(e.target.value)}
                  className="input"
                  disabled={!user || role !== 'admin'}
                >
                  <option value="operator">Operator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="card admin-card">
          <div className="admin-card-head">
            <div><h3 style={{ margin: 0 }}>Export</h3></div>
          </div>
          <div className="admin-actions">
            <button className="btn" onClick={doExport} disabled={!user || (role !== 'supervisor' && role !== 'admin')}>
              Export {filterCount() > 0 ? `(${filterCount()} filters active)` : '(all data)'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="filters">
          <div className="filters-left">
            <div className="field">
              <label className="small admin-muted">Status</label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
              >
                <option value="">All</option>
                <option value="Pending">Pending</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="field">
              <label className="small admin-muted">Category</label>
              <select
                value={filters.category}
                onChange={(e) => updateFilter('category', e.target.value)}
              >
                <option value="">All</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Electrical">Electrical</option>
                <option value="Hydraulic">Hydraulic</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="field grow">
              <label className="small admin-muted">Search</label>
              <input
                className="input"
                placeholder="Equipment, description, section, operator…"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>
          </div>

          <div className="filters-right">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '▼ Advanced' : '▶ Advanced'} {hasActiveFilters() && `(${filterCount()})`}
            </button>
            {filterCount() > 0 && (
              <button type="button" className="btn ghost" onClick={clearAllFilters} style={{ color: '#ff6b6b' }}>
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {filterCount() > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
            {filters.status && filters.status !== 'Pending' && (
              <FilterChip label={`Status: ${filters.status}`} onRemove={() => updateFilter('status', '')} />
            )}
            {filters.category && (
              <FilterChip label={`Category: ${filters.category}`} onRemove={() => updateFilter('category', '')} />
            )}
            {filters.search && (
              <FilterChip label={`Search: ${filters.search}`} onRemove={() => updateFilter('search', '')} />
            )}
            {filters.supervisor && (
              <FilterChip label={`Supervisor: ${filters.supervisor}`} onRemove={() => updateFilter('supervisor', '')} />
            )}
            {filters.eventType && (
              <FilterChip label={`Type: ${filters.eventType}`} onRemove={() => updateFilter('eventType', '')} />
            )}
            {(filters.minDowntime || filters.maxDowntime) && (
              <FilterChip
                label={`Downtime: ${filters.minDowntime || '0'}-${filters.maxDowntime || '∞'} min`}
                onRemove={() => { updateFilter('minDowntime', ''); updateFilter('maxDowntime', ''); }}
              />
            )}
            {(filters.startDate || filters.endDate) && (
              <FilterChip
                label={`Date: ${filters.startDate || '?'} to ${filters.endDate || '?'}`}
                onRemove={() => { updateFilter('startDate', ''); updateFilter('endDate', ''); }}
              />
            )}
          </div>
        )}

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <AdvancedFiltersPanel
            filters={filters}
            updateFilter={updateFilter}
            presets={presets}
            onLoadPreset={handleLoadPreset}
            onDeletePreset={deletePreset}
            presetName={presetName}
            setPresetName={setPresetName}
            onSavePreset={handleSavePreset}
          />
        )}
      </div>

      {/* Summary Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
        <StatCard label="Total Results" value={rows.length} />
        <StatCard label="Current Page" value={`${page + 1}`} />
        <StatCard label="Active Filters" value={filterCount()} />
      </div>

      {/* Breakdown History Table */}
      <div className="card admin-card">
        <div className="admin-card-head">
          <div>
            <h3 style={{ margin: 0 }}>Breakdown History</h3>
            <div className="small admin-muted">
              {rows.length > 0 ? `${rows.length} results • Page ${page + 1}` : 'No breakdowns found'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onPrev} disabled={page === 0 || tableLoading}>
              ← Prev
            </button>
            <button className="btn ghost" onClick={onNext} disabled={!hasMore || tableLoading}>
              Next →
            </button>
          </div>
        </div>

        {tableLoading ? (
          <div style={{ padding: 12 }}><div className="skeleton shape-lg" /></div>
        ) : showEmpty ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>No breakdowns found</div>
            <button type="button" className="btn ghost" onClick={clearAllFilters}>
              Clear filters and try again
            </button>
          </div>
        ) : (
          <BreakdownTable
            rows={rows}
            onViewDetails={handleViewDetails}
            onEdit={startEdit}
            onReopen={handleReopen}
            userRole={role}
            setToast={setToast}
          />
        )}
      </div>

      {/* Modals and Toast */}
      <Toast toast={toast} onClose={clearToast} />
      <ViewDetailsModal
        open={!!viewingItem}
        breakdown={viewingItem}
        onClose={() => setViewingItem(null)}
        statusHistory={viewingItem?.id ? statusHistory[viewingItem.id] : null}
      />

      {/* Edit Breakdown Modal */}
      {editingItem && (
        <EditBreakdownModal
          item={editingItem}
          formData={editFormData}
          onFormChange={handleEditChange}
          onSave={submitEdit}
          onClose={() => setEditingItem(null)}
          loading={saveLoading}
        />
      )}
    </Layout>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function FilterChip({ label, onRemove }) {
  return (
    <span style={{
      background: '#e3f2fd',
      padding: '4px 8px',
      borderRadius: 4,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14 }}
        aria-label="Remove filter"
      >
        ×
      </button>
    </span>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>{value}</div>
    </div>
  );
}

function AdvancedFiltersPanel({
  filters,
  updateFilter,
  presets,
  onLoadPreset,
  onDeletePreset,
  presetName,
  setPresetName,
  onSavePreset,
}) {
  return (
    <div style={{
      background: '#f9f9f9',
      padding: 16,
      borderRadius: 6,
      border: '1px solid #e0e0e0',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="field">
          <label className="small admin-muted">Supervisor</label>
          <input
            className="input"
            placeholder="e.g. John Smith"
            value={filters.supervisor}
            onChange={(e) => updateFilter('supervisor', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="small admin-muted">Event Type</label>
          <select value={filters.eventType} onChange={(e) => updateFilter('eventType', e.target.value)}>
            <option value="">All</option>
            <option value="Breakdown">Breakdown</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Inspection">Inspection</option>
          </select>
        </div>

        <div className="field">
          <label className="small admin-muted">Min Downtime (min)</label>
          <input
            type="number"
            className="input"
            placeholder="0"
            value={filters.minDowntime}
            onChange={(e) => updateFilter('minDowntime', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="small admin-muted">Max Downtime (min)</label>
          <input
            type="number"
            className="input"
            placeholder="999"
            value={filters.maxDowntime}
            onChange={(e) => updateFilter('maxDowntime', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="small admin-muted">Start Date</label>
          <input
            type="date"
            className="input"
            value={filters.startDate}
            onChange={(e) => updateFilter('startDate', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="small admin-muted">End Date</label>
          <input
            type="date"
            className="input"
            value={filters.endDate}
            onChange={(e) => updateFilter('endDate', e.target.value)}
          />
        </div>
      </div>

      {/* Presets Section */}
      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <label className="small admin-muted" style={{ display: 'block', marginBottom: 6 }}>Save search as preset</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              className="input"
              placeholder="e.g. Critical Breakdowns"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn ghost" onClick={onSavePreset}>Save</button>
          </div>
        </div>

        {Object.keys(presets).length > 0 && (
          <div>
            <label className="small admin-muted" style={{ display: 'block', marginBottom: 6 }}>Load saved presets</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.keys(presets).map((name) => (
                <div key={name} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => onLoadPreset(name)}
                    style={{ fontSize: 12 }}
                  >
                    {name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePreset(name)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 14,
                    }}
                    aria-label={`Delete preset: ${name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Tips */}
      <details style={{ marginTop: 12, borderTop: '1px solid #e0e0e0', paddingTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: '#666', fontWeight: 500 }}>
          Search tips
        </summary>
        <ul style={{ fontSize: 11, color: '#999', marginTop: 8, marginLeft: 16 }}>
          <li>Multi-field search finds equipment, description, section, and operator names</li>
          <li>Supervisor filter uses partial matching</li>
          <li>Combine date range with downtime to find specific incident patterns</li>
          <li>Save searches as presets for quick access to common queries</li>
        </ul>
      </details>
    </div>
  );
}

function EditBreakdownModal({ item, formData, onFormChange, onSave, onClose, loading }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: '700px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        }}
      >
        {/* Modal Header */}
        <div style={{ padding: 20, borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
          <h3 id="modal-title" style={{ margin: 0, marginBottom: 4 }}>Review & Approve Breakdown</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#999' }}>ID: {item.id}</p>
        </div>

        {/* Modal Content */}
        <div style={{ padding: 20 }}>
          {/* Section 1: Incident Details */}
          <fieldset style={{ border: 'none', padding: 0, marginBottom: 16 }}>
            <legend style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 12 }}>
              Incident Details
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField
                label="Equipment Item"
                value={formData.equipment_item || ''}
                onChange={(v) => onFormChange('equipment_item', v)}
              />
              <FormField
                label="Category"
                type="select"
                value={formData.category || ''}
                onChange={(v) => onFormChange('category', v)}
                options={[
                  { value: '', label: 'Select…' },
                  { value: 'Mechanical', label: 'Mechanical' },
                  { value: 'Electrical', label: 'Electrical' },
                  { value: 'Hydraulic', label: 'Hydraulic' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
              <FormField
                label="Occurred On"
                type="date"
                value={formData.occurred_on || ''}
                onChange={(v) => onFormChange('occurred_on', v)}
              />
              <FormField
                label="Section"
                value={formData.section || ''}
                onChange={(v) => onFormChange('section', v)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <FormField
                label="Start Time"
                type="time"
                value={formData.start_time || ''}
                onChange={(v) => onFormChange('start_time', v)}
              />
              <FormField
                label="End Time"
                type="time"
                value={formData.end_time || ''}
                onChange={(v) => onFormChange('end_time', v)}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <FormField
                label="Description"
                type="textarea"
                value={formData.description || ''}
                onChange={(v) => onFormChange('description', v)}
                rows={4}
              />
            </div>
          </fieldset>

          {/* Section 2: Reporter & Supervisor */}
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 12 }}>
              People & Location
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField
                label="Reported By"
                value={formData.reported_by_name || ''}
                onChange={(v) => onFormChange('reported_by_name', v)}
                readonly
              />
              <FormField
                label="Supervising"
                value={formData.supervisor || ''}
                onChange={(v) => onFormChange('supervisor', v)}
              />
            </div>
          </fieldset>
        </div>

        {/* Modal Footer (Sticky) */}
        <div style={{ padding: 16, borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fafafa' }}>
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={onSave}
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Approve & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, type = 'text', value, onChange, readonly = false, options = [], rows = 3 }) {
  const commonStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 500,
    color: '#666',
  };

  if (type === 'textarea') {
    return (
      <div style={commonStyle}>
        <label style={labelStyle}>{label}</label>
        <textarea
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          style={{ resize: 'vertical' }}
          readOnly={readonly}
        />
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div style={commonStyle}>
        <label style={labelStyle}>{label}</label>
        <select
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div style={commonStyle}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readonly}
      />
    </div>
  );
}
