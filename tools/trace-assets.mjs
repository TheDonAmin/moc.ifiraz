import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
const DOMAIN = 'aminzarifi.com';

// --- collect every file on disk -------------------------------------------
const allFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else allFiles.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
})(ROOT);

// --- resolve a URL/path reference to a repo-relative file ------------------
function resolveRef(ref, fromFile) {
  if (!ref) return null;
  ref = ref.trim().replace(/^['"]|['"]$/g, '');
  if (!ref || ref.startsWith('data:') || ref.startsWith('#')) return null;

  // strip protocol + our own domain; drop anything pointing elsewhere
  if (/^https?:\/\//i.test(ref)) {
    const m = ref.match(/^https?:\/\/(?:www\.)?([^/]+)(\/.*)?$/i);
    if (!m || !m[1].toLowerCase().includes(DOMAIN)) return null;
    ref = m[2] || '/';
  } else if (ref.startsWith('//')) return null;

  ref = ref.split('?')[0].split('#')[0];
  if (!ref) return null;

  let rel = ref.startsWith('/')
    ? ref.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), ref));
  if (rel.startsWith('..')) return null;

  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  return rel;
}

// --- pull references out of one file ---------------------------------------
const TEXTUAL = /\.(html?|css|js|mjs|svg|xml|xsl|json|txt|webmanifest)$/i;

function extractRefs(file) {
  if (!TEXTUAL.test(file)) return [];
  let src;
  try { src = fs.readFileSync(path.join(ROOT, file), 'utf8'); } catch { return []; }

  const out = [];
  const push = (v) => { const r = resolveRef(v, file); if (r) out.push(r); };

  for (const m of src.matchAll(/\b(?:href|src|poster|content|data-src)\s*=\s*["']([^"']+)["']/gi)) push(m[1]);
  for (const m of src.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) push(m[1]);
  for (const m of src.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi))
    for (const cand of m[1].split(',')) push(cand.trim().split(/\s+/)[0]);

  return out;
}

// --- breadth-first closure from the real pages -----------------------------
const seeds = allFiles.filter((f) => f.endsWith('.html'));
const keep = new Set(seeds);
const queue = [...seeds];

while (queue.length) {
  const file = queue.shift();
  for (const ref of extractRefs(file)) {
    if (keep.has(ref)) continue;
    if (!allFiles.includes(ref)) continue;   // referenced but never exported
    keep.add(ref);
    queue.push(ref);
  }
}

const drop = allFiles.filter((f) => !keep.has(f));

const bytes = (list) =>
  list.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';

console.log('total files on disk :', allFiles.length, '(' + mb(bytes(allFiles)) + ')');
console.log('actually referenced :', keep.size, '(' + mb(bytes([...keep])) + ')');
console.log('unreferenced        :', drop.length, '(' + mb(bytes(drop)) + ')');

const byDir = {};
for (const f of drop) {
  const k = f.split('/').slice(0, 2).join('/');
  byDir[k] = (byDir[k] || 0) + 1;
}
console.log('\nunreferenced, grouped:');
for (const [k, v] of Object.entries(byDir).sort((a, b) => b[1] - a[1]).slice(0, 15))
  console.log('  ' + String(v).padStart(5), k);

fs.writeFileSync('tools/keep.txt', [...keep].sort().join('\n'));
fs.writeFileSync('tools/drop.txt', drop.sort().join('\n'));
console.log('\nwrote tools/keep.txt and tools/drop.txt');
