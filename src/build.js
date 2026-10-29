// Reads data/ and writes the finished static site to dist/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { boxKey } from './parse.js';
import { todayCentral, gamePath } from './format.js';
import { homePage, schedulePage, standingsPage, statsPage, gamePage } from './pages.js';

const DATA = path.resolve('data');
const OUT = path.resolve('dist');

async function main() {
  const data = JSON.parse(await fs.readFile(path.join(DATA, 'site.json'), 'utf8'));
  const today = todayCentral();

  // Show opponents' current PairWise rank on games not yet played.
  const ranks = data.pairwise?.ranks || {};
  for (const g of data.schedule.games) {
    if (!g.result && ranks[g.opponent]) g.oppRank = ranks[g.opponent];
  }

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT, 'games'), { recursive: true });

  const write = (file, html) => fs.writeFile(path.join(OUT, file), html);

  await write('index.html', homePage(data, today));
  await write('schedule.html', schedulePage(data));
  await write('standings.html', standingsPage(data));
  await write('stats.html', statsPage(data));

  let games = 0;
  for (const g of data.schedule.games) {
    if (!g.boxPath) continue;
    const file = path.join(DATA, 'boxes', `${boxKey(g.boxPath)}.json`);
    const box = JSON.parse(await fs.readFile(file, 'utf8'));
    await write(gamePath(g), gamePage(data, g, box));
    games++;
  }

  await fs.copyFile(path.resolve('static/style.css'), path.join(OUT, 'style.css'));
  console.log(`Built dist/ with ${games} game pages`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
