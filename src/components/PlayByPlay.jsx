import { periodLabel } from '../lib/stats.js';

export default function PlayByPlay({ d, game, onRemove, limit }) {
  const rows = [...d.feed].reverse().slice(0, limit || 400);
  if (!rows.length) return <p className="muted pad">No plays yet.</p>;
  return (
    <ul className="plays">
      {rows.map((f) => (
        <li key={f.id} className={`play ${f.team} ${f.scoring ? 'scoring' : ''}`}>
          <span className="ptag">{periodLabel(f.period)}</span>
          <span className="ptext">{f.text}</span>
          {f.scoring && <span className="pscore">{f.score.us}–{f.score.opp}</span>}
          {onRemove && <button className="x" title="Delete this play" onClick={() => onRemove(f.id)}>✕</button>}
        </li>
      ))}
    </ul>
  );
}
