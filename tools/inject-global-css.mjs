// Adds tools/global.css as one <style> block to every built page, for rules
// that belong to the whole site (the header menu) rather than a single page.
//
// Run by tools/build.mjs after the pages are written.

import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync('tools/global.css', 'utf8').trim();
const block = '<style id="az-global">\n' + css + '\n</style>\n';

let count = 0;
for (const rel of fs.readdirSync('docs', { recursive: true }).map((s) => String(s).split(path.sep).join('/'))) {
  if (!rel.endsWith('.html')) continue;
  const file = path.join('docs', rel);
  const html = fs.readFileSync(file, 'utf8');
  if (!/<\/head>/i.test(html) || html.includes('id="az-global"')) continue;
  fs.writeFileSync(file, html.replace(/<\/head>/i, block + '</head>'));
  count++;
}
console.log(count + ' page(s) got the global stylesheet');
