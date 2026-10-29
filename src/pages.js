// Builds the HTML for each page. Everything is fixed-width text inside <pre> blocks.
import { TEAM, SITE, CHN_BASE, seasonLabel } from './config.js';
import { WIDTH, cell, spread, wrap, box, esc, heading, len } from './text.js';
import {
  shortDate, dayOfMonth, monthName, updatedLabel, timeShort, timeLong,
  record, resultLabel, finalLabel, isTie, ordinal, gamePath,
} from './format.js';

// ---------------------------------------------------------------- page shell

const ourNpi = (data) => data.npi?.[TEAM.name]?.rank ?? null;

function page({ title, root, body, data, description, current }) {
  const nav = [
    ['', 'Home'], ['schedule.html', 'Schedule'], ['stats.html', 'Stats'], ['standings.html', 'Standings'],
    ['rankings.html', 'Rankings'],
  ].map(([href, label]) => {
    const here = label === current;
    return `<a href="${root}${href || './'}"${here ? ' aria-current="page"' : ''}>${here ? `<b>${label}</b>` : label}</a>`;
  }).join('  ');

  const header = [
    spread(SITE.title.toUpperCase(), (ourNpi(data) ? `Ranked #${ourNpi(data)}  ` : '') + seasonLabel(data.season), WIDTH,
      { left: { bold: true, href: `${root}./` } }),
    nav,
  ].join('\n');

  const footer = [
    `Data: <a href="${CHN_BASE}">College Hockey News</a>`,
    `Updated ${esc(updatedLabel(data.fetchedAt))}`,
  ].join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description || `${TEAM.name} men's hockey scores, schedule and stats in plain text.`)}">
<link rel="stylesheet" href="${root}style.css">
<link rel="icon" href="${root}favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="${root}favicon-32.png">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="Gophers">
</head>
<body>
<header><pre>${header}</pre></header>
<main>
${body}
</main>
<footer><pre>${footer}</pre></footer>
</body>
</html>
`;
}

const section = (title, lines) =>
  `<section><pre>${title ? heading(title) + '\n' : ''}${lines.join('\n')}</pre></section>`;

// ---------------------------------------------------------------- shared bits

// Opponent name with its current NPI rank (set on upcoming games only), e.g. "#12 Penn State".
const oppLabel = (g) => (g.oppRank ? `#${g.oppRank} ${g.opponent}` : g.opponent);

// Away team on top, home on bottom. Minnesota is listed second at home and at neutral sites.
function sides(g) {
  const us = { name: TEAM.name, score: g.score?.us, link: null };
  const them = { name: oppLabel(g), score: g.score?.them };
  return g.site === 'away' ? [us, them] : [them, us];
}

function gameCard(g, root, today) {
  const inner = WIDTH - 4;
  const when = g.date === today ? 'Today' : shortDate(g.date);
  let status;
  let statusOpts = {};
  if (g.result) {
    status = finalLabel(g);
    if (g.boxPath) statusOpts = { href: root + gamePath(g) };
  } else {
    status = timeLong(g.time);
  }
  const lines = [spread(when, status, inner, { right: statusOpts })];

  const [top, bottom] = sides(g);
  for (const t of [top, bottom]) {
    const other = t === top ? bottom : top;
    const won = g.result && t.score > other.score;
    lines.push(cell(t.name, inner - 4, { bold: won }) + cell(g.result ? t.score : '', 4, { align: 'right', bold: won }));
  }

  const extra = [g.site === 'home' ? 'Home' : g.site === 'away' ? 'Away' : 'Neutral site'];
  if (g.type === 'conf') extra.push(TEAM.conference);
  if (g.type === 'exhibition') extra.push('Exhibition');
  if (!g.result && g.tv.length) extra.push(g.tv.join(', '));
  if (extra.length) lines.push(cell(extra.join(' · '), inner));
  if (g.result && g.boxPath) lines.push(cell('Box score ›', inner, { href: root + gamePath(g) }));
  return box(lines);
}

