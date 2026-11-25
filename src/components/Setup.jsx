import { useEffect, useMemo, useRef, useState } from 'react';
import { remote } from '../lib/remote.js';
import { parseRoster, uid, makeCode } from '../lib/util.js';
import { outbox, writeCache } from '../lib/sync.js';

const LAST = 'hb_last_setup';
const loadLast = () => { try { return JSON.parse(localStorage.getItem(LAST)) || {}; } catch { return {}; } };

export default function Setup() {
  const last = useMemo(loadLast, []);
  const [ourName, setOurName] = useState(last.ourName || '');
  const [oppName, setOppName] = useState('');
  const [ourText, setOurText] = useState(last.ourText || '');
  const [oppText, setOppText] = useState('');
  const [starters, setStarters] = useState(new Set(last.starters || []));

  const [rosterId, setRosterId] = useState(null);
  const touched = useRef(false);

  // Prefer the roster saved in your account (same on every device) unless you've already started typing.
  useEffect(() => {
    let dead = false;
    remote.getRoster().then((r) => {
      if (dead || !r || touched.current) return;
      setRosterId(r.id);
      setOurName(r.name || '');
      setOurText((r.players || []).map((p) => `${p.number} ${p.name || ''}`.trim()).join('\n'));
      setStarters(new Set(r.starters || []));
    }).catch(() => {});
    return () => { dead = true; };
  }, []);

  const ours = useMemo(() => parseRoster(ourText), [ourText]);
  const opps = useMemo(() => parseRoster(oppText), [oppText]);
  const startNums = ours.filter((p) => starters.has(p.number)).map((p) => p.number);
  const ready = ourName.trim() && oppName.trim() && ours.length >= 5 && startNums.length === 5;

  const toggle = (num) => {
    const s = new Set(starters);
    if (s.has(num)) s.delete(num); else if (startNums.length < 5) s.add(num);
    setStarters(s);
  };

  const start = (e) => {
    e.preventDefault();
    if (!ready) return;
    const players = [
      ...ours.map((p) => ({ id: uid(), team: 'us', number: p.number, name: p.name })),
      ...opps.map((p) => ({ id: uid(), team: 'opp', number: p.number, name: p.name })),
    ];
    const now = new Date().toISOString();
    const game = {
      id: uid(), code: makeCode(), our_name: ourName.trim(), opp_name: oppName.trim(),
      status: 'live', period: 1, stream_url: null,
      players, starters: players.filter((p) => p.team === 'us' && startNums.includes(p.number)).map((p) => p.id),
      created_at: now, updated_at: now,
    };
    outbox.push('rosters', {
      id: rosterId || uid(), name: ourName.trim(), players: ours, starters: startNums, updated_at: now,
    });
    localStorage.setItem(LAST, JSON.stringify({ ourName: ourName.trim(), ourText, starters: startNums }));
    writeCache(game.id, { game, events: [] });
    outbox.push('games', game);
    window.location.hash = `#/score/${game.id}`;
  };

  return (
    <form className="page stack-lg" onSubmit={start}>
      <header className="row between">
        <h1>New game</h1>
        <a className="btn small" href="#/">Cancel</a>
      </header>

      <section className="card stack">
        <div className="grid2">
          <label>Your team<input value={ourName} onChange={(e) => setOurName(e.target.value)} placeholder="e.g. Eagles" required /></label>
          <label>Opponent<input value={oppName} onChange={(e) => setOppName(e.target.value)} placeholder="e.g. Lincoln" required /></label>
        </div>
      </section>

      <section className="card stack">
        <h2>Your roster</h2>
        <p className="muted">One player per line: number, then name. {rosterId ? 'Loaded from your saved roster. Changes you make are saved when you start the game.' : 'Saved to your account when you start the game.'}</p>
        <textarea rows={8} value={ourText} onChange={(e) => { touched.current = true; setOurText(e.target.value); }} placeholder={'23 Jake Smith\n5 Sam Lee\n11 Chris Park'} />
        {ours.length > 0 && (
          <>
            <h3>Starters <span className="muted">({startNums.length}/5)</span></h3>
            <div className="chips">
              {ours.map((p) => (
                <button type="button" key={p.number} className={`chip ${starters.has(p.number) ? 'on' : ''}`} onClick={() => toggle(p.number)}>
                  #{p.number} {p.name}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card stack">
        <h2>Opponent roster <span className="muted">(optional)</span></h2>
        <p className="muted">Paste numbers if you have them, like <code>12, 23, 5, 31</code>. You can also add players by jersey number during the game.</p>
        <textarea rows={3} value={oppText} onChange={(e) => setOppText(e.target.value)} />
        {opps.length > 0 && <div className="chips">{opps.map((p) => <span className="chip" key={p.number}>#{p.number} {p.name}</span>)}</div>}
      </section>

      <button className="btn primary big" disabled={!ready}>
        {ready ? 'Start game' : 'Add names, 5+ players and pick 5 starters'}
      </button>
    </form>
  );
}