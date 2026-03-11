import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import AdminManageModal from '../../components/AdminManageModal';

const TABS = [
  { id: 'staff', label: 'Staff' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'audit', label: 'Audit Logs' },
];

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
        <div className="toast-icon" aria-hidden="true">{icon}</div>
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

function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="small muted">{label}</div>
      <div className="skeleton shape-lg" style={{ height: 140, marginTop: 12 }} />
    </div>
  );
}

function EmptyState({ title, subtitle, action }) {
  return (
    <div style={{ padding: 18, textAlign: 'center' }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div className="small muted" style={{ marginBottom: action ? 14 : 0 }}>
        {subtitle}
      </div>
      {action}
    </div>
  );
}

function FilterBar({ children }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div>
      <label className="small muted" style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

async function apiFetch(url, options = {}) {
  const session = await supabase.auth.getSession();
  const token = session?.data?.session?.access_token;
  if (!token) throw new Error('No session');

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function AdminTools() {
  const [activeTab, setActiveTab] = useState('staff');
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);

  const [accessChecking, setAccessChecking] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  const [staffLoading, setStaffLoading] = useState(false);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [staffSaveLoading, setStaffSaveLoading] = useState(false);
  const [equipmentSaveLoading, setEquipmentSaveLoading] = useState(false);
  const [deleteLoadingKey, setDeleteLoadingKey] = useState('');

  const [staffList, setStaffList] = useState([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [equipmentList, setEquipmentList] = useState([]);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [expandedAuditLogId, setExpandedAuditLogId] = useState(null);

  const [loadedTabs, setLoadedTabs] = useState({
    staff: false,
    equipment: false,
    audit: false,
  });

  // Staff filters
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('');

  // Equipment filters
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState('');
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState('');
  const [equipmentSectionFilter, setEquipmentSectionFilter] = useState('');

  // Audit filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');

  const clearToast = useCallback(() => setToast(null), []);

  const checkAccess = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user || null);

      if (!userData.user?.id) {
        setHasAdminAccess(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (error) throw error;
      setHasAdminAccess(profile?.role === 'admin');
    } catch (e) {
      console.error('Access check failed:', e);
      setHasAdminAccess(false);
    } finally {
      setAccessChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  const markTabLoaded = useCallback((tab) => {
    setLoadedTabs((prev) => ({ ...prev, [tab]: true }));
  }, []);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await apiFetch('/api/admin-manage?type=staff');
      setStaffList(Array.isArray(res.data) ? res.data : []);
      markTabLoaded('staff');
    } catch (e) {
      setToast({ type: 'error', text: 'Failed to load staff: ' + (e.message || e) });
    } finally {
      setStaffLoading(false);
    }
  }, [markTabLoaded]);

  const loadEquipment = useCallback(async () => {
    setEquipmentLoading(true);
    try {
      const res = await apiFetch('/api/admin-manage?type=equipment');
      setEquipmentList(Array.isArray(res.data) ? res.data : []);
      markTabLoaded('equipment');
    } catch (e) {
      setToast({ type: 'error', text: 'Failed to load equipment: ' + (e.message || e) });
    } finally {
      setEquipmentLoading(false);
    }
  }, [markTabLoaded]);

  const loadAuditLogs = useCallback(async (page = 0) => {
    setAuditLoading(true);
    try {
      const res = await apiFetch(`/api/audit-logs?page=${page}&limit=20&days=30`);
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
      setAuditHasMore(Boolean(res.hasMore));
      setAuditPage(page);
      markTabLoaded('audit');
    } catch (e) {
      setToast({ type: 'error', text: 'Failed to load audit logs: ' + (e.message || e) });
    } finally {
      setAuditLoading(false);
    }
  }, [markTabLoaded]);

  useEffect(() => {
    if (accessChecking || !hasAdminAccess) return;

    if (activeTab === 'staff' && !loadedTabs.staff) loadStaff();
    if (activeTab === 'equipment' && !loadedTabs.equipment) loadEquipment();
    if (activeTab === 'audit' && !loadedTabs.audit) loadAuditLogs(0);
  }, [
    accessChecking,
    hasAdminAccess,
    activeTab,
    loadedTabs.staff,
    loadedTabs.equipment,
    loadedTabs.audit,
    loadStaff,
    loadEquipment,
    loadAuditLogs,
  ]);

  const saveStaff = useCallback(async (formData) => {
    setStaffSaveLoading(true);
    try {
      if (!formData.full_name?.trim()) throw new Error('Name is required');
      if (!formData.role) throw new Error('Role is required');

      if (!editingStaff) {
        if (!formData.email?.trim()) throw new Error('Email is required');

        const result = await apiFetch('/api/admin-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
          }),
        });

        setToast({ type: 'success', text: result.message || 'Invitation sent.' });
      } else {
        await apiFetch('/api/admin-manage', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_staff',
            id: editingStaff.id,
            full_name: formData.full_name,
            role: formData.role,
            is_active: formData.is_active,
          }),
        });

        setToast({ type: 'success', text: 'Staff updated successfully' });
      }

      setShowAddStaff(false);
      setEditingStaff(null);
      await loadStaff();
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setStaffSaveLoading(false);
    }
  }, [editingStaff, loadStaff]);

  const deleteStaff = useCallback(async (id) => {
    if (!window.confirm('Delete this staff member permanently?')) return;

    const deleteKey = `staff:${id}`;
    setDeleteLoadingKey(deleteKey);

    try {
      await apiFetch(`/api/admin-manage?type=staff&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setToast({ type: 'success', text: 'Staff deleted' });
      await loadStaff();
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setDeleteLoadingKey('');
    }
  }, [loadStaff]);

  const saveEquipment = useCallback(async (formData) => {
    setEquipmentSaveLoading(true);
    try {
      if (!formData.name?.trim()) throw new Error('Name is required');
      if (!formData.category) throw new Error('Category is required');

      await apiFetch('/api/admin-manage', {
        method: editingEquipment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingEquipment ? 'update_equipment' : 'create_equipment',
          id: editingEquipment?.id,
          ...formData,
        }),
      });

      setToast({
        type: 'success',
        text: `Equipment ${editingEquipment ? 'updated' : 'created'} successfully`,
      });

      setShowAddEquipment(false);
      setEditingEquipment(null);
      await loadEquipment();
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setEquipmentSaveLoading(false);
    }
  }, [editingEquipment, loadEquipment]);

  const deleteEquipment = useCallback(async (id) => {
    if (!window.confirm('Delete this equipment permanently?')) return;

    const deleteKey = `equipment:${id}`;
    setDeleteLoadingKey(deleteKey);

    try {
      await apiFetch(`/api/admin-manage?type=equipment&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setToast({ type: 'success', text: 'Equipment deleted' });
      await loadEquipment();
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setDeleteLoadingKey('');
    }
  }, [loadEquipment]);

  const filteredStaff = useMemo(() => {
    return staffList
      .filter((s) =>
        !staffSearch.trim()
          ? true
          : (s.full_name || '').toLowerCase().includes(staffSearch.trim().toLowerCase())
      )
      .filter((s) => (!staffRoleFilter ? true : s.role === staffRoleFilter))
      .filter((s) => {
        if (!staffStatusFilter) return true;
        return staffStatusFilter === 'active' ? s.is_active !== false : s.is_active === false;
      });
  }, [staffList, staffSearch, staffRoleFilter, staffStatusFilter]);

  const filteredEquipment = useMemo(() => {
    return equipmentList
      .filter((eq) =>
        !equipmentSearch.trim()
          ? true
          : (eq.name || '').toLowerCase().includes(equipmentSearch.trim().toLowerCase())
      )
      .filter((eq) => (!equipmentCategoryFilter ? true : eq.category === equipmentCategoryFilter))
      .filter((eq) => {
        if (!equipmentStatusFilter) return true;
        return equipmentStatusFilter === 'active' ? eq.is_active !== false : eq.is_active === false;
      })
      .filter((eq) =>
        !equipmentSectionFilter.trim()
          ? true
          : (eq.section || '').toLowerCase().includes(equipmentSectionFilter.trim().toLowerCase())
      );
  }, [
    equipmentList,
    equipmentSearch,
    equipmentCategoryFilter,
    equipmentStatusFilter,
    equipmentSectionFilter,
  ]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const haystack = [
        log.action || '',
        log.user_id || '',
        typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {}),
      ]
        .join(' ')
        .toLowerCase();

      const searchMatch = !auditSearch.trim()
        ? true
        : haystack.includes(auditSearch.trim().toLowerCase());

      const actionMatch = !auditActionFilter
        ? true
        : (log.action || '') === auditActionFilter;

      const createdAt = log.created_at ? new Date(log.created_at) : null;
      const fromMatch = !auditDateFrom
        ? true
        : createdAt && createdAt >= new Date(`${auditDateFrom}T00:00:00`);
      const toMatch = !auditDateTo
        ? true
        : createdAt && createdAt <= new Date(`${auditDateTo}T23:59:59`);

      return searchMatch && actionMatch && fromMatch && toMatch;
    });
  }, [auditLogs, auditSearch, auditActionFilter, auditDateFrom, auditDateTo]);

  const expandedAuditLog = useMemo(
    () => auditLogs.find((l) => l.id === expandedAuditLogId) || null,
    [auditLogs, expandedAuditLogId]
  );

  const uniqueAuditActions = useMemo(() => {
    return [...new Set(auditLogs.map((log) => log.action).filter(Boolean))].sort();
  }, [auditLogs]);

  const tabCounts = useMemo(() => ({
    staff: staffList.length,
    equipment: equipmentList.length,
    audit: auditLogs.length,
  }), [staffList.length, equipmentList.length, auditLogs.length]);

  const resetStaffFilters = () => {
    setStaffSearch('');
    setStaffRoleFilter('');
    setStaffStatusFilter('');
  };

  const resetEquipmentFilters = () => {
    setEquipmentSearch('');
    setEquipmentCategoryFilter('');
    setEquipmentStatusFilter('');
    setEquipmentSectionFilter('');
  };

  const resetAuditFilters = () => {
    setAuditSearch('');
    setAuditActionFilter('');
    setAuditDateFrom('');
    setAuditDateTo('');
  };

  if (accessChecking) {
    return (
      <Layout
        title="Admin Tools — Dishaba Mine"
        pageTitle="Admin Tools"
        pageDescription="Manage staff, equipment, and view audit logs"
      >
        <LoadingState label="Checking admin access…" />
      </Layout>
    );
  }

  if (!hasAdminAccess) {
    return (
      <Layout
        title="Admin Tools — Dishaba Mine"
        pageTitle="Admin Tools"
        pageDescription="Manage staff, equipment, and view audit logs"
      >
        <div
          className="card"
          style={{ padding: 24, background: '#fff3cd', border: '1px solid #ffc107' }}
        >
          <h3 style={{ margin: '0 0 8px 0', color: '#856404' }}>Access Denied</h3>
          <div className="small" style={{ color: '#856404' }}>
            You do not have permission to access admin tools. Only administrators can manage
            staff, equipment, and view audit logs.
          </div>
        </div>
        <Toast toast={toast} onClose={clearToast} />
      </Layout>
    );
  }

  return (
    <Layout
      title="Admin Tools — Dishaba Mine"
      pageTitle="Admin Tools"
      pageDescription="Manage staff, equipment, and view audit logs"
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`btn ${activeTab === tab.id ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              borderRadius: 0,
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none',
            }}
          >
            {tab.label}
            {tabCounts[tab.id] > 0 && (
              <span className="small" style={{ marginLeft: 6, opacity: 0.7 }}>
                ({tabCounts[tab.id]})
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'staff' && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Staff Management</h3>
              <div className="small muted">Create, edit, and manage staff members</div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" onClick={loadStaff} disabled={staffLoading}>
                {staffLoading ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  setEditingStaff(null);
                  setShowAddStaff(true);
                }}
                disabled={staffLoading}
              >
                Add Staff
              </button>
            </div>
          </div>

          <FilterBar>
            <FilterField label="Search by name">
              <input
                type="text"
                className="input"
                placeholder="Search staff…"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                disabled={staffLoading}
              />
            </FilterField>

            <FilterField label="Role">
              <select
                className="input"
                value={staffRoleFilter}
                onChange={(e) => setStaffRoleFilter(e.target.value)}
                disabled={staffLoading}
              >
                <option value="">All roles</option>
                <option value="operator">Operator</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </FilterField>

            <FilterField label="Status">
              <select
                className="input"
                value={staffStatusFilter}
                onChange={(e) => setStaffStatusFilter(e.target.value)}
                disabled={staffLoading}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FilterField>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button type="button" className="btn ghost" onClick={resetStaffFilters}>
                Clear filters
              </button>
            </div>
          </FilterBar>

          {staffLoading ? (
            <LoadingState label="Loading staff…" />
          ) : staffList.length === 0 ? (
            <EmptyState
              title="No staff members found"
              subtitle="Add your first staff member to start managing roles and access."
              action={
                <button
                  className="btn primary"
                  onClick={() => {
                    setEditingStaff(null);
                    setShowAddStaff(true);
                  }}
                >
                  Add Staff
                </button>
              }
            />
          ) : filteredStaff.length === 0 ? (
            <EmptyState
              title="No matching staff"
              subtitle="Try adjusting or clearing your filters."
              action={<button className="btn ghost" onClick={resetStaffFilters}>Clear filters</button>}
            />
          ) : (
            <table className="table" role="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => {
                  const isDeleting = deleteLoadingKey === `staff:${staff.id}`;
                  return (
                    <tr key={staff.id}>
                      <td data-label="Name">{staff.full_name}</td>
                      <td data-label="Role">
                        <span className="small" style={{ textTransform: 'capitalize' }}>
                          {staff.role}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`pill ${staff.is_active ? 'ok' : ''}`}
                          style={{
                            background: staff.is_active ? '#4caf50' : '#9e9e9e',
                            color: '#fff',
                          }}
                        >
                          {staff.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td data-label="Actions" style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn small"
                          onClick={() => {
                            setEditingStaff(staff);
                            setShowAddStaff(true);
                          }}
                          disabled={isDeleting}
                        >
                          Edit
                        </button>
                        <button
                          className="btn ghost small"
                          onClick={() => deleteStaff(staff.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Equipment Management</h3>
              <div className="small muted">Create, edit, and manage equipment items</div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" onClick={loadEquipment} disabled={equipmentLoading}>
                {equipmentLoading ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  setEditingEquipment(null);
                  setShowAddEquipment(true);
                }}
                disabled={equipmentLoading}
              >
                Add Equipment
              </button>
            </div>
          </div>

          <FilterBar>
            <FilterField label="Search by name">
              <input
                type="text"
                className="input"
                placeholder="Search equipment…"
                value={equipmentSearch}
                onChange={(e) => setEquipmentSearch(e.target.value)}
                disabled={equipmentLoading}
              />
            </FilterField>

            <FilterField label="Category">
              <select
                className="input"
                value={equipmentCategoryFilter}
                onChange={(e) => setEquipmentCategoryFilter(e.target.value)}
                disabled={equipmentLoading}
              >
                <option value="">All categories</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Electrical">Electrical</option>
                <option value="Hydraulic">Hydraulic</option>
                <option value="Other">Other</option>
              </select>
            </FilterField>

            <FilterField label="Status">
              <select
                className="input"
                value={equipmentStatusFilter}
                onChange={(e) => setEquipmentStatusFilter(e.target.value)}
                disabled={equipmentLoading}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FilterField>

            <FilterField label="Section / location">
              <input
                type="text"
                className="input"
                placeholder="e.g. Area 3"
                value={equipmentSectionFilter}
                onChange={(e) => setEquipmentSectionFilter(e.target.value)}
                disabled={equipmentLoading}
              />
            </FilterField>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button type="button" className="btn ghost" onClick={resetEquipmentFilters}>
                Clear filters
              </button>
            </div>
          </FilterBar>

          {equipmentLoading ? (
            <LoadingState label="Loading equipment…" />
          ) : equipmentList.length === 0 ? (
            <EmptyState
              title="No equipment found"
              subtitle="Create equipment items so operators can log incidents accurately."
              action={
                <button
                  className="btn primary"
                  onClick={() => {
                    setEditingEquipment(null);
                    setShowAddEquipment(true);
                  }}
                >
                  Add Equipment
                </button>
              }
            />
          ) : filteredEquipment.length === 0 ? (
            <EmptyState
              title="No matching equipment"
              subtitle="Try adjusting or clearing your filters."
              action={<button className="btn ghost" onClick={resetEquipmentFilters}>Clear filters</button>}
            />
          ) : (
            <table className="table" role="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Section</th>
                  <th>Status</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEquipment.map((eq) => {
                  const isDeleting = deleteLoadingKey === `equipment:${eq.id}`;
                  return (
                    <tr key={eq.id}>
                      <td data-label="Name"><strong>{eq.name}</strong></td>
                      <td data-label="Category"><span className="small">{eq.category}</span></td>
                      <td data-label="Section"><span className="small">{eq.section || '—'}</span></td>
                      <td data-label="Status">
                        <span
                          className="pill"
                          style={{
                            background: eq.is_active ? '#4caf50' : '#9e9e9e',
                            color: '#fff',
                          }}
                        >
                          {eq.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td data-label="Actions" style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn small"
                          onClick={() => {
                            setEditingEquipment(eq);
                            setShowAddEquipment(true);
                          }}
                          disabled={isDeleting}
                        >
                          Edit
                        </button>
                        <button
                          className="btn ghost small"
                          onClick={() => deleteEquipment(eq.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Audit Logs</h3>
              <div className="small muted">Track admin actions from the last 30 days</div>
            </div>

            <button className="btn ghost" onClick={() => loadAuditLogs(auditPage)} disabled={auditLoading}>
              {auditLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <FilterBar>
            <FilterField label="Search">
              <input
                type="text"
                className="input"
                placeholder="Search action, user, or details…"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                disabled={auditLoading}
              />
            </FilterField>

            <FilterField label="Action">
              <select
                className="input"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                disabled={auditLoading}
              >
                <option value="">All actions</option>
                {uniqueAuditActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Date from">
              <input
                type="date"
                className="input"
                value={auditDateFrom}
                onChange={(e) => setAuditDateFrom(e.target.value)}
                disabled={auditLoading}
              />
            </FilterField>

            <FilterField label="Date to">
              <input
                type="date"
                className="input"
                value={auditDateTo}
                onChange={(e) => setAuditDateTo(e.target.value)}
                disabled={auditLoading}
              />
            </FilterField>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button type="button" className="btn ghost" onClick={resetAuditFilters}>
                Clear filters
              </button>
            </div>
          </FilterBar>

          {auditLoading ? (
            <LoadingState label="Loading audit logs…" />
          ) : auditLogs.length === 0 ? (
            <EmptyState
              title="No audit logs found"
              subtitle="No audit logs were found in the last 30 days."
            />
          ) : filteredAuditLogs.length === 0 ? (
            <EmptyState
              title="No matching audit logs"
              subtitle="Try adjusting or clearing your filters."
              action={<button className="btn ghost" onClick={resetAuditFilters}>Clear filters</button>}
            />
          ) : (
            <>
              <table className="table" role="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>User ID</th>
                    <th style={{ width: 90 }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => {
                    const timestamp = new Date(log.created_at);
                    const isExpanded = expandedAuditLogId === log.id;

                    return (
                      <tr key={log.id}>
                        <td data-label="Timestamp">
                          <span className="small">{timestamp.toLocaleString()}</span>
                        </td>
                        <td data-label="Action">
                          <code style={{ fontSize: 12 }}>{log.action}</code>
                        </td>
                        <td data-label="User ID">
                          <span
                            className="small"
                            style={{ fontFamily: 'monospace', fontSize: 11 }}
                            title={log.user_id || ''}
                          >
                            {log.user_id ? `${log.user_id.substring(0, 8)}…` : '—'}
                          </span>
                        </td>
                        <td data-label="Details">
                          <button
                            className="btn ghost small"
                            onClick={() => setExpandedAuditLogId(isExpanded ? null : log.id)}
                            style={{ padding: '4px 8px' }}
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {expandedAuditLog && (
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
                  <div className="small muted" style={{ marginBottom: 8 }}>
                    Details for {expandedAuditLog.action}
                  </div>
                  <pre
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: 12,
                      fontSize: 12,
                      overflowX: 'auto',
                      color: 'var(--text)',
                    }}
                  >
                    {JSON.stringify(expandedAuditLog.details || {}, null, 2)}
                  </pre>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
                <button
                  className="btn ghost"
                  onClick={() => loadAuditLogs(Math.max(0, auditPage - 1))}
                  disabled={auditPage === 0 || auditLoading}
                >
                  Previous
                </button>
                <button
                  className="btn ghost"
                  onClick={() => loadAuditLogs(auditPage + 1)}
                  disabled={!auditHasMore || auditLoading}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <AdminManageModal
        open={showAddStaff}
        onClose={() => {
          setShowAddStaff(false);
          setEditingStaff(null);
        }}
        title={editingStaff ? 'Edit Staff' : 'Add New Staff'}
        mode={editingStaff ? 'edit' : 'add'}
        item={editingStaff}
        entityType="staff"
        onSave={saveStaff}
        loading={staffSaveLoading}
      />

      <AdminManageModal
        open={showAddEquipment}
        onClose={() => {
          setShowAddEquipment(false);
          setEditingEquipment(null);
        }}
        title={editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}
        mode={editingEquipment ? 'edit' : 'add'}
        item={editingEquipment}
        entityType="equipment"
        onSave={saveEquipment}
        loading={equipmentSaveLoading}
      />

      <Toast toast={toast} onClose={clearToast} />
    </Layout>
  );
}