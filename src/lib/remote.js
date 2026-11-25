import { hasSupabase, supabaseRemote } from './remoteSupabase.js';
import { localRemote } from './remoteLocal.js';

// With VITE_SUPABASE_* set -> real shared backend. Without -> local-only demo mode.
export const remote = hasSupabase ? supabaseRemote : localRemote;
export const isLocalMode = !hasSupabase;