// One schedule line, WIDTH wide: "Fri 30 @ Penn State      *  7:00p BTN"
function scheduleLine(g, root, { notes = true } = {}) {
  const loc = g.site === 'away' ? '@ ' : g.site === 'neutral' ? 'vs ' : '';
  const mark = (g.type === 'conf' ? '*' : g.type === 'exhibition' ? '†' : '') + (notes && g.note ? g.note : '');
  const rightW = 13; // fits "6:00p Peacock"
  let right;
  if (g.result) {
    const won = g.result === 'W';
    right = cell(resultLabel(g), rightW, { align: 'right', href: g.boxPath ? root + gamePath(g) : null, bold: won });
  } else {
    const tv = g.tv[0] ? ` ${g.tv[0]}` : '';
    right = cell(timeShort(g.time) + tv, rightW, { align: 'right' });
  }
  // Opponent plus its markers share one column so short names leave room for long ones.
  const oppW = WIDTH - 7 - rightW - 1;
  const opp = cell(loc + oppLabel(g), oppW - len(mark)) + esc(mark);
  return cell(dayOfMonth(g.date), 7) + opp + ' ' + right;
}

// Short key for the markers used in a list of games (home page lists have no full legend).
function miniKey(games) {
  const keys = [];
  if (games.some((g) => g.type === 'conf')) keys.push(`* ${TEAM.conference} game`);
  if (games.some((g) => g.type === 'exhibition')) keys.push('† exhibition');
  if (games.some((g) => g.oppRank)) keys.push('#n NPI rank');
  return keys.length ? [`<i>${esc(keys.join('  '))}</i>`] : [];
}

function legend(notes) {
  const lines = ['@ away  vs neutral site', `* ${TEAM.conference} game  † exhibition`, '#n current NPI rank'];
  for (const [n, text] of Object.entries(notes || {})) lines.push(...wrap(`${n} ${text}`, WIDTH, 2));
  return lines;
}

function ourStanding(standings) {
  const row = standings.find((r) => r.team === TEAM.name);
  if (!row) return null;
  const place = (row.tied || standings.some((r) => r !== row && r.rank === row.rank) ? 'T-' : '') + ordinal(Number(row.rank));
  return { row, place };
}

// Full conference table plus a key. Wider than the page, so it scrolls sideways on phones.
function standingsTable(standings) {
  const R = (s, w, o = {}) => cell(s, w, { align: 'right', ...o });
  const head = cell('', 3) + cell('', 16) + R('GP', 3) + R('PTS', 4) + R('RW', 4) + R('RL', 3) + R('OW', 3) + R('OL', 3)
    + '  ' + R('W-L-T', 8) + R('GF', 4) + R('GA', 4);
  const rows = standings.map((r) => {
    const us = r.team === TEAM.name;
    return cell(r.tied ? '' : r.rank, 3) + cell(r.team, 16, { bold: us }) + R(r.conf.gp, 3)
      + R(r.conf.pts, 4, { bold: us }) + R(r.conf.rw, 4) + R(r.conf.rl, 3) + R(r.conf.ow, 3) + R(r.conf.ol, 3)
      + '  ' + R(`${r.overall.w}-${r.overall.l}-${r.overall.t}`, 8) + R(r.overall.gf, 4) + R(r.overall.ga, 4);
  });
  return [
    '<div class="scroll">' + [head, ...rows].join('\n') + '</div>',
    '',
    '<i>GP through OL: conference games only</i>',
    '<i>RW/RL: regulation wins/losses</i>',
    '<i>OW/OL: overtime wins/losses</i>',
    '<i>W-L-T, GF, GA: all games</i>',
  ];
}

// ---------------------------------------------------------------- home page

export function homePage(data, today) {
  const root = '';
  const games = data.schedule.games;
  const played = games.filter((g) => g.result);
  const upcoming = games.filter((g) => !g.result && g.date >= today);
  const last = played.at(-1);
  const next = upcoming[0];

  const overall = record(games);
  const conf = record(games, (g) => g.type === 'conf');
  const st = ourStanding(data.standings);
  const summary = [
    `<b>${esc(overall)}</b> overall  ·  ${esc(conf)} ${esc(TEAM.conference)}`,
  ];
  if (st && Number(st.row.conf.gp) > 0) {
    summary.push(`${st.place} in the ${TEAM.conference}, ${st.row.conf.pts} pts`);
  }
  if (ourNpi(data)) summary.push(`#${ourNpi(data)} in the NPI (NCAA ranking)`);

  const parts = [section(null, summary)];
  if (next) parts.push(section(next.date === today ? 'Today' : 'Next game', [gameCard(next, root, today)]));
  if (last) parts.push(section('Last game', [gameCard(last, root, today)]));

  const later = upcoming.slice(1, 6);
  if (later.length) {
    parts.push(section('Coming up', [...later.map((g) => scheduleLine(g, root, { notes: false })),
      ...miniKey(later), '', cell('Full schedule ›', WIDTH, { href: 'schedule.html' })]));
  }
  const recent = played.slice(-5).reverse();
  if (recent.length) {
    parts.push(section('Recent results', [...recent.map((g) => scheduleLine(g, root, { notes: false })), ...miniKey(recent)]));
  }
  if (data.standings.length) {
    parts.push(section(`${TEAM.conference} standings`, standingsTable(data.standings)));
  }

  return page({ title: `${SITE.title} ${seasonLabel(data.season)}`, root, data, body: parts.join('\n'), current: 'Home' });
}

