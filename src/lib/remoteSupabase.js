import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(url && key);
export const supabase = hasSupabase
  ? createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } })
  : null;

const EVENT_COLS = ['id', 'game_id', 'ts', 'period', 'team', 'player_id', 'type', 'meta', 'deleted'];
const GAME_COLS = ['id', 'code', 'our_name', 'opp_name', 'status', 'period', 'stream_url', 'players', 'starters', 'created_at', 'updated_at'];
const pick = (row, cols) => Object.fromEntries(cols.filter((c) => row[c] !== undefined).map((c) => [c, row[c]]));
const check = ({ data, error }) => { if (error) throw error; return data; };

export const supabaseRemote = {
  mode: 'supabase',
  auth: {
    async getUser() {
      const { data } = await supabase.auth.getSession();
      return data.session?.user ?? null;
    },
    onChange(cb) {
      const { data } = supabase.auth.onAuthStateChange((_evt, session) => cb(session?.user ?? null));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() { await supabase.auth.signOut(); },
  },

  async upsert(table, row) {
    const clean = pick(row, table === 'games' ? GAME_COLS : EVENT_COLS);
    check(await supabase.from(table).upsert(clean));
  },

  async getGameByCode(code) {
    return check(await supabase.from('games').select('*').eq('code', String(code).toUpperCase()).maybeSingle());
  },
  async getGame(id) {
    return check(await supabase.from('games').select('*').eq('id', id).maybeSingle());
  },
  async listGames() {
    return check(
      await supabase.from('games').select('id,code,our_name,opp_name,status,created_at').order('created_at', { ascending: false }).limit(50)
    );
  },
  async getEvents(gameId) {
    // The API returns at most 1000 rows per request, so page through.
    const all = [];
    for (let from = 0; ; from += 1000) {
      const rows = check(
        await supabase.from('events').select('*').eq('game_id', gameId).order('ts').range(from, from + 999)
      );
      all.push(...rows);
      if (rows.length < 1000) break;
    }
    return all;
  },

  subscribe(gameId, { onGame, onEvent, onStatus }) {
    const channel = supabase
      .channel(`game-${gameId}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `game_id=eq.${gameId}` },
        (p) => p.new && onEvent?.(p.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (p) => p.new && onGame?.(p.new))
      .subscribe((status) => onStatus?.(status));
    return () => { supabase.removeChannel(channel); };
  },
};
