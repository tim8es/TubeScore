# TubeScore

TubeScore is a Chrome/Chromium Manifest V3 extension that identifies movies or TV series referenced by YouTube videos and renders review scores near the YouTube metadata area.

## Runtime model

The standard extension remains zero-token:

- no API key or token;
- no backend or deployed proxy required;
- no account setup after installation;
- no LLM, computer vision, or remote browsing-history collection.

Recognition uses YouTube page metadata plus deterministic scoring. Catalog candidates come from the official Wikidata Action API. Ratings come from Wikidata `review score (P444)` statements, with issuer provenance from `review score by (P447)` when available.

TubeScore stores only the user's enabled rating-source names in `chrome.storage.local`. The inline settings drawer is part of the YouTube overlay; there is no separate options page. The recommended default is exactly Kinopoisk, IMDb, Rotten Tomatoes, and Metacritic.

TMDB and IMDb code retained in the repository is legacy/fallback/reference code and is not imported by the standard production service-worker bundle.

## Current scope

- YouTube `/watch` pages with SPA navigation support.
- Trailers, teasers, clips, and reviews when the title can be identified confidently from page metadata.
- Wikidata movie/TV matching and review-score display when usable `P444` statements exist.
- Compact two-column overlay with a title block clamped to three lines and a responsive rating-card grid.
- Inline source settings opened from the icon-only gear button; the selection persists locally and is passed into recognition so disabled sources are filtered before display.
- Direct title links when Wikidata exposes a validated exact platform ID; unsupported/fallback provenance URLs are not presented as fake platform links.
- High/likely/hidden confidence decisions; false negatives are preferred over confident false positives.
- Generic non-blocking error state when the public data source is unavailable.

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
4. build-isolation checks proving the standard service worker contains no TMDB token/runtime-config or IMDb production dependency and does contain the Wikidata provider.

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

The generated directory contains:

```text
dist/
  manifest.json
  content-script.js
  service-worker.js
```

## Rating-source settings

The gear button in the lower-left of the TubeScore card opens the source drawer. By default only these sources are enabled:

- Kinopoisk
- IMDb
- Rotten Tomatoes
- Metacritic

Other real sources found in Wikidata can be enabled individually. The selection is saved as a list of source names in extension-local storage. Changing it triggers recognition again for the current YouTube video so newly enabled sources can appear without reloading the page. **Reset to recommended** restores the four defaults.

## Network/data flow

```text
YouTube watch page
  -> load source selection from chrome.storage.local
  -> content-script metadata extraction
  -> chrome.runtime message with enabled source names
  -> service worker
  -> Wikidata wbsearchentities / exact YouTube-ID lookup
  -> deterministic candidate scorer / match decision
  -> Wikidata wbgetentities / P444 review scores
  -> filter to enabled rating sources
  -> TubeScore rating card
```

The extension sends no TubeScore API credential because the standard runtime has no credential.

The Wikidata client uses a bounded in-memory cache, in-flight request deduplication, at most three concurrent requests, and bounded `429/Retry-After` handling. The cache is intentionally non-persistent and resets when the MV3 service worker restarts.

## Permissions

TubeScore requests the `storage` permission solely for the enabled rating-source list. It does not request `tabs`, `history`, or `cookies`.

Host access is limited to:

- `https://www.wikidata.org/*` — official Wikidata Action API and entity pages.

Direct rating-card links do not require additional host permissions. The content script is matched only on `https://www.youtube.com/*`; this broad path is required because YouTube performs SPA navigation between watch pages without full page reloads.

## Error behavior

A provider/network failure for the active video renders a generic:

```text
TubeScore · Unavailable
Ratings could not be loaded.
```

Internal exception details are not rendered. Existing navigation generation guards prevent a stale result/error from an old video overwriting the current page. A local-storage failure falls back to the recommended defaults and does not block recognition.

## Data-source and coverage constraints

The active production data path uses Wikidata structured data through the official Wikimedia Action API. TubeScore remains zero-token and uses Wikidata data under its published CC0 licensing model.

Coverage is intentionally lower than commercial movie databases: not every matched movie or TV item has a usable `P444` review score or an exact external platform ID. TubeScore does not silently fall back to restricted scraping. A rating without a validated platform destination remains non-clickable rather than linking to a misleading page.

## Release verification

Automated CI verifies type safety, tests, production build isolation, and the installable archive on `main`. Browser acceptance smoke is performed with an isolated Chromium profile and the unpacked `dist/` build. Chrome Web Store publication is a separate release action and is not performed by CI.
