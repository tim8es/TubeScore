# TubeScore

TubeScore is a Chrome/Chromium Manifest V3 extension that identifies movies or TV series referenced by YouTube videos and renders an available review score near the YouTube metadata area.

## Runtime model

The standard extension is zero-config:

- no API key or token;
- no extension options page;
- no `chrome.storage` permission;
- no backend or deployed proxy required;
- no account setup after installation.

Recognition uses YouTube page metadata plus deterministic scoring. Catalog candidates come from the official Wikidata Action API. Ratings come from Wikidata `review score (P444)` statements, with issuer provenance from `review score by (P447)` when available.

TMDB and IMDb code retained in the repository is legacy/fallback/reference code and is not imported by the standard production service-worker bundle.

## Current scope

- YouTube `/watch` pages with SPA navigation support.
- Trailers, teasers, clips, and reviews when the title can be identified confidently from page metadata.
- Wikidata movie/TV matching and review-score display when a usable `P444` statement exists.
- High/likely/hidden confidence decisions; false negatives are preferred over confident false positives.
- Generic non-blocking error state when the public data source is unavailable.
- No LLM, computer vision, audio fingerprinting, subtitle analysis, or remote YouTube-history collection.

## Requirements

- Node.js 22.
- npm.
- Chrome/Chromium with Manifest V3 support. The build targets modern Chromium.

## Verify

```bash
npm install --no-audit --no-fund
npm run verify
```

`npm run verify` performs:

1. strict TypeScript typecheck;
2. the full Vitest suite;
3. a clean production build;
4. build-isolation checks proving the standard service worker contains no TMDB token/runtime-config/storage or IMDb production dependency and does contain the Wikidata provider.

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
  -> Wikidata wbsearchentities
  -> deterministic candidate scorer / match decision
  -> Wikidata wbgetentities / P444 review score
  -> TubeScore rating card
```

The extension sends no TubeScore API credential because the standard runtime has no credential.

The Wikidata client uses a bounded in-memory cache, in-flight request deduplication, at most three concurrent requests, and bounded `429/Retry-After` handling. The cache is intentionally non-persistent and resets when the MV3 service worker restarts.

## Permissions

TubeScore requests no extension permissions such as `storage`, `tabs`, `history`, or `cookies`.

Host access is limited to:

- `https://www.wikidata.org/*` — official Wikidata Action API and entity pages.

The content script is matched only on `https://www.youtube.com/*`; this broad path is required because YouTube performs SPA navigation between watch pages without full page reloads.

## Error behavior

A provider/network failure for the active video renders a generic:

```text
TubeScore · Unavailable
Ratings could not be loaded.
```

Internal exception details are not rendered. Existing navigation generation guards prevent a stale result/error from an old video overwriting the current page.

## Data-source and coverage constraints

The active production data path uses Wikidata structured data through the official Wikimedia Action API. The MVP remains zero-token and uses Wikidata data under its published CC0 licensing model.

Coverage is intentionally lower than IMDb/TMDB: not every matched movie or TV item has a usable `P444` review score. TubeScore does not silently fall back to restricted scraping. If no usable score is available, the rating is hidden or the existing unavailable state is used as appropriate.

## Release verification

The release branch has been verified with automated CI plus an isolated Playwright Chromium profile using the unpacked `dist/` build. The browser smoke covers:

- extension load and service-worker startup;
- a real YouTube watch page;
- a Wikidata-backed rating render;
- same-document YouTube SPA navigation;
- provider-error UI.

The smoke uses no token, secret, account, backend, or user Chrome profile. Chrome Web Store publication is a separate release action and is not performed by the verification workflow.
