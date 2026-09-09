# TubeScore production-readiness review

Reviewed against the zero-config standard unpacked extension runtime.

## Manifest and permissions

Status: PASS.

- Manifest V3 service worker.
- YouTube content script limited to `https://www.youtube.com/*`.
- No extension permissions (`storage`, `tabs`, `history`, `cookies`, etc.).
- Network host permissions limited to `https://www.wikidata.org/*`.
- No options page.
- No web-accessible resources.

The broad YouTube path match is intentional because YouTube navigates between watch pages through its SPA runtime.

## Credential and runtime configuration

Status: PASS / not required.

The standard service worker uses `createPublicRecognitionOrchestrator()` and requires no token, secret, backend URL, environment variable, or `chrome.storage` configuration.

Automated build verification rejects the production service-worker bundle if it contains legacy dependencies such as:

- `tubescoreRuntimeConfig`
- `tmdbAccessToken`
- `api.themoviedb.org`
- `chrome.storage`
- IMDb production endpoints

## Public data path

Status: PASS.

- Candidate discovery: official Wikidata Action API `wbsearchentities`.
- Rating lookup: `wbgetentities` and Wikidata `review score (P444)` statements.
- Rating issuer provenance: `review score by (P447)` when available.
- Requests use `Api-User-Agent` identification and no Authorization header.
- Shared Wikidata client provides a bounded in-memory cache, in-flight request deduplication, max 3 concurrent requests, and bounded `429/Retry-After` handling.
- HTTP/JSON failures and unavailable review scores fail safely through the existing provider error path.

## Error UX

Status: PASS.

Recognition/provider failures mount a generic `TubeScore · Unavailable` card for the current video only. Exception details are not rendered. The SPA generation guard prevents an old request/error from overwriting a newer video.

## Automated coverage

Covered:

- YouTube metadata extraction and late-metadata startup race.
- YouTube SPA video changes and stale-response protection.
- Message boundary validation and normalized failures.
- Wikidata candidate mapping/filtering and review-score parsing.
- Zero-config public recognition orchestration.
- Candidate scoring and high/likely/hidden match decisions.
- Client cache, in-flight deduplication, bounded concurrency, and `429/Retry-After` retry behavior.
- Exact least-privilege manifest host/permission set.
- Generic provider-error UX without internal error leakage.
- Production bundle isolation from TMDB/IMDb runtime dependencies.

Legacy TMDB and IMDb modules/tests remain as regression/reference coverage, but they are not selected by the standard service worker and are rejected from the production bundle by build verification.

## Isolated browser verification

Status: PASS.

Browser Smoke run `34302786877` used an isolated temporary Playwright Chromium profile and confirmed:

- unpacked `dist/` MV3 extension loading;
- live tokenless Wikidata access from the extension worker;
- a real YouTube watch page rendering `Metacritic via Wikidata 79/100` for Dune: Part Two;
- same-document YouTube SPA navigation with one correct overlay;
- fault-injected provider failure rendering `TubeScore · Unavailable`.

The user's Chrome/profile was not touched and no token, secret, account, or backend was used.

## Install/run documentation

Status: PASS.

```bash
npm install --no-audit --no-fund
npm run verify
npm run build
```

Then load `dist/` through Chrome's **Load unpacked** action. There is no token/configuration step.

## Source-policy and coverage boundary

The active production source is Wikidata structured data through the official Wikimedia Action API. This keeps the MVP zero-token and uses Wikidata's published CC0 data model.

Known limitation: rating coverage is lower than IMDb/TMDB because not every movie/TV item has a usable `P444` review score. The product intentionally does not restore restricted IMDb scraping or a credentialed provider as a silent fallback.

## Remaining release actions

The requested technical, source-policy, hardening, CI, and isolated-browser gates are complete for this MVP branch.

Chrome Web Store packaging/review/publication remains a separate explicit action and is not performed by repository verification or this PR.
