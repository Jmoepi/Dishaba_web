import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const signIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/admin');
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Sign in — Dishaba Mine">
      <div style={{maxWidth:520,margin:'0 auto',display:'grid',gap:12}}>
        <h2 style={{margin:0}}>Welcome back</h2>
        <div className="small muted">Sign in to access admin tools and analytics</div>
        <form onSubmit={signIn} style={{display:'grid',gap:10}}>
          <div>
            <label htmlFor="email" className="small">Email</label>
            <input id="email" name="email" className="input" value={email} onChange={(e)=>setEmail(e.target.value)} required inputMode="email" />
          </div>
          <div>
            <label htmlFor="password" className="small">Password</label>
            <input id="password" name="password" className="input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          </div>
          {error && <div style={{color:'#ef4444'}}>{error}</div>}
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button className="btn primary" disabled={loading}>{loading? 'Signing...' : 'Sign in'}</button>
            <button type="button" className="btn ghost" onClick={()=>router.push('/')}>Back</button>
          </div>
        </form>
        <div className="small muted">Having trouble? Contact your systems administrator.</div>
      </div>
    </Layout>
  )
}
