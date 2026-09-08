# Production TMDB proxy architecture

## Decision

TubeScore production releases must not contain a reusable TMDB credential.

The selected minimal architecture is a thin serverless proxy:

```text
Chrome extension
  -> HTTPS proxy URL (public, non-secret)
  -> strict operation/path validation
  -> server runtime secret
  -> api.themoviedb.org
```

The repository contains a framework-free Fetch-compatible proxy core, a thin Vercel Function entrypoint, tokenless proxy-backed TMDB providers, and a proxy-backed recognition orchestrator. No deployment is performed by this repository state.

The existing unpacked development flow remains unchanged: local development can continue to use `chrome.storage.local` with a developer-supplied TMDB token. The production proxy path is separate and is not selected by the current unpacked build.

## Security boundaries

The proxy deliberately does not expose a generic TMDB passthrough.

Allowed operations are only:

- `GET /api/tmdb/search?query=...`
- `GET /api/tmdb/movie/:numericId`
- `GET /api/tmdb/tv/:numericId`
- CORS `OPTIONS` for an allowed extension origin

The proxy:

- obtains the TMDB credential only from server runtime configuration;
- sends the credential to TMDB as a Bearer token server-side;
- validates query length, locale, page, media type, and numeric ids;
- ignores unknown search query parameters;
- rejects arbitrary TMDB paths;
- normalizes upstream failures instead of returning upstream error bodies;
- fails closed when the server credential or origin allowlist is missing;
- emits no credential value in responses or application-level errors;
- returns cache headers for successful public TMDB metadata responses.

`Origin` filtering is defense-in-depth for browser traffic, not authentication: non-browser clients can forge an Origin header. A public production deployment therefore still requires platform-level rate limiting / abuse controls before broad distribution.

## Server runtime configuration

Two deploy-time variables are required. Neither belongs in extension source, extension build artifacts, GitHub Actions logs, or documentation values.

### `TMDB_ACCESS_TOKEN`

Server-side TMDB API read token.

- secret;
- available only to the proxy function runtime;
- never returned to the extension;
- never supplied as a Vite/esbuild variable.

### `TUBESCORE_ALLOWED_ORIGINS`

Comma-separated allowlist of Chrome extension origins, for example conceptually:

```text
chrome-extension://<production-extension-id>
```

The repository intentionally contains no concrete production extension id.

## Public extension runtime configuration

The production extension needs only one non-secret value once the proxy is deployed:

```json
{
  "tmdbProxyBaseUrl": "https://<deployed-host>/api/tmdb"
}
```

This URL is public configuration and does not authenticate TMDB. `createProxyRecognitionOrchestrator()` validates the HTTPS URL and constructs tokenless proxy-backed catalog and ratings providers. Those providers never add an `Authorization` header.

The current unpacked build intentionally continues to use the local developer-token path; selecting the proxy-backed orchestrator is a production build/entrypoint concern, not a credential distribution mechanism.

Do not add `TMDB_ACCESS_TOKEN` to extension runtime configuration.

## Vercel skeleton

Repository pieces:

- `src/proxy/tmdb-proxy.ts` — security and forwarding logic;
- `src/proxy/runtime-config.ts` — deploy-time origin parsing contract;
- `src/proxy/serverless-handler.ts` — serverless env adapter and rewrite normalization;
- `api/tmdb.ts` — deployable function entrypoint;
- `vercel.json` — rewrites for search and movie/TV detail paths;
- `src/providers/tmdb/tmdb-proxy-provider.ts` — tokenless extension-side providers;
- `src/extension/proxy-recognition-orchestrator.ts` — proxy-backed recognition factory;
- `tests/proxy/*.test.ts` and proxy provider/orchestrator tests — security and failure-path coverage.

No Vercel project, account, deployment, domain, extension id, or environment secret is created by this slice.

## Deploy prerequisites

Before a public deployment can serve production extension traffic, external infrastructure/state must exist:

1. A serverless deployment project/domain.
2. A valid TMDB read token stored as the server-side `TMDB_ACCESS_TOKEN` secret.
3. The concrete Chrome extension origin for `TUBESCORE_ALLOWED_ORIGINS`.
4. Platform-level rate limiting / abuse protection appropriate for expected traffic.

## Smoke prerequisites

A real end-to-end proxy smoke test requires external runtime state:

1. A deployed HTTPS proxy URL.
2. The server-side token configured on that deployment.
3. The test extension origin allowed by the proxy.

Until those exist, tests use mocked upstream responses and do not make a live TMDB request.
