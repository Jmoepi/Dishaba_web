import React from 'react';
import Link from 'next/link';
import { formatMinutesHuman, formatMinutesVerbose } from '../lib/formatters';
import Tooltip from './Tooltip';

export default function BreakdownTable({
  rows = [],
  onViewDetails,
  onEdit,
  onReopen,
  userRole = 'operator',
  setToast,
}) {
  return (
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
              {r.status === 'Pending' ? (
                <span className="pill" style={{ background: '#FFA500', color: '#fff' }}>Pending</span>
              ) : r.status === 'Open' ? (
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    console.log('View Details clicked:', r);

                    if (typeof onViewDetails !== 'function') {
                      console.error('onViewDetails prop is missing or not a function');
                      setToast?.({
                        type: 'error',
                        text: 'View details handler is missing from parent component.',
                      });
                      return;
                    }

                    try {
                      onViewDetails(r);
                    } catch (e) {
                      console.error('View details failed:', e);
                      setToast?.({
                        type: 'error',
                        text: 'View details failed: ' + (e.message || e),
                      });
                    }
                  }}
                >
                  View Details
                </button>
                {r.status === 'Pending' && userRole === 'admin' && (
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => {
                      if (typeof onEdit !== 'function') {
                        setToast?.({
                          type: 'error',
                          text: 'Edit handler is missing from parent component.',
                        });
                        return;
                      }
                      try {
                        onEdit(r);
                      } catch (e) {
                        console.error('Edit failed:', e);
                        setToast?.({
                          type: 'error',
                          text: 'Edit failed: ' + (e.message || e),
                        });
                      }
                    }}
                  >
                    Edit & Close
                  </button>
                )}
                {r.status === 'Open' ? (
                  <Link href={`/admin/close/${r.id}`} className="btn primary small">Close Out</Link>
                ) : (
                  <>
                    {['supervisor', 'admin'].includes(userRole) && (
                      <button
                        type="button"
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
  );
}
