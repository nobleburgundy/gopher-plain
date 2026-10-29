import { CHN_BASE } from './config.js';

const UA = 'gopher-plain/1.0 (static fan site; low-volume, cached)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let last = 0;

// Fetch a CHN page as text. Spaces requests out and retries a couple of times.
export async function getPage(path) {
  const url = path.startsWith('http') ? path : CHN_BASE + path;
  for (let attempt = 1; ; attempt++) {
    const wait = last + 1000 - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 3) throw new Error(`Failed to fetch ${url}: ${err.message}`);
      await sleep(2000 * attempt);
    }
  }
}
