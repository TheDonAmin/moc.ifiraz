// Injects the GoatCounter tracking snippet into every page.
//
// The WordPress export shipped with Matomo wired to a backend that's gone
// (apply-seo.mjs strips it), which left the site with no visit data at all.
// GoatCounter is a free, cookieless, no-consent-banner-needed alternative:
// https://www.goatcounter.com/
//
// Signup is a manual, one-time step (email + accepting their terms), so this
// script does nothing until tools/seo.json has a real analytics.code in it -
// see README.md's "Analytics" section for how to get one.
//
// Run:  node tools/add-analytics.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'docs';
const cfg = JSON.parse(fs.readFileSync('tools/seo.json', 'utf8'));
const code = cfg.analytics && cfg.analytics.code;

if (!code) {
  console.log('  no analytics.code in tools/seo.json - skipping (see README.md "Analytics")');
  process.exit(0);
}

const snippet = `<script data-goatcounter="https://${code}.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>`;

const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
})(ROOT);

let changed = 0;
for (const file of pages.sort()) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('data-goatcounter=')) continue; // already injected

  if (!/<\/body>/i.test(html)) { console.error('  ' + file + ': no </body> - skipped.'); continue; }
  html = html.replace(/<\/body>/i, snippet + '\n</body>');
  fs.writeFileSync(file, html);
  changed++;
}

console.log('  ' + changed + ' page(s) instrumented with GoatCounter (' + code + ')');
