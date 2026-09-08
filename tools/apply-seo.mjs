// Strips WordPress-only cruft and injects the metadata WordPress never emitted.
//
// The export carries head tags that point at a backend which no longer exists
// (RSS feeds, the RSD/xmlrpc endpoint, the Matomo tracker), and it carries no
// meta description or Open Graph tags at all. Descriptions live in seo.json.
//
// Run:  node tools/apply-seo.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'docs';
const cfg = JSON.parse(fs.readFileSync('tools/seo.json', 'utf8'));
const { name, domain, image, twitterCard } = cfg.site;

// Titles come out of the HTML already entity-encoded; decode before re-encoding
// or '&amp;' turns into '&amp;amp;'.
const decodeEntities = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8211;|&ndash;/g, '–')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) pages.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
})(ROOT);

const skipped = [];
let changed = 0;

for (const rel of pages.sort()) {
  const file = path.join(ROOT, rel);
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // --- 1. drop tags whose backend is gone ---------------------------------
  html = html.replace(/[ \t]*<link rel="alternate" type="application\/rss\+xml"[^>]*>\s*\n?/gi, '');
  html = html.replace(/[ \t]*<link rel="EditURI"[^>]*>\s*\n?/gi, '');
  html = html.replace(/[ \t]*<link rel="pingback"[^>]*>\s*\n?/gi, '');
  html = html.replace(/[ \t]*<link rel="wlwmanifest"[^>]*>\s*\n?/gi, '');

  // --- 2. drop the Matomo tracker (its endpoint died with WordPress) -------
  const mi = html.indexOf('_paq');
  if (mi !== -1) {
    const s = html.lastIndexOf('<script', mi);
    const e = html.indexOf('</script>', mi);
    if (s !== -1 && e !== -1) html = html.slice(0, s) + html.slice(e + '</script>'.length);
  }

  // --- 3. add the metadata WordPress never wrote --------------------------
  const meta = cfg.pages[rel];
  if (!meta) {
    skipped.push(rel);
  } else if (!/<meta name="description"/i.test(html)) {
    const title = decodeEntities((html.match(/<title>([\s\S]*?)<\/title>/i) || [, name])[1].trim());
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [, domain + '/'])[1];
    const desc = meta.description;

    const tags = [
      `<meta name="description" content="${attr(desc)}">`,
      meta.noindex ? '<meta name="robots" content="noindex, follow">' : null,
      `<meta property="og:type" content="${meta.type || 'website'}">`,
      `<meta property="og:site_name" content="${attr(name)}">`,
      `<meta property="og:title" content="${attr(title)}">`,
      `<meta property="og:description" content="${attr(desc)}">`,
      `<meta property="og:url" content="${attr(canonical)}">`,
      `<meta property="og:image" content="${attr(image)}">`,
      `<meta name="twitter:card" content="${twitterCard}">`,
      `<meta name="twitter:title" content="${attr(title)}">`,
      `<meta name="twitter:description" content="${attr(desc)}">`,
      `<meta name="twitter:image" content="${attr(image)}">`,
    ].filter(Boolean).join('\n');

    // sit right after <title>, before whatever WordPress emitted next
    if (!/<title>/i.test(html)) { console.error(rel + ': no <title> - skipped.'); continue; }
    html = html.replace(/(<\/title>)/i, '$1\n' + tags);
  }

  if (html !== before) { fs.writeFileSync(file, html); changed++; }
  console.log((meta ? '  ok    ' : '  SKIP  ') + rel);
}

console.log('\n' + changed + ' file(s) rewritten.');
if (skipped.length) {
  console.log('\nNo entry in seo.json (left without a description):');
  for (const s of skipped) console.log('  - ' + s);
}
