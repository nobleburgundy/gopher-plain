// Small formatting helpers for dates, times, records and results.

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const parts = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return { dow: DOW[d.getUTCDay()], mon: d.getUTCMonth(), day: d.getUTCDate() };
};

export const shortDate = (iso) => { const p = parts(iso); return `${p.dow} ${MON[p.mon]} ${p.day}`; };
export const dayOfMonth = (iso) => { const p = parts(iso); return `${p.dow} ${p.day}`; };
export const monthName = (iso) => MONTH[parts(iso).mon];

// Today's date in Minnesota, as YYYY-MM-DD.
export function todayCentral(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(now);
}

export function updatedLabel(iso) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso)) + ' CT';
}

// Hours to add to convert each zone to Central.
const TO_CENTRAL = { ET: -1, EST: -1, EDT: -1, CT: 0, CST: 0, CDT: 0, MT: 1, MST: 1, MDT: 1, PT: 2, PST: 2, PDT: 2, AKT: 3 };

// "4:07 ET" -> { h24: 15, min: '07' } in Central time. CHN times have no AM/PM;
// college hockey is almost always afternoon/evening, so 9-11 are taken as morning.
function toCentral(t) {
  const m = (t || '').match(/^(\d{1,2}):(\d{2})\s*([A-Z]+)?$/);
  if (!m) return null;
  const off = TO_CENTRAL[m[3] || 'CT'];
  if (off === undefined) return null;
  const h = Number(m[1]);
  const h24 = (h >= 9 && h <= 12 ? h : h + 12) + off;
  return { h24, min: m[2] };
}

const h12 = (h24) => ((h24 + 11) % 12) + 1;

export function timeShort(t) {
  const c = toCentral(t);
  if (!c) return t ? t.replace(/\s+/g, '') : 'TBA';
  return `${h12(c.h24)}:${c.min}${c.h24 >= 12 ? 'p' : 'a'}`;
}

export function timeLong(t) {
  const c = toCentral(t);
  if (!c) return t || 'Time TBA';
  return `${h12(c.h24)}:${c.min} ${c.h24 >= 12 ? 'PM' : 'AM'} CT`;
}

export const isTie = (r) => !!r && r.startsWith('T');

export function record(games, filter = () => true) {
  const r = { w: 0, l: 0, t: 0 };
  for (const g of games) {
    if (!g.result || g.type === 'exhibition' || !filter(g)) continue;
    if (g.result === 'W') r.w++;
    else if (g.result === 'L') r.l++;
    else if (isTie(g.result)) r.t++;
  }
  return `${r.w}-${r.l}-${r.t}`;
}

// "W 3-2 OT", "T 3-3 SOW", "L 1-4"
export function resultLabel(g) {
  if (!g.result) return '';
  const score = `${g.score.us}-${g.score.them}`;
  if (g.result === 'T-SOW') return `T ${score} SOW`;
  if (g.result === 'T-SOL') return `T ${score} SOL`;
  return `${g.result[0]} ${score}${g.ot ? ' OT' : ''}`;
}

// "Final", "Final/OT", "Final/SO"
export function finalLabel(g) {
  if (g.result && g.result.includes('SO')) return 'Final/SO';
  return g.ot ? 'Final/OT' : 'Final';
}

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const gamePath = (g) => `games/${g.date}-${slug(g.opponent)}.html`;
