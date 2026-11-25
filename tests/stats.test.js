import test from 'node:test';
import assert from 'node:assert/strict';
import { derive, teamTotals, periodLabel, activeEvents } from '../src/lib/stats.js';
import { parseRoster, youTubeId } from '../src/lib/util.js';

const game = {
  id: 'g1', our_name: 'Home', opp_name: 'Away', period: 1, status: 'live',
  players: [
    { id: 'a', team: 'us', number: '1', name: 'Ann' },
    { id: 'b', team: 'us', number: '2', name: 'Bo' },
    { id: 'c', team: 'us', number: '3', name: 'Cy' },
    { id: 'o9', team: 'opp', number: '9', name: '' },
  ],
  starters: ['a', 'b'],
};
let n = 0;
const ev = (o) => ({ id: 'e' + ++n, game_id: 'g1', ts: n, period: 1, team: 'us', player_id: null, meta: {}, deleted: false, ...o });

test('scoring, FG/3P/FT lines and score', () => {
  const d = derive(game, [
    ev({ type: 'm3', player_id: 'a' }),
    ev({ type: 'x2', player_id: 'a' }),
    ev({ type: 'm2', player_id: 'b' }),
    ev({ type: 'mft', player_id: 'b' }),
    ev({ type: 'xft', player_id: 'b' }),
    ev({ type: 'm2', team: 'opp', player_id: 'o9' }),
    ev({ type: 'm3', team: 'opp', player_id: null }),
  ]);
  assert.deepEqual(d.score, { us: 6, opp: 5 });
  assert.equal(d.stats.a.pts, 3);
  assert.equal(d.stats.a.fgm, 1);
  assert.equal(d.stats.a.fga, 2);
  assert.equal(d.stats.a.tpm, 1);
  assert.equal(d.stats.b.ftm, 1);
  assert.equal(d.stats.b.fta, 2);
  assert.equal(d.stats['team:opp'].pts, 3); // unknown-player bucket
  assert.equal(teamTotals(game, d, 'opp').pts, 5);
  assert.equal(d.byPeriod.us[1], 6);
});

test('deleted events are ignored (undo)', () => {
  const d = derive(game, [ev({ type: 'm2', player_id: 'a' }), ev({ type: 'm3', player_id: 'a', deleted: true })]);
  assert.equal(d.score.us, 2);
  assert.equal(activeEvents([ev({ deleted: true })]).length, 0);
});

test('plus/minus follows subs', () => {
  const d = derive(game, [
    ev({ type: 'm2', player_id: 'a' }),                                   // a,b on: +2
    ev({ type: 'sub', meta: { in: 'c', out: 'b' } }),                     // a,c on
    ev({ type: 'm3', team: 'opp', player_id: 'o9' }),                     // -3 for a,c
  ]);
  assert.deepEqual(d.onCourt.sort(), ['a', 'c']);
  assert.equal(d.stats.a.pm, -1);
  assert.equal(d.stats.b.pm, 2);
  assert.equal(d.stats.c.pm, -3);
});

test('fouls: player count, team fouls reset per quarter, bonus at 5', () => {
  const g = { ...game, period: 2 };
  const events = [
    ...[1, 2, 3, 4, 5].map(() => ev({ type: 'foul', player_id: 'a', period: 1 })),
    ...[1, 2, 3, 4, 5].map(() => ev({ type: 'foul', team: 'opp', player_id: 'o9', period: 2 })),
  ];
  const d = derive(g, events);
  assert.equal(d.stats.a.pf, 5);
  assert.equal(d.teamFoulsNow.us, 0);          // new quarter
  assert.equal(d.teamFoulsNow.opp, 5);
  assert.equal(d.bonus.us, true);               // we shoot bonus FTs
  assert.equal(d.bonus.opp, false);
  assert.match(d.feed.at(-1).text, /foul \(5\)/);
});

test('overtime continues 4th-quarter foul count', () => {
  const g = { ...game, period: 5 };
  const d = derive(g, [
    ...[1, 2, 3].map(() => ev({ type: 'foul', player_id: 'a', period: 4 })),
    ...[1, 2].map(() => ev({ type: 'foul', player_id: 'b', period: 5 })),
  ]);
  assert.equal(d.teamFoulsNow.us, 5);
});

test('feed text and running score', () => {
  const d = derive(game, [ev({ type: 'm3', player_id: 'a' }), ev({ type: 'dreb', team: 'opp', player_id: null })]);
  assert.equal(d.feed[0].text, '#1 Ann makes a 3-pointer');
  assert.deepEqual(d.feed[0].score, { us: 3, opp: 0 });
  assert.equal(d.feed[1].text, 'Away: defensive rebound');
});

test('period labels', () => {
  assert.deepEqual([1, 4, 5, 6].map(periodLabel), ['Q1', 'Q4', 'OT', '2OT']);
});

test('parseRoster', () => {
  assert.deepEqual(parseRoster('23 Jake Smith\n#5 - Sam Lee\n7'), [
    { number: '23', name: 'Jake Smith' }, { number: '5', name: 'Sam Lee' }, { number: '7', name: '' },
  ]);
  assert.deepEqual(parseRoster('12, 23, 5'), [
    { number: '12', name: '' }, { number: '23', name: '' }, { number: '5', name: '' },
  ]);
  assert.equal(parseRoster('23 A\n23 B').length, 1);
});

test('youTubeId', () => {
  assert.equal(youTubeId('https://www.youtube.com/watch?v=abcDEF12345'), 'abcDEF12345');
  assert.equal(youTubeId('https://youtu.be/abcDEF12345?t=3'), 'abcDEF12345');
  assert.equal(youTubeId('https://www.youtube.com/live/abcDEF12345'), 'abcDEF12345');
  assert.equal(youTubeId('nonsense'), null);
});
