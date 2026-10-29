// Parsers for College Hockey News pages. Each takes raw HTML and returns plain data.
import * as cheerio from 'cheerio';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

// Collapse whitespace (including &nbsp; and non-breaking hyphens) into plain text.
export function clean(s) {
  return (s || '')
    .replace(/ /g, ' ')
    .replace(/‑/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC');
}

const pad2 = (n) => String(n).padStart(2, '0');

// "/box/final/20261023/ndk/min/" -> "20261023-ndk-min"
export const boxKey = (boxPath) =>
  boxPath.replace(/^\/box\/final\//, '').replace(/\/$/, '').replace(/\//g, '-');

// ---------------------------------------------------------------- schedule

export function parseSchedule(html) {
  const $ = cheerio.load(html);
  const table = $('table.schedule').first();
  if (!table.length) throw new Error('Schedule table not found');

  const games = [];
  let year = null;
  let month = null;

  table.find('tr').each((_, tr) => {
    const $tr = $(tr);
    if ($tr.hasClass('stats-section')) {
      const m = clean($tr.text()).match(/^([A-Za-z]+) (\d{4})$/);
      if (m) {
        month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
        year = Number(m[2]);
      }
      return;
    }
    if ($tr.attr('valign') !== 'top' || !year) return;

    const tds = $tr.children('td');
    const day = Number(clean(tds.eq(0).text()).split(' ')[0]);
    const note = clean(tds.eq(1).find('sup').text()) || null;

    const resultTd = $tr.children('td.result');
    const resultIdx = tds.index(resultTd);
    const result = clean(resultTd.text()) || null; // W, L, T, T-SOW, T-SOL
    const gf = clean(tds.eq(resultIdx + 1).text());
    const ga = clean(tds.eq(resultIdx + 2).text()).replace(/^-\s*/, '');

    const ot = clean($tr.children('td[width="25"]').text()) || null;
    const locTd = $tr.children('td[width="20"]');
    const loc = clean(locTd.text()); // "" = home, "at" = away, "vs." = neutral
    const oppTd = locTd.next('td');
    const oppText = clean(oppTd.text());
    const tags = [...oppText.matchAll(/\((\w+)\)/g)].map((m) => m[1]);
    const opponent = clean(oppText.replace(/\(\w+\)/g, ''));
    const oppLink = oppTd.find('a').attr('href') || null;

    const time = clean($tr.children('td.sked-status').text()) || null;
    const tv = $tr.find('a.tv-pill').map((_, a) => $(a).attr('title')).get().filter(Boolean);
    const boxPath = $tr.find('a[href^="/box/final/"]').attr('href') || null;

    const date = `${year}-${pad2(month)}-${pad2(day)}`;
    let type = 'conf';
    if (tags.includes('ex')) type = 'exhibition';
    else if (tags.includes('nc')) type = 'nonconf';

    games.push({
      date,
      time,
      site: loc === 'at' ? 'away' : loc.startsWith('vs') ? 'neutral' : 'home',
      opponent,
      oppLink,
      type,
      note,
      tv,
      result,
      score: result ? { us: Number(gf), them: Number(ga) } : null,
      ot,
      boxPath,
    });
  });

  // Footnotes like "1 ppd. from Oct. 2 (ice issues)" under the table.
  const notes = {};
  const factHtml = table.nextAll('div.factbox').first().html() || '';
  for (const part of factHtml.split(/<br\s*\/?>/i)) {
    const t = clean(cheerio.load(`<p>${part}</p>`)('p').text());
    const m = t.match(/^(\d+)\s+(.*)$/);
    if (m) notes[m[1]] = m[2];
  }

  return { games, notes };
}

// ---------------------------------------------------------------- standings

// Returns the rows of one conference's standings table.
export function parseStandings(html, conference) {
  const $ = cheerio.load(html);
  let table = null;
  $('table.data').each((_, t) => {
    const head = clean($(t).find('tr.stats-section').first().text());
    if (head === conference) table = $(t);
  });
  if (!table) throw new Error(`Standings for ${conference} not found`);

  // Map header labels to column positions so we don't depend on exact order.
  const headers = table.find('thead tr').last().children('th').map((_, th) => clean($(th).text())).get();
  const firstGP = headers.indexOf('GP');
  const secondGP = headers.indexOf('GP', firstGP + 1);
  const col = (name, from) => headers.indexOf(name, from);

  const rows = [];
  let rank = null;
  table.find('tbody tr').each((_, tr) => {
    const tds = $(tr).children('td');
    const v = (i) => clean(tds.eq(i).text());
    const r = v(0);
    if (r) rank = r; // blank rank means tied with the row above
    rows.push({
      rank,
      tied: !r,
      team: v(1),
      conf: {
        gp: v(firstGP), pts: v(col('PTS', firstGP)), pct: v(col('Pt%', firstGP)),
        rw: v(col('RW', firstGP)), rl: v(col('RL', firstGP)),
        ow: v(col('OW', firstGP)), ol: v(col('OL', firstGP)),
      },
      overall: {
        gp: v(secondGP), w: v(col('W', secondGP)), l: v(col('L', secondGP)), t: v(col('T', secondGP)),
        gf: v(col('GF', secondGP)), ga: v(col('GA', secondGP)),
      },
    });
  });
  return rows;
}

// ---------------------------------------------------------------- team stats

function parseStatTable($, table) {
  const headers = table.find('thead tr').last().children('th').map((_, th) => clean($(th).text())).get();
  const rows = table.find('tbody tr').map((_, tr) => {
    const tds = $(tr).children('td');
    const row = {};
    headers.forEach((h, i) => { row[h] = clean(tds.eq(i).text()); });
    return row;
  }).get();
  const totals = {};
  table.find('tfoot tr').first().children('td').each((i, td) => {
    if (headers[i]) totals[headers[i]] = clean($(td).text());
  });
  return { headers, rows, totals };
}

// "Brodie Ziemer, F, Jr" -> name/pos/yr ; goalies are "Name, Yr"
function splitName(s) {
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length === 3) return { name: parts[0], pos: parts[1], yr: parts[2] };
  return { name: parts[0], pos: 'G', yr: parts[1] || '' };
}

export function parseTeamStats(html) {
  const $ = cheerio.load(html);
  const sk = $('table#skaters');
  const gk = $('table#goalies');
  if (!sk.length) throw new Error('Skater stats table not found');

  const skaters = parseStatTable($, sk).rows.map((r) => ({
    ...splitName(r['Name, Yr']),
    gp: r.GP, g: r.G, a: r.A, pts: r['Pts.'], pim: r.PIM, pm: r['+/-'],
    ppg: r.PPG, shg: r.SHG, gwg: r.GWG, shots: r.Shots, toi: r['TOI/G'],
  }));
  const goalies = gk.length ? parseStatTable($, gk).rows.map((r) => ({
    ...splitName(r['Name, Yr']),
    gp: r.GP, w: r.W, l: r.L, t: r.T, ga: r.GA, min: r.MIN, gaa: r.GAA, sv: r.SV, svpct: r['SV%'],
  })) : [];
  return { skaters, goalies };
}

// ---------------------------------------------------------------- box score

// ---------------------------------------------------------------- PairWise

// CHN's PairWise table. Returns our rank (null if not listed) and every team's rank by name.
export function parsePairwise(html, teamName) {
  const $ = cheerio.load(html);
  const rows = $('table.pw tbody tr');
  if (!rows.length) throw new Error('PairWise table not found');
  const ranks = {};
  rows.each((_, tr) => {
    const tds = $(tr).children('td');
    const rank = Number(clean(tds.eq(0).text()));
    if (rank) ranks[clean(tds.eq(1).text())] = rank;
  });
  return { rank: ranks[teamName] ?? null, teams: rows.length, ranks };
}

export function parseBox(html) {
  const $ = cheerio.load(html);
  const meta = $('#meta');
  if (!meta.length) throw new Error('Box score not found');

  const teams = meta.children('.team').map((_, el) => {
    const $el = $(el);
    return {
      name: clean($el.find('h4 a').first().text()),
      link: $el.find('h4 a').first().attr('href') || null,
      score: Number(clean($el.find('h2').text())),
      record: clean($el.find('h4').last().text()),
    };
  }).get();
  if (teams.length !== 2) throw new Error('Box score teams not found');

  const info = meta.children('div').last();
  const subMeta = info.find('p.sub-meta span').map((_, s) => clean($(s).text())).get();
  const summary = info.children('p').not('.sub-meta').map((_, p) => clean($(p).text())).get();

  // Line score tables (goals and shots by period).
  const lineTable = (id) => {
    const t = $(`#${id} table`);
    const periods = t.find('thead td').slice(1).map((_, td) => clean($(td).text())).get();
    const rows = t.find('tbody tr').map((_, tr) => {
      const tds = $(tr).children('td');
      return { team: clean(tds.eq(0).text()), values: tds.slice(1).map((_, td) => clean($(td).text())).get() };
    }).get();
    return { periods, rows };
  };

  const pp = (() => {
    const t = $('#pp table');
    const headers = t.find('thead td').map((_, td) => clean($(td).text())).get();
    const rows = t.find('tbody tr').map((_, tr) =>
      [$(tr).children('td').map((_, td) => clean($(td).text())).get()]).get();
    return { headers, rows };
  })();

  // Scoring and penalties are grouped by period header rows.
  const byPeriod = (id, mapRow) => {
    const out = [];
    let period = null;
    $(`#${id} > table tr`).each((_, tr) => {
      const $tr = $(tr);
      if ($tr.hasClass('stats-section')) {
        const t = clean($tr.text());
        if (t !== 'Scoring' && t !== 'Penalties') period = t;
        return;
      }
      if (!$tr.hasClass('hscore') && !$tr.hasClass('vscore')) return;
      const tds = $tr.children('td').map((_, td) => clean($(td).text())).get();
      out.push({ period, side: $tr.hasClass('hscore') ? 'home' : 'away', ...mapRow(tds) });
    });
    return out;
  };

  const goals = byPeriod('scoring', (td) => ({
    team: td[0], strength: td[1], scorer: td[3], assists: td[4], time: td[5],
  }));
  const penalties = byPeriod('penalties', (td) => ({
    team: td[0], player: td[1], minutes: td[2], infraction: td[3], time: td[4],
  }));

  // Goalies: one stats-header row per team, followed by that team's rows.
  const goalies = [];
  let current = null;
  $('#goalies tr').each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.children('td').map((_, td) => clean($(td).text())).get();
    if ($tr.hasClass('stats-header')) {
      current = { team: tds[0], players: [] };
      goalies.push(current);
    } else if (current && !$tr.hasClass('stats-section') && tds.length >= 4) {
      current.players.push({ name: tds[0], sv: tds[1], ga: tds[2], min: tds[3] });
    }
  });

  const shootout = $('#shootout table table').map((_, t) => {
    const $t = $(t);
    return [{
      team: clean($t.find('thead').text()),
      attempts: $t.find('tbody tr').map((_, tr) => {
        const tds = $(tr).children('td');
        return { player: clean(tds.eq(0).text()), result: clean(tds.eq(1).text()) };
      }).get(),
    }];
  }).get();

  const players = $('#playersums .playersum table').map((_, t) => {
    const $t = $(t);
    const headers = $t.find('thead td').map((_, td) => clean($(td).text())).get();
    const rows = $t.find('tbody tr').map((_, tr) => {
      const row = { first: $(tr).hasClass('first') };
      $(tr).children('td').each((i, td) => { row[headers[i] || i] = clean($(td).text()); });
      return row;
    }).get();
    return [{ team: headers[0], headers: headers.slice(1), rows }];
  }).get();

  return {
    title: clean($('#content h1').first().text()),
    away: teams[0],
    home: teams[1],
    date: clean(info.children('h4').first().text()),
    summary,
    details: subMeta,
    goalsByPeriod: lineTable('goals'),
    shotsByPeriod: lineTable('shots'),
    pp,
    goals,
    penalties,
    goalies,
    shootout,
    players,
  };
}
