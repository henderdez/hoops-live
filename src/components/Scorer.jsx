import { useMemo, useRef, useState } from 'react';
import { useScorerGame, useOutboxCount } from '../lib/sync.js';
import { derive, sortPlayers, periodLabel, playerLabel } from '../lib/stats.js';
import { uid } from '../lib/util.js';
import Scoreboard from './Scoreboard.jsx';
import BoxScore from './BoxScore.jsx';
import PlayByPlay from './PlayByPlay.jsx';
import ShareModal from './ShareModal.jsx';

const SETTINGS_KEY = 'hb_settings';
const loadSettings = () => {
  try { return { askAssist: true, askRebound: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; }
  catch { return { askAssist: true, askRebound: true }; }
};

const ACTIONS = {
  m2: { label: '2PT', sub: 'made', cls: 'good' },
  m3: { label: '3PT', sub: 'made', cls: 'good' },
  mft: { label: 'FT', sub: 'made', cls: 'good' },
  x2: { label: '2PT', sub: 'miss', cls: 'bad' },
  x3: { label: '3PT', sub: 'miss', cls: 'bad' },
  xft: { label: 'FT', sub: 'miss', cls: 'bad' },
  oreb: { label: 'O-REB' }, dreb: { label: 'D-REB' }, ast: { label: 'AST' },
  stl: { label: 'STL' }, blk: { label: 'BLK' }, to: { label: 'TO' },
  foul: { label: 'FOUL', cls: 'foul' },
};
const ROWS = [['m2', 'm3', 'mft'], ['x2', 'x3', 'xft'], ['oreb', 'dreb', 'ast', 'stl', 'blk', 'to', 'foul']];

function Tile({ p, L, selected, hot, small, onClick }) {
  return (
    <button className={`tile ${selected ? 'sel' : ''} ${hot ? 'hot' : ''} ${small ? 'small' : ''} pf-${Math.min(L.pf, 5)}`} onClick={onClick}>
      <span className="tnum">{p.number}</span>
      <span className="tname">{p.name}</span>
      <span className="tstat">{L.pts} pts · {L.pf} PF{L.pf >= 5 ? ' OUT' : ''}</span>
    </button>
  );
}

function Sheet({ title, onSkip, children }) {
  return (
    <div className="modal-back sheet-back" onClick={onSkip}>
      <div className="modal sheet stack" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h2>{title}</h2><button className="btn small" onClick={onSkip}>Skip</button></div>
        {children}
      </div>
    </div>
  );
}

function AddPlayer({ team, game, onAdd, onClose }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const submit = (e) => { e.preventDefault(); if (number.trim()) { onAdd({ team, number: number.trim().replace('#', ''), name: name.trim() }); onClose(); } };
  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal stack" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Add {team === 'us' ? game.our_name : game.opp_name} player</h2>
        <input autoFocus inputMode="numeric" placeholder="Jersey number" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="row"><button className="btn primary" disabled={!number.trim()}>Add</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </div>
  );
}

