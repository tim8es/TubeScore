# Local TMDB bootstrap and browser-smoke preflight

This flow is for local development only. It does not create, request, embed, print, or transmit a TMDB token during build or CI.

## Build modes

Standard build:

```bash
npm run verify:build
```

This creates `dist/` without the developer bootstrap page. CI verifies that `dist/dev-bootstrap.js`, `dist/dev-bootstrap.html`, and an `options_page` manifest entry are absent.

Local developer build:

```bash
npm run verify:build:dev
```

This creates `dist/` with `dev-bootstrap.html` and `dev-bootstrap.js`, and adds `options_page: "dev-bootstrap.html"` only to the generated `dist/manifest.json`.

No token is accepted as a build argument or environment variable. The build output contains UI/code for entering a token but never a token value.

## Local configuration flow

Do not load the extension into Chrome until you already have a concrete TMDB API read token available locally.

When a token is available:

1. Run `npm run verify:build:dev`.
2. Load the generated `dist/` directory as an unpacked extension in a local Chrome profile.
3. Open the extension's Options page.
4. Enter the token into the password field and choose **Save locally**.
5. The page writes only this object to `chrome.storage.local`:

```json
{
  "tubescoreRuntimeConfig": {
    "tmdbAccessToken": "<local value>"
  }
}
```

6. Choose **Run preflight** before opening a YouTube watch page.

The token is not written to repository files, generated build files, console output, or CI logs by this flow.

## Preflight verdicts

The preflight never contacts TMDB. It validates only local runtime configuration:

- `safe-unconfigured`: no local runtime token exists. This is the expected verdict before a token is supplied; no network request occurs.
- `invalid-config`: local configuration exists but is malformed or empty; no network request occurs.
- `ready-for-browser-smoke`: a non-empty local token exists. Preflight still performs no TMDB request; the actual provider call happens only when the extension processes a YouTube recognition request.

## Cleanup

After local smoke testing, use **Clear** on the Options page to remove `tubescoreRuntimeConfig` from `chrome.storage.local`.

Never paste the token into source files, test fixtures, issue comments, CI variables, build commands, documentation, or screenshots.
