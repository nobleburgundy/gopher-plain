# Gophers Hockey (plain text)

A plain-text static site for Minnesota men's hockey: schedule, box scores, Big Ten standings, stats and PairWise rank. Data from [College Hockey News](https://www.collegehockeynews.com).

```sh
npm install
npm run all     # fetch data + build to dist/
npm run serve   # preview at http://localhost:8080
```

**Deploy:** push to `main` on GitHub, set **Settings → Pages → Source** to **GitHub Actions**, then run the workflow. It rebuilds hourly (every 15 min on game nights).

**If it breaks:** CHN probably changed their page layout. Fix the parser in `src/parse.js`; the last good site stays up meanwhile.
