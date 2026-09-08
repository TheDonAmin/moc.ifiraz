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
