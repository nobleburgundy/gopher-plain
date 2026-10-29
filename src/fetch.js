// Downloads everything from College Hockey News and saves it as JSON in data/.
// Finished box scores never change, so they're cached and only fetched once.
import fs from 'node:fs/promises';
import path from 'node:path';
import { TEAM, SEASON, previousSeason } from './config.js';
import { getPage } from './http.js';
import { parseSchedule, parseStandings, parseTeamStats, parseBox, parsePairwise, boxKey } from './parse.js';

const DATA = path.resolve('data');
const BOXES = path.join(DATA, 'boxes');

const exists = (p) => fs.access(p).then(() => true, () => false);
const writeJson = (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2));

async function main() {
  await fs.mkdir(BOXES, { recursive: true });
  const team = `${TEAM.chnSlug}/${TEAM.chnId}`;

  // Before the new schedule is posted (late summer), fall back to last season.
  let season = SEASON;
  console.log(`Season ${season}: fetching schedule…`);
  let schedule = parseSchedule(await getPage(`/schedules/team/${team}/${season}`));
  if (!schedule.games.length && !process.env.SEASON) {
    season = previousSeason(season);
    console.log(`  no games yet; using ${season} instead`);
    schedule = parseSchedule(await getPage(`/schedules/team/${team}/${season}`));
  }
  if (!schedule.games.length) throw new Error('Schedule came back empty; refusing to continue');

  console.log('Fetching standings…');
  const standings = parseStandings(
    await getPage(`/reports/standings.php?s=${season}&conf=0`), TEAM.conference);

  console.log('Fetching team stats…');
  let stats = { skaters: [], goalies: [] };
  try {
    stats = parseTeamStats(await getPage(`/stats/team/${team}/overall,${season}`));
  } catch (err) {
    // Early in the season there may be no stats yet.
    console.warn(`  stats unavailable: ${err.message}`);
  }

  // The PairWise ranking is a nice-to-have: if it fails, build the site without it.
  // CHN's PairWise page only covers the current season.
  let pairwise = null;
  if (season === SEASON) {
    console.log('Fetching PairWise…');
    try {
      pairwise = parsePairwise(await getPage('/ratings/pairwise/'), TEAM.name);
    } catch (err) {
      console.warn(`  PairWise unavailable: ${err.message}`);
    }
  }

  let fetched = 0;
  for (const g of schedule.games) {
    if (!g.boxPath) continue;
    const file = path.join(BOXES, `${boxKey(g.boxPath)}.json`);
    if (await exists(file)) continue;
    console.log(`Fetching box score ${g.boxPath}`);
    await writeJson(file, parseBox(await getPage(g.boxPath)));
    fetched++;
  }
  console.log(`Box scores: ${fetched} new`);

  await writeJson(path.join(DATA, 'site.json'), {
    season,
    fetchedAt: new Date().toISOString(),
    schedule,
    standings,
    stats,
    pairwise,
  });
  console.log('Saved data/site.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
