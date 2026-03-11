import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import BreakdownTable from '../components/BreakdownTable';
import Layout from '../components/Layout';
import ViewDetailsModal from '../components/ViewDetailsModal';

const DEFAULT_FILTERS = {
  status: 'Pending',
  category: '',
  search: '',
  supervisor: '',
  eventType: '',
  startDate: '',
  endDate: '',
  minDowntime: '',
  maxDowntime: '',
};

function canExport(role) {
  return ['supervisor', 'admin'].includes(role);
}

function canManageRoles(role) {
  return role === 'admin';
}

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function useFilterPresets(storageKey = 'breakdown_presets') {
  const [presets, setPresets] = useState({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(storageKey);
      setPresets(raw ? JSON.parse(raw) : {});
    } catch {
      setPresets({});
    }
  }, [storageKey]);

  const persist = useCallback(
    (nextPresets) => {
      setPresets(nextPresets);
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(nextPresets));
      }
    },
    [storageKey]
  );

  const savePreset = useCallback(
    (name, value) => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, error: 'Please enter a preset name.' };

      const nextPresets = {
        ...presets,
        [trimmed]: value,
      };

      persist(nextPresets);
      return { ok: true, name: trimmed };
    },
    [persist, presets]
  );

  const deletePreset = useCallback(
    (name) => {
      const nextPresets = { ...presets };
      delete nextPresets[name];
      persist(nextPresets);
      return { ok: true, name };
    },
    [persist, presets]
  );

  return {
    presets,
    savePreset,
    deletePreset,
  };
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast || toast.type === 'error') return;

    const timer = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const icon =
    toast.type === 'error' ? '⛔' : toast.type === 'success' ? '✅' : 'ℹ️';

  const title =
    toast.type === 'error'
      ? 'Error'
      : toast.type === 'success'
        ? 'Success'
        : 'Info';

  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <div className="toast-inner">
        <div className="toast-icon" aria-hidden="true">
          {icon}
        </div>

        <div className="toast-text">
          <div className="toast-title">{title}</div>
          <div className="toast-msg">{toast.text}</div>
        </div>

        <button className="btn ghost small" onClick={onClose} aria-label="Close toast">
          ✕
        </button>
      </div>
    </div>
  );
}

function ActiveFilterChips({ filters, onChange, onClearAll }) {
  const chips = [];

  if (filters.status && filters.status !== DEFAULT_FILTERS.status) {
    chips.push({
      key: 'status',
      label: `Status: ${filters.status}`,
      background: '#e3f2fd',
      onRemove: () => onChange('status', DEFAULT_FILTERS.status),
    });
  }

  if (filters.category) {
    chips.push({
      key: 'category',
      label: `Category: ${filters.category}`,
      background: '#f3e5f5',
      onRemove: () => onChange('category', ''),
    });
  }

  if (filters.search) {
    chips.push({
      key: 'search',
      label: `Search: ${filters.search}`,
      background: '#fff3e0',
      onRemove: () => onChange('search', ''),
    });
  }

  if (filters.supervisor) {
    chips.push({
      key: 'supervisor',
      label: `Supervisor: ${filters.supervisor}`,
      background: '#e8f5e9',
      onRemove: () => onChange('supervisor', ''),
    });
  }

  if (filters.eventType) {
    chips.push({
      key: 'eventType',
      label: `Type: ${filters.eventType}`,
      background: '#ede7f6',
      onRemove: () => onChange('eventType', ''),
    });
  }

  if (filters.minDowntime || filters.maxDowntime) {
    chips.push({
      key: 'downtime',
      label: `Downtime: ${filters.minDowntime || '0'}-${filters.maxDowntime || '∞'} min`,
      background: '#fce4ec',
      onRemove: () => {
        onChange('minDowntime', '');
        onChange('maxDowntime', '');
      },
    });
  }

  if (filters.startDate || filters.endDate) {
    chips.push({
      key: 'date',
      label: `Date: ${filters.startDate || '?'} to ${filters.endDate || '?'}`,
      background: '#f1f8e9',
      onRemove: () => {
        onChange('startDate', '');
        onChange('endDate', '');
      },
    });
  }

  if (!chips.length) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 0',
        alignItems: 'center',
      }}
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          style={{
            background: chip.background,
            padding: '4px 8px',
            borderRadius: 999,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
            aria-label={`Remove ${chip.key} filter`}
          >
            ×
          </button>
        </span>
      ))}

      <button type="button" className="btn ghost" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}

