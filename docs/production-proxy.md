# Optional TMDB proxy fallback

## Status

This architecture is retained as an optional fallback/reference. It is **not used by the current standard TubeScore service worker** and is not required to build, install, test, or run the extension.

The active standard runtime is zero-config and uses Wikidata:

```text
YouTube
  -> Wikidata wbsearchentities
  -> deterministic scorer / decision
  -> Wikidata wbgetentities / P444 review score
  -> TubeScore card
```

No TMDB token, deployed backend, proxy URL, or runtime storage is required by that path.

## Why this code remains

Earlier slices implemented a secure alternative for a future provider that requires a server-side credential. Keeping it in the repository preserves a reviewed example of how TubeScore can isolate a reusable secret from the extension bundle without weakening the active zero-token path.

The optional architecture is:

```text
Chrome extension
  -> HTTPS proxy URL
  -> strict operation/path validation
  -> server runtime secret
  -> api.themoviedb.org
```

Repository pieces:

- `src/proxy/tmdb-proxy.ts`
- `src/proxy/runtime-config.ts`
- `src/proxy/serverless-handler.ts`
- `api/tmdb.ts`
- `vercel.json`
- `src/providers/tmdb/tmdb-proxy-provider.ts`
- `src/extension/proxy-recognition-orchestrator.ts`
- proxy/provider/orchestrator tests

These files are not reachable from `src/extension/service-worker.ts`. Production build verification rejects bundled `tmdbAccessToken`, `api.themoviedb.org`, `tubescoreRuntimeConfig`, `chrome.storage`, and the legacy IMDb production endpoints.

## Security contract if the fallback is ever activated

Allowed proxy operations are limited to:

- `GET /api/tmdb/search?query=...`
- `GET /api/tmdb/movie/:numericId`
- `GET /api/tmdb/tv/:numericId`
- CORS `OPTIONS` for an allowed extension origin

The proxy validates query/path parameters, rejects arbitrary TMDB passthrough, normalizes upstream failures, and fails closed when server runtime configuration is missing.

Any future activation would require external deployment state such as a server-side TMDB token and abuse/rate controls. Those are prerequisites only for this optional fallback, **not release gates for the current zero-token Wikidata build**.
