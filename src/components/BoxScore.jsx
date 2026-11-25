import { sortPlayers, teamTotals, teamName } from '../lib/stats.js';

const fmt = (m, a) => `${m}-${a}`;

function Row({ label, sub, L, showPm, cls = '', foulWarn }) {
  return (
    <tr className={cls}>
      <td className="pl">{label}{sub && <span className="muted"> {sub}</span>}</td>
      <td className="b">{L.pts}</td>
      <td>{fmt(L.fgm, L.fga)}</td>
      <td>{fmt(L.tpm, L.tpa)}</td>
      <td>{fmt(L.ftm, L.fta)}</td>
      <td>{L.oreb + L.dreb}</td>
      <td>{L.ast}</td>
      <td>{L.stl}</td>
      <td>{L.blk}</td>
      <td>{L.to}</td>
      <td className={foulWarn ? `pf-${Math.min(L.pf, 5)}` : ''}>{L.pf}</td>
      {showPm && <td>{L.pm > 0 ? `+${L.pm}` : L.pm}</td>}
    </tr>
  );
}

export default function BoxScore({ game, d, team }) {
  const players = sortPlayers(game.players.filter((p) => p.team === team));
  const showPm = team === 'us';
  const total = teamTotals(game, d, team);
  const teamLine = d.stats[`team:${team}`];
  const hasTeamLine = teamLine && Object.values(teamLine).some((v) => v);

  return (
    <div className="box-wrap">
      <h3 className="box-title">{teamName(game, team)}</h3>
      <div className="table-scroll">
        <table className="box">
          <thead>
            <tr>
              <th className="pl">Player</th><th>PTS</th><th>FG</th><th>3P</th><th>FT</th>
              <th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th>
              {showPm && <th>+/-</th>}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <Row
                key={p.id}
                label={`#${p.number}`}
                sub={p.name}
                L={d.stats[p.id]}
                showPm={showPm}
                foulWarn
                cls={d.onCourt.includes(p.id) ? 'oncourt' : ''}
              />
            ))}
            {hasTeamLine && <Row label="Team / unknown" L={teamLine} showPm={showPm} cls="teamrow" />}
            <Row label="Total" L={total} showPm={showPm} cls="totalrow" />
          </tbody>
        </table>
      </div>
    </div>
  );
}
