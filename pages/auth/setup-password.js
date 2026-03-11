import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function SetupPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);

  // Validate session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUser = sessionData?.session?.user;

        // Extract email from URL
        const urlEmail = router.query.email || '';
        setEmail(urlEmail);

        // For invited users, they'll have a session but not confirmed email yet
        // If there's no session, they need to confirm their email first
        if (!currentUser) {
          setError('Please confirm your email address first by clicking the link in your invitation email.');
        }

        setValidating(false);
      } catch (e) {
        console.error('Session check failed:', e);
        setError('Authentication check failed. Please try again.');
        setValidating(false);
      }
    };

    if (router.isReady) {
      checkSession();
    }
  }, [router.isReady, router.query.email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Update the user's password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateErr) {
        setError(updateErr.message || 'Failed to set password');
        return;
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (e) {
      console.error('Password update failed:', e);
      setError('Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Head>
          <title>Setting Up Password — Dishaba Mine</title>
        </Head>
        <div style={{ textAlign: 'center' }}>
          <div className="skeleton shape-lg" style={{ width: 300, height: 60, margin: '0 auto 12px' }} />
          <div className="small muted">Checking your invitation…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <Head>
        <title>Set Up Your Password — Dishaba Mine</title>
      </Head>

      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 32,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h1 style={{ margin: '0 0 4px 0', fontSize: 28, fontWeight: 700 }}>Welcome!</h1>
        <p className="small muted" style={{ marginTop: 0, marginBottom: 24 }}>
          Set up your password to get started with Dishaba Mine Operations Portal
        </p>

        {error && (
          <div
            style={{
              background: '#ffebee',
              border: '1px solid #ffcdd2',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              color: '#c62828',
              fontSize: 14,
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: '#e8f5e9',
              border: '1px solid #c8e6c9',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              color: '#2e7d32',
              fontSize: 14,
            }}
            role="status"
          >
            ✓ Password set successfully! Redirecting to dashboard…
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="email" className="small muted" style={{ display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              disabled
              style={{ background: 'var(--bg)', cursor: 'not-allowed' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="password" className="small muted" style={{ display: 'block', marginBottom: 6 }}>
              New Password *
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || success}
              autoComplete="new-password"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="confirmPassword" className="small muted" style={{ display: 'block', marginBottom: 6 }}>
              Confirm Password *
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="input"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || success}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn primary"
            style={{ width: '100%' }}
            disabled={loading || success}
          >
            {loading ? 'Setting up…' : success ? 'Done!' : 'Continue'}
          </button>
        </form>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div className="small muted" style={{ textAlign: 'center' }}>
            Need help? Contact your administrator.
          </div>
        </div>
      </div>
    </div>
  );
}
