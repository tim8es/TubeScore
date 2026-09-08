import { describe, expect, it, vi } from 'vitest';
import {
  createTmdbProxyHandler,
  type TmdbProxyEnvironment
} from '../../src/proxy/tmdb-proxy';

const allowedOrigin = 'chrome-extension://abcdefghijklmnop';

function env(overrides: Partial<TmdbProxyEnvironment> = {}): TmdbProxyEnvironment {
  return {
    tmdbAccessToken: 'server-only-token',
    allowedOrigins: [allowedOrigin],
    ...overrides
  };
}

describe('TMDB production proxy', () => {
  it('fails closed without a server-side TMDB token and does not call upstream', async () => {
    const fetchFn = vi.fn();
    const handle = createTmdbProxyHandler({
      env: env({ tmdbAccessToken: undefined }),
      fetchFn
    });

    const response = await handle(new Request('https://proxy.example/api/tmdb/search?query=Dune', {
      headers: { Origin: allowedOrigin }
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'proxy_unconfigured' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects origins outside the configured extension allowlist without upstream traffic', async () => {
    const fetchFn = vi.fn();
    const handle = createTmdbProxyHandler({ env: env(), fetchFn });

    const response = await handle(new Request('https://proxy.example/api/tmdb/search?query=Dune', {
      headers: { Origin: 'https://example.com' }
    }));

    expect(response.status).toBe(403);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('allows preflight only for configured origins without contacting TMDB', async () => {
    const fetchFn = vi.fn();
    const handle = createTmdbProxyHandler({ env: env(), fetchFn });

    const response = await handle(new Request('https://proxy.example/api/tmdb/search', {
      method: 'OPTIONS',
      headers: { Origin: allowedOrigin }
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('forwards only an allowlisted search operation using the server token', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ results: [{ id: 1 }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    const handle = createTmdbProxyHandler({ env: env(), fetchFn });

    const response = await handle(new Request(
      'https://proxy.example/api/tmdb/search?query=Dune&language=en-US&page=1&include_adult=false&evil=drop-me',
      { headers: { Origin: allowedOrigin } }
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(fetchFn).toHaveBeenCalledOnce();

    const [input, init] = fetchFn.mock.calls[0]!;
    const upstream = new URL(String(input));
    expect(upstream.origin + upstream.pathname).toBe('https://api.themoviedb.org/3/search/multi');
    expect(upstream.searchParams.get('query')).toBe('Dune');
    expect(upstream.searchParams.get('language')).toBe('en-US');
    expect(upstream.searchParams.get('page')).toBe('1');
    expect(upstream.searchParams.get('include_adult')).toBe('false');
    expect(upstream.searchParams.has('evil')).toBe(false);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer server-only-token');
  });

  it('forwards only movie/tv detail operations with numeric ids', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ vote_average: 8.2 }), { status: 200 }));
    const handle = createTmdbProxyHandler({ env: env(), fetchFn });

    const response = await handle(new Request('https://proxy.example/api/tmdb/movie/693134?language=en-US', {
      headers: { Origin: allowedOrigin }
    }));

    expect(response.status).toBe(200);
    const [input] = fetchFn.mock.calls[0]!;
    expect(String(input)).toContain('/movie/693134');
  });

  it('rejects arbitrary upstream paths and malformed ids', async () => {
    const fetchFn = vi.fn();
    const handle = createTmdbProxyHandler({ env: env(), fetchFn });

    for (const path of ['/api/tmdb/person/1', '/api/tmdb/movie/not-a-number', '/api/tmdb/../../configuration']) {
      const response = await handle(new Request(`https://proxy.example${path}`, {
        headers: { Origin: allowedOrigin }
      }));
      expect(response.status).toBe(404);
    }

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects empty or oversized search queries before network access', async () => {
    const fetchFn = vi.fn();
    const handle = createTmdbProxyHandler({ env: env(), fetchFn });

    const empty = await handle(new Request('https://proxy.example/api/tmdb/search?query=', {
      headers: { Origin: allowedOrigin }
    }));
    const huge = await handle(new Request(`https://proxy.example/api/tmdb/search?query=${'a'.repeat(201)}`, {
      headers: { Origin: allowedOrigin }
    }));

    expect(empty.status).toBe(400);
    expect(huge.status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('normalizes upstream failures instead of leaking TMDB response bodies', async () => {
    const fetchFn = vi.fn(async () => new Response('upstream secret-ish diagnostics', { status: 401 }));
    const handle = createTmdbProxyHandler({ env: env(), fetchFn });

    const response = await handle(new Request('https://proxy.example/api/tmdb/search?query=Dune', {
      headers: { Origin: allowedOrigin }
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'upstream_error', status: 401 });
  });
});
