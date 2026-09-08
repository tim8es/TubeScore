import { describe, expect, it, vi } from 'vitest';
import {
  TmdbProxyCatalogProvider,
  TmdbProxyRatingsProvider,
  normalizeTmdbProxyBaseUrl
} from '../../src/providers/tmdb/tmdb-proxy-provider';

const baseUrl = 'https://tubescore-proxy.example/api/tmdb';

describe('TMDB proxy-backed providers', () => {
  it('requires a credential-free HTTPS proxy base URL', () => {
    expect(normalizeTmdbProxyBaseUrl(`${baseUrl}/`)).toBe(baseUrl);
    expect(() => normalizeTmdbProxyBaseUrl('http://proxy.example/api/tmdb')).toThrow('invalid_proxy_base_url');
    expect(() => normalizeTmdbProxyBaseUrl('https://user:pass@proxy.example/api/tmdb')).toThrow('invalid_proxy_base_url');
  });

  it('searches through the proxy without an Authorization header', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      results: [{
        id: 693134,
        media_type: 'movie',
        title: 'Dune: Part Two',
        original_title: 'Dune: Part Two',
        release_date: '2024-02-27'
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const provider = new TmdbProxyCatalogProvider({ baseUrl, fetchFn });
    const result = await provider.search('Dune Part Two');

    expect(result[0]?.providerId).toBe('693134');
    const [input, init] = fetchFn.mock.calls[0]!;
    expect(String(input)).toContain('/api/tmdb/search?');
    expect(new Headers(init?.headers).has('authorization')).toBe(false);
  });

  it('loads ratings through the proxy without a reusable credential', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      vote_average: 8.4,
      vote_count: 6200
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const provider = new TmdbProxyRatingsProvider({ baseUrl, fetchFn });
    const rating = await provider.getRating({
      providerId: '693134',
      mediaType: 'movie',
      title: 'Dune: Part Two'
    });

    expect(rating).toEqual({ source: 'TMDB', value: 8.4, scale: 10, voteCount: 6200 });
    const [, init] = fetchFn.mock.calls[0]!;
    expect(new Headers(init?.headers).has('authorization')).toBe(false);
  });
});
