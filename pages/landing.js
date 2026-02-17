import Link from 'next/link';
import Layout from '../components/Layout';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Fast Reporting',
    desc: 'Capture incidents in seconds with minimal fields so crews can act immediately.',
  },
  {
    icon: '📊',
    title: 'Actionable Metrics',
    desc: 'Track downtime, MTTR trends, and top equipment to prioritise maintenance.',
  },
  {
    icon: '🛡️',
    title: 'Role-Based Controls',
    desc: 'Operator, Supervisor, and Admin roles backed by server-side rules and audit trails.',
  },
];

const HIGHLIGHTS = [
  { label: 'Offline-first ready', value: 'Works in low-signal areas' },
  { label: 'Supabase RLS', value: 'Least-privilege enforced' },
  { label: 'Export & reporting', value: 'CSV export for shift reports' },
];

export default function Landing() {
  return (
    <Layout showShell={false} title="Dishaba Mine — Welcome">
      <main className="landing">
        <div className="landingWrap">
          {/* Hero */}
          <header className="hero" aria-label="Dishaba Mine landing hero">
            <div className="brandPill">
              <span className="brandDot" aria-hidden="true" />
              Dishaba Mine
              <span className="brandSub">Operations Portal</span>
            </div>

            <h1 className="heroTitle">
              Breakdown tracking that stays reliable
              <span className="heroTitleAccent"> underground and on shift.</span>
            </h1>

            <p className="heroDesc">
              Log incidents, measure downtime, and coordinate repairs with clarity.
              Built for operators, supervisors, and admin reporting.
            </p>

            <div className="heroActions" role="group" aria-label="Primary actions">
              <Link href="/login" className="btn primary">
                Sign in
              </Link>
              <Link href="/admin" className="btn ghost">
                Open Admin
              </Link>
              <Link href="/analytics" className="btn ghost">
                View Analytics
              </Link>
            </div>

            <div className="heroMeta" aria-label="Highlights">
              {HIGHLIGHTS.map((h) => (
                <div key={h.label} className="metaChip">
                  <div className="metaLabel">{h.label}</div>
                  <div className="metaValue">{h.value}</div>
                </div>
              ))}
            </div>
          </header>

          {/* Features */}
          <section className="featureGrid" aria-label="Key features">
            {FEATURES.map((f) => (
              <article key={f.title} className="featureCard">
                <div className="featureIcon" aria-hidden="true">
                  {f.icon}
                </div>
                <h3 className="featureTitle">{f.title}</h3>
                <p className="featureDesc">{f.desc}</p>
              </article>
            ))}
          </section>

          {/* CTA */}
          <section className="cta" aria-label="Get started">
            <div className="ctaCard">
              <div>
                <h2 className="ctaTitle">Ready to start a shift?</h2>
                <p className="ctaDesc">
                  Sign in to log breakdowns, close incidents (role-based), and export reports for management.
                </p>
              </div>
              <div className="ctaActions">
                <Link href="/login" className="btn primary">
                  Sign in
                </Link>
                <Link href="/admin" className="btn ghost">
                  Go to Breakdowns
                </Link>
              </div>
            </div>

            <p className="footnote">
              For internal use only. If you don’t have access, contact your systems administrator.
            </p>
          </section>
        </div>
      </main>

      {/* Scoped styles: keeps it “drop-in” without touching globals.css */}
      {/* eslint-disable react/no-unknown-property */}
      <style jsx>{`
        .landing {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 56px 16px;
          position: relative;
          overflow: hidden;
        }

        /* background glow */
        .landing:before {
          content: '';
          position: absolute;
          inset: -200px;
          background:
            radial-gradient(circle at 20% 20%, rgba(15, 98, 255, 0.18), transparent 40%),
            radial-gradient(circle at 80% 30%, rgba(6, 182, 212, 0.14), transparent 45%),
            radial-gradient(circle at 40% 90%, rgba(245, 158, 11, 0.10), transparent 45%);
          filter: blur(1px);
          pointer-events: none;
        }

        .landingWrap {
          width: 100%;
          max-width: 1040px;
          position: relative;
          z-index: 1;
          display: grid;
          gap: 18px;
        }

        .hero {
          text-align: center;
          padding: 22px;
          border-radius: 16px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.6),
            rgba(255, 255, 255, 0.35)
          );
          border: 1px solid var(--border);
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(8px);
        }

        /* dark mode hero */
        @media (prefers-color-scheme: dark) {
          .hero {
            background: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.06),
              rgba(255, 255, 255, 0.03)
            );
          }
        }

        .brandPill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface);
          box-shadow: var(--shadow-sm);
          font-weight: 800;
        }

        .brandDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--primary), var(--primary-600));
          box-shadow: 0 0 0 4px rgba(15, 98, 255, 0.1);
        }

        .brandSub {
          font-weight: 700;
          color: var(--muted);
          font-size: 12px;
          border-left: 1px solid var(--border);
          padding-left: 10px;
        }

        .heroTitle {
          margin: 16px 0 10px;
          font-size: 44px;
          line-height: 1.05;
          letter-spacing: -0.02em;
          font-weight: 900;
        }

        .heroTitleAccent {
          color: var(--primary);
        }

        .heroDesc {
          margin: 0 auto;
          max-width: 760px;
          color: var(--muted);
          font-size: 18px;
          line-height: 1.5;
        }

        .heroActions {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .heroMeta {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .metaChip {
          text-align: left;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface);
          box-shadow: var(--shadow-sm);
        }

        .metaLabel {
          font-size: 12px;
          font-weight: 800;
          color: var(--muted);
          margin-bottom: 4px;
        }

        .metaValue {
          font-size: 13px;
          font-weight: 800;
          color: var(--text);
        }

        .featureGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .featureCard {
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--surface);
          box-shadow: var(--shadow-sm);
          padding: 16px;
          text-align: left;
        }

        .featureIcon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: linear-gradient(
            135deg,
            rgba(15, 98, 255, 0.12),
            rgba(6, 182, 212, 0.08)
          );
          border: 1px solid var(--border);
          font-size: 18px;
          margin-bottom: 10px;
        }

        .featureTitle {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
        }

        .featureDesc {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.5;
        }

        .cta {
          display: grid;
          gap: 10px;
        }

        .ctaCard {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: linear-gradient(90deg, rgba(15, 98, 255, 0.08), rgba(6, 182, 212, 0.04));
          box-shadow: var(--shadow-sm);
        }

        .ctaTitle {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
        }

        .ctaDesc {
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.5;
          max-width: 700px;
        }

        .ctaActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .footnote {
          text-align: center;
          color: var(--muted);
          font-size: 12px;
          margin: 0;
        }

        /* Responsive */
        @media (max-width: 900px) {
          .heroTitle {
            font-size: 36px;
          }
          .heroMeta {
            grid-template-columns: 1fr;
          }
          .featureGrid {
            grid-template-columns: 1fr;
          }
          .ctaCard {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 420px) {
          .heroTitle {
            font-size: 30px;
          }
        }
      `}</style>
      {/* eslint-enable react/no-unknown-property */}
    </Layout>
  );
}
