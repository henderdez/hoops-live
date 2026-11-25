import { useState } from 'react';
import { remote } from '../lib/remote.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await remote.auth.signIn(email, password); }
    catch (ex) { setErr(ex.message || 'Sign in failed'); }
    setBusy(false);
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Scorer sign in</h2>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      {err && <div className="error">{err}</div>}
      <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
