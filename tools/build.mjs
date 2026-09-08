// Rebuilds docs/ from the untouched WordPress export in src/.
//
//   src/  = raw Simply Static output, never edited
//   docs/  = what gets published, regenerated from scratch every run
//
// Run:  node tools/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const cfg = JSON.parse(fs.readFileSync('tools/seo.json', 'utf8'));
const DOMAIN = cfg.site.domain;

const step = (msg) => console.log('\n=== ' + msg + ' ===');

// --- 1. copy only the files the pages actually reference --------------------
step('copying referenced files');
fs.rmSync('docs', { recursive: true, force: true });

const keep = fs.readFileSync('tools/keep.txt', 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
for (const rel of keep) {
  const dest = path.join('docs', rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join('src', rel), dest);
}
console.log(keep.length + ' file(s) copied');

// --- 2. render the lists that used to come from the REST API ---------------
step('rendering post lists');
execFileSync('node', ['tools/build-post-lists.mjs'], { stdio: 'inherit' });

// --- 3. strip dead WordPress tags, add description + Open Graph -------------
step('applying metadata');
execFileSync('node', ['tools/apply-seo.mjs'], { stdio: 'inherit' });

// --- 3b. host-agnostic paths ---------------------------------------------
step("making paths root-relative");
execFileSync("node", ["tools/relativize.mjs"], { stdio: "inherit" });

// --- 3c. structured data --------------------------------------------------
step('adding JSON-LD structured data');
execFileSync('node', ['tools/add-jsonld.mjs'], { stdio: 'inherit' });

// --- 4. sitemap ------------------------------------------------------------
// Only pages that are indexable and actually have content: anything without a
// seo.json entry is a blank page, and noindex pages don't belong in a sitemap.
step('writing sitemap.xml and robots.txt');

const urls = [];
const omitted = [];
for (const rel of fs.readdirSync('docs', { recursive: true }).map((s) => String(s).split(path.sep).join('/'))) {
  if (!rel.endsWith('.html')) continue;
  const meta = cfg.pages[rel];
  if (!meta)          { omitted.push(rel + '  (no content)'); continue; }
  if (meta.noindex)   { omitted.push(rel + '  (noindex)');    continue; }
  urls.push(DOMAIN + '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, ''));
}
urls.sort();

fs.writeFileSync('docs/sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => '  <url>\n    <loc>' + u + '</loc>\n  </url>').join('\n') +
  '\n</urlset>\n');

fs.writeFileSync('docs/robots.txt',
  'User-agent: *\n' +
  'Allow: /\n\n' +
  'Sitemap: ' + DOMAIN + '/sitemap.xml\n');

console.log(urls.length + ' URL(s) in sitemap:');
for (const u of urls) console.log('  ' + u);
if (omitted.length) {
  console.log('\nleft out of the sitemap:');
  for (const o of omitted) console.log('  - ' + o);
}

// --- 5. GitHub Pages plumbing ----------------------------------------------
step('GitHub Pages files');
fs.writeFileSync('docs/.nojekyll', '');                       // serve _-prefixed paths as-is
fs.writeFileSync('docs/CNAME', DOMAIN.replace(/^https?:\/\//, '') + '\n');
console.log('.nojekyll + CNAME written');

console.log('\nBuild complete.');
