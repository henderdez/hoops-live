import { useMemo, useState } from 'react';
import { useLiveGame, useNow } from '../lib/sync.js';
import { derive, periodLabel } from '../lib/stats.js';
import { timeAgo } from '../lib/util.js';
import Scoreboard from './Scoreboard.jsx';
import BoxScore from './BoxScore.jsx';
import PlayByPlay from './PlayByPlay.jsx';

function LineScore({ game, d }) {
  const periods = Array.from({ length: Math.max(4, d.maxPeriod) }, (_, i) => i + 1);
  return (
    <div className="table-scroll">
      <table className="box line">
        <thead>
          <tr><th className="pl"></th>{periods.map((p) => <th key={p}>{periodLabel(p)}</th>)}<th>T</th></tr>
        </thead>
        <tbody>
          {['us', 'opp'].map((t) => (
            <tr key={t}>
              <td className="pl">{t === 'us' ? game.our_name : game.opp_name}</td>
              {periods.map((p) => <td key={p}>{p <= game.period || d.byPeriod[t][p] ? (d.byPeriod[t][p] || 0) : '–'}</td>)}
              <td className="b">{d.score[t]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Viewer({ code }) {
  const { game, events, conn, notFound, lastSync } = useLiveGame(code);
  const d = useMemo(() => (game ? derive(game, events) : null), [game, events]);
  const [tab, setTab] = useState('plays');
  const now = useNow(1000);

  if (notFound) {
    return (
      <div className="page stack center">
        <h1>Game not found</h1>
        <p className="muted">Check the code “{code}” and try again.</p>
        <a className="btn" href="#/">Home</a>
      </div>
    );
  }
  if (!game) return <div className="page center muted">Loading game…</div>;

  const stale = lastSync && now - lastSync > 45000;
  const dot = conn === 'live' && !stale ? 'ok' : conn === 'offline' ? 'bad' : 'wait';

  return (
    <div className="page viewer stack">
      <div className="row between">
        <a className="small-text muted" href="#/">← Hoops Live</a>
        <div className="small-text muted"><span className={`dot ${dot}`} />
          {game.status === 'final' ? 'Final' : conn === 'offline' ? 'Reconnecting…' : 'Live'} · updated {timeAgo(lastSync)}
        </div>
      </div>

      <Scoreboard game={game} d={d} />
      <LineScore game={game} d={d} />

      <div className="tabs">
        {[['plays', 'Plays'], ['us', game.our_name], ['opp', game.opp_name]].map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{k === 'plays' ? label : `${label} box`}</button>
        ))}
      </div>

      {tab === 'plays' && <PlayByPlay d={d} game={game} />}
      {tab === 'us' && <BoxScore game={game} d={d} team="us" />}
      {tab === 'opp' && <BoxScore game={game} d={d} team="opp" />}

      <p className="small-text muted center">Stats are entered by a scorekeeper watching the stream, so they may trail the live action by a few seconds.</p>
    </div>
  );
}
