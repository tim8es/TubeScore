# TubeScore

TubeScore is a Chrome/Chromium Manifest V3 extension that identifies movies or TV series referenced by YouTube videos and renders rating information near the YouTube metadata area.

## Current scope

- YouTube watch pages with SPA navigation support.
- Deterministic metadata-based recognition.
- TMDB catalog lookup and TMDB rating retrieval.
- No LLM, computer vision, audio fingerprinting, subtitle analysis, or remote YouTube-history collection.
- No embedded API credentials.

## Requirements

- Node.js 22.
- npm.
- Chrome/Chromium with Manifest V3 support.

## Verify the repository

```bash
npm install --no-audit --no-fund
npm run typecheck
npm test
npm run verify:build
npm run verify:build:dev
```

`verify:build` checks the standard unpacked build. `verify:build:dev` checks the local developer build and confirms the developer bootstrap stays isolated from the standard build.

## Standard unpacked build

```bash
npm run build
```

The resulting `dist/` contains the Manifest V3 service worker and YouTube content script. The standard build intentionally contains no developer options page and no TMDB token.

The current standard build is safe to inspect/load, but it is not a functional end-user release until a production credential-provisioning strategy is implemented. Do not embed a TMDB token in the bundle to bypass that gate.

## Local developer build

Use this only when you already possess a concrete TMDB API read token locally:

```bash
npm run build:dev
```

Then load `dist/` as an unpacked extension in a local Chrome profile, open the extension Options page, save the token locally, and run preflight before visiting a YouTube watch page.

The token is stored only in `chrome.storage.local` under `tubescoreRuntimeConfig`. It is not accepted through build arguments or environment variables and must not be committed, pasted into documentation, or printed to logs.

Detailed instructions: `docs/development/local-tmdb-bootstrap.md`.

## Safe behavior without configuration

Without a local runtime token, preflight returns `safe-unconfigured` and performs no TMDB network request. Recognition remains unconfigured rather than attempting anonymous or malformed requests.

Provider/runtime failures on an active watch page render a generic `TubeScore · Unavailable` state. Internal exception text and credential material are not rendered into the page.

## Permissions

The source manifest requests only:

- `storage` — runtime configuration/cache seam.
- `https://api.themoviedb.org/*` host access — TMDB background requests.
- `https://www.youtube.com/*` content-script match — required to survive YouTube SPA transitions into and between watch pages.

No developer options page or web-accessible resource is declared in the standard source manifest.

## Release gate

Before an end-user release, TubeScore still requires both:

1. A production-safe TMDB credential-provisioning strategy that does not ship a reusable secret in the extension bundle (for example, a controlled backend/proxy or another explicitly approved browser-safe model).
2. A real browser smoke test with a concrete authorized TMDB token/configuration, covering install → preflight → YouTube recognition → rating render → SPA navigation → provider-error UX.

Until those gates are satisfied, do not publish to the Chrome Web Store.