function AdvancedFiltersPanel({
  filters,
  onChange,
  presets,
  presetName,
  setPresetName,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}) {
  return (
    <div
      style={{
        background: '#f9f9f9',
        padding: 12,
        borderRadius: 8,
        border: '1px solid #e0e0e0',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div className="field">
          <label className="small admin-muted" htmlFor="supervisorFilter">
            Supervisor name
          </label>
          <input
            id="supervisorFilter"
            className="input"
            placeholder="e.g. John Smith"
            value={filters.supervisor}
            onChange={(e) => onChange('supervisor', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="small admin-muted" htmlFor="eventTypeFilter">
            Event type
          </label>
          <select
            id="eventTypeFilter"
            className="input"
            value={filters.eventType}
            onChange={(e) => onChange('eventType', e.target.value)}
          >
            <option value="">All</option>
            <option value="Breakdown">Breakdown</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Inspection">Inspection</option>
          </select>
        </div>

        <div className="field">
          <label className="small admin-muted" htmlFor="minDowntimeFilter">
            Min downtime (min)
          </label>
          <input
            id="minDowntimeFilter"
            type="number"
            className="input"
            placeholder="0"
            value={filters.minDowntime}
            onChange={(e) => onChange('minDowntime', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="small admin-muted" htmlFor="maxDowntimeFilter">
            Max downtime (min)
          </label>
          <input
            id="maxDowntimeFilter"
            type="number"
            className="input"
            placeholder="999"
            value={filters.maxDowntime}
            onChange={(e) => onChange('maxDowntime', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="small admin-muted" htmlFor="startDateFilter">
            Start date
          </label>
          <input
            id="startDateFilter"
            type="date"
            className="input"
            value={filters.startDate}
            onChange={(e) => onChange('startDate', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="small admin-muted" htmlFor="endDateFilter">
            End date
          </label>
          <input
            id="endDateFilter"
            type="date"
            className="input"
            value={filters.endDate}
            onChange={(e) => onChange('endDate', e.target.value)}
          />
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <label
            className="small admin-muted"
            htmlFor="presetName"
            style={{ display: 'block', marginBottom: 4 }}
          >
            Save this search as preset
          </label>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              id="presetName"
              type="text"
              className="input"
              placeholder="e.g. Critical Breakdowns"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn ghost" onClick={onSavePreset}>
              Save
            </button>
          </div>
        </div>

        {Object.keys(presets).length > 0 && (
          <div>
            <label className="small admin-muted" style={{ display: 'block', marginBottom: 4 }}>
              Load saved presets
            </label>

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
                      fontSize: 16,
                    }}
                    aria-label={`Delete preset ${name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 12 }}>
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: '#666' }}>
            Search Tips
          </summary>
          <ul style={{ fontSize: 11, color: '#777', marginTop: 8 }}>
            <li>
              <strong>Multi-field search:</strong> equipment name, description, section, and operator
              name
            </li>
            <li>
              <strong>Supervisor:</strong> filter by supervisor name using partial match
            </li>
            <li>
              <strong>Event type:</strong> filter by Breakdown, Maintenance, or Inspection
            </li>
            <li>
              <strong>Downtime:</strong> search for incidents between min and max minutes
            </li>
            <li>
              <strong>Date range:</strong> filter by occurrence date
            </li>
            <li>
              <strong>Combine filters:</strong> mix filters to narrow results
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}

function ApproveBreakdownModal({
  open,
  breakdown,
  formData,
  onChange,
  onClose,
  onSubmit,
  loading,
}) {
  if (!open || !breakdown) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
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
        aria-labelledby="approve-breakdown-title"
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          padding: 20,
          boxShadow: 'var(--shadow-lg)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <h3 id="approve-breakdown-title" style={{ margin: 0 }}>
              Approve Breakdown
            </h3>
            <div className="small admin-muted">Review details and approve for response.</div>
          </div>

          <button type="button" className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <label className="small admin-muted" htmlFor="edit-equipment-item">
              Equipment Item
            </label>
            <input
              id="edit-equipment-item"
              type="text"
              className="input"
              value={formData.equipment_item || ''}
              onChange={(e) => onChange('equipment_item', e.target.value)}
            />
          </div>

          <div>
            <label className="small admin-muted" htmlFor="edit-category">
              Category
            </label>
            <select
              id="edit-category"
              className="input"
              value={formData.category || ''}
              onChange={(e) => onChange('category', e.target.value)}
            >
              <option value="">Select…</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Electrical">Electrical</option>
              <option value="Hydraulic">Hydraulic</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="small admin-muted" htmlFor="edit-occurred-on">
              Occurred On
            </label>
            <input
              id="edit-occurred-on"
              type="date"
              className="input"
              value={formData.occurred_on || ''}
              onChange={(e) => onChange('occurred_on', e.target.value)}
            />
          </div>

          <div>
            <label className="small admin-muted" htmlFor="edit-start-time">
              Start Time
            </label>
            <input
              id="edit-start-time"
              type="time"
              className="input"
              value={formData.start_time || ''}
              onChange={(e) => onChange('start_time', e.target.value)}
            />
          </div>

          <div>
            <label className="small admin-muted" htmlFor="edit-end-time">
              End Time
            </label>
            <input
              id="edit-end-time"
              type="time"
              className="input"
              value={formData.end_time || ''}
              onChange={(e) => onChange('end_time', e.target.value)}
            />
          </div>

          <div>
            <label className="small admin-muted" htmlFor="edit-section">
              Section
            </label>
            <input
              id="edit-section"
              type="text"
              className="input"
              value={formData.section || ''}
              onChange={(e) => onChange('section', e.target.value)}
            />
          </div>

          <div>
            <label className="small admin-muted" htmlFor="edit-reported-by">
              Reported By
            </label>
            <input
              id="edit-reported-by"
              type="text"
              className="input"
              value={formData.reported_by_name || ''}
              onChange={(e) => onChange('reported_by_name', e.target.value)}
            />
          </div>

          <div>
            <label className="small admin-muted" htmlFor="edit-supervisor">
              Supervisor
            </label>
            <input
              id="edit-supervisor"
              type="text"
              className="input"
              value={formData.supervisor || ''}
              onChange={(e) => onChange('supervisor', e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="small admin-muted" htmlFor="edit-description">
            Description
          </label>
          <textarea
            id="edit-description"
            className="input"
            rows={4}
            value={formData.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={onSubmit} disabled={loading}>
            {loading ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReopenBreakdownModal({
  open,
  breakdown,
  reasonCategory,
  reasonDetails,
  onCategoryChange,
  onDetailsChange,
  onClose,
  onSubmit,
  loading,
}) {
  if (!open || !breakdown) return null;

  const isValid = reasonCategory && reasonDetails.trim().length >= 10;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
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
        aria-labelledby="reopen-breakdown-title"
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 600,
          maxHeight: '90vh',
          padding: 20,
          boxShadow: 'var(--shadow-lg)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <h3 id="reopen-breakdown-title" style={{ margin: 0 }}>
              Reopen Breakdown
            </h3>
            <div className="small admin-muted">Provide a reason for reopening this incident.</div>
          </div>

          <button type="button" className="btn ghost small" onClick={onClose} disabled={loading}>
            Close
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="small admin-muted" htmlFor="reopen-category" style={{ display: 'block', marginBottom: 6 }}>
            Reason Category *
          </label>
          <select
            id="reopen-category"
            className="input"
            value={reasonCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            disabled={loading}
          >
            <option value="">Select…</option>
            <option value="Information Error">Information Error</option>
            <option value="Need Adjustment">Need Adjustment</option>
            <option value="Wrong Closure">Wrong Closure</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="small admin-muted" htmlFor="reopen-details" style={{ display: 'block', marginBottom: 6 }}>
            Details * (minimum 10 characters)
          </label>
          <textarea
            id="reopen-details"
            className="input"
            rows={4}
            value={reasonDetails}
            onChange={(e) => onDetailsChange(e.target.value)}
            placeholder="Explain why this breakdown needs to be reopened..."
            disabled={loading}
            style={{ resize: 'vertical' }}
          />
          <div className="small admin-muted" style={{ marginTop: 4 }}>
            {reasonDetails.length}/10{reasonDetails.length >= 10 ? ' ✓' : ' characters'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={onSubmit}
            disabled={loading || !isValid}
          >
            {loading ? 'Reopening…' : 'Reopen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('operator');

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [presetName, setPresetName] = useState('');

  const [toast, setToast] = useState(null);

  const [tableLoading, setTableLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [viewingItem, setViewingItem] = useState(null);
  const [statusHistory, setStatusHistory] = useState({});

  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const [reopeningItem, setReopeningItem] = useState(null);
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');

  const { presets, savePreset, deletePreset } = useFilterPresets();

  const debouncedSearch = useDebouncedValue(filters.search, 350);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      search: debouncedSearch,
    }),
    [filters, debouncedSearch]
  );

  const roleLabel = useMemo(() => {
    if (role === 'admin') return 'Admin';
    if (role === 'supervisor') return 'Supervisor';
    return 'Operator';
  }, [role]);

  const activeFilterCount = useMemo(() => {
    return [
      filters.status !== DEFAULT_FILTERS.status,
      !!filters.category,
      !!filters.search,
      !!filters.supervisor,
      !!filters.eventType,
      !!filters.startDate,
      !!filters.endDate,
      !!filters.minDowntime,
      !!filters.maxDowntime,
    ].filter(Boolean).length;
  }, [filters]);

  const clearToast = useCallback(() => setToast(null), []);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
  }, []);

  const buildQueryString = useCallback((pageIndex, nextFilters) => {
    const params = new URLSearchParams();
    params.append('page', String(pageIndex));

    if (nextFilters.status) params.append('status', nextFilters.status);
    if (nextFilters.category) params.append('category', nextFilters.category);
    if (nextFilters.search) params.append('search', nextFilters.search);
    if (nextFilters.supervisor) params.append('supervisor', nextFilters.supervisor);
    if (nextFilters.eventType) params.append('event_type', nextFilters.eventType);
    if (nextFilters.minDowntime) params.append('min_downtime', nextFilters.minDowntime);
    if (nextFilters.maxDowntime) params.append('max_downtime', nextFilters.maxDowntime);
    if (nextFilters.startDate) params.append('start_date', nextFilters.startDate);
    if (nextFilters.endDate) params.append('end_date', nextFilters.endDate);

    return params.toString();
  }, []);

  const loadBreakdowns = useCallback(
    async ({ pageIndex = 0, nextFilters = effectiveFilters } = {}) => {
      setTableLoading(true);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) throw new Error('Not authenticated');

        const query = buildQueryString(pageIndex, nextFilters);
        const res = await fetch(`/api/breakdowns?${query}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load breakdowns (${res.status})`);
        }

        const data = await res.json();

        setRows(Array.isArray(data.rows) ? data.rows : []);
        setHasMore(Boolean(data.hasMore));
      } catch (error) {
        setToast({ type: 'error', text: error.message || String(error) });
      } finally {
        setTableLoading(false);
      }
    },
    [buildQueryString, effectiveFilters]
  );

  const latestRequestRef = useRef({
    page,
    filters: effectiveFilters,
  });

  useEffect(() => {
    latestRequestRef.current = {
      page,
      filters: effectiveFilters,
    };
  }, [page, effectiveFilters]);

  useEffect(() => {
    let active = true;

    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;

      setUser(data?.user || null);

      if (data?.user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          setRole('operator');
        } else {
          setRole(profile?.role || 'operator');
        }
      }
    }

    init();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [
    effectiveFilters.status,
    effectiveFilters.category,
    effectiveFilters.search,
    effectiveFilters.supervisor,
    effectiveFilters.eventType,
    effectiveFilters.startDate,
    effectiveFilters.endDate,
    effectiveFilters.minDowntime,
    effectiveFilters.maxDowntime,
  ]);

  useEffect(() => {
    loadBreakdowns({ pageIndex: page, nextFilters: effectiveFilters });
  }, [page, effectiveFilters, loadBreakdowns]);

  useEffect(() => {
    const handler = () => {
      const latest = latestRequestRef.current;
      loadBreakdowns({
        pageIndex: latest.page,
        nextFilters: latest.filters,
      }).catch(() => {});
    };

    window.addEventListener('breakdown:created', handler);
    return () => window.removeEventListener('breakdown:created', handler);
  }, [loadBreakdowns]);

  const handleSavePreset = useCallback(() => {
    const result = savePreset(presetName, filters);

    if (!result.ok) {
      setToast({ type: 'error', text: result.error });
      return;
    }

    setPresetName('');
    setToast({ type: 'success', text: `Preset "${result.name}" saved.` });
  }, [filters, presetName, savePreset]);

  const handleLoadPreset = useCallback(
    (name) => {
      const preset = presets[name];
      if (!preset) return;

      setFilters({ ...DEFAULT_FILTERS, ...preset });
      setPage(0);
      setToast({ type: 'success', text: `Loaded preset: "${name}"` });
    },
    [presets]
  );

  const handleDeletePreset = useCallback(
    (name) => {
      deletePreset(name);
      setToast({ type: 'success', text: `Preset deleted: "${name}"` });
    },
    [deletePreset]
  );

  const doExport = useCallback(async () => {
    if (!user) {
      setToast({ type: 'error', text: 'Sign in first.' });
      return;
    }

    if (!canExport(role)) {
      setToast({ type: 'error', text: 'Only supervisors/admins can export.' });
      return;
    }

    setExportLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) throw new Error('No session token.');

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          start_date: '1970-01-01',
          end_date: '2099-12-31',
        }),
      });

      if (!res.ok) {
        const msg =
          (await res.json().catch(() => null))?.error || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'breakdowns_export.csv';
      anchor.click();

      URL.revokeObjectURL(url);

      setToast({ type: 'success', text: 'Export started. Check your downloads.' });
    } catch (error) {
      setToast({ type: 'error', text: `Export failed: ${error.message || error}` });
    } finally {
      setExportLoading(false);
    }
  }, [role, user]);

  const updateRole = useCallback(
    async (newRole) => {
      if (!user?.id) {
        setToast({ type: 'error', text: 'Sign in first.' });
        return;
      }

      if (!canManageRoles(role)) {
        setToast({ type: 'error', text: 'Only Admin can change roles.' });
        return;
      }

      try {
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', user.id);

        if (error) throw error;

        setRole(newRole);
        setToast({ type: 'success', text: 'Role updated.' });
      } catch (error) {
        setToast({ type: 'error', text: error.message || String(error) });
      }
    },
    [role, user?.id]
  );

  const loadStatusHistory = useCallback(async (breakdownId) => {
    try {
      const res = await fetch(`/api/breakdown-comments?breakdown_id=${breakdownId}&history=true`);
      if (!res.ok) throw new Error('Failed to load history');

      const { data } = await res.json();
      setStatusHistory((prev) => ({ ...prev, [breakdownId]: data }));
    } catch (error) {
      console.error('Failed to load status history:', error);
    }
  }, []);

  const handleViewDetails = useCallback(
    (item) => {
      setViewingItem(item);

      if (item?.id && !statusHistory[item.id]) {
        loadStatusHistory(item.id);
      }
    },
    [loadStatusHistory, statusHistory]
  );

  const handleReopen = useCallback((row) => {
    setReopeningItem(row);
    setReasonCategory('');
    setReasonDetails('');
  }, []);

  const submitReopen = useCallback(async () => {
    if (!user?.id) {
      setToast({ type: 'error', text: 'Sign in first.' });
      return;
    }

    if (role !== 'admin') {
      setToast({ type: 'error', text: 'Only admins can reopen.' });
      return;
    }

    if (!reasonCategory || reasonDetails.trim().length < 10) {
      setToast({ type: 'error', text: 'Please select a category and provide at least 10 characters for details.' });
      return;
    }

    setSaveLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) throw new Error('No session token.');

      const res = await fetch('/api/reopen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: reopeningItem.id,
          reasonCategory,
          reasonDetails,
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.error || `${res.status} ${res.statusText}`);
      }

      setToast({ type: 'success', text: 'Breakdown reopened successfully.' });
      setReopeningItem(null);
      setReasonCategory('');
      setReasonDetails('');

      await loadBreakdowns({
        pageIndex: latestRequestRef.current.page,
        nextFilters: latestRequestRef.current.filters,
      });
    } catch (error) {
      setToast({ type: 'error', text: `Reopen failed: ${error.message || error}` });
    } finally {
      setSaveLoading(false);
    }
  }, [reopeningItem?.id, reasonCategory, reasonDetails, role, user?.id, loadBreakdowns]);

  const startEdit = useCallback((breakdown) => {
    setEditingItem(breakdown);
    setEditFormData({ ...breakdown });
  }, []);

  const handleEditChange = useCallback((field, value) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const submitEdit = useCallback(async () => {
    if (!user?.id) {
      setToast({ type: 'error', text: 'Sign in first.' });
      return;
    }

    if (role !== 'admin') {
      setToast({ type: 'error', text: 'Only admins can approve.' });
      return;
    }

    setSaveLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) throw new Error('No session token.');

      const res = await fetch('/api/admin-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingItem.id,
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.error || `${res.status} ${res.statusText}`);
      }

      setToast({ type: 'success', text: 'Breakdown approved successfully.' });
      setEditingItem(null);

      await loadBreakdowns({
        pageIndex: latestRequestRef.current.page,
        nextFilters: latestRequestRef.current.filters,
      });
    } catch (error) {
      setToast({ type: 'error', text: `Approval failed: ${error.message || error}` });
    } finally {
      setSaveLoading(false);
    }
  }, [editingItem?.id, loadBreakdowns, role, user?.id]);

  const totalVisible = rows.length;

  return (
    <Layout
      title="Breakdown Log - Dishaba Mine"
      pageTitle="Breakdown Log"
      pageDescription="Live breakdown and downtime logger"
      pageActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/log" className="btn primary">
            Log new breakdown
          </Link>
        </div>
      }
    >
      <div className="admin-grid">
        <div className="card admin-card">
          <div className="admin-card-head">
            <div>
              <h3 style={{ margin: 0 }}>Permissions</h3>
            </div>
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
            <div>
              <h3 style={{ margin: 0 }}>Export</h3>
            </div>
          </div>

          <div className="admin-actions">
            <button
              className="btn"
              onClick={doExport}
              disabled={!user || !canExport(role) || exportLoading}
            >
              {exportLoading ? 'Exporting…' : 'Export as CSV'}
            </button>
          </div>
        </div>
      </div>

      <div className="filters">
        <div className="filters-left">
          <div className="field">
            <label className="small admin-muted" htmlFor="statusFilter">
              Status
            </label>
            <select
              id="statusFilter"
              className="input"
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
            <label className="small admin-muted" htmlFor="categoryFilter">
              Category
            </label>
            <select
              id="categoryFilter"
              className="input"
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
            <label className="small admin-muted" htmlFor="searchText">
              Multi-field search
            </label>
            <input
              id="searchText"
              className="input"
              placeholder="Search equipment, description, section, operator…"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
        </div>

        <div className="filters-right">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            {showAdvanced ? '▼ Advanced' : '▶ Advanced'}
          </button>

          {activeFilterCount > 0 && (
            <button
              type="button"
              className="btn ghost"
              onClick={clearAllFilters}
              style={{ color: '#ff6b6b' }}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <ActiveFilterChips
        filters={filters}
        onChange={updateFilter}
        onClearAll={clearAllFilters}
      />

      {showAdvanced && (
        <AdvancedFiltersPanel
          filters={filters}
          onChange={updateFilter}
          presets={presets}
          presetName={presetName}
          setPresetName={setPresetName}
          onSavePreset={handleSavePreset}
          onLoadPreset={handleLoadPreset}
          onDeletePreset={handleDeletePreset}
        />
      )}

      <div className="card admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head">
          <div>
            <h3 style={{ margin: 0 }}>Breakdown history</h3>
            <div className="small admin-muted">
              Page <strong>{page + 1}</strong> · Showing <strong>{totalVisible}</strong>{' '}
              records
              {activeFilterCount > 0 ? (
                <>
                  {' '}
                  · <strong>{activeFilterCount}</strong> active filter
                  {activeFilterCount > 1 ? 's' : ''}
                </>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn ghost"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0 || tableLoading}
            >
              Prev
            </button>
            <button
              className="btn ghost"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!hasMore || tableLoading}
            >
              Next
            </button>
          </div>
        </div>

        {tableLoading ? (
          <div style={{ padding: 12 }}>
            <div className="skeleton shape-lg" />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No breakdowns found</div>
            <div className="small admin-muted" style={{ marginBottom: 12 }}>
              Try adjusting or clearing your filters.
            </div>
            {activeFilterCount > 0 && (
              <button type="button" className="btn ghost" onClick={clearAllFilters}>
                Reset filters
              </button>
            )}
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

      <Toast toast={toast} onClose={clearToast} />

      <ViewDetailsModal
        open={!!viewingItem}
        breakdown={viewingItem}
        onClose={() => setViewingItem(null)}
        statusHistory={viewingItem?.id ? statusHistory[viewingItem.id] : null}
      />

      <ApproveBreakdownModal
        open={!!editingItem}
        breakdown={editingItem}
        formData={editFormData}
        onChange={handleEditChange}
        onClose={() => setEditingItem(null)}
        onSubmit={submitEdit}
        loading={saveLoading}
      />

      <ReopenBreakdownModal
        open={!!reopeningItem}
        breakdown={reopeningItem}
        reasonCategory={reasonCategory}
        reasonDetails={reasonDetails}
        onCategoryChange={setReasonCategory}
        onDetailsChange={setReasonDetails}
        onClose={() => {
          setReopeningItem(null);
          setReasonCategory('');
          setReasonDetails('');
        }}
        onSubmit={submitReopen}
        loading={saveLoading}
      />
    </Layout>
  );
}