import Layout from '../../components/Layout';

export default function AdminTools() {
  return (
    <Layout title="Admin Tools — Dishaba Mine" pageTitle="Admin Tools" pageDescription="Privileged tools and debugging helpers">
      <div style={{ padding: 12 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Admin Tools</h3>
          <div className="small muted">Small collection of privileged utilities and diagnostics.</div>
          <div style={{ marginTop: 12 }}>
            <p>This area is reserved for supervisor/admin utilities (export, audit, maintenance).</p>
            <p>Coming soon — contact the platform team to request additional tools.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
