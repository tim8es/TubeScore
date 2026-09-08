# TubeScore production-readiness review

Reviewed against the unpacked extension branch after the local developer bootstrap slice.

## Manifest and permissions

Status: PASS for current unpacked scope.

- Manifest V3 service worker.
- YouTube content script limited to `https://www.youtube.com/*`.
- Exact extension permission set: `storage`.
- Exact network host permission set: `https://api.themoviedb.org/*`.
- No standard-build options page.
- No standard source-manifest web-accessible resources.

The broad YouTube path match is intentional: the content script must remain present across YouTube SPA navigation into and between `/watch` pages.

## Build isolation

Status: PASS under automated verification.

- Standard build excludes `dev-bootstrap.html` and `dev-bootstrap.js`.
- Standard build does not add `options_page`.
- Developer build adds the options page only to generated `dist/manifest.json`.
- Neither build accepts a token as an argument or environment variable.
- Source maps are disabled.
- `dist/`, `.env`, and `.env.*` remain ignored.

## Error UX

Status: FIXED during this review.

Before the review, recognition/provider failures were swallowed in the content runtime, making provider failure indistinguishable from no match. The runtime now mounts a generic `TubeScore · Unavailable` card for the current video only. Exception text is not rendered, preserving the existing SPA race guard and avoiding credential/error-detail leakage.

## Test coverage

Covered automatically:

- YouTube metadata extraction.
- SPA video changes and stale-response race protection.
- Message boundary validation and normalized failures.
- Runtime config missing/invalid states.
- TMDB catalog/rating provider HTTP and payload failures.
- Recognition orchestration and hidden/high decisions.
- Local developer token save/clear and safe preflight.
- Standard/dev build isolation.
- Exact least-privilege manifest permission/host sets.
- Generic provider-error UX without exception leakage.

Not covered without a real browser and authorized runtime credential:

- Chrome unpacked installation lifecycle.
- Actual `chrome.storage.local` interaction in Chrome rather than mocks.
- Real service-worker wake/suspend behavior.
- Real YouTube DOM compatibility on current production pages.
- Real TMDB network responses and authorization.
- End-to-end SPA navigation with a live extension.

These are intentionally deferred to the browser-smoke gate.

## Install and run documentation

Status: PASS.

- Root `README.md` documents verification, standard build, dev build, permissions, safe-unconfigured behavior, and release gates.
- `docs/development/local-tmdb-bootstrap.md` documents local token handling and preflight.

## Remaining release gate

The repository can be brought to release-ready-without-secrets only up to the following external/runtime gates:

1. Select and implement a production-safe TMDB credential-provisioning strategy that does not embed a reusable secret in the browser bundle.
2. With a concrete authorized token/configuration, run the documented browser smoke covering unpacked install, preflight, YouTube recognition/render, SPA navigation, and provider-error behavior.

Chrome Web Store publication remains out of scope until both gates are satisfied.
