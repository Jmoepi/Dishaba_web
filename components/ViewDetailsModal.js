import React, { useEffect } from 'react';

export default function ViewDetailsModal({ open, onClose, breakdown }) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !breakdown) return null;

  return (
    <div
      className="modal-backdrop"
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          onClose?.();
        }
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
        aria-labelledby="view-details-title"
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex="-1"
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 700,
          padding: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 id="view-details-title" style={{ margin: 0 }}>
            Breakdown Details
          </h3>

          <button type="button" className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className="small muted">Status</div>
            <div>{breakdown.status || '—'}</div>
          </div>

          <div>
            <div className="small muted">Occurred On</div>
            <div>{breakdown.occurred_on || '—'}</div>
          </div>

          <div>
            <div className="small muted">Start Time</div>
            <div>{breakdown.start_time || '—'}</div>
          </div>

          <div>
            <div className="small muted">End Time</div>
            <div>{breakdown.end_time || '—'}</div>
          </div>

          <div>
            <div className="small muted">Equipment</div>
            <div>{breakdown.equipment_item || '—'}</div>
          </div>

          <div>
            <div className="small muted">Category</div>
            <div>{breakdown.category || '—'}</div>
          </div>

          <div>
            <div className="small muted">Reported By</div>
            <div>{breakdown.reported_by_name || '—'}</div>
          </div>

          <div>
            <div className="small muted">Supervisor</div>
            <div>{breakdown.supervisor || '—'}</div>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div className="small muted">Description</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{breakdown.description || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
