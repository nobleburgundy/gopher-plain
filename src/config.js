// Site settings. Change TEAM to point the site at a different program.

export const TEAM = {
  name: 'Minnesota',
  nickname: 'Gophers',
  chnSlug: 'Minnesota',
  chnId: 34,
  conference: 'Big Ten',
};

export const SITE = {
  title: 'Gophers Hockey',
  // Set to the full URL once the site is live (used for canonical links only).
  url: '',
};

export const CHN_BASE = 'https://www.collegehockeynews.com';

// College hockey seasons start in the fall. Before August, we're still in last season.
export function currentSeason(now = new Date()) {
  const y = now.getFullYear();
  const start = now.getMonth() >= 7 ? y : y - 1;
  return `${start}${start + 1}`;
}

export const SEASON = process.env.SEASON || currentSeason();

export function previousSeason(season) {
  const start = Number(season.slice(0, 4)) - 1;
  return `${start}${start + 1}`;
}

export function seasonLabel(season = SEASON) {
  return `${season.slice(0, 4)}–${season.slice(6)}`;
}
