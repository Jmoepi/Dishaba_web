import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loading;
  }, [email, password, loading]);

  const signIn = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      // Optional: redirect to where user came from, otherwise dashboard
      const next = router.query.next ? String(router.query.next) : '/dashboard';
      router.push(next);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Sign in — Dishaba Mine">
      <div
        style={{
          minHeight: 'calc(100vh - 140px)',
          display: 'grid',
          placeItems: 'center',
          padding: 16,
        }}
      >
        <div style={{ width: '100%', maxWidth: 520, display: 'grid', gap: 12 }}>
          {/* Brand / Title */}
          <div style={{ display: 'grid', gap: 6, textAlign: 'center' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                margin: '0 auto',
                display: 'grid',
                placeItems: 'center',
                border: '1px solid var(--border, rgba(0,0,0,0.12))',
                background: 'var(--surface, rgba(255,255,255,0.6))',
              }}
              aria-hidden="true"
            >
              {/* simple icon */}
              <span style={{ fontSize: 18 }}>⛏️</span>
            </div>

            <h2 style={{ margin: 0 }}>Welcome back</h2>
            <div className="small muted">
              Sign in to access analytics and admin tools
            </div>
          </div>

          {/* Card */}
          <div className="card" style={{ padding: 16 }}>
            <form onSubmit={signIn} style={{ display: 'grid', gap: 12 }}>
              {/* Email */}
              <div style={{ display: 'grid', gap: 6 }}>
                <label htmlFor="email" className="small" style={{ fontWeight: 600 }}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                />
              </div>

              {/* Password */}
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="password" className="small" style={{ fontWeight: 600 }}>
                    Password
                  </label>

                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setShowPw((s) => !s)}
                    style={{ padding: '6px 10px' }}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>

                <input
                  id="password"
                  name="password"
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  style={{
                    border: '1px solid rgba(239,68,68,0.35)',
                    background: 'rgba(239,68,68,0.08)',
                    color: '#ef4444',
                    borderRadius: 12,
                    padding: 10,
                    fontSize: 13,
                    lineHeight: 1.3,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Sign-in failed</div>
                  <div>{error}</div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'grid', gap: 10 }}>
                <button className="btn primary" disabled={!canSubmit}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => router.push('/')}
                  disabled={loading}
                >
                  Back
                </button>
              </div>

              <div className="small muted" style={{ textAlign: 'center', marginTop: 4 }}>
                Having trouble? Contact your systems administrator.
              </div>
            </form>
          </div>

          {/* Footer hint */}
          <div className="small muted" style={{ textAlign: 'center' }}>
            Tip: Use your mine-issued credentials.
          </div>
        </div>
      </div>
    </Layout>
  );
}
