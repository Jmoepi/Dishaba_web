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
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);

  // keep refs up to date without re-running the focus/key effect
  useEffect(() => {
    onConfirmRef.current = onConfirm;
    onCancelRef.current = onCancel;
  }, [onConfirm, onCancel]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;

    // Focus the first input/textarea for immediate typing, fall back to button
    setTimeout(() => {
      const first = dialogRef.current?.querySelector('input, textarea, button');
      first?.focus && first.focus();
    }, 10);

    const onKey = (e) => {
      if (e.key === 'Escape') onCancelRef.current && onCancelRef.current();
      if (e.key === 'Enter') {
        const active = document.activeElement;
        if (dialogRef.current && dialogRef.current.contains(active)) {
          const tag = active && active.tagName && active.tagName.toLowerCase();
          // If focus is inside an input/textarea or contentEditable, allow normal Enter behavior
          if (tag === 'textarea' || tag === 'input' || active?.isContentEditable) {
            return;
          }
          onConfirmRef.current && onConfirmRef.current();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus && prev.focus();
    };
  }, [open]);

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
