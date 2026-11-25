// Local-only backend (no Supabase keys). Data lives in this browser's localStorage and is
// shared between tabs via BroadcastChannel, so you can test scorer + viewer side by side.

const KEY = 'hb_localdb_v1';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hb-local') : null;
const listeners = new Set();

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || { games: {}, events: {} }; }
  catch { return { games: {}, events: {} }; }
};
const write = (db) => localStorage.setItem(KEY, JSON.stringify(db));
const emit = (table, row) => listeners.forEach((fn) => fn(table, row));
if (channel) channel.onmessage = (e) => emit(e.data.table, e.data.row);

export const localRemote = {
  mode: 'local',
  auth: {
    async getUser() { return { id: 'local', email: 'local' }; },
    onChange() { return () => {}; },
    async signIn() {},
    async signOut() {},
  },
  async upsert(table, row) {
    const db = read();
    if (table === 'games') db.games[row.id] = { ...db.games[row.id], ...row };
    else {
      const prev = db.events[row.id];
      db.events[row.id] = { ...prev, ...row, deleted: !!(prev?.deleted || row.deleted) };
    }
    write(db);
    channel?.postMessage({ table, row });
    emit(table, row);
  },
  async getGameByCode(code) {
    return Object.values(read().games).find((g) => g.code === String(code).toUpperCase()) || null;
  },
  async getGame(id) { return read().games[id] || null; },
  async listGames() {
    return Object.values(read().games).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },
  async getEvents(gameId) {
    return Object.values(read().events).filter((e) => e.game_id === gameId);
  },
  subscribe(gameId, { onGame, onEvent, onStatus }) {
    const fn = (table, row) => {
      if (table === 'games' && row.id === gameId) onGame?.(row);
      if (table === 'events' && row.game_id === gameId) onEvent?.(row);
    };
    listeners.add(fn);
    onStatus?.('SUBSCRIBED');
    return () => listeners.delete(fn);
  },
};
