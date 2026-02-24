import Link from 'next/link';
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import QuickLog from './QuickLog';
import { useTheme } from '../context/ThemeContext';

// Minimal inline icons (no extra deps)
function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };
  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path d="M4 13h8V4H4v9Zm0 7h8v-5H4v5Zm10 0h6V11h-6v9Zm0-18v7h6V2h-6Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'wrench':
      return (
        <svg {...common}>
          <path
            d="M20 7a6 6 0 0 1-8.9 5.2L7.3 16l.7.7-1.6 1.6-2.8-2.8 1.6-1.6.7.7 3.8-3.8A6 6 0 1 1 20 7Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 19V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 17v-6M12 17V7M16 17v-9M20 17v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4 19h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path
            d="M12 2 20 6v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M9 12l2 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

function roleLabel(role) {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'supervisor') return 'Supervisor';
  return 'Operator';
}

function isPrivileged(role) {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'supervisor';
}

export default function Layout({
  children,
  title = 'Dishaba Mine',
  pageTitle,
  pageDescription,
  pageActions,
  showShell = true,
}) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('operator');
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const isAuthPage = router.pathname === '/login';
  const shouldShowShell = showShell && !isAuthPage;

  const isActive = (href) => {
    if (href === '/') return router.pathname === '/';
    return router.pathname === href || router.pathname.startsWith(`${href}/`);
  };

  const resolvedPageTitle = useMemo(() => {
    if (pageTitle) return pageTitle;
    if (typeof title === 'string' && title.includes('—')) return title.split('—')[0].trim();
    return 'Dashboard';
  }, [pageTitle, title]);

  // Build nav with role-based access
  const NAV = useMemo(() => {
    const privileged = isPrivileged(role);
    return [
      // Root is the public landing/home page
      { href: '/', label: 'Home', icon: 'dashboard', show: true },
      // Keep the in-app dashboard accessible
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', show: true },
      { href: '/admin', label: 'Breakdowns', icon: 'wrench', show: true },
      { href: '/analytics', label: 'Analytics', icon: 'chart', show: true },
      // Example admin/supervisor-only area (keep if you have /admin tools, else remove)
      { href: '/admin/tools', label: privileged ? 'Admin Tools' : 'Tools', icon: 'shield', show: privileged },
    ].filter((x) => x.show);
  }, [role]);

  const displayName = useMemo(() => {
    if (!user) return '';
    return (
      user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || ''
    ).toString();
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const inferRoleFast = (u) => {
      const metaRole = u?.user_metadata?.role || u?.app_metadata?.role;
      return metaRole ? String(metaRole).toLowerCase() : null;
    };

    const fetchRoleFromProfiles = async (uid) => {
      // profiles table: id (uuid) + role
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();

      if (error) return null;
      return data?.role ? String(data.role).toLowerCase() : null;
    };

    const loadUserAndRole = async () => {
      setAuthLoading(true);

      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const u = data?.user || null;
      setUser(u);

      // 1) Fast path: metadata
      const metaRole = inferRoleFast(u);
      if (metaRole) {
        setRole(metaRole);
        setAuthLoading(false);
        return;
      }

      // 2) Fallback: profiles
      if (u?.id) {
        const profRole = await fetchRoleFromProfiles(u.id);
        if (!mounted) return;
        setRole(profRole || 'operator');
      } else {
        setRole('operator');
      }

      setAuthLoading(false);
    };

    loadUserAndRole();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const u = session?.user || null;
      setUser(u);

      const metaRole = inferRoleFast(u);
      if (metaRole) {
        setRole(metaRole);
        setAuthLoading(false);
        return;
      }

      if (u?.id) {
        const { data } = await supabase.from('profiles').select('role').eq('id', u.id).single();
        if (!mounted) return;
        setRole((data?.role ? String(data.role) : 'operator').toLowerCase());
      } else {
        setRole('operator');
      }

      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole('operator');
    router.push('/');
  };

  return (
    <div className="app-shell">
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>

      {shouldShowShell && (
        <div className="topbar">
          <div className="brand">
            <div className="logo" aria-hidden="true">
              DM
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>Dishaba Mine</div>
              <div className="small muted">Operations portal</div>
            </div>
          </div>

          {/* Primary navigation moved to topbar */}
          {NAV && NAV.length > 0 && (
            <nav className="nav topnav" aria-label="Primary navigation">
              {NAV.map((n) => (
                <Link
                  key={`${n.href}:${n.label}`}
                  href={n.href}
                  className={`nav-link ${isActive(n.href) ? 'active' : ''}`}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <Icon name={n.icon} />
                  </span>
                  <span className="nav-label">{n.label}</span>
                </Link>
              ))}
            </nav>
          )}

          <div className="actions">
            {authLoading ? (
              <div className="small muted">Checking session…</div>
            ) : user ? (
              <>
                <span className={`role-badge ${roleLabel(role).toLowerCase()}`}>
                  {roleLabel(role)}
                </span>
                <div
                  className="small muted"
                  style={{
                    maxWidth: 320,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={displayName || user?.email}
                >
                  {displayName || user?.email}
                </div>
                <button className="btn ghost" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="btn ghost">
                Sign in
              </Link>
            )}
            <button onClick={toggleTheme} className="btn ghost" style={{ marginLeft: 8 }}>
              {theme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
          </div>
        </div>
      )}

      <div className="layout">
        <main className="content">
          {shouldShowShell && (pageTitle || pageDescription || pageActions) && (
            <div className="page-header">
              <div>
                <h1 className="page-title">{resolvedPageTitle}</h1>
                {pageDescription && <div className="page-desc">{pageDescription}</div>}
              </div>
              {pageActions && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{pageActions}</div>
              )}
            </div>
          )}

          {shouldShowShell ? <div className="card">{children}</div> : <>{children}</>}
        </main>
      </div>
      {/* Always-available quick log button/modal */}
      {shouldShowShell && <QuickLog />}

      {shouldShowShell && (
        <footer style={{ textAlign: 'center', padding: '18px 0', color: 'var(--muted)' }}>
          © {new Date().getFullYear()} Dishaba Mine — internal use only
        </footer>
      )}

      {/* Bottom nav for small screens (icons too) */}
      {shouldShowShell && (
        <div className="bottom-nav" aria-label="Bottom navigation">
          {NAV.slice(0, 3).map((n) => (
            <Link
              key={`bottom:${n.href}:${n.label}`}
              href={n.href}
              className={`btn ghost ${isActive(n.href) ? 'bottom-active' : ''}`}
              title={n.label}
            >
              <span className="nav-icon" aria-hidden="true">
                <Icon name={n.icon} />
              </span>
              <span className="visually-hidden">{n.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
