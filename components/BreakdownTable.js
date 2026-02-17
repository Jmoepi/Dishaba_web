import React, { useState, useEffect } from 'react';
import { formatMinutesHuman, formatMinutesVerbose } from '../lib/formatters';
import Tooltip from './Tooltip';

export default function BreakdownTable({
  rows = [],
  onClose,
  onRequestClose,
  onReopen,
  currentUser = null,
  userRole = 'operator',
  setToast,
}) {
  const [openRow, setOpenRow] = useState(null);

  function fmtDate(value) {
    if (!value) return '—';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleString();
    } catch (e) {
      return String(value);
    }
  }

  const openDetails = (r) => setOpenRow(r);
  const closeDetails = () => setOpenRow(null);

  useEffect(() => {
    if (!openRow) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDetails();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openRow]);

  return (
    <>
      <table className="table" role="table">
        <thead>
          <tr>
            <th>Occurred</th>
            <th>Time</th>
            <th>Equipment</th>
            <th>Category</th>
            <th>Supervisor</th>
            <th>Downtime</th>
            <th style={{ width: 180 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const currentUserId = currentUser?.id || currentUser?.user?.id;
            const isOwner = currentUserId && currentUserId === r.reported_by;
            const allowed =
              ['supervisor', 'admin'].includes(userRole) || (userRole === 'operator' && isOwner);
            return (
              <tr key={r.id}>
                <td data-label="Occurred">
                  <div className="small">{r.occurred_on}</div>
                </td>
                <td data-label="Time">
                  <div className="muted">
                    {r.start_time || '—'} → {r.end_time || '—'}
                  </div>
                </td>
                <td data-label="Equipment">
                  <strong>{r.equipment_item}</strong>
                </td>
                <td data-label="Category">
                  <span className="small muted">{r.category}</span>
                </td>
                <td data-label="Supervisor">
                  {r.supervisor_name || r.supervisor ? (
                    <span className="small">{r.supervisor_name || r.supervisor}</span>
                  ) : (
                    <span className="small muted">—</span>
                  )}
                </td>
                <td data-label="Downtime">
                  {typeof r.downtime_minutes === 'number' ? (
                    <Tooltip label={formatMinutesVerbose(r.downtime_minutes)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge">{formatMinutesHuman(r.downtime_minutes)}</span>
                      </span>
                    </Tooltip>
                  ) : (
                    <span className="small muted">—</span>
                  )}
                </td>
                <td data-label="Actions">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn small" onClick={() => openDetails(r)}>
                      View
                    </button>
                    {r.status !== 'Closed' ? (
                      allowed ? (
                        <button
                          className="btn primary small"
                          onClick={() =>
                            onRequestClose ? onRequestClose(r) : onClose && onClose(r)
                          }
                        >
                          Close
                        </button>
                      ) : (
                        <span className="small muted">Not allowed</span>
                      )
                    ) : (
                      <>
                        <span className="pill closed">Closed</span>
                        {['supervisor', 'admin'].includes(userRole) && (
                          <button
                            className="btn ghost small"
                            onClick={async () => {
                              try {
                                if (onReopen) {
                                  await onReopen(r);
                                } else {
                                  const session = await fetch('/api/reopen', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: r.id }),
                                  });
                                  if (!session.ok) {
                                    let body = null;
                                    try { body = await session.json(); } catch (_) { body = await session.text(); }
                                    throw new Error(body?.error || String(body));
                                  }
                                }
                              } catch (e) {
                                if (typeof setToast === 'function') {
                                  setToast({ type: 'error', text: 'Reopen failed: ' + (e.message || e) });
                                }
                              }
                            }}
                          >
                            Reopen
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Details drawer */}
      {openRow && (
        // Backdrop intentionally handles click to close the drawer.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          className="drawer-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closeDetails}
        >
          {/* Inner drawer stops click propagation to prevent backdrop close. */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{openRow.equipment_item}</h3>
                <div className="small muted">
                  {openRow.category} — {openRow.occurred_on}
                </div>
              </div>
              <div>
                <button className="btn" onClick={closeDetails} aria-label="Close drawer">
                  ✕
                </button>
              </div>
            </div>

            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12, marginTop: 12 }}
            >
              <div>
                <h4 style={{ marginTop: 0 }}>Timeline</h4>
                <div className="small muted">
                  Reported: {openRow.occurred_on} {openRow.start_time || ''}
                </div>
                {openRow.end_time && <div className="small muted">Closed: {openRow.end_time}</div>}
                <div style={{ marginTop: 12 }}>
                  <strong>Notes</strong>
                  <div style={{ marginTop: 8 }} className="small">
                    {openRow.description || (
                      <span className="small muted">No description provided.</span>
                    )}
                  </div>
                  {openRow.status === 'Closed' && (
                    <div style={{ marginTop: 8 }} className="small muted">
                      Closed by: {openRow.closed_by_name || openRow.closed_by || openRow.closed_by_email || '—'}
                    </div>
                  )}
                </div>

                {/* Supervisor-only expanded details */}
                {['supervisor', 'admin'].includes(userRole) && (
                  <div style={{ marginTop: 18 }}>
                    <h4 style={{ marginTop: 0 }}>Supervisor Details</h4>
                    <div style={{ marginTop: 8 }}>
                      <div className="small muted">Reporter</div>
                      <div className="small">
                        {openRow.reported_by_name || openRow.reported_by_email || openRow.reported_by || '—'}
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="small muted">Supervisor</div>
                      <div className="small">{openRow.supervisor_name || openRow.supervisor || '—'}</div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="small muted">Created</div>
                      <div className="small">{fmtDate(openRow.created_at || openRow.occurred_on)}</div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="small muted">Updated</div>
                      <div className="small">{fmtDate(openRow.updated_at)}</div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="small muted">Severity</div>
                      <div className="small">{openRow.severity || openRow.priority || '—'}</div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="small muted">Location</div>
                      <div className="small">{openRow.location || openRow.plant || openRow.area || '—'}</div>
                    </div>
                    {openRow.tags && (
                      <div style={{ marginTop: 8 }}>
                        <div className="small muted">Tags</div>
                        <div className="small">{Array.isArray(openRow.tags) ? openRow.tags.join(', ') : String(openRow.tags)}</div>
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <div className="small muted">Downtime (verbose)</div>
                      <div className="small">
                        {typeof openRow.downtime_minutes === 'number' ? formatMinutesVerbose(openRow.downtime_minutes) : '—'}
                      </div>
                    </div>
                    {openRow.resolution && (
                      <div style={{ marginTop: 12 }}>
                        <div className="small muted">Resolution (full)</div>
                        <div className="small">{openRow.resolution}</div>
                      </div>
                    )}
                    {openRow.status === 'Closed' && (
                      <div style={{ marginTop: 8 }} className="small muted">
                        Closed by: {openRow.closed_by_name || openRow.closed_by || openRow.closed_by_email || '—'}
                      </div>
                    )}
                    {openRow.attachments && (
                      <div style={{ marginTop: 8 }}>
                        <div className="small muted">Attachments</div>
                        <div className="small">
                          {Array.isArray(openRow.attachments)
                            ? openRow.attachments.map((a, i) => (
                                <div key={i}>{a.name || a}</div>
                              ))
                            : String(openRow.attachments)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="card">
                  <div className="small muted">Downtime</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {typeof openRow.downtime_minutes === 'number'
                      ? formatMinutesHuman(openRow.downtime_minutes)
                      : '—'}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {openRow.status !== 'Closed' ? (
                      <div className="small muted">
                        Status: <span className="pill open">Open</span>
                      </div>
                    ) : (
                      <div className="small muted">
                        Status: <span className="pill closed">Closed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn ghost" onClick={closeDetails}>
                Close
              </button>
              {openRow.status !== 'Closed' && (
                <button
                  className="btn primary"
                  onClick={() => {
                    closeDetails();
                    onRequestClose ? onRequestClose(openRow) : onClose && onClose(openRow);
                  }}
                >
                  Close Incident
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
