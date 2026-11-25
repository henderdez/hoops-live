import { useEffect, useState } from 'react';
import Home from './components/Home.jsx';
import Setup from './components/Setup.jsx';
import Scorer from './components/Scorer.jsx';
import Viewer from './components/Viewer.jsx';
import Login from './components/Login.jsx';
import { useUser } from './lib/sync.js';

function useRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const f = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return hash.replace(/^#/, '');
}

function ScorerGate({ children }) {
  const user = useUser();
  if (user === undefined) return <div className="page center muted">Loading…</div>;
  if (!user) return <div className="page"><Login /></div>;
  return children;
}

export default function App() {
  const parts = useRoute().split('/').filter(Boolean);
  if (parts[0] === 'g' && parts[1]) return <Viewer code={parts[1]} />;
  if (parts[0] === 'score' && parts[1]) return <ScorerGate><Scorer gameId={parts[1]} key={parts[1]} /></ScorerGate>;
  if (parts[0] === 'new') return <ScorerGate><Setup /></ScorerGate>;
  return <Home />;
}
