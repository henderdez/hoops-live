import { useEffect, useState } from 'react';
import { remote, isLocalMode } from '../lib/remote.js';
import { useUser } from '../lib/sync.js';
import Login from './Login.jsx';

export default function Home() {
  const user = useUser();
  const [code, setCode] = useState('');
  const [games, setGames] = useState([]);

  useEffect(() => {
    if (!user) return;
    remote.listGames().then(setGames).catch(() => setGames([]));
  }, [user]);

  const go = (e) => {
    e.preventDefault();
    if (code.trim()) window.location.hash = `#/g/${code.trim().toUpperCase()}`;
  };

  return (
    <div className="page stack-lg">
      <header className="brand">
        <img src="./icon.svg" alt="" width="40" height="40" />
        <h1>Hoops Live</h1>
      </header>

      {isLocalMode && (
        <div className="notice">
          Demo mode: no Supabase keys found, so games are saved only in this browser. See the README to turn on live sharing.
        </div>
      )}

      <form className="card stack" onSubmit={go}>
        <h2>Watch a game</h2>
        <p className="muted">Enter the game code, or just open the link you were given.</p>
        <div className="row">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Game code" maxLength={8} autoCapitalize="characters" />
          <button className="btn primary">Watch</button>
        </div>
      </form>

      <section className="card stack">
        <div className="row between">
          <h2>Scorekeeper</h2>
          {user && !isLocalMode && <button className="btn small" onClick={() => remote.auth.signOut()}>Sign out</button>}
        </div>
        {user === undefined && <p className="muted">Loading…</p>}
        {user === null && <Login />}
        {user && (
          <>
            <a className="btn primary" href="#/new">+ New game</a>
            {games.length > 0 && <h3>Your games</h3>}
            <ul className="list">
              {games.map((g) => (
                <li key={g.id} className="row between">
                  <div>
                    <strong>{g.our_name} vs {g.opp_name}</strong>
                    <div className="muted small-text">{new Date(g.created_at).toLocaleDateString()} · {g.status === 'final' ? 'Final' : 'Live'} · code {g.code}</div>
                  </div>
                  <div className="row">
                    <a className="btn small" href={`#/g/${g.code}`}>View</a>
                    <a className="btn small primary" href={`#/score/${g.id}`}>Score</a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
