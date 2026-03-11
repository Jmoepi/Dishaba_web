import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import AdminManageModal from '../../components/AdminManageModal';

const TABS = ['Staff', 'Equipment', 'Audit Logs'];

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

export default function AdminTools() {
  const [activeTab, setActiveTab] = useState('Staff');
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Staff state
  const [staffList, setStaffList] = useState([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  // Equipment state
  const [equipmentList, setEquipmentList] = useState([]);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);

  const clearToast = () => setToast(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user || null);
    };
    getUser();
  }, []);

  const getToken = async () => {
    const session = await supabase.auth.getSession();
    return session?.data?.session?.access_token;
  };

  // Load staff list
  const loadStaff = async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');
      const r = await fetch('/api/admin-manage?type=staff', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const { data } = await r.json();
      setStaffList(data || []);
    } catch (e) {
      setToast({ type: 'error', text: 'Failed to load staff: ' + (e.message || e) });
    }
  };

  // Load equipment list
  const loadEquipment = async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');
      const r = await fetch('/api/admin-manage?type=equipment', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const { data } = await r.json();
      setEquipmentList(data || []);
    } catch (e) {
      setToast({ type: 'error', text: 'Failed to load equipment: ' + (e.message || e) });
    }
  };

  // Load audit logs
  const loadAuditLogs = async (page = 0) => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');
      const r = await fetch(`/api/audit-logs?page=${page}&limit=20&days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const { data, hasMore } = await r.json();
      setAuditLogs(data || []);
      setAuditHasMore(hasMore);
      setAuditPage(page);
    } catch (e) {
      setToast({ type: 'error', text: 'Failed to load audit logs: ' + (e.message || e) });
    }
  };

  // Save staff (add or edit)
  const saveStaff = async (formData) => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');

      if (!formData.full_name?.trim()) throw new Error('Name is required');
      if (!formData.role) throw new Error('Role is required');

      // For new staff, send invite email
      if (!editingStaff) {
        if (!formData.email?.trim()) throw new Error('Email is required');

        const r = await fetch('/api/admin-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
          }),
        });
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error || 'Failed to create user');
        }
        const result = await r.json();
        setToast({ type: 'success', text: result.message });
      } else {
        // For editing, use the regular manage endpoint
        const r = await fetch('/api/admin-manage', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'update_staff',
            id: editingStaff.id,
            full_name: formData.full_name,
            role: formData.role,
            is_active: formData.is_active,
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
        setToast({ type: 'success', text: 'Staff updated successfully' });
      }

      setShowAddStaff(false);
      setEditingStaff(null);
      await loadStaff();
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  // Delete staff
  const deleteStaff = async (id) => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');
      const r = await fetch(`/api/admin-manage?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setToast({ type: 'success', text: 'Staff deleted' });
      await loadStaff();
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  // Save equipment (add or edit)
  const saveEquipment = async (formData) => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');

      if (!formData.name?.trim()) throw new Error('Name is required');
      if (!formData.category) throw new Error('Category is required');

      const method = editingEquipment ? 'PUT' : 'POST';
      const r = await fetch('/api/admin-manage', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: editingEquipment ? 'update_equipment' : 'create_equipment',
          id: editingEquipment?.id,
          ...formData,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);

      setToast({ type: 'success', text: `Equipment ${editingEquipment ? 'updated' : 'created'} successfully` });
      setShowAddEquipment(false);
      setEditingEquipment(null);
      await loadEquipment();
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  // Delete equipment
  const deleteEquipment = async (id) => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');
      const r = await fetch(`/api/admin-manage?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setToast({ type: 'success', text: 'Equipment deleted' });
      await loadEquipment();
    } catch (e) {
      setToast({ type: 'error', text: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Staff' && staffList.length === 0) loadStaff();
    if (activeTab === 'Equipment' && equipmentList.length === 0) loadEquipment();
    if (activeTab === 'Audit Logs' && auditLogs.length === 0) loadAuditLogs();
  }, [activeTab]);

  return (
    <Layout title="Admin Tools — Dishaba Mine" pageTitle="Admin Tools" pageDescription="Manage staff, equipment, and view audit logs">
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, borderBottom: '1px solid #e0e0e0' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            className={`btn ${activeTab === tab ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab(tab)}
            style={{ borderRadius: 0, borderBottom: activeTab === tab ? '2px solid #0066cc' : 'none' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* STAFF TAB */}
      {activeTab === 'Staff' && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Staff Management</h3>
                <div className="small muted">Create, edit, and manage staff members</div>
              </div>
              <button className="btn primary" onClick={() => { setEditingStaff(null); setShowAddStaff(true); }}>
                Add Staff
              </button>
            </div>

            <table className="table" role="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(staff => (
                  <tr key={staff.id}>
                    <td data-label="Name">{staff.full_name}</td>
                    <td data-label="Role"><span className="small" style={{ textTransform: 'capitalize' }}>{staff.role}</span></td>
                    <td data-label="Status">
                      <span className={`pill ${staff.is_active ? 'ok' : ''}`} style={{ background: staff.is_active ? '#4caf50' : '#ccc', color: '#fff' }}>
                        {staff.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-label="Actions" style={{ display: 'flex', gap: 8 }}>
                      <button className="btn small" onClick={() => { setEditingStaff(staff); setShowAddStaff(true); }}>Edit</button>
                      <button className="btn ghost small" onClick={() => deleteStaff(staff.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {staffList.length === 0 && <div className="small muted" style={{ padding: 12 }}>No staff members found</div>}
          </div>
        </div>
      )}

      {/* EQUIPMENT TAB */}
      {activeTab === 'Equipment' && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Equipment Management</h3>
                <div className="small muted">Create, edit, and manage equipment items</div>
              </div>
              <button className="btn primary" onClick={() => { setEditingEquipment(null); setShowAddEquipment(true); }}>
                Add Equipment
              </button>
            </div>

            <table className="table" role="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Section</th>
                  <th>Status</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipmentList.map(eq => (
                  <tr key={eq.id}>
                    <td data-label="Name"><strong>{eq.name}</strong></td>
                    <td data-label="Category"><span className="small">{eq.category}</span></td>
                    <td data-label="Section"><span className="small">{eq.section || '—'}</span></td>
                    <td data-label="Status">
                      <span className="pill" style={{ background: eq.is_active ? '#4caf50' : '#ccc', color: '#fff' }}>
                        {eq.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-label="Actions" style={{ display: 'flex', gap: 8 }}>
                      <button className="btn small" onClick={() => { setEditingEquipment(eq); setShowAddEquipment(true); }}>Edit</button>
                      <button className="btn ghost small" onClick={() => deleteEquipment(eq.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {equipmentList.length === 0 && <div className="small muted" style={{ padding: 12 }}>No equipment found</div>}
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'Audit Logs' && (
        <div>
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Audit Logs</h3>
              <div className="small muted">Track admin actions from the last 30 days</div>
            </div>

            <table className="table" role="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>User ID</th>
                  <th style={{ width: 200 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, idx) => {
                  const timestamp = new Date(log.created_at);
                  const timeStr = timestamp.toLocaleString();
                  const details = log.details ? JSON.stringify(log.details).substring(0, 50) : '—';
                  return (
                    <tr key={idx}>
                      <td data-label="Timestamp"><span className="small">{timeStr}</span></td>
                      <td data-label="Action"><code style={{ fontSize: 12 }}>{log.action}</code></td>
                      <td data-label="User ID"><span className="small" style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.user_id?.substring(0, 8)}…</span></td>
                      <td data-label="Details"><span className="small">{details}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {auditLogs.length === 0 && <div className="small muted" style={{ padding: 12 }}>No audit logs found</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
              <button className="btn ghost" onClick={() => loadAuditLogs(Math.max(0, auditPage - 1))} disabled={auditPage === 0}>
                Previous
              </button>
              <button className="btn ghost" onClick={() => loadAuditLogs(auditPage + 1)} disabled={!auditHasMore}>
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {activeTab === 'Staff' && (
        <AdminManageModal
          open={showAddStaff}
          onClose={() => { setShowAddStaff(false); setEditingStaff(null); }}
          title={editingStaff ? 'Edit Staff' : 'Add New Staff'}
          mode={editingStaff ? 'edit' : 'add'}
          item={editingStaff}
          onSave={saveStaff}
          loading={loading}
        />
      )}

      {activeTab === 'Equipment' && (
        <AdminManageModal
          open={showAddEquipment}
          onClose={() => { setShowAddEquipment(false); setEditingEquipment(null); }}
          title={editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}
          mode={editingEquipment ? 'edit' : 'add'}
          item={editingEquipment}
          onSave={saveEquipment}
          loading={loading}
        />
      )}

      <Toast toast={toast} onClose={clearToast} />
    </Layout>
  );
}
