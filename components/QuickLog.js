import { useRouter } from 'next/router';

export default function QuickLog() {
  const router = useRouter();

  return (
    <div style={{ position: 'fixed', right: 18, bottom: 86, zIndex: 1200 }}>
      <button
        className="btn primary"
        style={{ borderRadius: 999, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}
        onClick={() => router.push('/log')}
      >
        ⛏️ Log
      </button>
    </div>
  );
}