function SettingsModal({ game, settings, onSave, onClose }) {
  const [f, setF] = useState({ our_name: game.our_name, opp_name: game.opp_name });
  const [s, setS] = useState(settings);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <label>Your team<input value={f.our_name} onChange={(e) => setF({ ...f, our_name: e.target.value })} /></label>
        <label>Opponent<input value={f.opp_name} onChange={(e) => setF({ ...f, opp_name: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={s.askAssist} onChange={(e) => setS({ ...s, askAssist: e.target.checked })} /> Ask “Assist by?” after our made shots</label>
        <label className="check"><input type="checkbox" checked={s.askRebound} onChange={(e) => setS({ ...s, askRebound: e.target.checked })} /> Ask “Rebound by?” after missed shots</label>
        <div className="row">
          <button className="btn primary" onClick={() => { onSave(f, s); onClose(); }}>Save</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function Scorer({ gameId }) {
  const { game, events, phase, addEvents, undo, removeEvent, updateGame } = useScorerGame(gameId);
  const pending = useOutboxCount();
  const d = useMemo(() => (game ? derive(game, events) : null), [game, events]);

  const [team, setTeam] = useState('us');
  const [selected, setSelected] = useState(null); // player id | 'team' | null
  const [pendingIn, setPendingIn] = useState(null); // bench player waiting to sub in
  const [prompt, setPrompt] = useState(null);
  const [modal, setModal] = useState(null); // share | settings | add
  const [panel, setPanel] = useState('log');
  const [settings, setSettings] = useState(loadSettings);
  const [toast, setToast] = useState('');
  const toastTimer = useRef();

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  };

  if (!game) {
    return (
      <div className="page center stack">
        {phase === 'loading' ? <p className="muted">Loading game…</p> : (<><h1>Game not found</h1><a className="btn" href="#/">Home</a></>)}
      </div>
    );
  }

  const byId = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const ours = sortPlayers(game.players.filter((p) => p.team === 'us'));
  const onCourt = ours.filter((p) => d.onCourt.includes(p.id));
  const bench = ours.filter((p) => !d.onCourt.includes(p.id));
  const opps = sortPlayers(game.players.filter((p) => p.team === 'opp'));
  const L = (id) => d.stats[id];

  const selLabel = selected === 'team'
    ? `${team === 'us' ? game.our_name : game.opp_name} (team / unknown #)`
    : selected ? playerLabel(game, byId[selected]) : null;

  const doAction = (type) => {
    if (!selected) { flash('Tap a player first'); return; }
    const player_id = selected === 'team' ? null : selected;
    const grp = uid();
    addEvents([{ type, team, player_id, meta: { grp } }]);
    setSelected(null);
    if (type === 'foul' && player_id) {
      const n = (d.stats[player_id]?.pf || 0) + 1;
      if (n === 4) flash(`${playerLabel(game, byId[player_id])} has 4 fouls`);
      if (n >= 5) flash(`${playerLabel(game, byId[player_id])} fouled out (5)`);
    }
    if (team === 'us' && (type === 'm2' || type === 'm3') && settings.askAssist) setPrompt({ kind: 'assist', grp, shooter: player_id });
    if ((type === 'x2' || type === 'x3') && settings.askRebound) setPrompt({ kind: 'rebound', grp, team });
  };

  const pickAssist = (pid) => { addEvents([{ type: 'ast', team: 'us', player_id: pid, meta: { grp: prompt.grp } }]); setPrompt(null); };
  const pickRebound = (rteam, pid) => {
    addEvents([{ type: rteam === prompt.team ? 'oreb' : 'dreb', team: rteam, player_id: pid, meta: { grp: prompt.grp } }]);
    setPrompt(null);
  };

  const clickOnCourt = (id) => {
    if (pendingIn) {
      addEvents([{ type: 'sub', team: 'us', meta: { grp: uid(), in: pendingIn, out: id } }]);
      flash(`${playerLabel(game, byId[pendingIn])} in for ${playerLabel(game, byId[id])}`);
      setPendingIn(null);
    } else setSelected(selected === id ? null : id);
  };
  const clickBench = (id) => { setSelected(null); setPendingIn(pendingIn === id ? null : id); };

  const addPlayer = ({ team: t, number, name }) => {
    const existing = game.players.find((p) => p.team === t && p.number === number);
    if (existing) { setSelected(existing.id); flash(`#${number} is already on the roster`); return; }
    const p = { id: uid(), team: t, number, name };
    updateGame({ players: [...game.players, p] });
    if (t === team) setSelected(p.id);
  };

  const doUndo = () => {
    setPrompt(null); setSelected(null);
    flash(undo() ? 'Undid last play' : 'Nothing to undo');
  };

  const switchTeam = (t) => { setTeam(t); setSelected(null); setPendingIn(null); };
  const final = game.status === 'final';

  return (
    <div className="scorer">
      <div className="topbar">
        <Scoreboard game={game} d={d}>
          <div className="period-ctl">
            <button className="btn small" disabled={game.period <= 1} onClick={() => updateGame({ period: game.period - 1 })} aria-label="Previous period">‹</button>
            <button className="btn small" onClick={() => updateGame({ period: game.period + 1 })} aria-label="Next period">→ {periodLabel(game.period + 1)}</button>
          </div>
        </Scoreboard>
        <div className="toolbar">
          <a className="btn small" href="#/">☰</a>
          <button className="btn small" onClick={() => setModal('share')}>Share</button>
          <button className="btn small" onClick={() => setModal('settings')}>⚙</button>
          {final
            ? <button className="btn small" onClick={() => updateGame({ status: 'live' })}>Reopen</button>
            : <button className="btn small" onClick={() => { if (window.confirm('End the game and mark it final?')) updateGame({ status: 'final' }); }}>End game</button>}
          <span className={`sync ${pending ? 'wait' : 'ok'}`}>{pending ? `Saving… ${pending}` : 'Synced ✓'}</span>
        </div>
      </div>

      <div className="cols">
        <div className="col-right stack">
          <div className="tabs team-tabs">
            <button className={team === 'us' ? 'on' : ''} onClick={() => switchTeam('us')}>{game.our_name}</button>
            <button className={team === 'opp' ? 'on' : ''} onClick={() => switchTeam('opp')}>{game.opp_name}</button>
          </div>

          {team === 'us' ? (
            <>
              <div className="label">On court {pendingIn && <span className="hint">Tap who comes out ↓</span>}</div>
              <div className="tiles">
                {onCourt.map((p) => <Tile key={p.id} p={p} L={L(p.id)} selected={selected === p.id} hot={!!pendingIn} onClick={() => clickOnCourt(p.id)} />)}
                <button className={`tile team ${selected === 'team' ? 'sel' : ''}`} onClick={() => setSelected(selected === 'team' ? null : 'team')}>TEAM</button>
              </div>
              <div className="label">Bench <span className="muted">(tap to sub in)</span></div>
              <div className="tiles">
                {bench.map((p) => <Tile key={p.id} p={p} L={L(p.id)} small selected={pendingIn === p.id} onClick={() => clickBench(p.id)} />)}
                <button className="tile small add" onClick={() => setModal('add')}>+ player</button>
              </div>
            </>
          ) : (
            <>
              <div className="label">{game.opp_name} players</div>
              <div className="tiles">
                {opps.map((p) => <Tile key={p.id} p={p} L={L(p.id)} selected={selected === p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} />)}
                <button className={`tile team ${selected === 'team' ? 'sel' : ''}`} onClick={() => setSelected(selected === 'team' ? null : 'team')}>TEAM / ?</button>
                <button className="tile add" onClick={() => setModal('add')}>+ #</button>
              </div>
            </>
          )}

          <div className={`selbar ${selected ? 'on' : ''}`}>{selLabel ? <>Selected: <strong>{selLabel}</strong></> : 'Tap a player, then an action'}</div>

          <div className={`pad ${selected ? '' : 'idle'}`}>
            {ROWS.map((row, i) => (
              <div key={i} className={`padrow n${row.length}`}>
                {row.map((k) => (
                  <button key={k} className={`act ${ACTIONS[k].cls || ''}`} onClick={() => doAction(k)}>
                    {ACTIONS[k].label}{ACTIONS[k].sub && <small>{ACTIONS[k].sub}</small>}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <button className="btn undo" onClick={doUndo}>↶ Undo last play</button>
        </div>

        <div className="col-left stack">
          <div className="tabs">
            <button className={panel === 'log' ? 'on' : ''} onClick={() => setPanel('log')}>Play log</button>
            <button className={panel === 'us' ? 'on' : ''} onClick={() => setPanel('us')}>{game.our_name}</button>
            <button className={panel === 'opp' ? 'on' : ''} onClick={() => setPanel('opp')}>{game.opp_name}</button>
          </div>
          {panel === 'log' && <PlayByPlay d={d} game={game} onRemove={removeEvent} limit={60} />}
          {panel === 'us' && <BoxScore game={game} d={d} team="us" />}
          {panel === 'opp' && <BoxScore game={game} d={d} team="opp" />}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {prompt?.kind === 'assist' && (
        <Sheet title="Assist by?" onSkip={() => setPrompt(null)}>
          <div className="tiles">
            {onCourt.filter((p) => p.id !== prompt.shooter).map((p) => (
              <Tile key={p.id} p={p} L={L(p.id)} onClick={() => pickAssist(p.id)} />
            ))}
          </div>
          <button className="btn" onClick={() => setPrompt(null)}>No assist</button>
        </Sheet>
      )}

      {prompt?.kind === 'rebound' && (
        <Sheet title="Rebound by?" onSkip={() => setPrompt(null)}>
          <div className="label">{game.our_name}</div>
          <div className="tiles">
            {onCourt.map((p) => <Tile key={p.id} p={p} L={L(p.id)} small onClick={() => pickRebound('us', p.id)} />)}
            <button className="tile team small" onClick={() => pickRebound('us', null)}>TEAM</button>
          </div>
          <div className="label">{game.opp_name}</div>
          <div className="tiles">
            {opps.map((p) => <Tile key={p.id} p={p} L={L(p.id)} small onClick={() => pickRebound('opp', p.id)} />)}
            <button className="tile team small" onClick={() => pickRebound('opp', null)}>TEAM / ?</button>
          </div>
        </Sheet>
      )}

      {modal === 'share' && <ShareModal game={game} onClose={() => setModal(null)} />}
      {modal === 'add' && <AddPlayer team={team} game={game} onAdd={addPlayer} onClose={() => setModal(null)} />}
      {modal === 'settings' && (
        <SettingsModal
          game={game}
          settings={settings}
          onClose={() => setModal(null)}
          onSave={(patch, s) => { updateGame(patch); setSettings(s); localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }}
        />
      )}
    </div>
  );
}
