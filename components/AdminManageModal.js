import React, { useEffect, useMemo, useRef, useState } from 'react';

function detectEntityType(title = '', item = null) {
  if (item?.full_name || item?.role) return 'staff';
  if (item?.name || item?.category || item?.section !== undefined) return 'equipment';
  if (title.toLowerCase().includes('staff')) return 'staff';
  if (title.toLowerCase().includes('equipment')) return 'equipment';
  return 'staff';
}

function getInitialFormData(entityType, mode, item) {
  if (mode === 'edit' && item) {
    return { ...item };
  }

  if (entityType === 'equipment') {
    return {
      name: '',
      category: '',
      section: '',
      is_active: true,
    };
  }

  return {
    email: '',
    full_name: '',
    role: '',
    is_active: true,
  };
}

function validateForm(entityType, mode, formData) {
  const errors = {};

  if (entityType === 'staff') {
    if (mode === 'add' && !formData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (
      mode === 'add' &&
      formData.email?.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      errors.email = 'Enter a valid email address';
    }

    if (!formData.full_name?.trim()) {
      errors.full_name = 'Full name is required';
    }

    if (!formData.role) {
      errors.role = 'Role is required';
    }
  }

  if (entityType === 'equipment') {
    if (!formData.name?.trim()) {
      errors.name = 'Equipment name is required';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }
  }

  return errors;
}

function FieldError({ message }) {
  if (!message) return null;
  return (
    <div
      className="small"
      style={{ color: '#d32f2f', marginTop: 4 }}
      role="alert"
    >
      {message}
    </div>
  );
}

export default function AdminManageModal({
  open,
  onClose,
  title,
  mode = 'add',
  item,
  onSave,
  loading = false,
  entityType: entityTypeProp,
}) {
  const entityType = useMemo(
    () => entityTypeProp || detectEntityType(title, item),
    [entityTypeProp, title, item]
  );

  const [formData, setFormData] = useState(() =>
    getInitialFormData(entityType, mode, item)
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const firstInputRef = useRef(null);
  const titleId = `admin-manage-modal-title-${entityType}`;
  const descId = `admin-manage-modal-desc-${entityType}`;

  useEffect(() => {
    if (!open) return;

    setFormData(getInitialFormData(entityType, mode, item));
    setSubmitAttempted(false);
  }, [entityType, mode, item, open]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      firstInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onClose]);

  const errors = useMemo(
    () => validateForm(entityType, mode, formData),
    [entityType, mode, formData]
  );

  const canSubmit = Object.keys(errors).length === 0;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!canSubmit) return;
    await onSave?.(formData);
  };

  const showError = (field) => submitAttempted ? errors[field] : '';

  if (!open) return null;

  const isStaffForm = entityType === 'staff';
  const isEquipmentForm = entityType === 'equipment';

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!loading) onClose?.();
      }}
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
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 520,
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
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h3 id={titleId} style={{ margin: 0 }}>
              {title}
            </h3>
            <div id={descId} className="small admin-muted" style={{ marginTop: 4 }}>
              {isStaffForm
                ? mode === 'add'
                  ? 'Create a staff profile and send an invitation.'
                  : 'Update staff member details and access.'
                : mode === 'add'
                  ? 'Create a new equipment record.'
                  : 'Update the equipment record.'}
            </div>
          </div>

          <button
            type="button"
            className="btn ghost small"
            onClick={onClose}
            disabled={loading}
            aria-label="Close modal"
          >
            Close
          </button>
        </div>

        {isStaffForm && mode === 'add' && (
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <div className="small" style={{ color: 'var(--text)', fontWeight: 500 }}>
              💌 An invitation email will be sent so the person can set up their account.
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          {isStaffForm && (
            <>
              {mode === 'add' && (
                <div>
                  <label className="small admin-muted" htmlFor="email">
                    Email *
                  </label>
                  <input
                    ref={firstInputRef}
                    id="email"
                    type="email"
                    className="input"
                    placeholder="e.g. john@dishaba.com"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    disabled={loading}
                    aria-invalid={!!showError('email')}
                  />
                  <FieldError message={showError('email')} />
                </div>
              )}

              <div>
                <label className="small admin-muted" htmlFor="full_name">
                  Full Name *
                </label>
                <input
                  ref={mode === 'edit' ? firstInputRef : undefined}
                  id="full_name"
                  type="text"
                  className="input"
                  placeholder="e.g. John Smith"
                  value={formData.full_name || ''}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  disabled={loading}
                  aria-invalid={!!showError('full_name')}
                />
                <FieldError message={showError('full_name')} />
              </div>

              <div>
                <label className="small admin-muted" htmlFor="role">
                  Role *
                </label>
                <select
                  id="role"
                  className="input"
                  value={formData.role || ''}
                  onChange={(e) => handleChange('role', e.target.value)}
                  disabled={loading}
                  aria-invalid={!!showError('role')}
                >
                  <option value="">Select role…</option>
                  <option value="operator">Operator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
                <FieldError message={showError('role')} />
              </div>

              {mode === 'edit' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label
                    style={{
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
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
                <label className="small admin-muted" htmlFor="name">
                  Equipment Name *
                </label>
                <input
                  ref={firstInputRef}
                  id="name"
                  type="text"
                  className="input"
                  placeholder="e.g. Conveyor Belt A"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  disabled={loading}
                  aria-invalid={!!showError('name')}
                />
                <FieldError message={showError('name')} />
              </div>

              <div>
                <label className="small admin-muted" htmlFor="category">
                  Category *
                </label>
                <select
                  id="category"
                  className="input"
                  value={formData.category || ''}
                  onChange={(e) => handleChange('category', e.target.value)}
                  disabled={loading}
                  aria-invalid={!!showError('category')}
                >
                  <option value="">Select category…</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Hydraulic">Hydraulic</option>
                  <option value="Other">Other</option>
                </select>
                <FieldError message={showError('category')} />
              </div>

              <div>
                <label className="small admin-muted" htmlFor="section">
                  Section / Location
                </label>
                <input
                  id="section"
                  type="text"
                  className="input"
                  placeholder="e.g. Area 3, Level 2"
                  value={formData.section || ''}
                  onChange={(e) => handleChange('section', e.target.value)}
                  disabled={loading}
                />
              </div>

              {mode === 'edit' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label
                    style={{
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
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
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Saving…' : mode === 'add' ? 'Create' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
