import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ViewDetailsModal({ open, onClose, breakdown, statusHistory }) {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (!open) return;

    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user || null);
    };
    getUser();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open && breakdown?.id && activeTab === 'comments') {
      loadComments();
    }
  }, [activeTab, breakdown?.id, open]);

  const loadComments = async () => {
    if (!breakdown?.id) return;
    setLoadingComments(true);
    try {
      const r = await fetch(`/api/breakdown-comments?breakdown_id=${breakdown.id}`);
      if (!r.ok) throw new Error('Failed to load comments');
      const { data } = await r.json();
      setComments(data || []);
    } catch (e) {
      console.error('Failed to load comments:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !breakdown?.id || !user) return;

    setSubmittingComment(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error('No session');

      const r = await fetch('/api/breakdown-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          breakdown_id: breakdown.id,
          comment_text: newComment,
        }),
      });

      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Failed to add comment');
      }

      setNewComment('');
      await loadComments();
    } catch (e) {
      console.error('Failed to submit comment:', e);
    } finally {
      setSubmittingComment(false);
    }
  };

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
          maxWidth: '850px',
          maxHeight: '90vh',
          padding: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
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

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e0e0e0', marginBottom: 16, paddingBottom: 12 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'details' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('details')}
            style={{ fontSize: 12 }}
          >
            Details
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'history' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('history')}
            style={{ fontSize: 12 }}
          >
            Status History
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'comments' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('comments')}
            style={{ fontSize: 12 }}
          >
            Comments
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, marginBottom: 16 }}>
          {activeTab === 'details' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="small muted">Status</div>
                <div style={{ fontWeight: 500 }}>{breakdown.status || '—'}</div>
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
                <div><strong>{breakdown.equipment_item || '—'}</strong></div>
              </div>

              <div>
                <div className="small muted">Category</div>
                <div>{breakdown.category || '—'}</div>
              </div>

              <div>
                <div className="small muted">Section</div>
                <div>{breakdown.section || '—'}</div>
              </div>

              <div>
                <div className="small muted">Reported By</div>
                <div>{breakdown.reported_by_name || '—'}</div>
              </div>

              <div>
                <div className="small muted">Supervisor</div>
                <div>{breakdown.supervisor || '—'}</div>
              </div>

              <div>
                <div className="small muted">Downtime (minutes)</div>
                <div>{breakdown.downtime_minutes || '—'}</div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div className="small muted">Description</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{breakdown.description || '—'}</div>
              </div>

              {breakdown.closed_out_by_name && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="small muted">Closed By</div>
                  <div>{breakdown.closed_out_by_name}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <div className="small muted" style={{ marginBottom: 12 }}>Status timeline</div>
              {statusHistory && statusHistory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {statusHistory.map((h, idx) => {
                    const timestamp = new Date(h.created_at);
                    const timeStr = timestamp.toLocaleString();
                    return (
                      <div key={idx} style={{ borderLeft: '3px solid #0066cc', paddingLeft: 12 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>
                          {h.old_status || 'Created'} → <strong>{h.new_status}</strong>
                        </div>
                        <div className="small muted" style={{ marginTop: 4 }}>{timeStr}</div>
                        <div className="small" style={{ marginTop: 4, fontStyle: 'italic' }}>By: {h.changed_by_name}</div>
                        {h.reason && <div className="small" style={{ marginTop: 4, color: '#555' }}>Reason: {h.reason}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="small muted">No status changes recorded</div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div>
              <div className="small muted" style={{ marginBottom: 12 }}>Discussion & notes</div>
              {loadingComments ? (
                <div className="small muted">Loading comments...</div>
              ) : comments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {comments.map(c => (
                    <div key={c.id} style={{ background: '#f9f9f9', padding: 12, borderRadius: 8, borderLeft: '3px solid #0066cc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <strong style={{ fontSize: 13 }}>{c.user_name}</strong>
                          <span className="small muted" style={{ marginLeft: 8 }}>({c.user_role})</span>
                        </div>
                        <div className="small muted">{new Date(c.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{c.comment_text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small muted" style={{ marginBottom: 16 }}>No comments yet</div>
              )}
            </div>
          )}
        </div>

        {/* Comment form (only show in comments tab and if user is logged in) */}
        {activeTab === 'comments' && user && (
          <form onSubmit={submitComment} style={{ borderTop: '1px solid #e0e0e0', paddingTop: 12 }}>
            <textarea
              className="input"
              placeholder="Add a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={submittingComment}
              rows={3}
              style={{ resize: 'vertical', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="submit"
                className="btn primary small"
                disabled={!newComment.trim() || submittingComment}
              >
                {submittingComment ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
