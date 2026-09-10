// Generates a weekly site-visits report from GoatCounter.
//
// Needs:
//   - tools/seo.json  analytics.code   set (see tools/add-analytics.mjs)
//   - GOATCOUNTER_API_TOKEN           env var, an API token from
//     https://<code>.goatcounter.com/settings/api (Site "Read" access is enough)
//
// Run:  GOATCOUNTER_API_TOKEN=xxx node tools/weekly-report.mjs [--out reports/foo.md]
//
// Reports are written under reports/, which is gitignored - they're a local
// artifact, not part of the published site.

import fs from 'node:fs';
import path from 'node:path';

const cfg = JSON.parse(fs.readFileSync('tools/seo.json', 'utf8'));
const code = cfg.analytics && cfg.analytics.code;
const token = process.env.GOATCOUNTER_API_TOKEN;

if (!code) {
  console.error('tools/seo.json has no analytics.code yet - run tools/add-analytics.mjs setup first.');
  process.exit(1);
}
if (!token) {
  console.error('Set GOATCOUNTER_API_TOKEN (create one at https://' + code + '.goatcounter.com/settings/api).');
  process.exit(1);
}

const BASE = `https://${code}.goatcounter.com/api/v0`;

async function api(pathname, params = {}) {
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${pathname} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; };

const thisWeek = { start: daysAgo(7), end: daysAgo(0) };
const lastWeek = { start: daysAgo(14), end: daysAgo(7) };

async function totals(start, end) {
  const stats = await api('/stats/total', { start: isoDay(start), end: isoDay(end) });
  return { hits: stats.hits, visitors: stats.total ?? stats.hits };
}

async function topList(pathname, start, end, limit = 10) {
  const data = await api(pathname, { start: isoDay(start), end: isoDay(end), limit });
  return data.hits || data.stats || [];
}

const pctChange = (now, prev) => {
  if (!prev) return now ? '+∞%' : '0%';
  const p = ((now - prev) / prev) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
};

const [curr, prev, pages, refs, browsers, locations] = await Promise.all([
  totals(thisWeek.start, thisWeek.end),
  totals(lastWeek.start, lastWeek.end),
  topList('/stats/hits', thisWeek.start, thisWeek.end),
  topList('/stats/refs', thisWeek.start, thisWeek.end),
  topList('/stats/browsers', thisWeek.start, thisWeek.end),
  topList('/stats/locations', thisWeek.start, thisWeek.end),
]);

const fmtRows = (rows, nameKey = 'path', countKey = 'count') =>
  rows.slice(0, 10).map((r) => `| ${r[nameKey] ?? r.name ?? r.title ?? '(unknown)'} | ${r[countKey] ?? r.count} |`).join('\n');

const report = `# Weekly site visits — ${isoDay(thisWeek.start)} to ${isoDay(thisWeek.end)}

## Summary

| Metric | This week | Last week | Change |
|---|---|---|---|
| Pageviews | ${curr.hits} | ${prev.hits} | ${pctChange(curr.hits, prev.hits)} |
| Visitors | ${curr.visitors} | ${prev.visitors} | ${pctChange(curr.visitors, prev.visitors)} |

## Top pages

| Page | Views |
|---|---|
${fmtRows(pages)}

## Top referrers

| Source | Views |
|---|---|
${fmtRows(refs, 'ref')}

## Browsers

| Browser | Views |
|---|---|
${fmtRows(browsers, 'browser')}

## Locations

| Country | Views |
|---|---|
${fmtRows(locations, 'country')}

---
Generated ${new Date().toISOString()} from GoatCounter (${code}).
`;

const outArg = process.argv.indexOf('--out');
const outFile = outArg !== -1 ? process.argv[outArg + 1] : `reports/${isoDay(thisWeek.end)}.md`;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, report);

console.log(report);
console.log(`\nWritten to ${outFile}`);