// ---------------------------------------------------------------- schedule

export function schedulePage(data) {
  const root = '';
  const games = data.schedule.games;
  const parts = [section(null, [
    `${esc(record(games))} overall  ·  ${esc(record(games, (g) => g.type === 'conf'))} ${esc(TEAM.conference)}`,
    `Home ${esc(record(games, (g) => g.site === 'home'))}  ·  Away ${esc(record(games, (g) => g.site === 'away'))}`,
    'Times are Central.',
  ])];

  let month = null;
  let lines = [];
  for (const g of games) {
    const m = monthName(g.date);
    if (m !== month) {
      if (lines.length) parts.push(section(month, lines));
      month = m;
      lines = [];
    }
    lines.push(scheduleLine(g, root));
  }
  if (lines.length) parts.push(section(month, lines));
  parts.push(section(null, legend(data.schedule.notes)));

  return page({ title: `Schedule · ${SITE.title}`, root, data, body: parts.join('\n'), current: 'Schedule' });
}

// ---------------------------------------------------------------- standings

export function standingsPage(data) {
  const body = section(`${TEAM.conference} ${seasonLabel(data.season)}`, standingsTable(data.standings));
  return page({ title: `Standings · ${SITE.title}`, root: '', data, body, current: 'Standings' });
}

// ---------------------------------------------------------------- stats

export function statsPage(data) {
  const root = '';
  const { goalies } = data.stats;
  const skaters = data.stats.skaters.filter((s) => s.pos !== 'G');
  const R = (s, w, o = {}) => cell(s, w, { align: 'right', ...o });

  const parts = [];
  if (!skaters.length && !goalies.length) {
    parts.push(section(null, ['No stats yet this season.']));
  }
  if (skaters.length) {
    const head = cell('', 20) + R('POS', 4) + R('YR', 3) + R('GP', 3) + R('G', 3) + R('A', 3) + R('PTS', 4)
      + R('+/-', 4) + R('PIM', 4) + R('PPG', 4) + R('SOG', 4) + R('TOI', 6);
    const rows = skaters.map((s) => cell(s.name, 20) + R(s.pos, 4) + R(s.yr, 3) + R(s.gp, 3) + R(s.g, 3)
      + R(s.a, 3) + R(s.pts, 4, { bold: true }) + R(s.pm, 4) + R(s.pim, 4) + R(s.ppg, 4) + R(s.shots, 4) + R(s.toi, 6));
    parts.push(section('Skaters', ['<div class="scroll">' + [head, ...rows].join('\n') + '</div>']));
  }
  if (goalies.length) {
    const head = cell('', 20) + R('GP', 3) + R('W-L-T', 7) + R('GAA', 6) + R('SV%', 6) + R('MIN', 5);
    const rows = goalies.map((g) => cell(g.name, 20) + R(g.gp, 3) + R(`${g.w}-${g.l}-${g.t}`, 7)
      + R(g.gaa, 6) + R(g.svpct, 6, { bold: true }) + R(g.min, 5));
    parts.push(section('Goalies', ['<div class="scroll">' + [head, ...rows].join('\n') + '</div>']));
  }
  return page({ title: `Stats · ${SITE.title}`, root, data, body: parts.join('\n'), current: 'Stats' });
}

// ---------------------------------------------------------------- game page

