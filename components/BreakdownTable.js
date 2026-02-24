import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatMinutesHuman, formatMinutesVerbose } from '../lib/formatters';
import Tooltip from './Tooltip';

export default function BreakdownTable({
  rows = [],
  onReopen,
  userRole = 'operator',
  setToast,
}) {
  const [openRow, setOpenRow] = useState(null);

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
            <th>Status</th>
            <th>Occurred</th>
            <th>Equipment</th>
            <th>Category</th>
            <th>Reported By</th>
            <th>Supervisor</th>
            <th>Downtime</th>
            <th style={{ width: 220 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td data-label="Status">
                {r.status === 'Open' ? (
                  <span className="pill open">Open</span>
                ) : (
                  <span className="pill closed">Closed</span>
                )}
              </td>
              <td data-label="Occurred">
                <div className="small">{r.occurred_on}</div>
                <div className="muted">{r.start_time || '—'}</div>
              </td>
              <td data-label="Equipment">
                <strong>{r.equipment_item}</strong>
              </td>
              <td data-label="Category">
                <span className="small muted">{r.category}</span>
              </td>
              <td data-label="Reported By">
                <span className="small">{r.reported_by_name || '—'}</span>
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
              <td data-label="Actions">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn small" onClick={() => openDetails(r)}>
                    View Details
                  </button>
                  {r.status === 'Open' ? (
                    <Link href={`/admin/close/${r.id}`} className="btn primary small">Close Out</Link>
                  ) : (
                    <>
                      {['supervisor', 'admin'].includes(userRole) && (
                        <button
                          className="btn ghost small"
                          onClick={async () => {
                            try {
                              if (onReopen) await onReopen(r);
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
          ))}
        </tbody>
      </table>

      {openRow && (
        <div
          className="drawer-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="drawer"
            role="document"
          >
          <button onClick={closeDetails} style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'transparent', border: 0, cursor: 'default'}} />
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12, marginTop: 12 }}>
              <div>
                <div style={{ marginTop: 12 }}>
                  <strong>Description</strong>
                  <div style={{ marginTop: 8 }} className="small">
                    {openRow.description || <span className="small muted">No description provided.</span>}
                  </div>
                </div>

                {['supervisor', 'admin'].includes(userRole) && (
                  <div style={{ marginTop: 18 }}>
                    <h4 style={{ marginTop: 0 }}>All Details (Supervisor view)</h4>
                    <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 400, overflowY: 'auto' }}>
                      {JSON.stringify(openRow, null, 2)}
                    </pre>
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
                    <div className="small muted">
                      Status: {openRow.status === 'Open' ? <span className="pill open">Open</span> : <span className="pill closed">Closed</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn ghost" onClick={closeDetails}>
                Close
              </button>
              {openRow.status === 'Open' && (
                <Link href={`/admin/close/${openRow.id}`} className="btn primary">Close Out Incident</Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
