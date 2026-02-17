import Link from 'next/link';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/admin', label: 'Breakdowns' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/admin', label: 'Admin' },
];

export default function Layout({ children, title = 'Dishaba Mine', pageTitle, pageDescription, pageActions }) {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user || null);
    })();
    return () => { mounted = false };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  };

  const active = (href) => router.pathname === href || (href !== '/' && router.pathname.startsWith(href));

  const resolvedPageTitle = pageTitle || (typeof title === 'string' ? title.split('—')[0].trim() : 'Dashboard');

  return (
    <div className="app-shell">
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>

      <div className="topbar">
        <div className="brand">
          <div className="logo">DM</div>
          <div>
            <div style={{fontWeight:800}}>{/* compact brand */}Dishaba Mine</div>
            <div className="small muted">Operations portal</div>
          </div>
        </div>

        <div className="topbar-actions">
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {user ? (
              <>
                <div className="small muted" style={{marginRight:6}}>{user.email}</div>
                <button className="btn ghost" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <Link href="/login" className="btn ghost">Sign in</Link>
            )}
          </div>
        </div>
      </div>

      <div className="layout">
        <aside className="sidebar" aria-label="Primary navigation">
          <nav className="nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`nav-link ${active(n.href) ? 'active' : ''}`}>{n.label}</Link>
            ))}
          </nav>
        </aside>

        <main className="content">
          <div className="page-header">
            <div>
              <h1 className="page-title">{resolvedPageTitle}</h1>
              {pageDescription && <div className="page-desc">{pageDescription}</div>}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>{pageActions}</div>
          </div>

          <div className="card">{children}</div>
        </main>
      </div>

      <div style={{textAlign:'center',padding:'18px 0',color:'var(--muted)'}}>© {new Date().getFullYear()} Dishaba Mine — internal use only</div>

      {/* Bottom nav for small screens */}
      <div className="bottom-nav" style={{display:'none'}} aria-hidden>
        <Link href="/" className="btn">Home</Link>
        <Link href="/admin" className="btn">Breakdowns</Link>
        <Link href="/analytics" className="btn">Analytics</Link>
      </div>
    </div>
  );
}
