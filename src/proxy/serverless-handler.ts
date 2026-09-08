import { createTmdbProxyHandler } from './tmdb-proxy';
import { parseAllowedOrigins } from './runtime-config';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ServerlessTmdbHandlerOptions {
  runtimeEnv: Record<string, string | undefined>;
  fetchFn?: FetchFn;
}

function rewriteProxyPath(request: Request): Request {
  const url = new URL(request.url);
  const proxyPath = url.searchParams.get('__proxy_path');
  url.searchParams.delete('__proxy_path');
  url.pathname = proxyPath ? `/api/tmdb/${proxyPath}` : '/api/tmdb';
  return new Request(url, request);
}

export function createServerlessTmdbHandler(options: ServerlessTmdbHandlerOptions) {
  const handle = createTmdbProxyHandler({
    env: {
      tmdbAccessToken: options.runtimeEnv.TMDB_ACCESS_TOKEN,
      allowedOrigins: parseAllowedOrigins(options.runtimeEnv.TUBESCORE_ALLOWED_ORIGINS)
    },
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {})
  });

  return (request: Request): Promise<Response> => handle(rewriteProxyPath(request));
}
