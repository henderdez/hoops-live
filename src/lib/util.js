export const uid = () =>
  (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

/**
 * Parse a pasted roster. Accepts:
 *   23 Jake Smith        (one player per line)
 *   #5 - Sam Lee
 *   12, 23, 5, 31        (just numbers, comma separated)
 */
export function parseRoster(text) {
  const out = [];
  const seen = new Set();
  for (const raw of String(text || '').split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[#\d\s,]+$/.test(line) && line.includes(',')) {
      for (const n of line.split(',')) {
        const num = n.replace('#', '').trim();
        if (num && !seen.has(num)) { seen.add(num); out.push({ number: num, name: '' }); }
      }
      continue;
    }
    const m = line.match(/^#?(\d{1,3})\s*[-–:.)]?\s*(.*)$/);
    if (m && !seen.has(m[1])) { seen.add(m[1]); out.push({ number: m[1], name: m[2].trim() }); }
  }
  return out;
}

/** Pull a YouTube video id out of a watch / live / youtu.be / embed URL. */
export function youTubeId(url) {
  if (!url) return null;
  const s = String(url).trim();
  try {
    const u = new URL(s);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.hostname.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{6,})/);
      if (m) return m[1];
    }
  } catch { /* not a URL */ }
  return /^[\w-]{11}$/.test(s) ? s : null;
}

export function timeAgo(ms) {
  if (ms == null) return '—';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}
