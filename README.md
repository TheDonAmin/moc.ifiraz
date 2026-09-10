# aminzarifi.com

Static build of the site, served by GitHub Pages from `docs/` on `main`.

The site was originally WordPress. It was exported to static HTML with the
Simply Static plugin, then trimmed and repaired here — WordPress is no longer
involved in serving it.

## Layout

| path | what it is |
|---|---|
| `src/` | the export, trimmed to the 17 files the pages actually reference |
| `docs/` | the published site — **generated, never edit by hand** |
| `tools/` | build scripts |
| `tools/seo.json` | page titles' descriptions and Open Graph metadata |

The raw 148 MB export lives in `site/` locally and is deliberately not
committed: 99% of it is WordPress plugin and editor assets no page loads.

## Build

```
node tools/build.mjs
```

That wipes `docs/` and regenerates it from `src/`:

1. copies the referenced files
2. renders the post lists that used to be fetched from the WordPress REST API
3. strips dead WordPress tags (RSS, xmlrpc, Matomo) and injects the metadata
   WordPress never emitted
4. rewrites absolute URLs to root-relative so the site works on any host
5. writes `sitemap.xml`, `robots.txt`, `.nojekyll`, `CNAME`

## Preview

```
node tools/serve.mjs
```

Serves `docs/` on <http://localhost:4321>, and falls back to `404.html` the way
GitHub Pages does.

## Analytics

The WordPress export shipped with a Matomo tracker pointed at a backend
that's gone (`tools/apply-seo.mjs` strips it), so the site currently records
no visit data at all. `tools/add-analytics.mjs` (run as part of the build)
injects [GoatCounter](https://www.goatcounter.com/) instead — free, no
cookies, no consent banner required — but only once it's configured:

1. Sign up at <https://www.goatcounter.com/> (pick a site code, e.g.
   `aminzarifi`) and verify the account by email.
2. Put that code in `tools/seo.json` under `analytics.code`.
3. Re-run `node tools/build.mjs` and commit the result — every page now
   loads the tracking snippet.
4. For the weekly report, create a read-only API token at
   `https://<code>.goatcounter.com/settings/api`, then run:
   ```
   GOATCOUNTER_API_TOKEN=xxx node tools/weekly-report.mjs
   ```
   This compares the last 7 days to the 7 before them (pageviews, visitors,
   top pages, referrers, browsers, locations) and writes the result to
   `reports/` (gitignored — a local artifact, not part of the published
   site). Data only exists from the day the code goes live, so the first
   report won't have a full week to compare until the second week.

## Checks

```
node tools/check-links.mjs
```

Reports internal links with no file behind them.

## Adding a post

Posts still come from the WordPress export. After exporting again, refresh the
files under `src/`, then re-run the build — the post lists on the home page and
`/insights/` are regenerated from the category archive.

## Known gaps

- `/business-consulting/`, `/operations-consulting/` and `/resources/` are in the
  menu but have no content. They are excluded from `sitemap.xml`.
- The home page links to `/technology` and `/connect-collaboration`, which do not
  exist. Both already 404'd on the WordPress site.
- The search box on `404.html` is inert — it posted to WordPress.
- Comment submission and RSS feeds are gone with the backend.
