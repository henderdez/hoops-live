// Pure stats engine. Everything on screen is derived by replaying the event log,
// so undo, edits and late corrections "just work".

export const POINTS = { m2: 2, m3: 3, mft: 1 };

export const VERBS = {
  m2: 'makes a 2-pointer',
  x2: 'misses a 2-pointer',
  m3: 'makes a 3-pointer',
  x3: 'misses a 3-pointer',
  mft: 'makes a free throw',
  xft: 'misses a free throw',
  oreb: 'offensive rebound',
  dreb: 'defensive rebound',
  ast: 'assist',
  stl: 'steal',
  blk: 'block',
  to: 'turnover',
  foul: 'foul',
};
const SHOT_TYPES = new Set(['m2', 'x2', 'm3', 'x3', 'mft', 'xft']);

export function periodLabel(p) {
  if (p <= 4) return `Q${p}`;
  return p === 5 ? 'OT' : `${p - 4}OT`;
}

export function emptyLine() {
  return { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0, pm: 0 };
}

export function activeEvents(events) {
  return events
    .filter((e) => !e.deleted)
    .sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function sortPlayers(list) {
  return [...list].sort(
    (a, b) =>
      (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) ||
      String(a.number).localeCompare(String(b.number))
  );
}

export function teamName(game, team) {
  return team === 'us' ? game.our_name : game.opp_name;
}

export function playerLabel(game, player) {
  if (!player) return null;
  const n = `#${player.number}`;
  if (player.team === 'opp') return `${game.opp_name} ${n}`;
  return player.name ? `${n} ${player.name}` : n;
}

/** Team fouls reset each quarter; overtime continues the 4th-quarter count (NFHS). */
export const foulPeriod = (period) => Math.min(period, 4);
export const BONUS_AT = 5;

export function derive(game, events) {
  const evs = activeEvents(events);
  const byId = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const stats = {};
  const line = (k) => (stats[k] ||= emptyLine());
  game.players.forEach((p) => line(p.id));
  line('team:us');
  line('team:opp');

  const onCourt = new Set(game.starters || []);
  const score = { us: 0, opp: 0 };
  const byPeriod = { us: {}, opp: {} };
  const teamFouls = { us: {}, opp: {} };
  const feed = [];
  let maxPeriod = game.period || 1;

  const who = (e) => {
    const p = e.player_id ? byId[e.player_id] : null;
    return p ? playerLabel(game, p) : teamName(game, e.team);
  };

  for (const e of evs) {
    maxPeriod = Math.max(maxPeriod, e.period);

    if (e.type === 'sub') {
      const { out, in: inn } = e.meta || {};
      if (out) onCourt.delete(out);
      if (inn) onCourt.add(inn);
      feed.push({
        id: e.id, ts: e.ts, period: e.period, team: e.team, type: 'sub', grp: e.meta?.grp,
        text: `Sub: ${playerLabel(game, byId[inn]) || '?'} in for ${playerLabel(game, byId[out]) || '?'}`,
        score: { ...score },
      });
      continue;
    }

    const key = e.player_id && byId[e.player_id] ? e.player_id : `team:${e.team}`;
    const L = line(key);
    let text;

    switch (e.type) {
      case 'm2': case 'm3': case 'mft': {
        const pts = POINTS[e.type];
        L.pts += pts;
        if (e.type !== 'mft') { L.fgm++; L.fga++; }
        if (e.type === 'm3') { L.tpm++; L.tpa++; }
        if (e.type === 'mft') { L.ftm++; L.fta++; }
        score[e.team] += pts;
        byPeriod[e.team][e.period] = (byPeriod[e.team][e.period] || 0) + pts;
        for (const pid of onCourt) line(pid).pm += e.team === 'us' ? pts : -pts;
        break;
      }
      case 'x2': L.fga++; break;
      case 'x3': L.fga++; L.tpa++; break;
      case 'xft': L.fta++; break;
      case 'oreb': L.oreb++; break;
      case 'dreb': L.dreb++; break;
      case 'ast': L.ast++; break;
      case 'stl': L.stl++; break;
      case 'blk': L.blk++; break;
      case 'to': L.to++; break;
      case 'foul': {
        L.pf++;
        const k = foulPeriod(e.period);
        teamFouls[e.team][k] = (teamFouls[e.team][k] || 0) + 1;
        text = `${who(e)}: foul (${L.pf})`;
        break;
      }
      default: break;
    }

    if (!text) {
      text = SHOT_TYPES.has(e.type) ? `${who(e)} ${VERBS[e.type]}` : `${who(e)}: ${VERBS[e.type] || e.type}`;
    }
    feed.push({
      id: e.id, ts: e.ts, period: e.period, team: e.team, type: e.type, grp: e.meta?.grp,
      scoring: e.type in POINTS, text, score: { ...score },
    });
  }

  const fk = foulPeriod(game.period || 1);
  const teamFoulsNow = { us: teamFouls.us[fk] || 0, opp: teamFouls.opp[fk] || 0 };
  // "bonus.us" = our team is shooting bonus free throws (opponent has committed 5+).
  const bonus = { us: teamFoulsNow.opp >= BONUS_AT, opp: teamFoulsNow.us >= BONUS_AT };

  return {
    score, byPeriod, teamFouls, teamFoulsNow, bonus, maxPeriod, stats,
    onCourt: [...onCourt],
    feed,
    lastTs: evs.length ? evs[evs.length - 1].ts : null,
  };
}

/** Sum of every player on a team plus the team/unknown bucket. */
export function teamTotals(game, derived, team) {
  const total = emptyLine();
  const ids = game.players.filter((p) => p.team === team).map((p) => p.id).concat(`team:${team}`);
  for (const id of ids) {
    const L = derived.stats[id];
    if (!L) continue;
    for (const k of Object.keys(total)) total[k] += L[k];
  }
  total.pm = 0;
  return total;
}
