// Reports internal links that have no file behind them in docs/.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'docs';
const DOMAIN = 'aminzarifi.com';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p) : files.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
})(ROOT);

const exists = new Set(files);
const broken = new Map();

for (const f of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/\b(?:href|src)\s*=\s*"([^"]+)"/gi)) {
    let ref = m[1].trim();
    if (!ref || ref.startsWith('#') || ref.startsWith('data:') || ref.startsWith('mailto:') || ref.startsWith('tel:')) continue;

    if (/^https?:\/\//i.test(ref)) {
      const u = ref.match(/^https?:\/\/(?:www\.)?([^/]+)(\/.*)?$/i);
      if (!u || !u[1].toLowerCase().includes(DOMAIN)) continue;  // external, not our problem
      ref = u[2] || '/';
    } else if (ref.startsWith('//')) continue;

    ref = ref.split('?')[0].split('#')[0];
    let rel = ref.startsWith('/') ? ref.slice(1)
      : path.posix.normalize(path.posix.join(path.posix.dirname(f), ref));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';

    // a bare /foo also resolves if /foo/index.html exists
    if (exists.has(rel) || exists.has(rel + '/index.html')) continue;

    if (!broken.has(ref)) broken.set(ref, new Set());
    broken.get(ref).add(f);
  }
}

if (broken.size === 0) { console.log('No broken internal links.'); process.exit(0); }

console.log('Broken internal links: ' + broken.size + '\n');
for (const [ref, pages] of [...broken].sort()) {
  console.log('  ' + ref);
  console.log('    on: ' + [...pages].join(', '));
}
