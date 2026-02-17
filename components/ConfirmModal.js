import { useEffect, useRef } from 'react';

export default function ConfirmModal({
  open,
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel = 'Confirm',
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    setTimeout(() => dialogRef.current?.querySelector('button')?.focus(), 10);

    const onKey = (e) => {
      if (e.key === 'Escape') onCancel && onCancel();
      if (e.key === 'Enter') {
        const active = document.activeElement;
        if (dialogRef.current && dialogRef.current.contains(active)) {
          onConfirm && onConfirm();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus && prev.focus();
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    // Backdrop intentionally handles click to close the modal.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel && onCancel();
      }}
    >
      {/* inner modal stops propagation so clicks inside don't close the backdrop */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className="modal" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <h3 id="modal-title" style={{ margin: 0 }}>
            {title}
          </h3>
          <button className="btn" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
