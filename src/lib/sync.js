import { useCallback, useEffect, useRef, useState } from 'react';
import { remote } from './remote.js';
import { activeEvents } from './stats.js';
import { uid } from './util.js';

/* ---------------- Outbox: durable queue of writes, retried until they land ---------------- */

const OB_KEY = 'hb_outbox_v1';
const loadOutbox = () => { try { return JSON.parse(localStorage.getItem(OB_KEY)) || []; } catch { return []; } };
let items = loadOutbox();
const subs = new Set();
let flushing = false;
let retryTimer = null;
const save = () => {
  try { localStorage.setItem(OB_KEY, JSON.stringify(items)); } catch { /* quota */ }
  subs.forEach((f) => f(items.length));
};

export const outbox = {
  push(table, row) {
    const entry = { table, row };
    const i = items.findIndex((x) => x.table === table && x.row.id === row.id);
    if (i >= 0) items[i] = entry; else items.push(entry);
    save();
    outbox.flush();
  },
  async flush() {
    if (flushing) return;
    flushing = true;
    clearTimeout(retryTimer);
    try {
      while (items.length) {
        const item = items[0];
        try {
          await remote.upsert(item.table, item.row);
        } catch (err) {
          console.warn('[sync] write failed, will retry', err);
          retryTimer = setTimeout(() => outbox.flush(), 4000);
          return;
        }
        if (items[0] === item) items.shift(); // if it was replaced mid-flight, send the newer one next
        save();
      }
    } finally {
      flushing = false;
    }
  },
  count: () => items.length,
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => outbox.flush());
  setTimeout(() => outbox.flush(), 500); // resume anything left over from last session
}

export function useOutboxCount() {
  const [n, setN] = useState(outbox.count());
  useEffect(() => outbox.subscribe(setN), []);
  return n;
}

/* ---------------- helpers ---------------- */

export function mergeEvents(a, b) {
  const m = new Map();
  for (const e of [...a, ...b]) {
    const p = m.get(e.id);
    m.set(e.id, p ? { ...p, ...e, deleted: p.deleted || e.deleted } : e);
  }
  return [...m.values()];
}

const cacheKey = (id) => `hb_cache_${id}`;
export const readCache = (id) => { try { return JSON.parse(localStorage.getItem(cacheKey(id))); } catch { return null; } };
export const writeCache = (id, s) => { try { localStorage.setItem(cacheKey(id), JSON.stringify(s)); } catch { /* quota */ } };

export function useUser() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  useEffect(() => {
    let alive = true;
    remote.auth.getUser().then((u) => alive && setUser(u)).catch(() => alive && setUser(null));
    const off = remote.auth.onChange((u) => setUser(u));
    return () => { alive = false; off(); };
  }, []);
  return user;
}

/* ---------------- Scorer: local-first, optimistic, synced via outbox ---------------- */

export function useScorerGame(gameId) {
  const [state, setState] = useState(() => readCache(gameId) || { game: null, events: [] });
  const [phase, setPhase] = useState(state.game ? 'ready' : 'loading');
  const ref = useRef(state);
  const lastTs = useRef(0);

  const commit = useCallback((next) => {
    ref.current = next;
    setState(next);
    writeCache(gameId, next);
  }, [gameId]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [g, evs] = await Promise.all([remote.getGame(gameId), remote.getEvents(gameId)]);
        if (dead) return;
        const cur = ref.current;
        let game = cur.game;
        if (g && (!game || (g.updated_at || '') > (game.updated_at || ''))) game = g;
        if (game) { commit({ game, events: mergeEvents(cur.events, evs) }); setPhase('ready'); }
        else setPhase('missing');
      } catch {
        if (!dead) setPhase(ref.current.game ? 'ready' : 'missing');
      }
    })();
    return () => { dead = true; };
  }, [gameId, commit]);

  const nextTs = () => {
    const max = ref.current.events.reduce((m, e) => Math.max(m, e.ts), 0);
    lastTs.current = Math.max(Date.now(), max + 1, lastTs.current + 1);
    return lastTs.current;
  };

  const addEvents = useCallback((list) => {
    const s = ref.current;
    const evs = list.map((e) => ({
      id: uid(), game_id: gameId, ts: nextTs(), period: s.game.period,
      player_id: null, meta: {}, deleted: false, ...e,
    }));
    commit({ ...s, events: [...s.events, ...evs] });
    evs.forEach((e) => outbox.push('events', e));
    return evs;
  }, [gameId, commit]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDeleted = useCallback((ids) => {
    const s = ref.current;
    const changed = [];
    const events = s.events.map((e) => {
      if (ids.has(e.id) && !e.deleted) { const n = { ...e, deleted: true }; changed.push(n); return n; }
      return e;
    });
    if (!changed.length) return;
    commit({ ...s, events });
    changed.forEach((e) => outbox.push('events', e));
  }, [commit]);

  /** Undo the last action, including its linked assist / rebound. */
  const undo = useCallback(() => {
    const act = activeEvents(ref.current.events);
    const last = act[act.length - 1];
    if (!last) return null;
    const grp = last.meta?.grp;
    const ids = new Set(grp ? act.filter((e) => e.meta?.grp === grp).map((e) => e.id) : [last.id]);
    markDeleted(ids);
    return ids.size;
  }, [markDeleted]);

  const removeEvent = useCallback((id) => markDeleted(new Set([id])), [markDeleted]);

  const updateGame = useCallback((patch) => {
    const s = ref.current;
    const game = { ...s.game, ...patch, updated_at: new Date().toISOString() };
    commit({ ...s, game });
    outbox.push('games', game);
  }, [commit]);

  return { game: state.game, events: state.events, phase, addEvents, undo, removeEvent, updateGame };
}

/* ---------------- Viewer: read-only, realtime + polling safety net ---------------- */

export function useLiveGame(code) {
  const [game, setGame] = useState(null);
  const [events, setEvents] = useState([]);
  const [conn, setConn] = useState('connecting'); // connecting | live | offline
  const [notFound, setNotFound] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    let dead = false;
    let off = () => {};
    let timer;
    let gid = null;

    const load = async () => {
      try {
        const g = gid ? await remote.getGame(gid) : await remote.getGameByCode(code);
        if (dead) return null;
        if (!g) { setNotFound(true); return null; }
        gid = g.id;
        setGame(g);
        const evs = await remote.getEvents(g.id);
        if (dead) return null;
        setEvents((prev) => mergeEvents(prev, evs));
        setLastSync(Date.now());
        return g;
      } catch {
        if (!dead) setConn('offline');
        return null;
      }
    };

    (async () => {
      const g = await load();
      if (!g || dead) return;
      off = remote.subscribe(g.id, {
        onGame: (row) => { setGame(row); setLastSync(Date.now()); },
        onEvent: (row) => { setEvents((prev) => mergeEvents(prev, [row])); setLastSync(Date.now()); },
        onStatus: (s) => {
          if (s === 'SUBSCRIBED') setConn('live');
          else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(s)) setConn('offline');
        },
      });
    })();
    timer = setInterval(() => { if (gid) load(); }, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible' && gid) load(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => { dead = true; off(); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [code]);

  return { game, events, conn, notFound, lastSync };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}
