// Adds JSON-LD structured data the WordPress export never emitted.
//
// The site currently has zero structured data, which leaves AI search
// engines and Google to guess who "Amin Zarifi" refers to from prose alone -
// a real problem given a much more prominent person shares the exact name.
// A Person block ties the name to concrete, disambiguating facts (employer,
// job title, LinkedIn) the same way the visible page text already does; this
// mirrors existing on-page content, it does not introduce anything new.
//
// Run:  node tools/add-jsonld.mjs

import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync('tools/seo.json', 'utf8'));
const { domain, image } = cfg.site;
const p = cfg.person;

const PERSON_ID = domain + '/#person';

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': PERSON_ID,
  name: p.name,
  alternateName: p.alternateName,
  jobTitle: p.jobTitle,
  worksFor: { '@type': 'Organization', name: p.worksFor },
  url: domain + '/',
  image,
  email: p.email,
  sameAs: p.sameAs,
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: cfg.site.name,
  url: domain + '/',
  author: { '@id': PERSON_ID },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Builds YYYY-MM-DD straight from the "Month D, YYYY" text without going
// through Date parsing, which is timezone-dependent and shifted this by a
// day (new Date("May 21, 2026").toISOString() came out as the 20th here).
function toIsoDate(text) {
  const m = text.match(/^(\w+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1]) + 1;
  if (!month) return null;
  return m[3] + '-' + String(month).padStart(2, '0') + '-' + m[2].padStart(2, '0');
}

function articleSchema(rel, html) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1]
    .replace(/\s*[–-]\s*Amin Zarifi\s*$/i, '').trim();
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [, ''])[1];
  const dateText = (html.match(/itemprop="datePublished"[^>]*>\s*([^<]+?)\s*</i) || [, ''])[1];
  const iso = dateText ? toIsoDate(dateText) : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: desc,
    image,
    author: { '@id': PERSON_ID },
    ...(iso ? { datePublished: iso } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': domain + '/' + rel.replace(/index\.html$/, '') },
  };
}

function inject(file, schemas) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('application/ld+json')) return false; // already has one - don't double up

  const block = schemas
    .map((s) => '<script type="application/ld+json">' + JSON.stringify(s) + '</script>')
    .join('\n');

  if (!/<\/head>/i.test(html)) { console.error(file + ': no </head> - skipped.'); return false; }
  html = html.replace(/<\/head>/i, block + '\n</head>');
  fs.writeFileSync(file, html);
  return true;
}

const targets = [
  { file: 'docs/index.html', schemas: [websiteSchema, personSchema] },
  { file: 'docs/executive-profile/index.html', schemas: [personSchema] },
  { file: 'docs/what-can-ai-change-and-what-might-eventually-slow-it-down/index.html',
    build: (html) => [personSchema, articleSchema('what-can-ai-change-and-what-might-eventually-slow-it-down/index.html', html)] },
];

for (const t of targets) {
  const html = fs.readFileSync(t.file, 'utf8');
  const schemas = t.schemas || t.build(html);
  const done = inject(t.file, schemas);
  console.log((done ? '  ok    ' : '  skip  ') + t.file);
}
