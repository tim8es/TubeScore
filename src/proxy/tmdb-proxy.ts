export interface TmdbProxyEnvironment {
  tmdbAccessToken: string | undefined;
  allowedOrigins: string[];
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface TmdbProxyHandlerOptions {
  env: TmdbProxyEnvironment;
  fetchFn?: FetchFn;
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function json(status: number, body: unknown, origin?: string): Response {
  const headers = new Headers(JSON_HEADERS);
  headers.set('Cache-Control', 'no-store');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigin(request: Request, env: TmdbProxyEnvironment): string | null {
  const origin = request.headers.get('origin');
  if (!origin || !env.allowedOrigins.includes(origin)) return null;
  return origin;
}

function buildSearchUrl(requestUrl: URL): URL | null {
  const query = requestUrl.searchParams.get('query')?.trim() ?? '';
  if (query.length === 0 || query.length > 200) return null;

  const language = requestUrl.searchParams.get('language') ?? 'en-US';
  const pageRaw = requestUrl.searchParams.get('page') ?? '1';
  const includeAdultRaw = requestUrl.searchParams.get('include_adult') ?? 'false';

  if (!/^[a-z]{2}-[A-Z]{2}$/.test(language)) return null;
  if (!/^\d{1,3}$/.test(pageRaw)) return null;
  const page = Number(pageRaw);
  if (page < 1 || page > 500) return null;
  if (includeAdultRaw !== 'false') return null;

  const upstream = new URL(`${TMDB_BASE_URL}/search/multi`);
  upstream.searchParams.set('query', query);
  upstream.searchParams.set('language', language);
  upstream.searchParams.set('page', String(page));
  upstream.searchParams.set('include_adult', 'false');
  return upstream;
}

function buildDetailsUrl(requestUrl: URL, pathname: string): URL | null {
  const match = /^\/api\/tmdb\/(movie|tv)\/(\d+)$/.exec(pathname);
  if (!match) return null;

  const [, mediaType, id] = match;
  const language = requestUrl.searchParams.get('language') ?? 'en-US';
  if (!/^[a-z]{2}-[A-Z]{2}$/.test(language)) return null;

  const upstream = new URL(`${TMDB_BASE_URL}/${mediaType}/${id}`);
  upstream.searchParams.set('language', language);
  return upstream;
}

function buildUpstreamUrl(requestUrl: URL): URL | null {
  if (requestUrl.pathname === '/api/tmdb/search') {
    return buildSearchUrl(requestUrl);
  }
  return buildDetailsUrl(requestUrl, requestUrl.pathname);
}

export function createTmdbProxyHandler(options: TmdbProxyHandlerOptions) {
  const fetchFn = options.fetchFn ?? fetch;

  return async (request: Request): Promise<Response> => {
    const origin = allowedOrigin(request, options.env);
    if (!origin) {
      return json(403, { error: 'origin_forbidden' });
    }

    if (request.method === 'OPTIONS') {
      const headers = new Headers({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
        'Vary': 'Origin'
      });
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'GET') {
      return json(405, { error: 'method_not_allowed' }, origin);
    }

    const token = options.env.tmdbAccessToken?.trim();
    if (!token) {
      return json(503, { error: 'proxy_unconfigured' }, origin);
    }

    const requestUrl = new URL(request.url);
    const upstreamUrl = buildUpstreamUrl(requestUrl);
    if (!upstreamUrl) {
      const isKnownOperation = requestUrl.pathname === '/api/tmdb/search'
        || /^\/api\/tmdb\/(movie|tv)\//.test(requestUrl.pathname);
      return json(isKnownOperation ? 400 : 404, {
        error: isKnownOperation ? 'invalid_request' : 'not_found'
      }, origin);
    }

    let upstream: Response;
    try {
      upstream = await fetchFn(upstreamUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });
    } catch {
      return json(502, { error: 'upstream_unavailable' }, origin);
    }

    if (!upstream.ok) {
      return json(502, { error: 'upstream_error', status: upstream.status }, origin);
    }

    const body = await upstream.text();
    const headers = new Headers(JSON_HEADERS);
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
    headers.set('Cache-Control', requestUrl.pathname === '/api/tmdb/search'
      ? 'public, max-age=300'
      : 'public, max-age=3600');

    return new Response(body, { status: 200, headers });
  };
}
