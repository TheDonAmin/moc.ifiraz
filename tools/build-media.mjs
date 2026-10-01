// Renders the Media page from tools/media.json.
//
// src/media/index.html is a normal page shell with two markers,
// <!--MEDIA:en--> and <!--MEDIA:fa-->; this fills them with the video cards,
// the appearances list, press coverage and "find me elsewhere" links for each
// language and copies the thumbnails from tools/media-assets/ to docs/media/img/.
//
// To add something to the page, edit tools/media.json and run:
//   node tools/build.mjs

import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync('tools/media.json', 'utf8'));
const SRC = 'src/media/index.html';
const OUT = 'docs/media/index.html';
const IMG_DIR = 'docs/media/img';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtDate = {
  en: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }),
  fa: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
};
const fmtNum = { en: new Intl.NumberFormat('en-US'), fa: new Intl.NumberFormat('fa-IR') };

const L = (v, lang) => (v && typeof v === 'object' ? v[lang] : v);
const dateText = (iso, lang) => fmtDate[lang].format(new Date(iso + 'T00:00:00Z'));
const videoById = new Map(data.videos.map((v) => [v.id, v]));

const PROVIDER = { youtube: 'YouTube', aparat: { en: 'Aparat', fa: 'آپارات' } };

function providerName(p, lang) {
  return typeof PROVIDER[p] === 'string' ? PROVIDER[p] : PROVIDER[p][lang];
}

function renderVideo(v, lang, t) {
  const title = L(v.title, lang);
  const meta = [L(v.event, lang), dateText(v.date, lang), fmtNum[lang].format(v.minutes) + ' ' + t.minutes].join(' · ');
  return `
<article class="az-video-card" id="${esc(v.id)}-${lang}">
  <div class="az-video-frame" data-provider="${esc(v.provider)}" data-video="${esc(v.videoId)}" data-title="${esc(title)}">
    <button type="button" class="az-video-play" aria-label="${esc(t.play)}: ${esc(title)}" style="background-image:url('/media/img/${esc(v.thumb)}')">
      <span class="az-video-playicon" aria-hidden="true"></span>
    </button>
  </div>
  <div class="az-video-body">
    <p class="az-video-meta">${esc(meta)}</p>
    <h3>${esc(title)}</h3>
    <p class="az-video-desc">${esc(L(v.description, lang))}</p>
    <a class="az-chip" href="${esc(v.watchUrl)}" target="_blank" rel="noopener">${esc(t.watchOn)} ${esc(providerName(v.provider, lang))} ↗</a>
  </div>
</article>`;
}

function renderAppearance(a, lang, t) {
  const video = a.videoId ? videoById.get(a.videoId) : null;
  const when = a.date ? dateText(a.date, lang) : L(a.dateLabel, lang);
  const chips = [];
  if (video) chips.push(`<a class="az-chip az-chip-strong" href="#${esc(video.id)}-${lang}">▶ ${esc(t.watchRecording)}</a>`);
  for (const l of a.links) {
    chips.push(`<a class="az-chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(L(l.label, lang))} ↗</a>`);
  }
  return `
<article class="az-appear">
  <div class="az-appear-when">${esc(when)}</div>
  <div class="az-appear-main">
    <p class="az-appear-role"><span>${esc(L(a.role, lang))}</span> · ${esc(L(a.organizer, lang))}</p>
    <h3>${esc(L(a.topic, lang))}</h3>
    <p>${esc(L(a.description, lang))}</p>
    ${chips.length ? `<div class="az-chips">${chips.join('')}</div>` : ''}
  </div>
</article>`;
}

function renderPress(p, lang, t) {
  return `
<a class="az-press-card" href="${esc(p.url)}" target="_blank" rel="noopener">
  <span class="az-press-outlet">${esc(L(p.outlet, lang))}</span>
  <h3 lang="fa" dir="rtl">${esc(p.title)}</h3>
  <p>${esc(L(p.description, lang))}</p>
  <span class="az-press-read">${esc(t.read)} ↗</span>
</a>`;
}

function renderElsewhere(e, lang) {
  return `
<a class="az-chip az-chip-big" href="${esc(e.url)}" target="_blank" rel="noopener">
  <strong>${esc(e.label)}</strong><span>${esc(L(e.description, lang))}</span>
</a>`;
}

function renderLang(lang) {
  const t = { ...data.page[lang], watchRecording: lang === 'en' ? 'Watch recording' : 'مشاهده‌ی ویدیو', read: lang === 'en' ? 'Read' : 'مطالعه' };
  const sortKey = (a) => a.date || (a.videoId && videoById.get(a.videoId).date) || '';
  const appearances = [...data.appearances].sort((x, y) => sortKey(y).localeCompare(sortKey(x)));

  return `
<h1>${esc(t.title)}</h1>
<p class="az-about-lead">${esc(t.lead)}</p>

<h2 class="az-media-h2">${esc(t.watch)}</h2>
<div class="az-video-grid">${data.videos.map((v) => renderVideo(v, lang, t)).join('')}
</div>

<h2 class="az-media-h2">${esc(t.appearances)}</h2>
<div class="az-appear-list">${appearances.map((a) => renderAppearance(a, lang, t)).join('')}
</div>

<h2 class="az-media-h2">${esc(t.press)}</h2>
<div class="az-press-grid">${data.press.map((p) => renderPress(p, lang, t)).join('')}
</div>

<h2 class="az-media-h2">${esc(t.elsewhere)}</h2>
<div class="az-chips">${data.elsewhere.map((e) => renderElsewhere(e, lang)).join('')}
</div>
`;
}

// --- build ---------------------------------------------------------------
let html = fs.readFileSync(SRC, 'utf8');
for (const lang of ['en', 'fa']) {
  const marker = `<!--MEDIA:${lang}-->`;
  if (!html.includes(marker)) { console.error(SRC + ': marker ' + marker + ' not found.'); process.exit(1); }
  html = html.replace(marker, renderLang(lang));
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

fs.mkdirSync(IMG_DIR, { recursive: true });
let imgs = 0;
for (const f of fs.readdirSync('tools/media-assets')) {
  fs.copyFileSync(path.join('tools/media-assets', f), path.join(IMG_DIR, f));
  imgs++;
}

// every referenced thumbnail must exist
for (const v of data.videos) {
  if (!fs.existsSync(path.join(IMG_DIR, v.thumb))) { console.error('missing thumbnail: ' + v.thumb); process.exit(1); }
}

console.log(OUT + ': ' + data.videos.length + ' video(s), ' + data.appearances.length + ' appearance(s), ' +
  data.press.length + ' press item(s), ' + imgs + ' image(s)');