export function gamePage(data, g, b) {
  const root = '../';
  const R = (s, w, o = {}) => cell(s, w, { align: 'right', ...o });
  const parts = [];

  // Score header.
  const teams = [b.away, b.home];
  const winner = b.away.score === b.home.score ? null : (b.away.score > b.home.score ? b.away : b.home);
  const inner = WIDTH - 4;
  const top = [spread(finalLabel(g), shortDate(g.date), inner)];
  for (const t of teams) {
    const won = t === winner;
    top.push(cell(t.name, inner - 4, { bold: won }) + R(t.score, 4, { bold: won }));
  }
  parts.push(section(null, [box(top)]));

  const info = [];
  for (const s of b.summary) info.push(...wrap(s));
  for (const d of b.details) {
    if (/referees/i.test(d)) continue;
    info.push(...wrap(d.replace(/^at /, '')));
  }
  if (info.length) parts.push(section(null, info));

  // Line score: goals and shots by period.
  const names = b.goalsByPeriod.rows.map((r) => r.team);
  const nameW = Math.min(12, Math.max(...names.map(len)) + 1);
  const periodTable = (label, t) => {
    const lines = [cell(label, nameW, { bold: true }) + t.periods.map((p) => R(p, 4)).join('')];
    for (const r of t.rows) lines.push(cell(r.team, nameW) + r.values.map((v) => R(v, 4)).join(''));
    return lines;
  };
  const line = [...periodTable('Goals', b.goalsByPeriod), '', ...periodTable('Shots', b.shotsByPeriod)];

  // Power play / penalties / faceoffs.
  const pp = b.pp;
  const idx = (h) => pp.headers.findIndex((x) => x.startsWith(h));
  const ppI = idx('PPG'); const penI = idx('Pen'); const foI = idx('FOW');
  if (pp.rows.length) {
    line.push('', cell('', nameW) + R('PP', 6) + R('PIM', 6) + R('FO', 7));
    for (const r of pp.rows) {
      line.push(cell(r[0], nameW) + R(ppI >= 0 ? r[ppI].replace('-', '/') : '', 6)
        + R(penI >= 0 ? r[penI].split('-')[1] : '', 6) + R(foI >= 0 ? r[foI] : '', 7));
    }
  }
  parts.push(section(null, line));

  // Scoring summary. Short team codes come from the box score URL, e.g. /box/final/20261023/ndk/min/
  const [, , , awayCode = 'AWY', homeCode = 'HOM'] = g.boxPath.split('/').filter(Boolean);
  // Prefer the line score's short name (UND, MSU); fall back to the URL code (MIN) when it's long.
  const code = (side) => {
    const name = names[side === 'away' ? 0 : 1] || '';
    return len(name) <= 4 ? name : (side === 'away' ? awayCode : homeCode).replace(/_/g, '').toUpperCase();
  };
  const teamW = 5;
  if (b.goals.length) {
    const lines = [];
    let period = null;
    for (const goal of b.goals) {
      if (goal.period !== period) {
        if (period) lines.push('');
        period = goal.period;
        lines.push(`<i>${esc(period)}</i>`);
      }
      const tag = goal.strength ? ` ${goal.strength}` : '';
      lines.push(R(goal.time, 5) + ' ' + cell(code(goal.side), teamW) + esc(goal.scorer + tag));
      const indent = ' '.repeat(6);
      for (const l of wrap(goal.assists || 'Unassisted', WIDTH - indent.length)) lines.push(indent + l);
    }
    parts.push(section('Scoring', lines));
  }

  if (b.shootout.length) {
    const lines = [];
    for (const t of b.shootout) {
      lines.push(`<i>${esc(t.team)}</i>`);
      for (const a of t.attempts) lines.push(cell(a.player, WIDTH - 6) + R(a.result, 6, { bold: a.result === 'made' }));
    }
    parts.push(section('Shootout', lines));
  }

  if (b.penalties.length) {
    const lines = [];
    let period = null;
    for (const p of b.penalties) {
      if (p.period !== period) {
        if (period) lines.push('');
        period = p.period;
        lines.push(`<i>${esc(period)}</i>`);
      }
      lines.push(R(p.time, 5) + ' ' + cell(code(p.side), teamW) + esc(p.player));
      lines.push(' '.repeat(6) + esc(`${p.infraction} (${p.minutes})`));
    }
    parts.push(section('Penalties', lines));
  }

  if (b.goalies.length) {
    const lines = [cell('', 20) + R('SV', 4) + R('GA', 4) + R('MIN', 8)];
    for (const t of b.goalies) {
      lines.push(`<i>${esc(t.team)}</i>`);
      for (const p of t.players) {
        const name = p.name === 'EMPTY NET' ? 'Empty net' : p.name;
        lines.push(cell(name, 20) + R(p.sv, 4) + R(p.ga, 4) + R(p.min, 8));
      }
    }
    parts.push(section('Goalies', lines));
  }

  for (const t of b.players) {
    const cols = [['G', 'G', 3], ['A', 'A', 3], ['Pt.', 'P', 3], ['+/-', '+/-', 4], ['Sh', 'SOG', 4],
      ['PIM', 'PIM', 4], ['FOW-L', 'FO', 6], ['TOI', 'TOI', 6]].filter(([k]) => t.headers.includes(k));
    const head = cell('', 20) + cols.map(([, label, w]) => R(label, w)).join('');
    const rows = t.rows.filter((r) => r[t.team]).map((r) => {
      const pts = Number(r['Pt.']) > 0;
      return cell(r[t.team], 20, { bold: pts }) + cols.map(([k, , w]) => R(r[k] ?? '', w)).join('');
    });
    parts.push(section(t.team, ['<div class="scroll">' + [head, ...rows].join('\n') + '</div>']));
  }

  parts.push(section(null, [
    `<a href="${CHN_BASE}${esc(g.boxPath)}">Full box score on CHN ›</a>`,
    `<a href="${root}schedule.html">‹ Back to schedule</a>`,
  ]));

  const title = `${b.away.name} ${b.away.score}, ${b.home.name} ${b.home.score} · ${shortDate(g.date)}`;
  return page({ title, root, data, body: parts.join('\n'), description: title });
}

