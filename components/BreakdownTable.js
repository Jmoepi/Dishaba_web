import React, { useMemo, useState, useEffect } from 'react';
import { formatMinutesHuman, formatMinutesVerbose } from '../lib/formatters';
import Tooltip from './Tooltip';
import Sparkline from './Sparkline';

export default function BreakdownTable({
  rows = [],
  onClose,
  onRequestClose,
  currentUser = null,
  userRole = 'operator',
}) {
  const [openRow, setOpenRow] = useState(null);

  const grouped = useMemo(() => {
    // small perf: map equipment -> last N values for sparkline
    const map = {};
    for (const r of rows) {
      map[r.equipment_item] = map[r.equipment_item] || [];
      map[r.equipment_item].push(r.downtime_minutes || 0);
      if (map[r.equipment_item].length > 12) map[r.equipment_item].shift();
    }
    return map;
  }, [rows]);

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
            <th style={{ width: 140 }}>Trend</th>
            <th style={{ width: 180 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOwner = currentUser?.user?.id && currentUser.user.id === r.reported_by;
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
                  {r.supervisor ? (
                    <span className="small">{r.supervisor}</span>
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
                <td data-label="Trend">
                  <Sparkline values={(grouped[r.equipment_item] || []).slice(-8)} />
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
                      <span className="pill closed">Closed</span>
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
                </div>
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
