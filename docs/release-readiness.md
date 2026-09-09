# TubeScore production-readiness review

Reviewed against the zero-config standard unpacked extension runtime.

## Manifest and permissions

Status: PASS under automated tests.

- Manifest V3 service worker.
- YouTube content script limited to `https://www.youtube.com/*`.
- No extension permissions (`storage`, `tabs`, `history`, `cookies`, etc.).
- Network host permissions limited to:
  - `https://v3.sg.media-imdb.com/*`
  - `https://datasets.imdbws.com/*`
- No options page.
- No web-accessible resources.

The broad YouTube path match is intentional because YouTube navigates between watch pages through its SPA runtime.

## Credential and runtime configuration

Status: PASS / not required.

The standard service worker uses `createPublicRecognitionOrchestrator()` and requires no token, secret, backend URL, environment variable, or `chrome.storage` configuration.

Automated build verification rejects the standard service-worker bundle if it contains any of these legacy dependencies:

- `tubescoreRuntimeConfig`
- `tmdbAccessToken`
- `api.themoviedb.org`
- `chrome.storage`

The previously implemented local TMDB token bootstrap/options-page flow has been removed from the active build and documentation.

## Public data path

Status: PASS under unit/integration tests.

- Candidate discovery: IMDb public autocomplete endpoint.
- Rating source: IMDb public `title.ratings.tsv.gz` dataset.
- Suggestion requests use no Authorization header.
- Dataset requests use no Authorization header and request `cache: force-cache`.
- Gzip content is decompressed with the browser-native `DecompressionStream` API.
- The decompressed dataset is memoized for the lifetime of the service worker.
- Dataset HTTP errors, malformed candidate ids, and missing rating rows fail safely.

The autocomplete endpoint is public but undocumented, so its external contract can change. That risk is isolated behind the provider boundary and surfaces as generic unavailable UX rather than breaking YouTube.

## Error UX

Status: PASS.

Recognition/provider failures mount a generic `TubeScore · Unavailable` card for the current video only. Exception details are not rendered. The existing SPA generation guard prevents an old request/error from overwriting a newer video.

## Automated coverage

Covered:

- YouTube metadata extraction.
- YouTube SPA video changes and stale-response race protection.
- Message boundary validation and normalized failures.
- IMDb autocomplete mapping/filtering and HTTP/JSON errors.
- IMDb ratings dataset gzip decoding, row parsing, HTTP errors, missing ratings, invalid ids, and in-memory memoization.
- Zero-config public recognition orchestration.
- Candidate scoring and high/likely/hidden match decisions.
- Exact least-privilege manifest host/permission set.
- Generic provider-error UX without internal error leakage.
- Production bundle isolation from TMDB token/runtime-config/storage dependencies.

Legacy TMDB/provider/proxy tests remain as regression coverage for the optional fallback code, but those modules are not selected by the standard service worker.

## Not covered by CI

These require an actual Chromium extension runtime rather than jsdom/unit mocks:

- `chrome://extensions` unpacked installation lifecycle.
- Real service-worker wake/suspend/restart behavior.
- Current production YouTube DOM compatibility.
- Live access from the extension service worker to the IMDb public autocomplete and dataset hosts.
- End-to-end SPA navigation with the installed extension.

No token or account is required to perform this browser smoke test.

## Install/run documentation

Status: PASS.

The root `README.md` documents one standard flow:

```bash
npm install --no-audit --no-fund
npm run verify
npm run build
```

Then load `dist/` through Chrome's **Load unpacked** action. There is no token/configuration step.

## Remaining gates

There is no credential-provisioning gate.

The remaining external gates are:

1. **Live Chromium smoke verification** of the unpacked extension against current YouTube and the public IMDb data endpoints.
2. **IMDb usage/licensing review before commercial distribution or monetization**, because IMDb's downloadable datasets are published under non-commercial dataset terms.
3. Chrome Web Store packaging/review only if publication is desired; publication is not part of the repository verification flow.

None of these gates requires an API token to run TubeScore.