// ---------------------------------------------------------------- rankings

const CONF_SHORT = {
  'Atlantic Hockey': 'AHA', 'Big Ten': 'B1G', CCHA: 'CCHA', ECAC: 'ECAC',
  'Hockey East': 'HE', NCHC: 'NCHC', Independents: 'Ind',
};

// Two static versions of the page (no JavaScript): sorted by NPI (default) or PairWise.
// A "Sort:" toggle above the table links between them.
export const RANKING_SORTS = {
  npi: { file: 'rankings.html', label: 'NPI', field: 'npiRank' },
  pw: { file: 'rankings-pairwise.html', label: 'PairWise', field: 'pwRank' },
};

export function rankingsPage(data, sort = 'npi') {
  const R = (s, w, o = {}) => cell(s, w, { align: 'right', ...o });
  const all = data.rankings || [];
  if (!all.length) {
    const body = section('National rankings', ['Rankings are only available for the current season.']);
    return page({ title: `Rankings · ${SITE.title}`, root: '', data, body, current: 'Rankings' });
  }

  const { field } = RANKING_SORTS[sort];
  const rows = all.filter((r) => r[field]).sort((a, b) => a[field] - b[field]).slice(0, 50);

  const toggle = 'Sort: ' + Object.entries(RANKING_SORTS).map(([key, s]) => (key === sort
    ? `<b>${s.label}</b>`
    : `<a href="${s.file}">${s.label}</a>`)).join(' · ');

  // Most useful columns first so they show on a phone before the table scrolls.
  // First column is the ranking being sorted by; the other ranking goes on the far right.
  const byNpi = sort === 'npi';
  const head = cell(byNpi ? 'NPI' : 'PW', 4) + cell('', 17)
    + R('W-L-T', 8) + R('+/-', 5) + R('GF', 4) + R('GA', 4) + '  ' + cell('CONF', 5) + R('PCW', 4) + R('RPI', 7)
    + R(byNpi ? 'PW' : 'NPI', 5);
  const lines = rows.map((r) => {
    const us = r.team === TEAM.name;
    const diff = r.gf !== '' && r.ga !== '' ? Number(r.gf) - Number(r.ga) : '';
    const diffText = diff === '' ? '' : diff > 0 ? `+${diff}` : String(diff);
    const [first, last] = byNpi ? [r.npiRank, r.pwRank] : [r.pwRank, r.npiRank];
    return R(first ?? '', 3, { bold: us }) + ' ' + cell(r.team, 17, { bold: us })
      + R(r.record, 8) + R(diffText, 5) + R(r.gf, 4) + R(r.ga, 4)
      + '  ' + cell(CONF_SHORT[r.conf] || r.conf, 5) + R(r.pcw, 4) + R(r.rpi, 7) + R(last ?? '', 5);
  });

  const key = [
    "NPI: the NCAA's official ranking, which",
    '  picks the tournament field',
    'PW: PairWise rank (fan-built model of',
    '  the old selection system)',
    '+/-, GF, GA: goal differential, goals',
    '  for and against, all games',
    'PCW: PairWise comparisons won',
    'RPI: Ratings Percentage Index',
  ].map((l) => `<i>${esc(l)}</i>`);

  const body = [
    section(null, [toggle]),
    section(`National rankings · top ${rows.length} by ${RANKING_SORTS[sort].label}`,
      ['<div class="scroll">' + [head, ...lines].join('\n') + '</div>']),
    section(null, key),
  ].join('\n');
  const title = `Rankings (${RANKING_SORTS[sort].label}) · ${SITE.title}`;
  return page({ title, root: '', data, body, current: 'Rankings' });
}
