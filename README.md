# TubeScore

TubeScore is a Chrome/Chromium Manifest V3 extension that identifies movies or TV series referenced by YouTube videos and renders an IMDb rating near the YouTube metadata area.

## Runtime model

The standard extension is zero-config:

- no API key or token;
- no extension options page;
- no `chrome.storage` permission;
- no backend or deployed proxy required;
- no account setup after installation.

Recognition uses YouTube page metadata plus deterministic scoring. Catalog candidates come from IMDb's public autocomplete endpoint. Ratings come from IMDb's public `title.ratings.tsv.gz` dataset. The ratings dataset is fetched with the browser HTTP cache enabled and memoized in the service worker while it is alive.

TMDB code retained in the repository is an optional legacy/fallback path and is not imported by the standard service-worker bundle.

## Current scope

- YouTube `/watch` pages with SPA navigation support.
- Trailers, teasers, clips, and reviews when the title can be identified confidently from page metadata.
- IMDb catalog matching and IMDb aggregate rating display.
- High/likely/hidden confidence decisions; false negatives are preferred over confident false positives.
- Generic non-blocking error state when a public data source is unavailable.
- No LLM, computer vision, audio fingerprinting, subtitle analysis, or remote YouTube-history collection.

## Requirements

- Node.js 22.
- npm.
- Chrome/Chromium with Manifest V3 and `DecompressionStream` support. The build targets Chrome 120+.

## Verify

```bash
npm install --no-audit --no-fund
npm run verify
```

`npm run verify` performs:

1. strict TypeScript typecheck;
2. the full Vitest suite;
3. a clean production build;
4. build-isolation checks proving the standard service worker contains no TMDB token/runtime-config/storage dependency and does contain the public IMDb providers.

## Build and install as an unpacked extension

```bash
npm run build
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this repository's generated `dist/` directory.
5. Open a YouTube watch page for a recognizable movie or TV trailer/review.

No additional TubeScore configuration is required.

The generated directory contains:

```text
dist/
  manifest.json
  content-script.js
  service-worker.js
```

## Network/data flow

```text
YouTube watch page
  -> content-script metadata extraction
  -> chrome.runtime message
  -> service worker
  -> IMDb public autocomplete
  -> deterministic candidate scorer / match decision
  -> IMDb public ratings dataset
  -> TubeScore rating card
```

The extension never sends a TubeScore API credential because the standard runtime has no credential.

On the first rating lookup after a cold service-worker start, Chrome may need to retrieve/decompress the IMDb ratings dataset. The request uses `cache: force-cache`; subsequent lookups in the same worker reuse the decompressed dataset in memory, and later worker starts can reuse the browser's HTTP cache.

## Permissions

TubeScore requests no extension permissions such as `storage`, `tabs`, `history`, or `cookies`.

Host access is limited to:

- `https://v3.sg.media-imdb.com/*` — public IMDb title autocomplete;
- `https://datasets.imdbws.com/*` — public IMDb ratings dataset.

The content script is matched only on `https://www.youtube.com/*`; this broad path is required because YouTube performs SPA navigation between watch pages without full page reloads.

## Error behavior

A provider/network failure for the active video renders a generic:

```text
TubeScore · Unavailable
Ratings could not be loaded.
```

Internal exception details are not rendered. Existing navigation generation guards prevent a stale result/error from an old video overwriting the current page.

## Data-source constraints

The IMDb autocomplete endpoint used for candidate discovery is public but undocumented and can change independently of TubeScore. Provider failures therefore remain fail-safe and non-blocking.

IMDb publishes its downloadable datasets for non-commercial use under its dataset terms. Before commercial distribution or Chrome Web Store monetization, review the applicable IMDb licensing/usage terms for the intended use. This is a distribution/legal gate, not a runtime credential requirement.

## Release verification still requiring a real browser

CI verifies the code, message boundary, providers, recognition decisions, manifest, and generated bundle. It does not emulate Chrome's unpacked-extension lifecycle or current live YouTube DOM/network behavior.

Before calling a build fully browser-verified, run an unpacked Chrome smoke test covering:

- extension load and service-worker startup;
- a recognizable YouTube watch page;
- IMDb rating render;
- YouTube SPA navigation to another video;
- no-match behavior;
- provider-error UI.

That smoke test requires **no token, secret, account, backend, or proxy**.
