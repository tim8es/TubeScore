import { describe, expect, it, vi } from 'vitest';
import { createServerlessTmdbHandler } from '../../src/proxy/serverless-handler';

const origin = 'chrome-extension://abcdefghijklmnop';

describe('serverless TMDB proxy adapter', () => {
  it('reads only server runtime configuration and maps rewrite paths into the proxy core', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const handler = createServerlessTmdbHandler({
      runtimeEnv: {
        TMDB_ACCESS_TOKEN: 'server-runtime-value',
        TUBESCORE_ALLOWED_ORIGINS: origin
      },
      fetchFn
    });

    const response = await handler(new Request(
      'https://proxy.example/api/tmdb?__proxy_path=search&query=Dune',
      { headers: { Origin: origin } }
    ));

    expect(response.status).toBe(200);
    const [, init] = fetchFn.mock.calls[0]!;
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer server-runtime-value');
  });

  it('fails closed when deploy-time origin configuration is absent', async () => {
    const fetchFn = vi.fn();
    const handler = createServerlessTmdbHandler({
      runtimeEnv: { TMDB_ACCESS_TOKEN: 'server-runtime-value' },
      fetchFn
    });

    const response = await handler(new Request(
      'https://proxy.example/api/tmdb?__proxy_path=search&query=Dune',
      { headers: { Origin: origin } }
    ));

    expect(response.status).toBe(403);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
