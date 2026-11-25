import { periodLabel } from '../lib/stats.js';

export default function Scoreboard({ game, d, children }) {
  const final = game.status === 'final';
  return (
    <div className="scoreboard">
      <div className="sb-team">
        <div className="sb-name">{game.our_name}</div>
        <div className="sb-score">{d.score.us}</div>
        <div className="sb-meta">
          Fouls {d.teamFoulsNow.us}
          {d.bonus.us && <span className="bonus">BONUS</span>}
        </div>
      </div>
      <div className="sb-mid">
        <div className={`sb-period ${final ? 'final' : ''}`}>{final ? 'FINAL' : periodLabel(game.period)}</div>
        {children}
      </div>
      <div className="sb-team">
        <div className="sb-name">{game.opp_name}</div>
        <div className="sb-score">{d.score.opp}</div>
        <div className="sb-meta">
          Fouls {d.teamFoulsNow.opp}
          {d.bonus.opp && <span className="bonus">BONUS</span>}
        </div>
      </div>
    </div>
  );
}
