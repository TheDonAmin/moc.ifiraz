// Renders the post lists that WordPress used to fetch from its REST API.
//
// /insights/ and the home page both called /wp-json/... on load. That endpoint
// is gone on a static site, so both pages would sit on "Loading..." forever.
// This writes the same markup ahead of time, reading the posts from the
// category archive WordPress still exports statically.
//
// Sources are read from src/ (the untouched export) and written to docs/,
// so the script is safe to re-run.
//
// Re-run after adding a post:  node tools/build-post-lists.mjs

import fs from 'node:fs';

const ARCHIVE = 'src/category/insights/index.html';

const TARGETS = [
  { src: 'src/index.html',          out: 'docs/index.html',
    containerId: 'az-latest-posts',  cardClass: 'az-latest-card',
    heading: 'h3', words: 22, limit: 3 },

  { src: 'src/insights/index.html', out: 'docs/insights/index.html',
    containerId: 'az-insights-list', cardClass: 'az-insight-list-card',
    heading: 'h2', words: 28, limit: Infinity },
];

const decode = (s) => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8211;|&ndash;/g, '–')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Range of a div's inner HTML, respecting nested divs.
function innerRange(html, containerId) {
  const open = html.indexOf('<div id="' + containerId + '"');
  if (open === -1) return null;
  const inner = html.indexOf('>', open) + 1;

  const tag = /<(\/?)div\b/g;
  tag.lastIndex = inner;

  let depth = 1, m;
  while ((m = tag.exec(html)) !== null) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return [inner, m.index];
  }
  return null;
}

// Cuts out the <script> block that used to populate a given container.
function removeLoaderScript(html, containerId) {
  const at = html.indexOf('getElementById("' + containerId + '")');
  if (at === -1) return html;
  const start = html.lastIndexOf('<script', at);
  const end = html.indexOf('</script>', at);
  if (start === -1 || end === -1) return html;
  return html.slice(0, start) + html.slice(end + '</script>'.length);
}

// WordPress' auto-excerpt starts at the top of the post body, which here means
// the category label and a repeat of the title. The first real paragraph reads
// far better, so prefer it and keep the auto-excerpt only as a fallback.
function firstParagraph(url, title) {
  const rel = url.replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '');
  const file = 'src/' + rel + '/index.html';
  if (!fs.existsSync(file)) return null;

  const page = fs.readFileSync(file, 'utf8')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // start at the article body, or the nav menu supplies the "first paragraph"
  const start = page.search(/class="[^"]*\bentry-content\b[^"]*"/i);
  if (start === -1) return null;
  const body = page.slice(start);

  for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = decode(m[1]);
    if (text.length < 60) continue;
    if (text.toLowerCase().startsWith(title.toLowerCase().slice(0, 25))) continue;
    return text;
  }
  return null;
}

// --- posts, newest first, straight out of the category archive -------------
const archive = fs.readFileSync(ARCHIVE, 'utf8');
const posts = [];

for (const block of archive.split('<article').slice(1)) {
  const link  = block.match(/<h2 class="entry-title[^"]*"[^>]*><a href="([^"]+)"/);
  const title = block.match(/<h2 class="entry-title[^"]*"[^>]*><a[^>]*>([\s\S]*?)<\/a>/);
  const date  = block.match(/itemprop="datePublished"[^>]*>([^<]+)</);
  const exc   = block.match(/class="ast-excerpt-container[^"]*"[^>]*>\s*<p>([\s\S]*?)<\/p>/);
  if (!link || !title) continue;

  const heading = decode(title[1]);
  const fallback = exc ? decode(exc[1]).replace(/\s*\[…\]\s*$/, '') : '';

  posts.push({
    link: link[1],
    title: heading,
    date: date ? decode(date[1]) : '',
    excerpt: firstParagraph(link[1], heading) || fallback,
  });
}

if (posts.length === 0) {
  console.error('No posts found in ' + ARCHIVE + ' - refusing to write empty lists.');
  process.exit(1);
}

// --- render ----------------------------------------------------------------
let failed = false;

for (const t of TARGETS) {
  const cards = posts.slice(0, t.limit).map((p) => {
    const words = p.excerpt.split(' ');
    const excerpt = words.slice(0, t.words).join(' ');
    const ellipsis = words.length > t.words ? '…' : '';
    return '\n<a class="' + t.cardClass + '" href="' + p.link + '">'
         + '\n<span>' + escapeHtml(p.date) + '</span>'
         + '\n<' + t.heading + '>' + escapeHtml(p.title) + '</' + t.heading + '>'
         + '\n<p>' + escapeHtml(excerpt) + ellipsis + '</p>'
         + '\n</a>';
  }).join('\n');

  const source = fs.readFileSync(t.src, 'utf8');
  const range = innerRange(source, t.containerId);
  if (range === null) {
    console.error(t.out + ': container #' + t.containerId + ' not found.');
    failed = true;
    continue;
  }

  let html = source.slice(0, range[0]) + cards + '\n' + source.slice(range[1]);
  html = removeLoaderScript(html, t.containerId);

  if (/Loading latest notes|Loading insights/.test(html)) {
    console.error(t.out + ': placeholder survived.'); failed = true; continue;
  }
  if (/wp-json/.test(html)) {
    console.error(t.out + ': a wp-json call survived.'); failed = true; continue;
  }
  if (!html.includes(t.cardClass)) {
    console.error(t.out + ': no cards were written.'); failed = true; continue;
  }

  fs.writeFileSync(t.out, html);
  console.log(t.out + ': ' + Math.min(posts.length, t.limit) + ' post(s)');
}

if (failed) process.exit(1);

console.log('\nPosts:');
for (const p of posts) console.log('  - ' + p.date + ' | ' + p.title);
