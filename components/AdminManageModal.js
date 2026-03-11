import React, { useEffect, useState } from 'react';

export default function AdminManageModal({ open, onClose, title, mode = 'add', item, onSave, loading }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (mode === 'edit' && item) {
      setFormData({ ...item });
    } else {
      setFormData({});
    }
  }, [mode, item, open]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave?.(formData);
  };

  const isStaffForm = title?.includes('Staff');
  const isEquipmentForm = title?.includes('Equipment');

  return (
    <div
      className="modal-backdrop"
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }}
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
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: '500px',
          padding: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="btn ghost small" onClick={onClose} disabled={loading}>
            Close
          </button>
        </div>

        {isStaffForm && mode === 'add' && (
          <div style={{ background: '#f0f7ff', border: '1px solid #c5e1ff', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div className="small" style={{ color: '#0066cc', fontWeight: 500 }}>
              💌 An invitation email will be sent to the person to set up their account
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          {isStaffForm && (
            <>
              {mode === 'add' && (
                <div>
                  <label className="small admin-muted" htmlFor="email">Email *</label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    placeholder="e.g., john@dishaba.com"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    disabled={loading}
                  />
                </div>
              )}
              <div>
                <label className="small admin-muted" htmlFor="full_name">Full Name *</label>
                <input
                  id="full_name"
                  type="text"
                  className="input"
                  placeholder="e.g., John Smith"
                  value={formData.full_name || ''}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="small admin-muted" htmlFor="role">Role *</label>
                <select
                  id="role"
                  className="input"
                  value={formData.role || ''}
                  onChange={(e) => handleChange('role', e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select role…</option>
                  <option value="operator">Operator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {mode === 'edit' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active !== false}
                      onChange={(e) => handleChange('is_active', e.target.checked)}
                      disabled={loading}
                    />
                    <span className="small">Active</span>
                  </label>
                </div>
              )}
            </>
          )}

          {isEquipmentForm && (
            <>
              <div>
                <label className="small admin-muted" htmlFor="name">Equipment Name *</label>
                <input
                  id="name"
                  type="text"
                  className="input"
                  placeholder="e.g., Conveyor Belt A"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="small admin-muted" htmlFor="category">Category *</label>
                <select
                  id="category"
                  className="input"
                  value={formData.category || ''}
                  onChange={(e) => handleChange('category', e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select category…</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Hydraulic">Hydraulic</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="small admin-muted" htmlFor="section">Section / Location</label>
                <input
                  id="section"
                  type="text"
                  className="input"
                  placeholder="e.g., Area 3, Level 2"
                  value={formData.section || ''}
                  onChange={(e) => handleChange('section', e.target.value)}
                  disabled={loading}
                />
              </div>
              {mode === 'edit' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active !== false}
                      onChange={(e) => handleChange('is_active', e.target.checked)}
                      disabled={loading}
                    />
                    <span className="small">Active</span>
                  </label>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
